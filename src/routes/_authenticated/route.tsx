import { useEffect } from "react";
import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";
import { useCurrentStaff } from "@/hooks/use-current-staff";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
    return { user: session.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  // Tablet widths start with the rail collapsed so content keeps a usable measure.
  const defaultOpen = typeof window === "undefined" ? true : window.innerWidth >= 1024;
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <BenchScopeGuard />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1">
            <div key={pathname} className="registry-enter">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

/**
 * Bench (judge) accounts only ever work inside /bench. Row-level security is the
 * real boundary — every registry table filters to their own listings — this simply
 * keeps them from landing on a screen that would render empty.
 */
function BenchScopeGuard() {
  const staff = useCurrentStaff();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    if (staff.data?.role === "judge" && pathname !== "/bench") {
      navigate({ to: "/bench", replace: true });
    }
  }, [staff.data?.role, pathname, navigate]);

  return null;
}
