"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { LoadingState } from "@/components/states/LoadingState";
import { useMe } from "@/features/auth/queries";

/** Staff → customer list; a customer → their own record. */
export default function Home() {
  const router = useRouter();
  const { data: me } = useMe();

  useEffect(() => {
    if (!me) return;
    router.replace(me.role === "staff" || !me.customer_id ? "/customers" : `/customers/${me.customer_id}`);
  }, [me, router]);

  return <LoadingState />;
}
