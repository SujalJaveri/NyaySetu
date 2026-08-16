import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen, Plus, Search } from "lucide-react";

import { PageHeader } from "@/components/page-shell";
import { PriorityBadge } from "@/components/priority-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CASE_STATUSES,
  caseCategoriesQuery,
  casesQuery,
  formatDate,
  priorityBand,
  statusLabel,
  type CaseStatus,
} from "@/lib/cases";

export const Route = createFileRoute("/_authenticated/cases/")({
  head: () => ({
    meta: [
      { title: "Cases — NyaySetu" },
      {
        name: "description",
        content: "Registered cases with status, category, priority and filing dates.",
      },
      { property: "og:title", content: "Cases — NyaySetu" },
      {
        property: "og:description",
        content: "Registered cases with status, category, priority and filing dates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CasesPage,
});

function CasesPage() {
  const cases = useQuery(casesQuery);
  const categories = useQuery(caseCategoriesQuery);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [priority, setPriority] = useState("all");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (
      (cases.data ?? [])
        .filter((c) => {
          if (
            q &&
            !c.case_number.toLowerCase().includes(q) &&
            !(c.parties ?? "").toLowerCase().includes(q)
          )
            return false;
          if (status !== "all" && c.status !== status) return false;
          if (category !== "all" && c.category_id !== category) return false;
          if (priority !== "all" && priorityBand(c.priority_score) !== priority) return false;
          return true;
        })
        // Walkthrough examples are pinned to the top so a demo always starts in the right place.
        .sort((a, b) => {
          if (a.is_example !== b.is_example) return a.is_example ? -1 : 1;
          if (a.is_example && b.is_example)
            return (a.example_order ?? 99) - (b.example_order ?? 99);
          return 0;
        })
    );
  }, [cases.data, search, status, category, priority]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Registry"
        title="Cases"
        description="Registered cases with status, category, priority and filing dates."
        actions={
          <Button asChild>
            <Link to="/cases/new">
              <Plus className="size-4" /> Register case
            </Link>
          </Button>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search case number or parties"
            className="pl-9"
            aria-label="Search cases"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {CASE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger aria-label="Filter by category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(categories.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger aria-label="Filter by priority">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="pending">Pending calculation</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">{rows.length} matching cases</p>

      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card shadow-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case number</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Filing date</TableHead>
              <TableHead className="text-right">Pending (days)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {cases.isError && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-destructive">
                  Could not load cases.
                </TableCell>
              </TableRow>
            )}

            {!cases.isLoading && !cases.isError && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-14 text-center">
                  <FolderOpen className="mx-auto mb-3 size-6 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">No cases found</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Adjust your filters, or register a new case to get started.
                  </p>
                </TableCell>
              </TableRow>
            )}

            {rows.map((c) => (
              <TableRow
                key={c.id}
                className={c.is_example ? "bg-accent/10 hover:bg-accent/15" : "hover:bg-muted/50"}
              >
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/cases/$caseId"
                      params={{ caseId: c.id }}
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {c.case_number}
                    </Link>
                    {c.is_example && (
                      <Badge variant="outline" className="border-accent text-accent">
                        Example{c.example_label ? ` · ${c.example_label}` : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="max-w-xs truncate text-xs text-muted-foreground">
                    {c.parties || "Parties not recorded"}
                  </p>
                </TableCell>

                <TableCell>{c.case_categories?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={c.status === "disposed" ? "secondary" : "default"}>
                    {statusLabel[c.status as CaseStatus] ?? c.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <PriorityBadge score={c.priority_score} />
                </TableCell>
                <TableCell>{formatDate(c.filing_date)}</TableCell>
                <TableCell className="text-right tabular-nums">{c.pending_duration_days}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
