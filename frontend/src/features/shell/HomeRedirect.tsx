"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useMe } from "@/features/auth/queries";
import { CustomerPageSkeleton, CustomersPageSkeleton } from "@/features/customers/components/PageSkeletons";
import { homePath } from "@/lib/session-claims";

/**
 * "/" when the server could not tell the role (no access token, only a refresh token): asks the
 * API who this is, then goes home. Meanwhile, the skeleton of where it goes.
 */
export function HomeRedirect() {
  const router = useRouter();
  const { data: me } = useMe();

  useEffect(() => {
    if (me) router.replace(homePath(me));
  }, [me, router]);

  return me?.role === "customer" && me.customer_id ? (
    <CustomerPageSkeleton id={me.customer_id} />
  ) : (
    <CustomersPageSkeleton />
  );
}
