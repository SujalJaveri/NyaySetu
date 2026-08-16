import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BrandMark } from "@/components/brand-mark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentStaff, roleLabel } from "@/hooks/use-current-staff";
import { NotificationsBell } from "@/components/notifications-bell";
import { AssistantPanel } from "@/components/assistant-panel";

export function TopBar() {
  const { data: staff } = useCurrentStaff();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const initials =
    staff?.fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "—";

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-20 flex h-13 items-center gap-2 border-b border-border bg-card/95 px-3 backdrop-blur-sm sm:px-5">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
      <div className="hidden min-w-0 items-center gap-2 sm:flex">
        <BrandMark className="size-8 p-0.5" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">NyaySetu Registry</p>
          <p className="text-[11px] text-muted-foreground">AI powered court scheduling control</p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {staff?.role !== "judge" && (
          <>
            <AssistantPanel />
            <NotificationsBell />
          </>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-sm px-1.5 py-1 transition-colors hover:bg-muted">
              <span className="flex size-8 items-center justify-center rounded-sm bg-primary text-xs font-semibold text-primary-foreground">
                {initials}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-medium text-foreground">
                  {staff?.fullName ?? "Loading…"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {staff ? roleLabel[staff.role] : ""}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-sm font-medium">{staff?.fullName}</span>
              <span className="block text-xs text-muted-foreground">{staff?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
