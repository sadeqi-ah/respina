import { NewCustomerRouteSkeleton } from "@/features/customers/components/PageSkeletons";

// Swaps the list for the form's skeleton as soon as "New customer" is followed, inside the shell.
export default function Loading() {
  return <NewCustomerRouteSkeleton />;
}
