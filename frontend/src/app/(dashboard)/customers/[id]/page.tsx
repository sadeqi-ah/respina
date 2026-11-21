import { notFound } from "next/navigation";
import { Suspense } from "react";

import { LoadingState } from "@/components/states/LoadingState";
import { CustomerDetailView } from "@/features/customers/components/CustomerDetailView";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Only a plain positive id ever reaches the API; /customers/abc is a 404 right here.
  if (!/^[1-9][0-9]{0,9}$/.test(id)) notFound();
  return (
    // useSearchParams() (tab and filters in the URL) needs a Suspense boundary.
    <Suspense fallback={<LoadingState />}>
      <CustomerDetailView id={Number(id)} />
    </Suspense>
  );
}
