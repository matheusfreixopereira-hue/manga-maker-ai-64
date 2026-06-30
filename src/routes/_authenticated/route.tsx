import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Plus, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState<string>(user.email ?? "");

  useEffect(() => {
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.display_name) setDisplayName(data.display_name);
    });
  }, [user.id]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b-2 border-ink/90 bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center bg-ink text-paper">
                <span className="font-display leading-none">墨</span>
              </div>
              <span className="font-display text-xl">TINTA</span>
            </Link>
            <nav className="hidden gap-1 md:flex">
              <Link
                to="/dashboard"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium hover:text-accent [&.active]:text-accent"
                activeProps={{ className: "active" }}
              >
                <LayoutDashboard className="h-4 w-4" /> Projetos
              </Link>
              <Link
                to="/projects/new"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium hover:text-accent [&.active]:text-accent"
                activeProps={{ className: "active" }}
              >
                <Plus className="h-4 w-4" /> Novo mangá
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{displayName}</span>
            <button
              onClick={signOut}
              className="flex items-center gap-2 border-2 border-ink bg-card px-3 py-2 text-sm hover:bg-muted"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
