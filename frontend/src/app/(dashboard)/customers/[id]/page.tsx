import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CustomerDetailView } from "@/features/customers/components/CustomerDetailView";
import { CustomerPageSkeleton } from "@/features/customers/components/PageSkeletons";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomerPage({ params, searchParams }: Props) {
  const { id } = await params;
  // Only a plain positive id ever reaches the API; /customers/abc is a 404 right here.
  if (!/^[1-9][0-9]{0,9}$/.test(id)) notFound();
  const { tab } = await searchParams;
  return (
    // useSearchParams() (tab and filters in the URL) needs a Suspense boundary. Its fallback is the
    // open tab's skeleton, inside the dashboard layout's shell.
    <Suspense fallback={<CustomerPageSkeleton tab={tab === "details" ? "details" : "services"} />}>
      <CustomerDetailView id={Number(id)} />
    </Suspense>
  );
}
