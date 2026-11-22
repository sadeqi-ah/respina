"use client";

import { IdCard, User as UserIcon } from "@duo-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition, type ComponentProps, type ReactNode } from "react";

import {
  DashboardButton,
  DashboardMenu,
  DashboardMenuContent,
  DashboardMenuItem,
  DashboardMenuLabel,
  DashboardMenuRadioGroup,
  DashboardMenuRadioItem,
  DashboardMenuSeparator,
  DashboardMenuTrigger,
  DashboardShell,
  type DashboardShellNavSection,
} from "@/components/block/dashboard-shell";
import { useMe } from "@/features/auth/queries";
import { setLocale } from "@/i18n/actions";
import { ThemeMenuGroup } from "@/features/theme/ThemeMenuGroup";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { locales } from "@/i18n/config";
import { cn } from "@/lib/utils";

type ShellProps = Omit<
  ComponentProps<typeof DashboardShell>,
  "brand" | "navigation" | "linkComponent" | "activeItemId"
>;

/** The Obsidian Dashboard Shell with our brand, role-based navigation and user menu. */
export function AppShell({ headerActions, className, ...props }: ShellProps & { headerActions?: ReactNode }) {
  const t = useTranslations();
  const pathname = usePathname();
  const { data: me } = useMe();

  const navigation: DashboardShellNavSection[] = [
    {
      id: "main",
      items:
        me?.role === "customer" && me.customer_id
          ? [
              {
                id: "account",
                label: t("nav.myAccount"),
                icon: UserIcon,
                href: `/customers/${me.customer_id}`,
              },
            ]
          : [{ id: "customers", label: t("nav.customers"), icon: IdCard, href: "/customers" }],
    },
  ];
  const activeItemId =
    me?.role === "customer" ? "account" : pathname.startsWith("/customers") ? "customers" : "";

  return (
    <DashboardShell
      {...props}
      // The shell scrolls its content area itself, so it needs a definite height: <body> only has
      // min-h-full, which would let h-full resolve to auto and the whole page scroll instead.
      // dvh follows the mobile browser's collapsing URL bar.
      className={cn("h-dvh", className)}
      brand={{ name: t("common.appName"), description: me ? t(`common.roles.${me.role}`) : undefined }}
      navigation={navigation}
      activeItemId={activeItemId}
      linkComponent={Link}
      navigationLabel={t("common.navigation")}
      labels={{
        openNavigation: t("common.openNavigation"),
        closeNavigation: t("common.closeNavigation"),
        resizeSidebar: t("common.resizeSidebar"),
      }}
      headerActions={
        <>
          {headerActions}
          <ThemeToggle variant="shell" />
          <UserMenu email={me?.email} />
        </>
      }
    />
  );
}

function UserMenu({ email }: { email?: string }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();

  const changeLocale = (next: string) =>
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });

  const signOut = () =>
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST", headers: { "X-Requested-With": "fetch" } });
      queryClient.clear(); // no cached data from this session survives
      router.replace("/login");
      router.refresh();
    });

  return (
    <DashboardMenu>
      <DashboardMenuTrigger asChild>
        <DashboardButton variant="secondary" size="icon" aria-label={t("account")} disabled={pending}>
          <UserIcon aria-hidden />
        </DashboardButton>
      </DashboardMenuTrigger>
      <DashboardMenuContent align="end" className="min-w-56">
        {email && (
          // normal-case: menu labels are uppercase section headings, but an email must stay as typed.
          <DashboardMenuLabel className="tracking-normal normal-case">
            {t("signedInAs")} <bdi dir="ltr">{email}</bdi>
          </DashboardMenuLabel>
        )}
        <DashboardMenuSeparator />
        <DashboardMenuLabel>{t("language")}</DashboardMenuLabel>
        <DashboardMenuRadioGroup value={locale} onValueChange={changeLocale}>
          {locales.map((l) => (
            <DashboardMenuRadioItem key={l} value={l} lang={l}>
              {t(`languages.${l}`)}
            </DashboardMenuRadioItem>
          ))}
        </DashboardMenuRadioGroup>
        <DashboardMenuSeparator />
        <ThemeMenuGroup />
        <DashboardMenuSeparator />
        <DashboardMenuItem onSelect={signOut}>
          <LogOut aria-hidden className="rtl:-scale-x-100" />
          {t("signOut")}
        </DashboardMenuItem>
      </DashboardMenuContent>
    </DashboardMenu>
  );
}
