import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LocaleSwitcher } from "@/features/auth/LocaleSwitcher";
import { LoginForm } from "@/features/auth/LoginForm";
import { ThemeToggle } from "@/features/theme/ThemeToggle";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("title") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await getTranslations();
  const next = (await searchParams).next;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-muted p-4">
      <div className="flex w-full max-w-sm justify-end gap-1">
        <ThemeToggle variant="page" />
        <LocaleSwitcher />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{t("auth.title")}</CardTitle>
          <CardDescription>
            {t("common.appName")} · {t("auth.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={typeof next === "string" ? next : null} />
        </CardContent>
      </Card>
    </main>
  );
}
