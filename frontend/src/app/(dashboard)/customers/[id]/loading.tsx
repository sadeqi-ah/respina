import { CustomerRouteSkeleton } from "@/features/customers/components/PageSkeletons";

// Shown as soon as a customer's link is followed, inside the dashboard shell (which already has the
// name when the customer is cached): the open tab's skeleton.
export default function Loading() {
  return <CustomerRouteSkeleton />;
}
