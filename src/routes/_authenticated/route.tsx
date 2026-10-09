import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { Receipt, FileText, Settings as SettingsIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: AppLayout,
});

const tabs = [
  { to: "/bills", label: "חשבונות", icon: Receipt },
  { to: "/contracts", label: "דיירים וחוזים", icon: FileText },
  { to: "/settings", label: "הגדרות", icon: SettingsIcon },
] as const;

function AppLayout() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <main className="mx-auto max-w-2xl px-4 pt-5">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl">
          {tabs.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="flex flex-1 flex-col items-center gap-1 py-3 text-xs text-muted-foreground"
              activeProps={{ className: "text-primary font-semibold" }}
            >
              <t.icon className="h-5 w-5" />
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
