import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DoorOpen, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-shell";
import { AllocationBadge } from "@/components/registry-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { recordAudit } from "@/lib/audit";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { countBy, courtroomsQuery, isActive, schedulesQuery, type Courtroom } from "@/lib/registry";

export const Route = createFileRoute("/_authenticated/courtrooms/")({
  head: () => ({
    meta: [
      { title: "Courtrooms — NyayaSetu" },
      {
        name: "description",
        content: "Courtroom inventory with capacity, type and current allocation status.",
      },
      { property: "og:title", content: "Courtrooms — NyayaSetu" },
      {
        property: "og:description",
        content: "Courtroom inventory with capacity, type and current allocation status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CourtroomsPage,
});

function CourtroomsPage() {
  const queryClient = useQueryClient();
  const { data: staff } = useCurrentStaff();
  const isAdmin = staff?.role === "admin";

  const courtrooms = useQuery(courtroomsQuery);
  const schedules = useQuery(schedulesQuery);

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Courtroom | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [capacity, setCapacity] = useState("0");
  const [allocation, setAllocation] = useState("0");
  const [deleting, setDeleting] = useState<Courtroom | null>(null);

  const bookingCounts = useMemo(
    () =>
      countBy(
        (schedules.data ?? []).filter((s) => isActive(s.status)),
        (s) => s.courtroom_id,
      ),
    [schedules.data],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = courtrooms.data ?? [];
    if (!q) return list;
    return list.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.type ?? "").toLowerCase().includes(q),
    );
  }, [courtrooms.data, search]);

  function openCreate() {
    setEditing(null);
    setName("");
    setType("");
    setCapacity("0");
    setAllocation("0");
    setFormOpen(true);
  }

  function openEdit(room: Courtroom) {
    setEditing(room);
    setName(room.name);
    setType(room.type ?? "");
    setCapacity(String(room.capacity ?? 0));
    setAllocation(String(room.current_allocation ?? 0));
    setFormOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        type: type.trim() || "general",
        capacity: Number(capacity) || 0,
        current_allocation: Number(allocation) || 0,
      };
      if (!payload.name) throw new Error("Name is required.");
      const { error } = editing
        ? await supabase.from("courtrooms").update(payload).eq("id", editing.id)
        : await supabase.from("courtrooms").insert(payload);
      if (error) throw error;
      await recordAudit(
        `${editing ? "Updated" : "Added"} courtroom ${payload.name}`,
        `courtroom:${payload.name}`,
      );
    },
    onSuccess: () => {
      toast.success(editing ? "Courtroom updated." : "Courtroom added.");
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["courtrooms"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (room: Courtroom) => {
      const { error } = await supabase.from("courtrooms").delete().eq("id", room.id);
      if (error) throw error;
      await recordAudit(`Removed courtroom ${room.name}`, `courtroom:${room.name}`);
    },
    onSuccess: () => {
      toast.success("Courtroom removed.");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["courtrooms"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Facilities"
        title="Courtrooms"
        description="Courtroom inventory with capacity, type and current allocation status."
        actions={
          isAdmin ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Add Courtroom
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6 flex items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or type"
            className="pl-9"
            aria-label="Search courtrooms"
          />
        </div>
        <span className="text-sm text-muted-foreground">{rows.length} listed</span>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card shadow-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Capacity</TableHead>
              <TableHead className="text-right">Allocation</TableHead>
              <TableHead>Status</TableHead>
              {isAdmin && <TableHead className="w-24 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {courtrooms.isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={isAdmin ? 6 : 5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {courtrooms.isError && (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 6 : 5}
                  className="py-10 text-center text-sm text-destructive"
                >
                  Could not load courtrooms.
                </TableCell>
              </TableRow>
            )}

            {!courtrooms.isLoading && !courtrooms.isError && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="py-14 text-center">
                  <DoorOpen className="mx-auto mb-3 size-6 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">No courtrooms found</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {search ? "Try a different search term." : "Add the first courtroom to begin."}
                  </p>
                </TableCell>
              </TableRow>
            )}

            {rows.map((room) => (
              <TableRow key={room.id} className="hover:bg-muted/50">
                <TableCell>
                  <Link
                    to="/courtrooms/$courtroomId"
                    params={{ courtroomId: room.id }}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {room.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{room.type || "general"}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{room.capacity ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {room.current_allocation ?? 0}
                </TableCell>
                <TableCell>
                  <AllocationBadge bookings={bookingCounts.get(room.id) ?? 0} />
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit courtroom"
                      onClick={() => openEdit(room)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete courtroom"
                      onClick={() => setDeleting(room)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit courtroom" : "Add courtroom"}</DialogTitle>
            <DialogDescription>
              Record the courtroom's designation, seating capacity and type.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="room-name">Name</Label>
              <Input
                id="room-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="room-type">Type</Label>
              <Input
                id="room-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="e.g. general, criminal, family"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="room-capacity">Capacity</Label>
                <Input
                  id="room-capacity"
                  type="number"
                  min={0}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room-allocation">Current allocation</Label>
                <Input
                  id="room-allocation"
                  type="number"
                  min={0}
                  value={allocation}
                  onChange={(e) => setAllocation(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : editing ? "Save changes" : "Add courtroom"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the courtroom from the registry. Existing schedules will be left without
              a venue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove.mutate(deleting)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
