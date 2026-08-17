import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

import { BrandMark } from "@/components/brand-mark";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { benchNavSections, navSections } from "@/lib/nav";
import { useCurrentStaff } from "@/hooks/use-current-staff";

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const staff = useCurrentStaff();
  const isAdmin = staff.data?.role === "admin";
  const isJudge = staff.data?.role === "judge";
  const sections = (isJudge ? benchNavSections : navSections)
    .map((section) => ({ ...section, items: section.items.filter((i) => !i.adminOnly || isAdmin) }))
    .filter((section) => section.items.length > 0);

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div
          className={cn(
            "flex items-center py-2.5",
            collapsed ? "justify-center px-0" : "gap-3 px-1",
          )}
        >
          <BrandMark
            className={cn(
              "bg-sidebar-foreground p-1 transition-all duration-200",
              collapsed ? "size-8" : "size-10",
            )}
            showLabel
          />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">NyayaSetu</p>
              <p className="truncate text-[11px] tracking-wide text-sidebar-foreground/60 uppercase">
                Court Scheduling
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.label} className="py-3">
            <SidebarGroupLabel className="text-[11px] tracking-[0.12em] text-sidebar-foreground/50 uppercase">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild tooltip={item.title} isActive={pathname === item.to}>
                      <Link
                        to={item.to}
                        className="flex items-center gap-2"
                        onClick={() => {
                          if (isMobile) {
                            setOpenMobile(false);
                          }
                        }}
                      >
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && (
          <p className="px-2 py-1 text-[11px] text-sidebar-foreground/50">
            Internal NyayaSetu workspace
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
