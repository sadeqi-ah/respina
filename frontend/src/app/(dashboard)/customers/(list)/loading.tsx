import { CustomersRouteSkeleton } from "@/features/customers/components/PageSkeletons";

// The list's own loading UI, inside the dashboard shell. In the (list) group so that it wraps only
// this page: a loading.tsx in customers/ would also stand in for /customers/new and a customer's page.
export default function Loading() {
  return <CustomersRouteSkeleton />;
}
