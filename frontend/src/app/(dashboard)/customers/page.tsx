import { Suspense } from "react";

import { LoadingState } from "@/components/states/LoadingState";
import { CustomersView } from "@/features/customers/components/CustomersView";

// useSearchParams() (URL list state) needs a Suspense boundary.
export default function CustomersPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CustomersView />
    </Suspense>
  );
}
