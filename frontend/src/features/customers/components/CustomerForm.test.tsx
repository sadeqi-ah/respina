import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";
import { renderWithProviders } from "@/test/render";
import { api, server } from "@/test/server";

import { CustomerForm } from "./CustomerForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(en.customers.form.firstName), "Sara");
  await user.type(screen.getByLabelText(en.customers.form.lastName), "Ahmadi");
  await user.type(screen.getByLabelText(en.customers.form.email), "Customer1@Example.com");
  await user.type(screen.getByLabelText(en.customers.form.phone), "0912 123 4567");
  await user.click(screen.getByRole("button", { name: en.customers.form.submit }));
}

describe("CustomerForm", () => {
  beforeEach(() => push.mockReset());

  it("puts Django's field errors under their inputs and focuses the first", async () => {
    server.use(
      http.post(api("customers"), () =>
        HttpResponse.json(
          {
            error: {
              code: "validation_error",
              message: "Invalid input.",
              details: {
                email: [{ code: "unique", message: "A customer with this email already exists." }],
                phone: [{ code: "unique", message: "A customer with this phone number already exists." }],
              },
              request_id: "req-1",
            },
          },
          { status: 400 },
        ),
      ),
    );
    renderWithProviders(<CustomerForm />);
    await fillAndSubmit();

    const email = screen.getByLabelText(en.customers.form.email);
    await waitFor(() => expect(email).toHaveFocus());
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription(en.validation.unique);
    expect(screen.getByLabelText(en.customers.form.phone)).toHaveAccessibleDescription(en.validation.unique);
    expect(screen.getByText(en.errors.validation_error)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a form-level message for errors that belong to no field", async () => {
    server.use(
      http.post(api("customers"), () =>
        HttpResponse.json(
          { error: { code: "permission_denied", message: "Nope.", request_id: "req-2" } },
          { status: 403 },
        ),
      ),
    );
    renderWithProviders(<CustomerForm />);
    await fillAndSubmit();
    expect(await screen.findByText(en.errors.permission_denied)).toBeInTheDocument();
  });

  it("sends trimmed values and goes to the new customer on success", async () => {
    let body: unknown;
    server.use(
      http.post(api("customers"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          {
            id: 42,
            full_name: "Sara Ahmadi",
            first_name: "Sara",
            last_name: "Ahmadi",
            email: "x",
            phone: "x",
            services_count: 0,
            created_at: "2026-11-21T00:00:00Z",
          },
          { status: 201 },
        );
      }),
    );
    renderWithProviders(<CustomerForm />);
    await fillAndSubmit();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/customers/42"));
    expect(body).toEqual({
      first_name: "Sara",
      last_name: "Ahmadi",
      email: "Customer1@Example.com",
      phone: "0912 123 4567",
    });
    expect(await screen.findByText("Sara Ahmadi was added")).toBeInTheDocument();
  });
});
