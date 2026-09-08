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
import { AssistantPanel } from "@/components/assistant-panel";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { LanguageProvider } from "@/lib/i18n";
import { getOfflineStaffSession } from "@/lib/offline-auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    let session = null;
    try {
      const res = await supabase.auth.getSession();
      session = res.data.session;
    } catch {
      // Supabase network request failed or device is offline
    }

    if (session) {
      return { user: session.user };
    }

    const offlineUser = getOfflineStaffSession();
    if (offlineUser) {
      return {
        user: {
          id: offlineUser.id,
          email: offlineUser.email,
          user_metadata: { full_name: offlineUser.fullName },
        },
      };
    }

    throw redirect({ to: "/auth" });
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { data: staff } = useCurrentStaff();
  // Tablet widths start with the rail collapsed so content keeps a usable measure.
  const defaultOpen = typeof window === "undefined" ? true : window.innerWidth >= 1024;
  return (
    <LanguageProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />
          <BenchScopeGuard />
          <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
            <TopBar />
            <main className="flex-1 min-w-0 w-full">
              <div key={pathname} className="registry-enter min-w-0 w-full">
                <Outlet />
              </div>
            </main>
          </div>
          {staff?.role !== "judge" && <AssistantPanel />}
        </div>
      </SidebarProvider>
    </LanguageProvider>
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
