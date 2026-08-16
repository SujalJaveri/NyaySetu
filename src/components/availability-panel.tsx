import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import {
  availabilityQuery,
  clearDayAvailability,
  ensureSlotsForDate,
  entityAvailabilityQuery,
  formatTimeRange,
  hearingSlotsByDateQuery,
  setDayAvailability,
  setSlotAvailability,
  toDateKey,
  type AvailabilityStatus,
  type EntityType,
} from "@/lib/availability";

export function AvailabilityPanel({
  entityType,
  entityId,
  entityName,
}: {
  entityType: EntityType;
  entityId: string;
  entityName: string;
}) {
  const queryClient = useQueryClient();
  const staff = useCurrentStaff();
  const canEdit = staff.data?.role === "admin" || staff.data?.role === "registrar";

  const [selected, setSelected] = useState<Date>(() => new Date());
  const dateKey = toDateKey(selected);

  const slots = useQuery(hearingSlotsByDateQuery(dateKey));
  const availability = useQuery(availabilityQuery(entityType, entityId, dateKey));
  const allAvailability = useQuery(entityAvailabilityQuery(entityType, entityId));

  const statusBySlot = useMemo(() => {
    const map = new Map<string, AvailabilityStatus>();
    for (const row of availability.data ?? []) map.set(row.slot_id, row.status);
    return map;
  }, [availability.data]);

  const markedDays = useMemo(() => {
    const unavailable = new Set<string>();
    const available = new Set<string>();
    for (const row of allAvailability.data ?? []) {
      (row.status === "unavailable" ? unavailable : available).add(row.date);
    }
    const toDates = (set: Set<string>) => [...set].map((d) => new Date(`${d}T00:00:00`));
    return {
      unavailable: toDates(unavailable),
      available: toDates(available).filter((d) => !unavailable.has(toDateKey(d))),
    };
  }, [allAvailability.data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["availability", entityType, entityId] });
    queryClient.invalidateQueries({ queryKey: ["hearing-slots", dateKey] });
  };

  const toggleSlot = useMutation({
    mutationFn: async (vars: { slotId: string; status: AvailabilityStatus }) =>
      setSlotAvailability({
        entityType,
        entityId,
        date: dateKey,
        slotId: vars.slotId,
        status: vars.status,
      }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const bulk = useMutation({
    mutationFn: async (status: AvailabilityStatus | "clear") => {
      const slotIds = (slots.data ?? []).map((s) => s.id);
      if (status === "clear") return clearDayAvailability({ entityType, entityId, date: dateKey });
      return setDayAvailability({ entityType, entityId, date: dateKey, slotIds, status });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Day updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createSlots = useMutation({
    mutationFn: async () => ensureSlotsForDate(dateKey),
    onSuccess: () => {
      invalidate();
      toast.success("Hearing slots created for this date.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const dayList = slots.data ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
      <Card className="w-fit">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Select a date</CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => d && setSelected(d)}
            modifiers={{
              hasUnavailable: markedDays.unavailable,
              hasAvailable: markedDays.available,
            }}
            modifiersClassNames={{
              hasUnavailable: "font-semibold text-destructive",
              hasAvailable: "font-semibold text-emerald-600 dark:text-emerald-400",
            }}
            className={cn("pointer-events-auto p-3")}
          />
          <div className="mt-2 flex flex-wrap gap-3 px-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" /> Available marked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-destructive" /> Unavailable marked
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0 gap-3">
          <div>
            <CardTitle className="text-base">
              Hearing slots ·{" "}
              {selected.toLocaleDateString(undefined, {
                weekday: "long",
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Toggle each slot for {entityName}. Slots with no record are treated as available by
              the scheduler.
            </p>
          </div>
          {canEdit && dayList.length > 0 && (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={bulk.isPending}
                onClick={() => bulk.mutate("available")}
              >
                All available
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={bulk.isPending}
                onClick={() => bulk.mutate("unavailable")}
              >
                All unavailable
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={bulk.isPending}
                onClick={() => bulk.mutate("clear")}
              >
                Clear
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {slots.isError || availability.isError ? (
            <ErrorState
              title="Could not load availability"
              error={slots.error ?? availability.error}
              onRetry={() => {
                void slots.refetch();
                void availability.refetch();
              }}
              retrying={slots.isFetching || availability.isFetching}
            />
          ) : slots.isLoading || availability.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : dayList.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
              <span className="mx-auto flex size-11 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <CalendarPlus className="size-5" />
              </span>
              <p className="mt-4 text-sm font-semibold text-foreground">
                No hearing slots on this date
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                Create the standard sitting grid (09:30–12:30 and 14:00–17:00) to start marking
                availability.
              </p>
              {canEdit && (
                <Button
                  className="mt-4"
                  size="sm"
                  disabled={createSlots.isPending}
                  onClick={() => createSlots.mutate()}
                >
                  {createSlots.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CalendarPlus className="size-4" />
                  )}
                  Create standard slots
                </Button>
              )}
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {dayList.map((slot) => {
                const status = statusBySlot.get(slot.id);
                const unavailable = status === "unavailable";
                const available = status === "available";
                return (
                  <li
                    key={slot.id}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
                      unavailable && "border-destructive/40 bg-destructive/10",
                      available && "border-emerald-600/40 bg-emerald-500/10",
                      !status && "border-border bg-muted/40",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium tabular-nums text-foreground">
                        {formatTimeRange(slot)}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "mt-1 border-transparent text-[11px]",
                          unavailable && "bg-destructive/15 text-destructive",
                          available && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                          !status && "bg-muted text-muted-foreground",
                        )}
                      >
                        {unavailable ? "Unavailable" : available ? "Available" : "Not set"}
                      </Badge>
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="icon"
                          variant={available ? "default" : "outline"}
                          aria-label={`Mark ${formatTimeRange(slot)} available`}
                          disabled={toggleSlot.isPending}
                          onClick={() =>
                            toggleSlot.mutate({ slotId: slot.id, status: "available" })
                          }
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant={unavailable ? "destructive" : "outline"}
                          aria-label={`Mark ${formatTimeRange(slot)} unavailable`}
                          disabled={toggleSlot.isPending}
                          onClick={() =>
                            toggleSlot.mutate({ slotId: slot.id, status: "unavailable" })
                          }
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
