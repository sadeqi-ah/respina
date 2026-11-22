import { Suspense } from "react";

import { CustomersPageSkeleton } from "@/features/customers/components/PageSkeletons";
import { CustomersView } from "@/features/customers/components/CustomersView";
import { parseListParams } from "@/features/customers/params";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// useSearchParams() (URL list state) needs a Suspense boundary. Its fallback is the list's own
// skeleton, inside the dashboard layout's shell.
export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = parseListParams(toURLSearchParams(await searchParams));
  return (
    <Suspense fallback={<CustomersPageSkeleton params={params} />}>
      <CustomersView />
    </Suspense>
  );
}

function toURLSearchParams(record: Awaited<SearchParams>): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) if (typeof value === "string") query.set(key, value);
  return query;
}
