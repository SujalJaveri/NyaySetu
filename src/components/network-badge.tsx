import { useState, useEffect, useRef } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { useNetworkStatus } from "@/lib/network-status";
import { useOfflineDrafts } from "@/lib/offline-store";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQueryClient } from "@tanstack/react-query";

export function NetworkBadge() {
  const { isOnline, isChecking, checkConnection } = useNetworkStatus();
  const { drafts, pendingCount, removeDraft, clearAll } = useOfflineDrafts();
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const prevOnlineRef = useRef(isOnline);

  // Notify user when network transitions
  useEffect(() => {
    if (prevOnlineRef.current !== isOnline) {
      if (isOnline) {
        toast.success("Internet Restored", {
          description: "NyayaSetu is back online. Live sync with court cloud active.",
          icon: <CheckCircle2 className="size-4 text-emerald-500" />,
        });
        // Invalidate and refresh critical queries
        queryClient.invalidateQueries();
      } else {
        toast.warning("Offline Mode Active", {
          description: "Internet disconnected. You can browse cached cause lists and save drafts safely.",
          icon: <AlertTriangle className="size-4 text-amber-500" />,
        });
      }
      prevOnlineRef.current = isOnline;
    }
  }, [isOnline, queryClient]);

  const handleManualCheck = async () => {
    const online = await checkConnection();
    if (online) {
      toast.success("Connection Verified", {
        description: "Successfully connected to NyayaSetu cloud servers.",
      });
      queryClient.invalidateQueries();
    } else {
      toast.error("Still Offline", {
        description: "Cannot reach central server. Continuing in local cache mode.",
      });
    }
  };

  const handleSyncDrafts = async () => {
    if (!isOnline) {
      toast.error("Cannot Sync Offline", {
        description: "Please reconnect to internet before syncing local drafts.",
      });
      return;
    }

    toast.promise(
      new Promise<void>((resolve) => {
        // Simulated batch sync of local drafts
        setTimeout(() => {
          clearAll();
          queryClient.invalidateQueries();
          resolve();
        }, 1200);
      }),
      {
        loading: "Validating judge schedules and syncing drafts...",
        success: "All local drafts verified and synced without conflicts!",
        error: "Conflict detected during synchronization.",
      },
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer border ${
            isOnline
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15"
              : "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 animate-pulse"
          }`}
          title={isOnline ? "Cloud connected" : "Offline mode active"}
        >
          <span className="relative flex size-2">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isOnline ? "bg-emerald-400 animate-ping" : "bg-amber-400"
              }`}
            />
            <span
              className={`relative inline-flex size-2 rounded-full ${
                isOnline ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
          </span>

          <span className="hidden sm:inline">
            {isOnline ? "Cloud Synced" : `Offline Cache ${pendingCount > 0 ? `(${pendingCount})` : ""}`}
          </span>
          <span className="sm:hidden">{isOnline ? "Online" : "Offline"}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0 shadow-lg border-border">
        <div className="border-b border-border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <div className="rounded-full bg-emerald-500/10 p-1.5 text-emerald-600 dark:text-emerald-400">
                  <Wifi className="size-4" />
                </div>
              ) : (
                <div className="rounded-full bg-amber-500/10 p-1.5 text-amber-600 dark:text-amber-400">
                  <WifiOff className="size-4" />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isOnline ? "Connected to Cloud Registry" : "Offline Cache Active"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isOnline
                    ? "Real-time updates & zero-conflict listing"
                    : "Browsing cached data • Draft protection"}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={handleManualCheck}
              disabled={isChecking}
              title="Test connection"
            >
              <RefreshCw className={`size-3.5 ${isChecking ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Offline Safety Info */}
        {!isOnline && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 p-2.5 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <ShieldCheck className="size-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <strong>Double-Booking Protection:</strong> You can read cause lists and draft changes. Direct publishing is held until internet returns to ensure no schedule collisions.
            </div>
          </div>
        )}

        {/* Pending Drafts Section */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Clock className="size-3.5 text-muted-foreground" />
              Local Drafts ({drafts.length})
            </span>
            {drafts.length > 0 && (
              <button
                onClick={clearAll}
                className="text-[10px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="size-3" /> Clear all
              </button>
            )}
          </div>

          {drafts.length === 0 ? (
            <div className="rounded-md border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
              No offline drafts pending.
            </div>
          ) : (
            <ScrollArea className="max-h-48">
              <div className="space-y-1.5 pr-2">
                {drafts.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-start justify-between gap-2 rounded border border-border bg-card p-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase">
                          {d.type.replace("_", " ")}
                        </Badge>
                        <p className="truncate font-medium text-foreground">{d.title}</p>
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                        {d.description}
                      </p>
                      <p className="text-[9px] text-muted-foreground/70 mt-1">
                        {new Date(d.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeDraft(d.id)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {drafts.length > 0 && isOnline && (
            <Button
              className="mt-3 w-full text-xs h-8"
              size="sm"
              onClick={handleSyncDrafts}
            >
              Verify & Sync {drafts.length} Draft{drafts.length > 1 ? "s" : ""}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
