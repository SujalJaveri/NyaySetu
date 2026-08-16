import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Info } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recordAudit } from "@/lib/audit";
import { supabase } from "@/integrations/supabase/client";
import { caseCategoriesQuery, generateCaseNumber, pendingDays } from "@/lib/cases";
import { recomputeCasePriority } from "@/lib/priority";

export const Route = createFileRoute("/_authenticated/cases/new")({
  head: () => ({
    meta: [
      { title: "Register a case — NyaySetu" },
      {
        name: "description",
        content: "Register a new case with category, parties and estimated hearing duration.",
      },
      { property: "og:title", content: "Register a case — NyaySetu" },
      {
        property: "og:description",
        content: "Register a new case with category, parties and estimated hearing duration.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterCasePage,
});

const today = () => new Date().toISOString().slice(0, 10);

function RegisterCasePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const categories = useQuery(caseCategoriesQuery);

  const [caseNumber, setCaseNumber] = useState("Generating…");
  const [categoryId, setCategoryId] = useState("");
  const [filingDate, setFilingDate] = useState(today());
  const [parties, setParties] = useState("");
  const [duration, setDuration] = useState("60");
  const [adjournments, setAdjournments] = useState("0");
  const [ftscPocso, setFtscPocso] = useState(false);
  const [seniorCitizen, setSeniorCitizen] = useState(false);
  const [propertyDispute5yr, setPropertyDispute5yr] = useState(false);
  const [limitationDeadline, setLimitationDeadline] = useState("");

  useEffect(() => {
    generateCaseNumber()
      .then(setCaseNumber)
      .catch(() => setCaseNumber(`CASE-${new Date().getFullYear()}-0001`));
  }, []);

  useEffect(() => {
    const category = (categories.data ?? []).find((c) => c.id === categoryId);
    if (category) setDuration(String(category.typical_duration_minutes));
  }, [categoryId, categories.data]);

  const pending = pendingDays(filingDate);

  const create = useMutation({
    mutationFn: async () => {
      if (!parties.trim()) throw new Error("Parties involved is required.");
      const number = await generateCaseNumber();
      const { data, error } = await supabase
        .from("cases")
        .insert({
          case_number: number,
          category_id: categoryId || null,
          filing_date: filingDate,
          parties: parties.trim(),
          estimated_duration_minutes: Number(duration) || 60,
          previous_adjournments: Number(adjournments) || 0,
          pending_duration_days: pendingDays(filingDate),
          status: "filed" as const,
          is_ftsc_pocso: ftscPocso,
          senior_citizen_litigant: seniorCitizen,
          property_dispute_5yr_plus: propertyDispute5yr,
          statutory_limitation_deadline: limitationDeadline || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      await recomputeCasePriority(data.id);
      await recordAudit(`Registered case ${number}`, `case:${number}`);
      return data;
    },
    onSuccess: (data) => {
      toast.success("Case registered.");
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      navigate({ to: "/cases/$caseId", params: { caseId: data.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/cases">
          <ArrowLeft className="size-4" /> All cases
        </Link>
      </Button>

      <PageHeader
        eyebrow="Registry"
        title="Register a case"
        description="Record the filing particulars. The case number, pending duration and Priority Score are handled by the registry."
      />

      <form
        className="mt-6 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <Card>
          <CardContent className="grid gap-5 pt-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="case-number">Case number</Label>
              <Input
                id="case-number"
                value={caseNumber}
                readOnly
                className="bg-muted font-medium"
              />
              <p className="text-xs text-muted-foreground">
                Generated automatically on registration.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="case-category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="case-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {(categories.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.typical_duration_minutes} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filing-date">Filing date</Label>
              <Input
                id="filing-date"
                type="date"
                max={today()}
                value={filingDate}
                onChange={(e) => setFilingDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pending-days">Pending duration (days)</Label>
              <Input id="pending-days" value={pending} readOnly className="bg-muted" />
              <p className="text-xs text-muted-foreground">
                Calculated from the filing date to today.
              </p>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="parties">Parties involved</Label>
              <Textarea
                id="parties"
                value={parties}
                onChange={(e) => setParties(e.target.value)}
                placeholder="e.g. State vs. R. Mehta"
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Estimated hearing duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjournments">Previous adjournments</Label>
              <Input
                id="adjournments"
                type="number"
                min={0}
                value={adjournments}
                onChange={(e) => setAdjournments(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5 pt-6">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Statutory Priority Categories
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Recorded by the registrar from documented case facts. Nothing here is inferred by
                the system — tick only what the filing papers establish.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  id: "ftsc-pocso",
                  label: "Fast Track Special Court / POCSO matter",
                  hint: "Case falls within FTSC or POCSO designation.",
                  checked: ftscPocso,
                  set: setFtscPocso,
                },
                {
                  id: "senior-citizen",
                  label: "Senior citizen litigant",
                  hint: "A party is a senior citizen as evidenced on record.",
                  checked: seniorCitizen,
                  set: setSeniorCitizen,
                },
                {
                  id: "property-5yr",
                  label: "Property dispute pending 5 years or more",
                  hint: "Property matter with five or more years of pendency.",
                  checked: propertyDispute5yr,
                  set: setPropertyDispute5yr,
                },
              ].map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-md border border-border p-3"
                >
                  <Checkbox
                    id={item.id}
                    checked={item.checked}
                    onCheckedChange={(v) => item.set(v === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <Label htmlFor={item.id} className="font-medium">
                      {item.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{item.hint}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 sm:max-w-xs">
              <Label htmlFor="limitation-deadline">Statutory limitation deadline</Label>
              <Input
                id="limitation-deadline"
                type="date"
                value={limitationDeadline}
                onChange={(e) => setLimitationDeadline(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Optional. Leave blank if no statutory deadline applies.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 rounded-lg border border-dashed border-border bg-card px-4 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">
              Priority Score is calculated automatically
            </span>{" "}
            on registration from category urgency, pending duration, adjournments and any
            administrative priority boost. The full breakdown appears on the case detail page.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link to="/cases">Cancel</Link>
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Registering…" : "Register case"}
          </Button>
        </div>
      </form>
    </div>
  );
}
