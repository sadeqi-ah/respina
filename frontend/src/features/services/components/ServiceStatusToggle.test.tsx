import { QueryClient } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import { renderWithProviders } from "@/test/render";
import { api, server } from "@/test/server";
import type { Page, Service } from "@/types/api";

import type { ServiceFilters } from "../params";
import { serviceKeys } from "../queries";
import { ServiceStatusToggle } from "./ServiceStatusToggle";

const service: Service = {
  id: 7,
  customer_id: 3,
  name: "web-1",
  service_type: "vps",
  service_type_display: "VPS",
  status: "active",
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};
const filters: ServiceFilters = { status: null, type: null, page: 1 };
const page = (status: Service["status"]): Page<Service> => ({
  count: 1,
  page: 1,
  page_size: 20,
  total_pages: 1,
  results: [{ ...service, status }],
});

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(serviceKeys.list(3, filters), page("active"));
  const key = serviceKeys.list(3, filters);
  const cached = () => queryClient.getQueryData<Page<Service>>(key)!.results[0].status;
  // onSettled marks every list stale; only lists on screen refetch (none here), so the rollback stays visible.
  const invalidated = () => queryClient.getQueryState(key)!.isInvalidated;
  renderWithProviders(<ServiceStatusToggle service={service} onOpenChange={() => {}} />, { queryClient });
  return { cached, invalidated };
}

/** A response the test releases by hand, to look at the state while the request is in flight. */
function deferred() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  return { gate, release };
}

describe("ServiceStatusToggle", () => {
  it("shows the new status at once, then rolls back and explains a 409", async () => {
    const { gate, release } = deferred();
    let posted: unknown;
    server.use(
      http.post(api("services/7/status"), async ({ request }) => {
        posted = await request.json();
        await gate;
        return HttpResponse.json(
          { error: { code: "invalid_status_transition", message: "Cannot change.", request_id: "r" } },
          { status: 409 },
        );
      }),
    );
    const { cached, invalidated } = setup();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(en.services.statusChange.reason), "  unpaid  ");
    await user.click(screen.getByRole("button", { name: en.services.suspend }));

    await waitFor(() => expect(cached()).toBe("suspended")); // optimistic, request still pending
    expect(posted).toEqual({ status: "suspended", reason: "unpaid" });

    release();
    expect(await screen.findByText("Couldn't change the status of web-1")).toBeInTheDocument();
    expect(screen.getByText(en.errors.invalid_status_transition)).toBeInTheDocument();
    expect(cached()).toBe("active"); // rolled back
    await waitFor(() => expect(invalidated()).toBe(true)); // and queued for the server's truth
  });

  it("restores the old status when the request fails outright", async () => {
    server.use(http.post(api("services/7/status"), () => HttpResponse.error()));
    const { cached } = setup();
    await userEvent.setup().click(screen.getByRole("button", { name: en.services.suspend }));

    expect(await screen.findByText(en.errors.network_error)).toBeInTheDocument();
    expect(cached()).toBe("active");
  });
});
