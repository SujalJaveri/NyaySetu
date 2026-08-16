import type { jsPDF } from "jspdf";

import { formatDate, statusLabel, type CaseStatus } from "@/lib/cases";
import { timeRange, type CalendarEntry } from "@/lib/calendar";
import type { PriorityBreakdown } from "@/lib/priority";

const NAVY: [number, number, number] = [23, 42, 78];
const GREY: [number, number, number] = [110, 118, 132];
const MARGIN = 42;

async function newDoc() {
  const { jsPDF: Ctor } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new Ctor({ unit: "pt", format: "a4" });
  return { doc, autoTable };
}

function header(doc: jsPDF, title: string, subtitle: string) {
  const width = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.text("NyaySetu", MARGIN, 52);
  doc.setFontSize(11);
  doc.text(title, MARGIN, 72);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text(subtitle, MARGIN, 88);
  doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, width - MARGIN, 52, {
    align: "right",
  });
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(1);
  doc.line(MARGIN, 98, width - MARGIN, 98);
  doc.setTextColor(0, 0, 0);
  return 116;
}

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text("Internal registry document — decision support only.", MARGIN, height - 24);
    doc.text(`Page ${i} of ${pages}`, width - MARGIN, height - 24, { align: "right" });
  }
}

const tableTheme = {
  theme: "grid" as const,
  styles: {
    font: "helvetica",
    fontSize: 9,
    cellPadding: 5,
    lineColor: [220, 224, 230] as [number, number, number],
  },
  headStyles: {
    fillColor: NAVY,
    textColor: [255, 255, 255] as [number, number, number],
    fontStyle: "bold" as const,
  },
  alternateRowStyles: { fillColor: [246, 247, 250] as [number, number, number] },
  margin: { left: MARGIN, right: MARGIN },
};

export type ScheduleExport = {
  title: string;
  rangeLabel: string;
  scopeLabel: string;
  entries: CalendarEntry[];
};

export async function downloadSchedulePdf(input: ScheduleExport) {
  const { doc, autoTable } = await newDoc();
  const startY = header(doc, input.title, `${input.rangeLabel} · ${input.scopeLabel}`);

  const rows = [...input.entries]
    .sort((a, b) =>
      a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
    )
    .map((e) => [
      formatDate(e.date),
      timeRange(e),
      e.caseNumber,
      e.parties || "—",
      e.judgeName,
      e.courtroomName,
      e.priorityScore === null ? "—" : String(e.priorityScore),
      e.status,
    ]);

  autoTable(doc, {
    ...tableTheme,
    startY,
    head: [["Date", "Time", "Case", "Parties", "Judge", "Courtroom", "Priority", "Listing"]],
    body: rows.length
      ? rows
      : [["—", "—", "No hearings listed for this selection.", "", "", "", "", ""]],
    columnStyles: { 3: { cellWidth: 96 }, 6: { halign: "center" } },
  });

  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  const endY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY;
  doc.text(`Total hearings: ${input.entries.length}`, MARGIN, endY + 18);

  footer(doc);
  doc.save(`cause-list-${input.rangeLabel.replace(/[^\w]+/g, "-").toLowerCase()}.pdf`);
}

export type CaseReportExport = {
  caseNumber: string;
  category: string;
  status: CaseStatus | string;
  filingDate: string;
  pendingDays: number;
  estimatedMinutes: number;
  adjournments: number;
  priorityScore: number | null;
  parties: string;
  breakdown: PriorityBreakdown | null;
  schedule: { slot: string; judge: string; courtroom: string; status: string } | null;
  adjournmentHistory: { recorded: string; reason: string; slot: string }[];
};

export async function downloadCaseReportPdf(input: CaseReportExport) {
  const { doc, autoTable } = await newDoc();
  let y = header(doc, `Case report — ${input.caseNumber}`, input.parties || "Parties not recorded");

  const section = (label: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(label, MARGIN, y);
    doc.setTextColor(0, 0, 0);
    y += 8;
  };

  const after = () => {
    y =
      ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 26;
  };

  section("Case particulars");
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [["Field", "Value"]],
    body: [
      ["Case number", input.caseNumber],
      ["Category", input.category],
      ["Status", statusLabel[input.status as CaseStatus] ?? String(input.status)],
      ["Filing date", formatDate(input.filingDate)],
      ["Pending duration", `${input.pendingDays} days`],
      ["Estimated hearing", `${input.estimatedMinutes} minutes`],
      ["Previous adjournments", String(input.adjournments)],
      ["Priority score", input.priorityScore === null ? "—" : `${input.priorityScore} / 100`],
      ["Parties involved", input.parties || "—"],
    ],
    columnStyles: { 0: { cellWidth: 150, fontStyle: "bold" } },
  });
  after();

  if (input.breakdown) {
    section("Priority breakdown");
    autoTable(doc, {
      ...tableTheme,
      startY: y,
      head: [["Factor", "Detail", "Weight", "Points"]],
      body: [
        ...input.breakdown.factors.map((f) => [
          f.label,
          f.detail,
          `${f.weight}`,
          f.points.toFixed(1),
        ]),
        ["Total", "Deterministic score out of 100", "", `${input.breakdown.score}`],
      ],
      columnStyles: {
        2: { halign: "center", cellWidth: 55 },
        3: { halign: "right", cellWidth: 55 },
      },
    });
    after();
  }

  section("Current schedule");
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [["Hearing slot", "Judge", "Courtroom", "Listing status"]],
    body: input.schedule
      ? [
          [
            input.schedule.slot,
            input.schedule.judge,
            input.schedule.courtroom,
            input.schedule.status,
          ],
        ]
      : [["No active hearing scheduled", "—", "—", "—"]],
  });
  after();

  if (input.adjournmentHistory.length) {
    section("Adjournment history");
    autoTable(doc, {
      ...tableTheme,
      startY: y,
      head: [["Recorded", "Reason", "Previous slot"]],
      body: input.adjournmentHistory.map((a) => [a.recorded, a.reason || "—", a.slot]),
    });
    after();
  }

  footer(doc);
  doc.save(`case-report-${input.caseNumber.toLowerCase()}.pdf`);
}

export type ComplianceExport = {
  generatedFor: string;
  summaryLine: string;
  outcomes: { label: string; count: number; percent: number }[];
  issued: number;
  overrides: { label: string; value: string }[];
  tiers: { tier: string; count: number; percent: number }[];
  tierOne: { label: string; value: string }[];
  auditWindow: { entries: number; from: string; to: string };
};

export async function downloadCompliancePdf(input: ComplianceExport) {
  const { doc, autoTable } = await newDoc();
  const width = doc.internal.pageSize.getWidth();
  let y = header(doc, "Governance & compliance report", input.generatedFor);

  const section = (label: string) => {
    // Keep a heading with at least the first rows of its table.
    if (y > doc.internal.pageSize.getHeight() - 150) {
      doc.addPage();
      y = 60;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(label, MARGIN, y);
    doc.setTextColor(0, 0, 0);
    y += 8;
  };
  const after = () => {
    y =
      ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 26;
  };
  const paragraph = (text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    const lines = doc.splitTextToSize(text, width - MARGIN * 2) as string[];
    doc.text(lines, MARGIN, y);
    doc.setTextColor(0, 0, 0);
    y += lines.length * 12 + 18;
  };

  section("Regulation 9 — continuous monitoring and periodic audits");
  y += 6;
  paragraph(
    "This report is produced as evidence for Regulation 9 of the Supreme Court's Draft Regulations for the Use of AI in Courts, which requires continuous monitoring of AI-assisted tools and periodic audits of their outputs. Every figure is computed from records held by this system — recommendations issued, registrar decisions on them, manual overrides of the suggested listing order, and the immutable audit trail. No figure is estimated or projected.",
  );

  section("Summary");
  y += 6;
  paragraph(input.summaryLine);

  section("Recommendation outcomes");
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [["Outcome", "Count", "Share of recommendations issued"]],
    body: [
      ...input.outcomes.map((o) => [o.label, String(o.count), `${o.percent}%`]),
      ["Total issued", String(input.issued), "100%"],
    ],
    columnStyles: { 1: { halign: "right", cellWidth: 70 }, 2: { halign: "right", cellWidth: 170 } },
  });
  after();

  section("Human overrides — cause list");
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [["Measure", "Value"]],
    body: input.overrides.map((o) => [o.label, o.value]),
    columnStyles: { 0: { cellWidth: 260, fontStyle: "bold" } },
  });
  after();

  section("Priority tier distribution");
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [["Priority tier", "Cases", "Share of all cases"]],
    body: input.tiers.map((t) => [t.tier, String(t.count), `${t.percent}%`]),
    columnStyles: { 1: { halign: "right", cellWidth: 70 }, 2: { halign: "right", cellWidth: 170 } },
  });
  after();

  section("Tier 1 responsiveness");
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [["Measure", "Value"]],
    body: input.tierOne.map((t) => [t.label, t.value]),
    columnStyles: { 0: { cellWidth: 260, fontStyle: "bold" } },
  });
  after();

  section("Audit trail coverage");
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [["Measure", "Value"]],
    body: [
      ["Audit entries examined", String(input.auditWindow.entries)],
      ["Earliest entry", input.auditWindow.from],
      ["Latest entry", input.auditWindow.to],
    ],
    columnStyles: { 0: { cellWidth: 260, fontStyle: "bold" } },
  });
  after();

  footer(doc);
  doc.save(`governance-compliance-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
