import { QueryClient } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { meQueryKey } from "@/features/auth/queries";
import en from "@/messages/en.json";
import fa from "@/messages/fa.json";
import { renderWithProviders } from "@/test/render";
import type { Me } from "@/types/api";

import { BackToCustomersLink } from "./BackToCustomersLink";

let search = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));

const staff: Me = { id: 1, email: "admin@example.com", role: "staff", customer_id: null };
const customer: Me = { id: 2, email: "customer1@example.com", role: "customer", customer_id: 5 };

function renderAs(me: Me, locale: "en" | "fa" = "en") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  queryClient.setQueryData(meQueryKey, me);
  return renderWithProviders(<BackToCustomersLink />, { queryClient, locale });
}

describe("BackToCustomersLink", () => {
  beforeEach(() => {
    search = "";
  });

  it("returns staff to the list view they came from", () => {
    search = `from=${encodeURIComponent("/customers?search=ali&page=2")}`;
    renderAs(staff);
    const link = screen.getByRole("link", { name: en.customers.backToList });
    expect(link).toHaveAttribute("href", "/customers?search=ali&page=2");
    expect(link).toHaveTextContent(en.nav.customers);
  });

  it("falls back to the plain list for a foreign ?from=", () => {
    search = `from=${encodeURIComponent("//evil.com/customers")}`;
    renderAs(staff);
    expect(screen.getByRole("link", { name: en.customers.backToList })).toHaveAttribute("href", "/customers");
  });

  it("is translated", () => {
    renderAs(staff, "fa");
    expect(screen.getByRole("link", { name: fa.customers.backToList })).toHaveTextContent(fa.nav.customers);
  });

  it("is not shown to customers, who have no list", () => {
    renderAs(customer);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
