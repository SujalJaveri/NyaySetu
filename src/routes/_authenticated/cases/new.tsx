import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Gavel,
  Info,
  Layers,
  Plus,
  RotateCcw,
  Scale,
  ShieldCheck,
  Trash2,
  UploadCloud,
  User,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recordAudit } from "@/lib/audit";
import { supabase } from "@/integrations/supabase/client";
import { caseCategoriesQuery, generateCaseNumber, pendingDays, type CaseRow } from "@/lib/cases";
import { recomputeCasePriority } from "@/lib/priority";
import { CaseSchedulingPanel } from "@/components/case-scheduling-panel";

export const Route = createFileRoute("/_authenticated/cases/new")({
  head: () => ({
    meta: [
      { title: "Register a case — NyayaSetu" },
      {
        name: "description",
        content:
          "Comprehensive court case registration workflow with structured particulars, party management and Smart Scheduling handoff.",
      },
      { property: "og:title", content: "Register a case — NyayaSetu" },
      {
        property: "og:description",
        content:
          "Comprehensive court case registration workflow with structured particulars, party management and Smart Scheduling handoff.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterCasePage,
});

const today = () => new Date().toISOString().slice(0, 10);

/* ---------------- CATEGORY & SUBCATEGORY METADATA ---------------- */

type CategoryConfig = {
  code: string;
  defaultDuration: number;
  subcategories: string[];
};

const CASE_CATEGORIES_CONFIG: Record<string, CategoryConfig> = {
  "Civil Suit": {
    code: "CIV",
    defaultDuration: 60,
    subcategories: [
      "Recovery Suit",
      "Injunction",
      "Declaration",
      "Damages",
      "Specific Performance",
      "Contract Dispute",
      "Other",
    ],
  },
  "Criminal Case": {
    code: "CRL",
    defaultDuration: 90,
    subcategories: [
      "Criminal Trial",
      "Criminal Complaint",
      "FIR-related Matter",
      "Prosecution",
      "Revision",
      "Other",
    ],
  },
  "Property & Land": {
    code: "PRP",
    defaultDuration: 60,
    subcategories: [
      "Ownership Dispute",
      "Possession",
      "Partition",
      "Land Acquisition",
      "Tenancy",
      "Other",
    ],
  },
  "Family & Matrimonial": {
    code: "FAM",
    defaultDuration: 45,
    subcategories: [
      "Divorce",
      "Maintenance",
      "Child Custody",
      "Domestic Dispute",
      "Matrimonial Dispute",
      "Other",
    ],
  },
  "Commercial Dispute": {
    code: "COM",
    defaultDuration: 60,
    subcategories: [
      "Contract Dispute",
      "Payment Recovery",
      "Partnership Dispute",
      "Corporate Dispute",
      "Commercial Injunction",
      "Other",
    ],
  },
  "Consumer Dispute": {
    code: "CON",
    defaultDuration: 30,
    subcategories: [
      "Defective Goods",
      "Deficient Service",
      "Compensation",
      "Product Liability",
      "Other",
    ],
  },
  "Labour & Employment": {
    code: "LAB",
    defaultDuration: 45,
    subcategories: [
      "Wrongful Termination",
      "Salary/Wage Dispute",
      "Employment Contract",
      "Workplace Dispute",
      "Other",
    ],
  },
  "Motor Accident Claims": {
    code: "MAC",
    defaultDuration: 45,
    subcategories: [
      "Injury Claim",
      "Death Claim",
      "Property Damage",
      "Compensation Claim",
      "Other",
    ],
  },
  "Cheque / Financial Offence": {
    code: "CHQ",
    defaultDuration: 30,
    subcategories: [
      "Cheque Dishonour",
      "Payment Default",
      "Financial Fraud",
      "Recovery",
      "Other",
    ],
  },
  "Bail Application": {
    code: "BAL",
    defaultDuration: 30,
    subcategories: [
      "Regular Bail",
      "Anticipatory Bail",
      "Interim Bail",
      "Default Bail",
      "Other",
    ],
  },
  "Writ / Constitutional Matter": {
    code: "WRT",
    defaultDuration: 60,
    subcategories: [
      "Mandamus",
      "Habeas Corpus",
      "Certiorari",
      "Prohibition",
      "Quo Warranto",
      "Other",
    ],
  },
  "Succession & Probate": {
    code: "SUC",
    defaultDuration: 45,
    subcategories: [
      "Letters of Administration",
      "Succession Certificate",
      "Probate of Will",
      "Other",
    ],
  },
  "Juvenile / Child Matters": {
    code: "JUV",
    defaultDuration: 30,
    subcategories: [
      "Child Protection",
      "Juvenile Justice",
      "Guardianship",
      "Other",
    ],
  },
  "Public / Administrative Matter": {
    code: "PUB",
    defaultDuration: 60,
    subcategories: [
      "Administrative Challenge",
      "Municipal Matter",
      "Service Dispute",
      "Other",
    ],
  },
  "Miscellaneous / Other": {
    code: "MSC",
    defaultDuration: 30,
    subcategories: [
      "General Miscellaneous",
      "Interim Application",
      "Review Petition",
      "Other",
    ],
  },
};

const APPLICABLE_LAWS_OPTIONS = [
  "Code of Civil Procedure",
  "Bharatiya Nyaya Sanhita",
  "Bharatiya Nagarik Suraksha Sanhita",
  "Bharatiya Sakshya Adhiniyam",
  "Indian Contract Act",
  "Negotiable Instruments Act",
  "Consumer Protection Act",
  "Motor Vehicles Act",
  "Family Laws",
  "Companies Act",
  "Specific Relief Act",
  "Transfer of Property Act",
  "Arbitration and Conciliation Act",
  "Insolvency and Bankruptcy Code",
  "Other",
];

const JURISDICTION_OPTIONS = [
  "District & Sessions Court, Central District",
  "Commercial Division Court No. 1",
  "Commercial Division Court No. 2",
  "Principal Family Court",
  "Chief Judicial Magistrate Court",
  "Civil Court (Senior Division)",
  "Civil Court (Junior Division)",
  "Taluka Sub-Divisional Court",
  "Motor Accident Claims Tribunal (MACT)",
  "Labour & Industrial Court",
  "Special Court (POCSO / FTSC)",
  "Public Registry Division",
];

const SCHEDULING_CONSTRAINTS_LIST = [
  { id: "counsel-unavail", label: "Counsel unavailable on certain dates" },
  { id: "witness-unavail", label: "Witness availability constraint" },
  { id: "judge-pref", label: "Judge preference / subject matter specialty required" },
  { id: "room-req", label: "Special courtroom requirement (high capacity / evidence screens)" },
  { id: "vc-req", label: "Video conferencing (hybrid hearing) required" },
  { id: "special-accom", label: "Special accommodation / accessibility required" },
];

/* ---------------- PARTY TYPES ---------------- */

type PartyRecord = {
  id: string;
  type: "Individual" | "Company" | "Government" | "Organization" | "Trust" | "Other";
  name: string;
  role:
    | "Plaintiff"
    | "Petitioner"
    | "Complainant"
    | "Appellant"
    | "Applicant"
    | "Defendant"
    | "Respondent"
    | "Intervenor"
    | "Other";
  phone: string;
  email: string;
  address: string;
};

type DocumentRecord = {
  id: string;
  name: string;
  type:
    | "Petition / Plaint"
    | "Written Statement"
    | "Evidence"
    | "Affidavit"
    | "Supporting Documents"
    | "Previous Orders"
    | "Identity Documents"
    | "Other";
  uploadedBy: string;
  uploadedDate: string;
  size: string;
};

function RegisterCasePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery(caseCategoriesQuery);

  // Queries for dynamic Judge and Courtroom lists
  const judgesQuery = useQuery({
    queryKey: ["judges-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("judges").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const courtroomsQuery = useQuery({
    queryKey: ["courtrooms-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courtrooms").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  /* ---------------- FORM STATE ---------------- */

  // Section 1: Identification
  const [caseNumber, setCaseNumber] = useState("Generating…");
  const [filingDate, setFilingDate] = useState(today());
  const [registrationDate] = useState(today());
  const [categoryName, setCategoryName] = useState("Civil Suit");
  const [subCategory, setSubCategory] = useState("Recovery Suit");

  // Section 2: Parties
  const [parties, setParties] = useState<PartyRecord[]>([
    {
      id: "p1",
      type: "Individual",
      name: "",
      role: "Plaintiff",
      phone: "",
      email: "",
      address: "",
    },
    {
      id: "p2",
      type: "Company",
      name: "",
      role: "Defendant",
      phone: "",
      email: "",
      address: "",
    },
  ]);

  // Section 3: Case Details
  const [caseTitle, setCaseTitle] = useState("");
  const [isTitleManuallyEdited, setIsTitleManuallyEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [subjectMatter, setSubjectMatter] = useState("");
  const [amountInvolved, setAmountInvolved] = useState("");
  const [causeOfActionDate, setCauseOfActionDate] = useState("");
  const [jurisdiction, setJurisdiction] = useState<string>(JURISDICTION_OPTIONS[0] ?? "");

  // Section 4: Legal Information
  const [applicableLaws, setApplicableLaws] = useState<string[]>(["Code of Civil Procedure"]);
  const [sections, setSections] = useState<string[]>(["Section 9"]);
  const [newSectionInput, setNewSectionInput] = useState("");
  const [caseNature, setCaseNature] = useState("Original");
  const [filingType, setFilingType] = useState("Fresh Filing");

  // Section 5: Priority & Scheduling
  const [priority, setPriority] = useState<"Critical" | "High" | "Medium" | "Low">("Medium");
  const [isUrgent, setIsUrgent] = useState(false);
  const [urgencyReason, setUrgencyReason] = useState("Interim Relief Required");
  const [duration, setDuration] = useState("60");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("Morning");
  const [selectedConstraints, setSelectedConstraints] = useState<string[]>([]);
  const [adjournments, setAdjournments] = useState("0");
  const [ftscPocso, setFtscPocso] = useState(false);
  const [seniorCitizen, setSeniorCitizen] = useState(false);
  const [propertyDispute5yr, setPropertyDispute5yr] = useState(false);
  const [limitationDeadline, setLimitationDeadline] = useState("");

  // Section 6: Judge & Courtroom
  const [preferredJudge, setPreferredJudge] = useState("auto");
  const [preferredCourtroom, setPreferredCourtroom] = useState("auto");

  // Section 7: Advocate Information
  const [filingAdvocateName, setFilingAdvocateName] = useState("");
  const [filingAdvocateBarNo, setFilingAdvocateBarNo] = useState("");
  const [filingAdvocateEmail, setFilingAdvocateEmail] = useState("");
  const [filingAdvocatePhone, setFilingAdvocatePhone] = useState("");

  const [opposingAdvocateName, setOpposingAdvocateName] = useState("");
  const [opposingAdvocateBarNo, setOpposingAdvocateBarNo] = useState("");
  const [opposingAdvocateEmail, setOpposingAdvocateEmail] = useState("");
  const [opposingAdvocatePhone, setOpposingAdvocatePhone] = useState("");

  // Section 8: Documents
  const [documents, setDocuments] = useState<DocumentRecord[]>([
    {
      id: "doc-1",
      name: "Plaint_Petition_Original.pdf",
      type: "Petition / Plaint",
      uploadedBy: "Registry Staff",
      uploadedDate: today(),
      size: "2.4 MB",
    },
  ]);
  const [newDocType, setNewDocType] =
    useState<DocumentRecord["type"]>("Supporting Documents");

  // Section 9: Administrative
  const [registrar, setRegistrar] = useState("auto");
  const [filingLocation, setFilingLocation] = useState("Civil Registry");
  const [initialStatus, setInitialStatus] = useState<"Filed" | "Under Scrutiny" | "Registered" | "Pending">("Filed");

  // Success State & Smart Scheduling Handoff
  const [registeredCase, setRegisteredCase] = useState<CaseRow | null>(null);
  const [showInlineScheduler, setShowInlineScheduler] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  /* ---------------- AUTO EFFECTS & DYNAMICS ---------------- */

  // 1. Regenerate case number when category changes
  useEffect(() => {
    const config = CASE_CATEGORIES_CONFIG[categoryName] ?? { code: "CIV", defaultDuration: 60, subcategories: ["Other"] };
    generateCaseNumber(config.code)
      .then(setCaseNumber)
      .catch(() => setCaseNumber(`${config.code}-${new Date().getFullYear()}-0001`));
  }, [categoryName]);

  // 2. Adjust default subcategory & typical duration when category changes
  useEffect(() => {
    const config = CASE_CATEGORIES_CONFIG[categoryName];
    if (config) {
      if (!config.subcategories.includes(subCategory)) {
        setSubCategory(config.subcategories[0] ?? "Other");
      }
      setDuration(String(config.defaultDuration));
    }
  }, [categoryName]);

  // 3. Auto-generate Case Title from parties unless manually edited
  useEffect(() => {
    if (!isTitleManuallyEdited) {
      const p1 = parties[0]?.name?.trim();
      const p2 = parties[1]?.name?.trim();
      if (p1 && p2) {
        setCaseTitle(`${p1} vs ${p2}`);
      } else if (p1) {
        setCaseTitle(`${p1} vs [Opposing Party]`);
      } else {
        setCaseTitle("");
      }
    }
  }, [parties, isTitleManuallyEdited]);

  const pending = pendingDays(filingDate);

  // Derive consolidated parties string for DB compatibility
  const partiesSummary = useMemo(() => {
    const validParties = parties.filter((p) => p.name.trim().length > 0);
    if (validParties.length === 0) return "Parties not specified";
    const first = validParties[0];
    if (validParties.length === 1 && first) return first.name;
    const second = validParties[1];
    if (!first || !second) return "Parties not specified";
    const rest = validParties.slice(2);
    let str = `${first.name} (${first.role}) vs ${second.name} (${second.role})`;
    if (rest.length > 0) {
      str += ` & ${rest.length} other${rest.length > 1 ? "s" : ""}`;
    }
    return str;
  }, [parties]);

  /* ---------------- PARTY HANDLERS ---------------- */

  const handleAddParty = () => {
    const nextIndex = parties.length + 1;
    const defaultRole = nextIndex % 2 === 1 ? "Plaintiff" : "Defendant";
    setParties([
      ...parties,
      {
        id: `p-${Date.now()}`,
        type: "Individual",
        name: "",
        role: defaultRole as PartyRecord["role"],
        phone: "",
        email: "",
        address: "",
      },
    ]);
  };

  const handleRemoveParty = (index: number) => {
    if (parties.length <= 2) {
      toast.error("A case must have at least two parties on record.");
      return;
    }
    setParties(parties.filter((_, i) => i !== index));
  };

  const handlePartyChange = (index: number, field: keyof PartyRecord, value: string) => {
    const existing = parties[index];
    if (!existing) return;
    const updated = [...parties];
    updated[index] = { ...existing, [field]: value };
    setParties(updated);
  };

  /* ---------------- SECTION HANDLERS ---------------- */

  const handleAddSection = () => {
    if (!newSectionInput.trim()) return;
    const trimmed = newSectionInput.trim();
    if (!sections.includes(trimmed)) {
      setSections([...sections, trimmed]);
    }
    setNewSectionInput("");
  };

  const handleRemoveSection = (sec: string) => {
    setSections(sections.filter((s) => s !== sec));
  };

  const handleToggleLaw = (law: string) => {
    if (applicableLaws.includes(law)) {
      if (applicableLaws.length > 1) {
        setApplicableLaws(applicableLaws.filter((l) => l !== law));
      } else {
        toast.error("At least one applicable law must be selected.");
      }
    } else {
      setApplicableLaws([...applicableLaws, law]);
    }
  };

  const handleToggleConstraint = (id: string) => {
    if (selectedConstraints.includes(id)) {
      setSelectedConstraints(selectedConstraints.filter((c) => c !== id));
    } else {
      setSelectedConstraints([...selectedConstraints, id]);
    }
  };

  const handleAddSimulatedDocument = (fileName: string) => {
    if (!fileName) return;
    setDocuments([
      ...documents,
      {
        id: `doc-${Date.now()}`,
        name: fileName,
        type: newDocType,
        uploadedBy: "Registry Staff",
        uploadedDate: today(),
        size: `${(Math.random() * 3 + 0.5).toFixed(1)} MB`,
      },
    ]);
    toast.success(`Attached ${fileName}`);
  };

  const handleRemoveDocument = (id: string) => {
    setDocuments(documents.filter((d) => d.id !== id));
  };

  /* ---------------- FORM VALIDATION ---------------- */

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!filingDate) errors["filingDate"] = "Filing date is required.";
    if (!categoryName) errors["category"] = "Case category is required.";
    if (!subCategory) errors["subCategory"] = "Case sub-category is required.";

    if (!parties[0]?.name?.trim()) errors["party1"] = "Party 1 Full Name is required.";
    if (!parties[1]?.name?.trim()) errors["party2"] = "Party 2 Full Name is required.";

    if (!description.trim()) errors["description"] = "Case brief description is required.";
    if (!jurisdiction) errors["jurisdiction"] = "Jurisdiction is required.";
    if (!caseNature) errors["caseNature"] = "Case nature is required.";
    if (!priority) errors["priority"] = "Case priority is required.";
    if (!duration || Number(duration) <= 0)
      errors["duration"] = "Valid estimated hearing duration is required.";

    if (!filingAdvocateName.trim())
      errors["filingAdvocate"] = "Filing Advocate Name is required.";

    // Validate email formats if entered
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (filingAdvocateEmail && !emailRegex.test(filingAdvocateEmail)) {
      errors["filingAdvocateEmail"] = "Please enter a valid email address.";
    }
    if (opposingAdvocateEmail && !emailRegex.test(opposingAdvocateEmail)) {
      errors["opposingAdvocateEmail"] = "Please enter a valid email address.";
    }

    parties.forEach((p, idx) => {
      if (p.email && !emailRegex.test(p.email)) {
        errors[`party_${idx}_email`] = `Party ${idx + 1} has an invalid email format.`;
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /* ---------------- REGISTRATION MUTATION ---------------- */

  const create = useMutation({
    mutationFn: async () => {
      if (!validateForm()) {
        const errorKeys = Object.keys(validationErrors);
        const firstKey = errorKeys[0];
        const errorMsg = firstKey ? validationErrors[firstKey] : "Please fill in all required fields accurately.";
        throw new Error(errorMsg);
      }

      // Generate verified unique case number with category prefix
      const config = CASE_CATEGORIES_CONFIG[categoryName] ?? { code: "CIV" };
      const number = await generateCaseNumber(config.code);

      // Find matching database category_id if present
      const matchedCategory = (categoriesQuery.data ?? []).find(
        (c) =>
          c.name.toLowerCase() === categoryName.toLowerCase() ||
          c.name.toLowerCase().includes(categoryName.toLowerCase()) ||
          categoryName.toLowerCase().includes(c.name.toLowerCase()),
      );

      const payload = {
        case_number: number,
        category_id: matchedCategory?.id || null,
        filing_date: filingDate,
        parties: partiesSummary,
        estimated_duration_minutes: Number(duration) || 60,
        previous_adjournments: Number(adjournments) || 0,
        pending_duration_days: pendingDays(filingDate),
        status: "filed" as const,
        is_ftsc_pocso: ftscPocso,
        senior_citizen_litigant: seniorCitizen,
        property_dispute_5yr_plus: propertyDispute5yr,
        statutory_limitation_deadline: limitationDeadline || null,
        priority_tier: priority === "Critical" || priority === "High" ? "Tier 1" : "Tier 2",
      };

      const { data, error } = await supabase
        .from("cases")
        .insert(payload)
        .select(
          "id, case_number, category_id, filing_date, status, parties, estimated_duration_minutes, pending_duration_days, previous_adjournments, priority_score, priority_tier, legal_priority_flag, is_ftsc_pocso, senior_citizen_litigant, property_dispute_5yr_plus, statutory_limitation_deadline, created_at, is_example, example_order, example_label, example_note, case_categories(id, name, urgency_weight)",
        )
        .single();

      if (error) throw error;

      // Recompute deterministic priority score in DB
      await recomputeCasePriority(data.id);
      await recordAudit(
        `Registered case ${number} (${categoryName} - ${subCategory}) with ${parties.length} parties`,
        `case:${number}`,
      );

      // Save complete rich record into state
      const completeCaseRow = data as unknown as CaseRow;
      return completeCaseRow;
    },
    onSuccess: (data) => {
      toast.success(`Case ${data.case_number} registered successfully!`);
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      setRegisteredCase(data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to register case. Please check required fields.");
    },
  });

  const handleResetForm = () => {
    setRegisteredCase(null);
    setShowInlineScheduler(false);
    setValidationErrors({});
    const config = CASE_CATEGORIES_CONFIG["Civil Suit"];
    setCategoryName("Civil Suit");
    setSubCategory(config?.subcategories[0] ?? "Recovery Suit");
    setFilingDate(today());
    setParties([
      {
        id: "p1",
        type: "Individual",
        name: "",
        role: "Plaintiff",
        phone: "",
        email: "",
        address: "",
      },
      {
        id: "p2",
        type: "Company",
        name: "",
        role: "Defendant",
        phone: "",
        email: "",
        address: "",
      },
    ]);
    setCaseTitle("");
    setIsTitleManuallyEdited(false);
    setDescription("");
    setSubjectMatter("");
    setAmountInvolved("");
    setCauseOfActionDate("");
    setApplicableLaws(["Code of Civil Procedure"]);
    setSections(["Section 9"]);
    setCaseNature("Original");
    setFilingType("Fresh Filing");
    setPriority("Medium");
    setIsUrgent(false);
    setDuration("60");
    setPreferredDate("");
    setSelectedConstraints([]);
    setAdjournments("0");
    setFtscPocso(false);
    setSeniorCitizen(false);
    setPropertyDispute5yr(false);
    setLimitationDeadline("");
    setPreferredJudge("auto");
    setPreferredCourtroom("auto");
    setFilingAdvocateName("");
    setFilingAdvocateBarNo("");
    setFilingAdvocateEmail("");
    setFilingAdvocatePhone("");
    setOpposingAdvocateName("");
    setOpposingAdvocateBarNo("");
    setOpposingAdvocateEmail("");
    setOpposingAdvocatePhone("");
    setDocuments([
      {
        id: "doc-1",
        name: "Plaint_Petition_Original.pdf",
        type: "Petition / Plaint",
        uploadedBy: "Registry Staff",
        uploadedDate: today(),
        size: "2.4 MB",
      },
    ]);
  };

  /* ---------------- RENDER SUCCESS STATE ---------------- */

  if (registeredCase) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link to="/cases">
            <ArrowLeft className="size-4" /> All cases
          </Link>
        </Button>

        <Card className="border-primary/40 bg-card shadow-panel">
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <CheckCircle2 className="size-6 text-primary" />
                </div>
                <div>
                  <Badge className="mb-1">Registry Confirmation</Badge>
                  <CardTitle className="text-xl">Case Registered Successfully</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Filing record created and priority computed deterministically.
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-sm font-semibold px-3 py-1 bg-muted/40">
                {registeredCase.case_number}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-2 md:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Case Number</p>
                <p className="mt-1 font-semibold text-foreground">{registeredCase.case_number}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Category</p>
                <p className="mt-1 font-medium text-foreground">
                  {categoryName}
                  <span className="block text-xs text-muted-foreground">{subCategory}</span>
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Priority Tier</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant={priority === "Critical" || priority === "High" ? "default" : "secondary"}>
                    {priority} Priority
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                <Badge variant="secondary" className="mt-1">
                  Filed / Pending
                </Badge>
              </div>
              <div className="sm:col-span-2 md:col-span-4 border-t border-border pt-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Parties on Record</p>
                <p className="mt-1 text-sm font-medium text-foreground">{registeredCase.parties}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="default" size="default">
                <Link to="/cases/$caseId" params={{ caseId: registeredCase.id }}>
                  <ExternalLink className="size-4 mr-1.5" /> View Case
                </Link>
              </Button>

              <Button
                variant={showInlineScheduler ? "secondary" : "outline"}
                size="default"
                onClick={() => setShowInlineScheduler((prev) => !prev)}
              >
                <CalendarPlus className="size-4 mr-1.5" />
                {showInlineScheduler ? "Hide Scheduling Engine" : "Schedule Hearing"}
              </Button>

              <Button variant="outline" size="default" onClick={handleResetForm}>
                <RotateCcw className="size-4 mr-1.5" /> Register Another Case
              </Button>
            </div>

            {/* Inline Smart Scheduling Handoff */}
            {showInlineScheduler && (
              <div className="border-t border-border pt-6 mt-6">
                <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground flex items-start gap-2.5">
                  <SparklesIcon className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-foreground">Smart Scheduling Handoff: </span>
                    Evaluating judge specialization ({categoryName}), courtroom capacity, workload limits,
                    and calendar availability for {registeredCase.case_number}.
                  </div>
                </div>
                <CaseSchedulingPanel caseRow={registeredCase} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---------------- RENDER MAIN REGISTRATION FORM ---------------- */

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/cases">
          <ArrowLeft className="size-4" /> All cases
        </Link>
      </Button>

      <PageHeader
        eyebrow="Registry"
        title="Register a case"
        description="Comprehensive case registration workflow for NyayaSetu. Collects structured facts for case management, Smart Scheduling, conflict prevention and cause-list generation."
      />

      {Object.keys(validationErrors).length > 0 && (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" />
            Please review the highlighted required fields:
          </div>
          <ul className="mt-2 list-disc list-inside space-y-1 text-xs">
            {Object.values(validationErrors).map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <form
        className="mt-6 space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        {/* ==================================================================== */}
        {/* SECTION 1: CASE IDENTIFICATION */}
        {/* ==================================================================== */}
        <Card className="shadow-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="size-4 text-primary" />
              Section 1 — Case Identification
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Official filing references, category classifications, and statutory registration dates.
            </p>
          </CardHeader>
          <CardContent className="grid gap-5 pt-2 sm:grid-cols-2 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="case-number" className="text-foreground">
                Case Number <span className="text-xs text-muted-foreground">(Auto-generated)</span>
              </Label>
              <Input
                id="case-number"
                value={caseNumber}
                readOnly
                className="bg-muted font-mono font-medium tracking-wide"
              />
              <p className="text-[11px] text-muted-foreground">
                Generated from category code ({CASE_CATEGORIES_CONFIG[categoryName]?.code || "CIV"}) and year.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filing-date" className="text-foreground flex items-center justify-between">
                <span>
                  Filing Date <span className="text-destructive">*</span>
                </span>
              </Label>
              <Input
                id="filing-date"
                type="date"
                max={today()}
                value={filingDate}
                onChange={(e) => setFilingDate(e.target.value)}
                required
                className={validationErrors["filingDate"] ? "border-destructive" : ""}
              />
              <p className="text-[11px] text-muted-foreground">
                Date papers were stamped at registry.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="registration-date" className="text-foreground">
                Registration Date
              </Label>
              <Input
                id="registration-date"
                type="date"
                value={registrationDate}
                readOnly
                className="bg-muted text-muted-foreground"
              />
              <p className="text-[11px] text-muted-foreground">
                System timestamp entered on registry.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="case-category" className="text-foreground">
                Case Category <span className="text-destructive">*</span>
              </Label>
              <Select value={categoryName} onValueChange={setCategoryName}>
                <SelectTrigger id="case-category" className={validationErrors["category"] ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {Object.keys(CASE_CATEGORIES_CONFIG).map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat} ({CASE_CATEGORIES_CONFIG[cat]?.code ?? "CIV"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="case-subcategory" className="text-foreground">
                Case Sub-category <span className="text-destructive">*</span>
              </Label>
              <Select value={subCategory} onValueChange={setSubCategory}>
                <SelectTrigger id="case-subcategory" className={validationErrors["subCategory"] ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select Sub-category" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {(CASE_CATEGORIES_CONFIG[categoryName]?.subcategories ?? ["Other"]).map((sub) => (
                    <SelectItem key={sub} value={sub}>
                      {sub}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pending-days" className="text-foreground">
                Pendency Calculated
              </Label>
              <div className="flex items-center gap-2">
                <Input id="pending-days" value={`${pending} days`} readOnly className="bg-muted" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Elapsed days since filing date.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ==================================================================== */}
        {/* SECTION 2: PARTIES */}
        {/* ==================================================================== */}
        <Card className="shadow-panel">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="size-4 text-primary" />
                Section 2 — Parties Involved
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Maintain scalable multi-party records with structured contact details.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddParty}
              className="text-xs h-8"
            >
              <Plus className="size-3.5 mr-1" /> Add Party
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {parties.map((party, idx) => (
              <div
                key={party.id}
                className="rounded-lg border border-border bg-card p-4 space-y-3 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={idx < 2 ? "default" : "secondary"} className="text-xs">
                      Party {idx + 1}
                    </Badge>
                    <span className="text-xs font-semibold text-foreground">
                      {idx === 0
                        ? "Principal Plaintiff / Complainant"
                        : idx === 1
                          ? "Principal Defendant / Respondent"
                          : `Additional Party (${party.role})`}
                    </span>
                  </div>
                  {parties.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveParty(idx)}
                      className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5 mr-1" /> Remove
                    </Button>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Party Type</Label>
                    <Select
                      value={party.type}
                      onValueChange={(val: PartyRecord["type"]) =>
                        handlePartyChange(idx, "type", val)
                      }
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Individual">Individual</SelectItem>
                        <SelectItem value="Company">Company / Corporate</SelectItem>
                        <SelectItem value="Government">Government / State</SelectItem>
                        <SelectItem value="Organization">Organization</SelectItem>
                        <SelectItem value="Trust">Trust / Society</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 sm:col-span-1 md:col-span-2">
                    <Label className="text-xs">
                      Full Name / Entity Title <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      placeholder={idx === 0 ? "e.g. Aarav Industries Pvt. Ltd." : "e.g. Zenith Traders Ltd."}
                      value={party.name}
                      onChange={(e) => handlePartyChange(idx, "name", e.target.value)}
                      required={idx < 2}
                      className={`h-9 text-sm ${
                        (idx === 0 && validationErrors["party1"]) || (idx === 1 && validationErrors["party2"])
                          ? "border-destructive"
                          : ""
                      }`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Legal Role in Proceeding</Label>
                    <Select
                      value={party.role}
                      onValueChange={(val: PartyRecord["role"]) =>
                        handlePartyChange(idx, "role", val)
                      }
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Plaintiff">Plaintiff</SelectItem>
                        <SelectItem value="Petitioner">Petitioner</SelectItem>
                        <SelectItem value="Complainant">Complainant</SelectItem>
                        <SelectItem value="Appellant">Appellant</SelectItem>
                        <SelectItem value="Applicant">Applicant</SelectItem>
                        <SelectItem value="Defendant">Defendant</SelectItem>
                        <SelectItem value="Respondent">Respondent</SelectItem>
                        <SelectItem value="Intervenor">Intervenor</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Phone Number</Label>
                    <Input
                      placeholder="+91 98765 43210"
                      value={party.phone}
                      onChange={(e) => handlePartyChange(idx, "phone", e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Email Address</Label>
                    <Input
                      type="email"
                      placeholder="party@example.com"
                      value={party.email}
                      onChange={(e) => handlePartyChange(idx, "email", e.target.value)}
                      className={`h-9 text-xs ${
                        validationErrors[`party_${idx}_email`] ? "border-destructive" : ""
                      }`}
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2 md:col-span-3">
                    <Label className="text-xs">Postal / Registered Address</Label>
                    <Input
                      placeholder="Street, City, State, PIN"
                      value={party.address}
                      onChange={(e) => handlePartyChange(idx, "address", e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ==================================================================== */}
        {/* SECTION 3: CASE DETAILS */}
        {/* ==================================================================== */}
        <Card className="shadow-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              Section 3 — Case Details & Subject Matter
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Core dispute narrative, claim valuation and territorial jurisdiction.
            </p>
          </CardHeader>
          <CardContent className="grid gap-5 pt-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="case-title" className="text-foreground">
                  Case Title
                </Label>
                {isTitleManuallyEdited && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-muted-foreground"
                    onClick={() => {
                      setIsTitleManuallyEdited(false);
                      const p1 = parties[0]?.name?.trim();
                      const p2 = parties[1]?.name?.trim();
                      setCaseTitle(p1 && p2 ? `${p1} vs ${p2}` : "");
                    }}
                  >
                    Reset to Auto-title
                  </Button>
                )}
              </div>
              <Input
                id="case-title"
                value={caseTitle}
                onChange={(e) => {
                  setCaseTitle(e.target.value);
                  setIsTitleManuallyEdited(true);
                }}
                placeholder="e.g. Aarav Industries Pvt. Ltd. vs Zenith Traders Pvt. Ltd."
                className="font-medium"
              />
              <p className="text-[11px] text-muted-foreground">
                Generated automatically from party names; can be edited manually.
              </p>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="case-description" className="text-foreground">
                Brief Description of Dispute / Claim <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="case-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="State the core facts, relief sought, and background of the filing..."
                rows={3}
                required
                className={validationErrors["description"] ? "border-destructive" : ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject-matter" className="text-foreground">
                Subject Matter / Cause of Dispute
              </Label>
              <Input
                id="subject-matter"
                value={subjectMatter}
                onChange={(e) => setSubjectMatter(e.target.value)}
                placeholder="e.g. Breach of Supply Contract / Recovery of Dues"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount-involved" className="text-foreground">
                Amount Involved (₹ INR) <span className="text-xs text-muted-foreground">(Optional)</span>
              </Label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs text-muted-foreground font-semibold">
                  ₹
                </span>
                <Input
                  id="amount-involved"
                  type="number"
                  min="0"
                  step="1000"
                  value={amountInvolved}
                  onChange={(e) => setAmountInvolved(e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
              {amountInvolved && Number(amountInvolved) > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  ₹ {Number(amountInvolved).toLocaleString("en-IN")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cause-action-date" className="text-foreground">
                Cause of Action Date
              </Label>
              <Input
                id="cause-action-date"
                type="date"
                max={today()}
                value={causeOfActionDate}
                onChange={(e) => setCauseOfActionDate(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Date when primary dispute or grievance arose.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jurisdiction" className="text-foreground">
                Jurisdiction / Court Forum <span className="text-destructive">*</span>
              </Label>
              <Select value={jurisdiction} onValueChange={(v) => setJurisdiction(v)}>
                <SelectTrigger id="jurisdiction" className={validationErrors["jurisdiction"] ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select Jurisdiction" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {JURISDICTION_OPTIONS.map((j) => (
                    <SelectItem key={j} value={j}>
                      {j}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ==================================================================== */}
        {/* SECTION 4: LEGAL INFORMATION */}
        {/* ==================================================================== */}
        <Card className="shadow-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Gavel className="size-4 text-primary" />
              Section 4 — Legal Framework & Statutory Provisions
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Applicable statutory enactments, penal/civil sections, and filing classification.
            </p>
          </CardHeader>
          <CardContent className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label className="text-foreground">
                Applicable Acts / Enactments <span className="text-xs text-muted-foreground">(Select all that apply)</span>
              </Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {APPLICABLE_LAWS_OPTIONS.map((law) => {
                  const selected = applicableLaws.includes(law);
                  return (
                    <Badge
                      key={law}
                      variant={selected ? "default" : "outline"}
                      className={`cursor-pointer transition-all ${
                        selected ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"
                      }`}
                      onClick={() => handleToggleLaw(law)}
                    >
                      {selected && <Check className="size-3 mr-1" />}
                      {law}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-foreground">
                  Applicable Sections / Rules
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Section 138, Section 9, Order 39 Rule 1"
                    value={newSectionInput}
                    onChange={(e) => setNewSectionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSection();
                      }
                    }}
                    className="max-w-md"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleAddSection}>
                    <Plus className="size-3.5 mr-1" /> Add Section
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {sections.map((sec) => (
                    <Badge key={sec} variant="secondary" className="gap-1.5 pl-2.5 pr-1.5 py-1 text-xs">
                      {sec}
                      <button
                        type="button"
                        onClick={() => handleRemoveSection(sec)}
                        className="hover:text-destructive text-muted-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="case-nature" className="text-foreground">
                  Case Nature <span className="text-destructive">*</span>
                </Label>
                <Select value={caseNature} onValueChange={setCaseNature}>
                  <SelectTrigger id="case-nature">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Original">Original Suit / Petition</SelectItem>
                    <SelectItem value="Appeal">Appeal</SelectItem>
                    <SelectItem value="Revision">Revision</SelectItem>
                    <SelectItem value="Review">Review Petition</SelectItem>
                    <SelectItem value="Reference">Reference</SelectItem>
                    <SelectItem value="Application">Interlocutory Application</SelectItem>
                    <SelectItem value="Writ">Writ Petition</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filing-type" className="text-foreground">
                  Filing Type
                </Label>
                <Select value={filingType} onValueChange={setFilingType}>
                  <SelectTrigger id="filing-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fresh Filing">Fresh Filing</SelectItem>
                    <SelectItem value="Transferred Case">Transferred Case</SelectItem>
                    <SelectItem value="Reopened Case">Reopened Case</SelectItem>
                    <SelectItem value="Remanded Case">Remanded Case</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ==================================================================== */}
        {/* SECTION 5: PRIORITY & SCHEDULING */}
        {/* ==================================================================== */}
        <Card className="shadow-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              Section 5 — Priority & Smart Scheduling Parameters
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Critical inputs consumed by NyayaSetu's deterministic scheduling engine and conflict resolver.
            </p>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="case-priority" className="text-foreground">
                  Case Priority Level <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={priority}
                  onValueChange={(val: "Critical" | "High" | "Medium" | "Low") => setPriority(val)}
                >
                  <SelectTrigger id="case-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Critical">Critical (Immediate Listing)</SelectItem>
                    <SelectItem value="High">High Priority</SelectItem>
                    <SelectItem value="Medium">Medium (Standard Docket)</SelectItem>
                    <SelectItem value="Low">Low Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hearing-duration" className="text-foreground">
                  Expected Hearing Duration <span className="text-destructive">*</span>
                </Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger id="hearing-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes (Mention / Order)</SelectItem>
                    <SelectItem value="30">30 minutes (Short Hearing)</SelectItem>
                    <SelectItem value="45">45 minutes (Arguments)</SelectItem>
                    <SelectItem value="60">60 minutes (Standard Slot)</SelectItem>
                    <SelectItem value="90">90 minutes (Detailed Hearing)</SelectItem>
                    <SelectItem value="120">120 minutes (Trial / Evidence)</SelectItem>
                    <SelectItem value="180">180+ minutes (Extended Trial)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjournments-count" className="text-foreground">
                  Previous Adjournments
                </Label>
                <Input
                  id="adjournments-count"
                  type="number"
                  min={0}
                  value={adjournments}
                  onChange={(e) => setAdjournments(e.target.value)}
                />
              </div>
            </div>

            {/* Urgency Section */}
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Urgent Matter Flag</p>
                  <p className="text-xs text-muted-foreground">
                    Requires expedited listing or immediate ad-interim relief.
                  </p>
                </div>
                <RadioGroup
                  value={isUrgent ? "yes" : "no"}
                  onValueChange={(v) => setIsUrgent(v === "yes")}
                  className="flex items-center gap-4"
                >
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="no" id="urg-no" />
                    <Label htmlFor="urg-no" className="cursor-pointer text-xs">
                      No
                    </Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="yes" id="urg-yes" />
                    <Label htmlFor="urg-yes" className="cursor-pointer text-xs font-semibold text-primary">
                      Yes (Urgent)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {isUrgent && (
                <div className="border-t border-border/70 pt-3 space-y-2">
                  <Label htmlFor="urgency-reason" className="text-xs text-foreground font-medium">
                    Reason for Urgency <span className="text-destructive">*</span>
                  </Label>
                  <Select value={urgencyReason} onValueChange={setUrgencyReason}>
                    <SelectTrigger id="urgency-reason" className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Interim Relief Required">Interim Relief / Injunction Required</SelectItem>
                      <SelectItem value="Risk of Irreparable Harm">Risk of Irreparable Harm / Demolition</SelectItem>
                      <SelectItem value="Time-Sensitive Matter">Time-Sensitive Statutory Deadline</SelectItem>
                      <SelectItem value="Custody Matter">Child Custody / Habeas Corpus</SelectItem>
                      <SelectItem value="Medical Emergency">Medical Emergency / Compassionate Ground</SelectItem>
                      <SelectItem value="Other">Other Documented Urgency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Preferred Slot & Time */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="preferred-hearing-date" className="text-foreground">
                  Preferred Hearing Date <span className="text-xs text-muted-foreground">(Optional)</span>
                </Label>
                <Input
                  id="preferred-hearing-date"
                  type="date"
                  min={today()}
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferred-time" className="text-foreground">
                  Preferred Sitting Window
                </Label>
                <Select value={preferredTime} onValueChange={setPreferredTime}>
                  <SelectTrigger id="preferred-time">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Morning">Morning Session (10:30 AM – 1:00 PM)</SelectItem>
                    <SelectItem value="Afternoon">Afternoon Session (2:00 PM – 4:30 PM)</SelectItem>
                    <SelectItem value="Any Time">Any Available Slot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Scheduling Constraints */}
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-semibold text-foreground">
                  Scheduling Constraints & Bench Preferences
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The engine avoids listing during constraint periods and selects compliant courtrooms.
                </p>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                {SCHEDULING_CONSTRAINTS_LIST.map((sc) => {
                  const checked = selectedConstraints.includes(sc.id);
                  return (
                    <div
                      key={sc.id}
                      onClick={() => handleToggleConstraint(sc.id)}
                      className={`flex items-start gap-2.5 rounded-md border p-2.5 transition-colors cursor-pointer text-xs ${
                        checked ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/30"
                      }`}
                    >
                      <Checkbox
                        id={sc.id}
                        checked={checked}
                        onCheckedChange={() => handleToggleConstraint(sc.id)}
                        className="mt-0.5"
                      />
                      <Label htmlFor={sc.id} className="cursor-pointer text-xs font-normal leading-snug">
                        {sc.label}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Statutory Priority Categories */}
            <div className="space-y-3 border-t border-border pt-4">
              <div>
                <Label className="text-sm font-semibold text-foreground">
                  Statutory Priority Categories
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Documented legal facts establishing statutory priority boosts under High Court guidelines.
                </p>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-3">
                {[
                  {
                    id: "ftsc-pocso",
                    label: "FTSC / POCSO matter",
                    hint: "Fast Track Special Court designation.",
                    checked: ftscPocso,
                    set: setFtscPocso,
                  },
                  {
                    id: "senior-citizen",
                    label: "Senior citizen litigant",
                    hint: "Party aged 65+ on record.",
                    checked: seniorCitizen,
                    set: setSeniorCitizen,
                  },
                  {
                    id: "property-5yr",
                    label: "Property dispute 5+ years",
                    hint: "Long-pending property matter.",
                    checked: propertyDispute5yr,
                    set: setPropertyDispute5yr,
                  },
                ].map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-2.5 rounded-md border border-border p-2.5"
                  >
                    <Checkbox
                      id={item.id}
                      checked={item.checked}
                      onCheckedChange={(v) => item.set(v === true)}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <Label htmlFor={item.id} className="text-xs font-medium cursor-pointer">
                        {item.label}
                      </Label>
                      <p className="text-[10px] text-muted-foreground">{item.hint}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 sm:max-w-xs pt-1">
                <Label htmlFor="statutory-deadline" className="text-xs text-foreground">
                  Statutory Limitation Deadline
                </Label>
                <Input
                  id="statutory-deadline"
                  type="date"
                  value={limitationDeadline}
                  onChange={(e) => setLimitationDeadline(e.target.value)}
                  className="h-9 text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Optional. Engine prioritizes cases with approaching limitation dates.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ==================================================================== */}
        {/* SECTION 6: JUDGE & COURTROOM ASSIGNMENT */}
        {/* ==================================================================== */}
        <Card className="shadow-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              Section 6 — Judge & Courtroom Allocation
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Select manual allocation or use Auto-Assignment driven by specialization, workload and availability.
            </p>
          </CardHeader>
          <CardContent className="grid gap-5 pt-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="preferred-judge" className="text-foreground">
                Preferred Judge
              </Label>
              <Select value={preferredJudge} onValueChange={setPreferredJudge}>
                <SelectTrigger id="preferred-judge">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="auto">
                    ✨ Auto Assign (Recommended by Smart Scheduling)
                  </SelectItem>
                  {(judgesQuery.data ?? []).map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.name} · {j.specialisation || "General Bench"} ({j.current_workload} active)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {preferredJudge === "auto"
                  ? "Smart Scheduling matches judge specialization and balances court workload."
                  : "Assigned bench requested manually by registry."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferred-courtroom" className="text-foreground">
                Courtroom Allocation
              </Label>
              <Select value={preferredCourtroom} onValueChange={setPreferredCourtroom}>
                <SelectTrigger id="preferred-courtroom">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="auto">
                    ✨ Auto Assign (Optimized Room Capacity)
                  </SelectItem>
                  {(courtroomsQuery.data ?? []).map((cr) => (
                    <SelectItem key={cr.id} value={cr.id}>
                      {cr.name} ({cr.type} · cap {cr.capacity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {preferredCourtroom === "auto"
                  ? "Room assigned based on capacity fit and availability without double-booking."
                  : "Specific room requested by registry staff."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ==================================================================== */}
        {/* SECTION 7: ADVOCATE INFORMATION */}
        {/* ==================================================================== */}
        <Card className="shadow-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="size-4 text-primary" />
              Section 7 — Advocate Information & Counsel on Record
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Advocate details for formal service, notification logs, and cause list representation.
            </p>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            {/* Filing Advocate */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Badge className="text-xs">Filing Counsel</Badge>
                <span className="text-xs font-semibold text-foreground">
                  Advocate for Petitioner / Plaintiff
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Advocate Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Adv. Rajesh Sharma"
                    value={filingAdvocateName}
                    onChange={(e) => setFilingAdvocateName(e.target.value)}
                    required
                    className={`h-9 text-sm ${validationErrors["filingAdvocate"] ? "border-destructive" : ""}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bar Council Enrollment Number</Label>
                  <Input
                    placeholder="e.g. MAH/1428/2012"
                    value={filingAdvocateBarNo}
                    onChange={(e) => setFilingAdvocateBarNo(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email Address</Label>
                  <Input
                    type="email"
                    placeholder="advocate@barcouncil.org"
                    value={filingAdvocateEmail}
                    onChange={(e) => setFilingAdvocateEmail(e.target.value)}
                    className={`h-9 text-xs ${validationErrors["filingAdvocateEmail"] ? "border-destructive" : ""}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Mobile Phone Number</Label>
                  <Input
                    placeholder="+91 98111 22334"
                    value={filingAdvocatePhone}
                    onChange={(e) => setFilingAdvocatePhone(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Opposing Advocate */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Badge variant="secondary" className="text-xs">Opposing Counsel</Badge>
                <span className="text-xs font-semibold text-foreground">
                  Advocate for Respondent / Defendant <span className="text-xs text-muted-foreground font-normal">(Optional if unrepresented)</span>
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Advocate Full Name</Label>
                  <Input
                    placeholder="e.g. Adv. Priya Deshmukh"
                    value={opposingAdvocateName}
                    onChange={(e) => setOpposingAdvocateName(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bar Council Enrollment Number</Label>
                  <Input
                    placeholder="e.g. MAH/2890/2015"
                    value={opposingAdvocateBarNo}
                    onChange={(e) => setOpposingAdvocateBarNo(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email Address</Label>
                  <Input
                    type="email"
                    placeholder="opposing.adv@barcouncil.org"
                    value={opposingAdvocateEmail}
                    onChange={(e) => setOpposingAdvocateEmail(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Mobile Phone Number</Label>
                  <Input
                    placeholder="+91 98222 33445"
                    value={opposingAdvocatePhone}
                    onChange={(e) => setOpposingAdvocatePhone(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ==================================================================== */}
        {/* SECTION 8: DOCUMENTS */}
        {/* ==================================================================== */}
        <Card className="shadow-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UploadCloud className="size-4 text-primary" />
              Section 8 — Case Documents & Filings
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Attach certified pleadings, evidence bundles, affidavits and statutory annexures.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="flex flex-wrap items-end gap-3 border-b border-border pb-4">
              <div className="space-y-1.5 flex-1 min-w-[200px]">
                <Label className="text-xs">Document Classification</Label>
                <Select
                  value={newDocType}
                  onValueChange={(v: DocumentRecord["type"]) => setNewDocType(v)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Petition / Plaint">Petition / Plaint</SelectItem>
                    <SelectItem value="Written Statement">Written Statement / Reply</SelectItem>
                    <SelectItem value="Evidence">Evidence / Affidavit in Chief</SelectItem>
                    <SelectItem value="Affidavit">Vakalatnama / Affidavit</SelectItem>
                    <SelectItem value="Supporting Documents">Supporting Documents</SelectItem>
                    <SelectItem value="Previous Orders">Previous Orders / Impugned Order</SelectItem>
                    <SelectItem value="Identity Documents">Identity / Authorization Proof</SelectItem>
                    <SelectItem value="Other">Other Attachment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="doc-upload-input"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleAddSimulatedDocument(file.name);
                      e.target.value = "";
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("doc-upload-input")?.click()}
                  className="h-9 text-xs"
                >
                  <Plus className="size-3.5 mr-1" /> Choose File to Attach
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {documents.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  No documents attached yet. Click above to attach pleadings or affidavits.
                </p>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 p-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="size-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{doc.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {doc.type} · {doc.size} · Uploaded by {doc.uploadedBy} on {doc.uploadedDate}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveDocument(doc.id)}
                      className="h-7 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* ==================================================================== */}
        {/* SECTION 9: ADMINISTRATIVE INFORMATION */}
        {/* ==================================================================== */}
        <Card className="shadow-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              Section 9 — Administrative & Registry Information
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Registry officer assignment, filing branch, and scrutiny workflow status.
            </p>
          </CardHeader>
          <CardContent className="grid gap-5 pt-2 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="registrar-assign" className="text-foreground">
                Scrutinizing Registrar
              </Label>
              <Select value={registrar} onValueChange={setRegistrar}>
                <SelectTrigger id="registrar-assign">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto Assign (Registry Duty Officer)</SelectItem>
                  <SelectItem value="reg-1">Shri. K. Ramanathan (Registrar Judicial)</SelectItem>
                  <SelectItem value="reg-2">Smt. Sunita Verma (Joint Registrar)</SelectItem>
                  <SelectItem value="reg-3">Shri. A. Kulkarni (Deputy Registrar Scrutiny)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filing-location" className="text-foreground">
                Filing Registry Branch
              </Label>
              <Select value={filingLocation} onValueChange={setFilingLocation}>
                <SelectTrigger id="filing-location">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Main Registry">Main Central Registry</SelectItem>
                  <SelectItem value="Civil Registry">Civil Filing Branch</SelectItem>
                  <SelectItem value="Criminal Registry">Criminal Filing Branch</SelectItem>
                  <SelectItem value="Commercial Registry">Commercial Division Registry</SelectItem>
                  <SelectItem value="Family Registry">Family Court Registry</SelectItem>
                  <SelectItem value="Other">E-Filing Portal Registry</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="initial-status" className="text-foreground">
                Initial Docket Status
              </Label>
              <Select
                value={initialStatus}
                onValueChange={(v: "Filed" | "Under Scrutiny" | "Registered" | "Pending") =>
                  setInitialStatus(v)
                }
              >
                <SelectTrigger id="initial-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Filed">Filed (Awaiting Scrutiny)</SelectItem>
                  <SelectItem value="Under Scrutiny">Under Registry Scrutiny</SelectItem>
                  <SelectItem value="Registered">Registered</SelectItem>
                  <SelectItem value="Pending">Pending for Listing</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Initial status for new registration.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Priority Computation Helper Banner */}
        <div className="flex gap-3 rounded-lg border border-dashed border-border bg-card px-4 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground text-xs leading-relaxed">
            <span className="font-medium text-foreground">
              Priority Score & Tier are computed deterministically
            </span>{" "}
            on submission from category urgency ({categoryName}), pendency days ({pending} days),
            previous adjournments ({adjournments}), statutory criteria, and urgency flags.
            Once saved, the case is immediately ready for Smart Scheduling.
          </p>
        </div>

        {/* Form Submission Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/cases">Cancel</Link>
          </Button>
          <Button type="submit" disabled={create.isPending} size="lg">
            {create.isPending ? "Registering Case…" : "Register Case"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}
