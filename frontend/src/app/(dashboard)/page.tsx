"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { CustomerPageSkeleton, CustomersPageSkeleton } from "@/features/customers/components/PageSkeletons";
import { useMe } from "@/features/auth/queries";

/** Staff → customer list; a customer → their own record. Meanwhile, the skeleton of where it goes. */
export default function Home() {
  const router = useRouter();
  const { data: me } = useMe();
  const isCustomer = me?.role === "customer" && !!me.customer_id;

  useEffect(() => {
    if (!me) return;
    router.replace(isCustomer ? `/customers/${me.customer_id}` : "/customers");
  }, [isCustomer, me, router]);

  return isCustomer ? <CustomerPageSkeleton id={me.customer_id!} /> : <CustomersPageSkeleton />;
}
