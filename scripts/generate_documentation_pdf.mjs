import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";
import path from "path";

const doc = new jsPDF({
  orientation: "portrait",
  unit: "pt",
  format: "a4",
});

const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
const pageHeight = doc.internal.pageSize.getHeight(); // 841.89 pt
const margin = 46;
const contentWidth = pageWidth - margin * 2; // 503.28 pt

// Colors
const NAVY = [23, 42, 78];
const GOLD = [170, 120, 35];
const CHARCOAL = [35, 40, 48];
const MUTED = [100, 110, 125];
const LIGHT_BG = [246, 248, 251];
const LINE_COLOR = [215, 222, 230];

let currentY = margin;

function checkPage(neededHeight = 40) {
  if (currentY + neededHeight > pageHeight - margin - 25) {
    doc.addPage();
    currentY = margin + 20;
    drawRunningHeader();
  }
}

function drawRunningHeader() {
  const pageNum = doc.getNumberOfPages();
  if (pageNum === 1) return;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("NyayaSetu — Master Technical & System Documentation", margin, margin - 10);
  doc.text("Indian Judiciary Smart Court Case Scheduling Platform", pageWidth - margin, margin - 10, { align: "right" });
  doc.setDrawColor(...LINE_COLOR);
  doc.setLineWidth(0.5);
  doc.line(margin, margin - 4, pageWidth - margin, margin - 4);
}

function addTitle(text, level = 1) {
  if (level === 1) {
    checkPage(65);
    currentY += 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...NAVY);
    doc.text(text, margin, currentY);
    currentY += 5;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(1.5);
    doc.line(margin, currentY, margin + 70, currentY);
    currentY += 14;
  } else if (level === 2) {
    checkPage(35);
    currentY += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(text, margin, currentY);
    currentY += 12;
  } else if (level === 3) {
    checkPage(25);
    currentY += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...GOLD);
    doc.text(text, margin, currentY);
    currentY += 10;
  }
}

function addParagraph(text, spacing = 6) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...CHARCOAL);
  const lines = doc.splitTextToSize(text, contentWidth);
  for (const line of lines) {
    checkPage(13);
    doc.text(line, margin, currentY);
    currentY += 11.5;
  }
  currentY += spacing;
}

function addBullet(bulletTitle, bulletText) {
  checkPage(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  const prefix = "•  " + bulletTitle + ": ";
  doc.text(prefix, margin, currentY);
  const prefixWidth = doc.getTextWidth(prefix);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...CHARCOAL);
  
  const words = bulletText.split(" ");
  let line = "";
  let isFirst = true;
  for (let i = 0; i < words.length; i++) {
    const testLine = line ? line + " " + words[i] : words[i];
    const maxWidth = isFirst ? contentWidth - prefixWidth : contentWidth - 12;
    if (doc.getTextWidth(testLine) <= maxWidth) {
      line = testLine;
    } else {
      checkPage(13);
      doc.text(line, isFirst ? margin + prefixWidth : margin + 12, currentY);
      currentY += 11.5;
      isFirst = false;
      line = words[i];
    }
  }
  if (line) {
    checkPage(13);
    doc.text(line, isFirst ? margin + prefixWidth : margin + 12, currentY);
    currentY += 11.5;
  }
  currentY += 3;
}

function addCallout(title, text) {
  checkPage(50);
  const lines = doc.splitTextToSize(text, contentWidth - 20);
  const boxHeight = lines.length * 11 + 24;
  
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(margin, currentY, contentWidth, boxHeight, 3, 3, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.5);
  doc.line(margin, currentY, margin, currentY + boxHeight);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...NAVY);
  doc.text(title, margin + 10, currentY + 14);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...CHARCOAL);
  let textY = currentY + 26;
  for (const line of lines) {
    doc.text(line, margin + 10, textY);
    textY += 11;
  }
  currentY += boxHeight + 10;
}

function addTable(headers, rows) {
  checkPage(60);
  autoTable(doc, {
    startY: currentY,
    head: [headers],
    body: rows,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 4,
      textColor: CHARCOAL,
      lineColor: LINE_COLOR,
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [250, 251, 253],
    },
    margin: { left: margin, right: margin },
  });
  currentY = doc.lastAutoTable.finalY + 12;
}

// -------------------------------------------------------------
// COVER PAGE
// -------------------------------------------------------------
doc.setFillColor(...NAVY);
doc.rect(0, 0, pageWidth, 240, "F");

doc.setFont("helvetica", "bold");
doc.setFontSize(26);
doc.setTextColor(255, 255, 255);
doc.text("NYAYASETU (Bridge to Justice)", margin, 80);

doc.setFont("helvetica", "normal");
doc.setFontSize(12);
doc.setTextColor(220, 230, 245);
doc.text("AI-Assisted Smart Court Case Scheduling & Cause-List Optimisation Platform", margin, 105);

doc.setFontSize(9.5);
doc.setTextColor(...GOLD);
doc.text("OFFICIAL SYSTEM SPECIFICATION & COMPREHENSIVE ARCHITECTURAL REPORT", margin, 130);

doc.setDrawColor(...GOLD);
doc.setLineWidth(1.5);
doc.line(margin, 145, pageWidth - margin, 145);

doc.setFont("helvetica", "normal");
doc.setFontSize(8.5);
doc.setTextColor(205, 220, 240);
doc.text("Target Domain: Indian District & Taluka Courts | National Judicial Data Grid (NJDG) Synergy", margin, 165);
doc.text("Fullstack SSR Architecture: React 19 + TanStack Start + Nitro Engine + Supabase PostgreSQL", margin, 180);
doc.text("Audience: Software Engineers, Academic Evaluators, Court Administrators & Judicial Officers", margin, 195);

currentY = 265;

addCallout(
  "EXECUTIVE SUMMARY & DOCUMENT INTENT",
  "NyayaSetu is an enterprise-grade judicial infrastructure platform engineered to eliminate scheduling bottlenecks, advocate double-bookings, and arbitrary hearing listings across Indian District and Taluka courts. Unlike opaque AI tools, NyayaSetu introduces deterministic constraint-based mathematical optimization combined with explainable AI receipts, human-in-the-loop registrar oversight, and multi-persona portals. This comprehensive document details the entire technical architecture, domain logic, data models, and user journeys."
);

addTitle("MASTER TABLE OF CONTENTS (26-PART TECHNICAL SPECIFICATION)", 2);

const tocData = [
  ["Part 1: Project Introduction", "Part 10: Complete Data Flow", "Part 19: Deployment Architecture"],
  ["Part 2: Project Story & Concept", "Part 11: Backend API & Server Functions", "Part 20: How Project Works Internally"],
  ["Part 3: Technology Stack Breakdown", "Part 12: Database Schema & PostgreSQL RLS", "Part 21: Code Architecture & Key Symbols"],
  ["Part 4: System Architecture & Tiers", "Part 13: Authentication & Role Management", "Part 22: Architectural Evolution & Choices"],
  ["Part 5: Project Folder & File Guide", "Part 14: UI/UX & Judicial Design System", "Part 23: System Strengths & Innovations"],
  ["Part 6: Complete Application Flow", "Part 15: Detailed Persona User Journeys", "Part 24: Current Limitations & Constraints"],
  ["Part 7: Screen & Route Catalog", "Part 16: Business Logic & Priority Scoring", "Part 25: Future Development Roadmap"],
  ["Part 8: Major Functional Features", "Part 17: Integrations & External AI Gates", "Part 26: Complete Executive Summary"],
  ["Part 9: Component Architecture", "Part 18: Configuration & Environment", "Official Project Appendix & Sign-Off"],
];

addTable(["Parts 1 to 9", "Parts 10 to 18", "Parts 19 to 26"], tocData);

doc.addPage();
currentY = margin + 20;
drawRunningHeader();

// PART 1
addTitle("PART 1 — PROJECT INTRODUCTION", 1);
addParagraph("Project Name: NyayaSetu (Sanskrit: 'Bridge to Justice' / Court Scheduler Pro).");
addParagraph("Project Type: Fullstack Production-Grade Judicial Case Scheduling, Hearing Roster Management & Cause-List Optimization Platform.");
addParagraph("Purpose: NyayaSetu addresses the staggering pendency crisis of over 4.5 crore (45 million) pending cases in the Indian judicial system—where more than 85% reside in District and Taluka courts. The root operational bottleneck in district courts is not merely a shortage of judges, but the archaic, manual, and arbitrary process of scheduling hearings and compiling the daily 'cause list' (the daily board of cases heard by a judge).");
addParagraph("Why This Problem Exists: Traditionally, court clerks (peshkars/registrars) manually list 100 to 150 cases per courtroom per day using physical ledgers. This creates chronic advocate schedule clashes (the same advocate being listed in 3 different courtrooms simultaneously), massive judge overwork, unpredictable courtroom allocation, and a persistent culture of repeated adjournments. Litigants travel dozens of kilometers to court, only to discover their matter has been adjourned without being heard.");
addParagraph("Target Personas: (1) Court Registrars & Administrative Staff who intake cases, assign hearings, and publish daily cause lists; (2) Judicial Officers (Judges) who require clean, conflict-free daily boards with explainable listing rationale; (3) Litigants & Advocates who require transparent, multilingual, mobile-friendly case tracking without intermediaries.");
addParagraph("Main Objectives: Enforce deterministic hard constraints (preventing double-booking of judges, rooms, and advocates); provide explainable soft preference scoring (prioritizing senior citizens, POCSO/FTSC cases, long-pending property disputes); maintain complete human-in-the-loop auditability; and offer transparent citizen access.");
addParagraph("What Makes It Different From a Basic Website: NyayaSetu is not a simple CRUD wrapper or form-filler. It implements a multi-tier constraint satisfaction engine, predictive adjournment risk modeling, live what-if simulation for courtroom closures, and draft Regulation 9 compliance tracking for judicial AI oversight.");

// PART 2
addTitle("PART 2 — PROJECT STORY / CONCEPT", 1);
addParagraph("The Reality in District Courts: Imagine Shri Ramesh, a 71-year-old retired schoolteacher in a district in Maharashtra, fighting a land boundary dispute since 2018. His hearing date is set manually every three months. On each date, he takes a morning bus to the district court. Upon arrival, he finds his case is Item #94 on Courtroom 3's cause list. By 3:30 PM, the judge has only been able to reach Item #32 due to time constraints, and Ramesh's matter is adjourned to another distant date without being called.");
addParagraph("Simultaneously, Advocate Mehra represents Ramesh but also has urgent bail matters listed at the exact same hour in Courtroom 1 and Courtroom 4. Because there is no cross-courtroom synchronization, Advocate Mehra is forced to send junior proxy counsel to seek adjournments.");
addParagraph("How NyayaSetu Transforms This Journey: With NyayaSetu, the court registry no longer guesses sitting dates. When a case is filed, the deterministic scheduling engine analyzes statutory priority tags (POCSO, senior citizen, statutory limitation), case complexity, and historical durations. It evaluates open slots across judicial benches, verifies that neither the judge nor the courtroom is double-booked, and ranks open slots based on judge specialization and workload balance.");
addParagraph("The registrar reviews the top-ranked recommendation, accompanied by an explicit 'Decision Receipt' explaining why that slot was chosen. Once confirmed, a conflict-free daily cause list is generated. Ramesh receives SMS/portal visibility in Hindi, Marathi, or English, knowing his exact cause-list position and estimated reporting time.");

// PART 3
addTitle("PART 3 — TECHNOLOGY STACK", 1);
addParagraph("The application leverages modern web and edge infrastructure designed for maximum reliability and type safety:");
addBullet("React 19.2.0", "Core frontend component rendering library. Utilizes modern hook paradigms, transition management, and concurrent features.");
addBullet("TanStack Start & Router", "Fullstack SSR meta-framework and type-safe router. Powers isomorphic server functions under src/lib/*.functions.ts and handles file-based routing with zero runtime route mismatches.");
addBullet("Nitro Engine (v3 beta)", "High-performance universal server engine compiling to Cloudflare Workers edge module presets.");
addBullet("Tailwind CSS v4.2.1", "Next-generation CSS engine using inline theme tokens and OKLCH color spaces tailored to a dignified judicial aesthetic.");
addBullet("Radix UI Primitives", "Accessible, unstyled UI primitives powering accessible Dialogs, Selects, Dropdowns, Tabs, and Sliders with full keyboard navigation and ARIA tags.");
addBullet("Supabase PostgreSQL", "Cloud database storing relational tables, enforced by Postgres Row Level Security (RLS) policies, database functions (has_role), and automated triggers.");
addBullet("Google Gemini 3.5 Flash", "Primary multimodal LLM engine utilized inside the Registry Assistant panel to parse natural language questions into database insights.");
addBullet("Groq LLaMA 3.3 Failover", "Sub-second AI inference engine providing seamless backup if primary Gemini API quotas are reached.");
addBullet("Recharts & D3", "Powers interactive data visualizations for the Backlog Simulator, Pendency Projections, and Courtroom Heatmaps.");
addBullet("jsPDF & jspdf-autotable", "Generates official, print-ready cause lists, compliance reports, and calendar schedules directly within the browser.");
addBullet("Zod & React Hook Form", "Validates case intake inputs, party records, and server function payloads with strict runtime schema verification.");

// PART 4
addTitle("PART 4 — SYSTEM ARCHITECTURE", 1);
addParagraph("NyayaSetu is architected around a 5-tier fullstack architecture:");
addBullet("Tier 1: Client / Browser Presentation", "React 19 single-page client running TanStack Router, providing responsive interfaces for Desktop, Tablet, and Mobile devices.");
addBullet("Tier 2: Edge Routing & SSR Gateway", "Nitro server running on Cloudflare Workers edge runtime. Renders initial HTML shells and dispatches isomorphic server functions.");
addBullet("Tier 3: Isomorphic Server Functions", "Type-safe server actions created with createServerFn({ method: 'POST' }). Handles authentication validation, input sanitization, rate-limiting, and AI gateway dispatch.");
addBullet("Tier 4: Business Logic & Deterministic Engines", "Pure, side-effect-free algorithms (scheduling.ts, priority.ts, conflicts.ts, simulation.ts) that compute constraint satisfaction and scoring without cloud or model dependencies.");
addBullet("Tier 5: Persistence & Security Layer", "Supabase PostgreSQL database with Row Level Security. Authenticated staff query tables through scoped sessions; server admin operations utilize service-role clients.");

doc.addPage();
currentY = margin + 20;
drawRunningHeader();

// PART 5
addTitle("PART 5 — PROJECT FOLDER STRUCTURE", 1);
addParagraph("The codebase follows a modular, feature-oriented structure:");
addBullet("src/routes/", "File-based routes managed by TanStack Router. Includes public routes (__root.tsx, index.tsx, auth.tsx, case-status.tsx, setup-admin.tsx) and authenticated routes under _authenticated/.");
addBullet("src/routes/_authenticated/", "Protected workspace routes including dashboard.tsx, smart-scheduling.tsx, cause-list.tsx, bench.tsx, conflicts.tsx, what-if-simulation.tsx, backlog-simulator.tsx, governance.tsx, activity-log.tsx, reports.tsx, and admin.tsx.");
addBullet("src/lib/", "Domain logic core. Houses scheduling.ts (the constraint engine), priority.ts (scoring equations), holidays.ts (court calendar closures), cases.ts, conflicts.ts, assistant.ts, and all *.functions.ts server endpoints.");
addBullet("src/components/", "Reusable UI components. Contains app-sidebar.tsx, top-bar.tsx, case-scheduling-panel.tsx, recommendation-panel.tsx, why-this-order.tsx, confidence-bar.tsx, decision-receipt-card.tsx, and ui/ (Radix wrappers).");
addBullet("src/integrations/supabase/", "Database client factories. Houses client.ts (browser client), client.server.ts (service-role admin client), auth-middleware.ts, and types.ts (PostgreSQL schema types).");
addBullet("supabase/", "Contains database setup scripts (supabase_setup.sql) and 23 historical migrations defining tables, triggers, and RLS policies.");

// PART 6
addTitle("PART 6 — COMPLETE APPLICATION FLOW", 1);
addParagraph("When a user accesses NyayaSetu, the lifecycle proceeds through precise execution stages:");
addBullet("1. Request Initialization", "The client browser sends an HTTP request to the edge server. The Nitro engine intercepts the request.");
addBullet("2. Root Shell SSR", "src/routes/__root.tsx renders the root HTML document, injecting fonts, CSS stylesheets, and TanStack Start hydration scripts.");
addBullet("3. Client Route Resolution", "TanStack Router loads the route definition on the client. For protected routes (_authenticated), beforeLoad executes in src/routes/_authenticated/route.tsx.");
addBullet("4. Auth Guard & Scope Check", "beforeLoad queries supabase.auth.getSession(). If null, it throws a redirect to /auth. If the user is a judicial officer, BenchScopeGuard ensures they are routed to /bench.");
addBullet("5. TanStack Query Fetching", "Active routes execute prefetch queries (e.g., casesQuery, schedulingDataQuery). Cached data renders instantly, while background fetches revalidate stale data.");
addBullet("6. Algorithmic Execution", "When a registrar triggers scheduling, runSchedulingEngine() executes in browser memory, running 1,000+ hard/soft constraint checks in < 5 milliseconds.");
addBullet("7. Server Mutation & Audit", "The registrar confirms a listing. A TanStack server function writes the schedule to PostgreSQL and creates an immutable audit log entry in audit_logs.");

// PART 7
addTitle("PART 7 — EVERY PAGE & SCREEN IN THE APPLICATION", 1);
addParagraph("NyayaSetu features 19 dedicated screens catering to specific judicial workflows:");
addBullet("1. Portal Choice Screen (/) ", "The public entry point allowing users to choose between Judicial Officer Sign-In, Registrar Portal, or Public Case Lookup.");
addBullet("2. Staff Authentication (/auth)", "Unified sign-in screen supporting Judge and Registrar roles with role-specific copy and credential authentication.");
addBullet("3. Public Case Status (/case-status)", "Citizen portal allowing litigants to search by CNR or Case Number with multi-lingual presentation (English, Hindi, Marathi) and cause-list position.");
addBullet("4. Initial Admin Setup (/setup-admin)", "One-time bootstrapping route allowing the creation of the primary administrative authority when the system is initialized.");
addBullet("5. Registry Dashboard (/dashboard)", "The central nerve center displaying key metrics: total pending cases, Tier 1 urgent cases, courtroom utilization rates, and quick action shortcuts.");
addBullet("6. Case Intake Form (/cases/new)", "Comprehensive 2,000+ line case filing workflow capturing acts, sections, parties, advocates, senior citizen flags, and predicted hearing durations.");
addBullet("7. Case Docket View (/cases/$caseId)", "Deep dive into an individual case file, displaying filing timeline, priority score breakdown, adjournment history, and case documents.");
addBullet("8. Smart Scheduling Panel (/smart-scheduling)", "Core listing engine interface. Registrars select pending cases, review algorithmically ranked hearing slots, and view explainability factor receipts.");
addBullet("9. Daily Cause List (/cause-list)", "The court's official daily hearing board. Displays cases ordered by priority tier, supports manual drag-and-drop re-ordering, and exports to official PDF.");
addBullet("10. Judge Bench View (/bench)", "Personal judicial workbench for judges, showing their daily cause list, statutory rationale for listing order, and courtroom workload ceiling.");
addBullet("11. Conflict Detection (/conflicts)", "Quality-assurance dashboard flagging double-bookings, holiday closures, judge unavailability, and courtroom duration clashes.");
addBullet("12. What-If Simulation (/what-if-simulation)", "Predictive modeling tool allowing registrars to simulate judge absences or courtroom repairs, previewing affected cases and automated re-assignments.");
addBullet("13. Backlog Simulator (/backlog-simulator)", "Monte Carlo style 6-month and 12-month pendency projection tool comparing FIFO listing against NyayaSetu's priority-based listing.");
addBullet("14. Governance & Regulation 9 (/governance)", "Regulatory compliance module measuring recommendation acceptance rates, manual overrides, and Tier 1 turnaround metrics for high court audits.");
addBullet("15. Registry Activity Log (/activity-log)", "Cryptographic-style audit trail logging every case creation, schedule confirmation, manual override, and setting change.");
addBullet("16. Registry Reports (/reports)", "Analytical reporting on case category distributions, judge workloads, courtroom utilization rates, and disposal velocity.");
addBullet("17. Priority Settings (/priority-settings)", "Administrative configuration panel allowing court chiefs to calibrate factor weights (case age, limitation, POCSO urgency, judge workload ceiling).");
addBullet("18. Admin Control Panel (/admin)", "Staff management console for issuing registrar accounts, linking judges to judicial benches, and revoking credentials.");
addBullet("19. Courtroom & Judge Registries (/courtrooms, /judges)", "Master asset management for physical courtroom chambers, seating capacities, and judge bench specializations.");

doc.addPage();
currentY = margin + 20;
drawRunningHeader();

// PART 8
addTitle("PART 8 — MAJOR FUNCTIONAL FEATURES", 1);
addParagraph("1. Deterministic Scheduling Engine (Zero Hallucination): Hard constraints (judge unavailability, room bookings, court holidays) are solved as binary filters. Only valid slots advance to soft preference ranking (specialization, workload, earliness).");
addParagraph("2. Multi-Factor Statutory Priority Scoring: Calculates a 0–100 priority score based on legal statutes: POCSO/FTSC (+30 pts), Senior Citizen litigants (+15 pts), 14th Finance Commission 5-yr property disputes (+20 pts), and statutory limitation deadlines.");
addParagraph("3. Batch Cause List Optimizer: Solves whole-day board scheduling by grouping matters into procedural stages: Motion hearings, Admission hearings, Evidence & Witness examination, and Final Arguments.");
addParagraph("4. Real-Time Conflict Detection Scanner: Continuously audits the database to surface hidden clashes before hearings take place, preventing courtroom standstills.");
addParagraph("5. What-If Impact Simulator: Empowers court administrators to handle sudden emergencies (e.g. judicial leave) by testing replacement judges and verifying that reallocated hearings do not violate courtroom capacity.");
addParagraph("6. Public Multilingual Transparency: Provides citizens with real-time access to case status, cause list sequence, and arrival instructions in vernacular languages without requiring court visits.");

// PART 9
addTitle("PART 9 — COMPONENT ARCHITECTURE", 1);
addParagraph("The frontend is constructed using a high-cohesion, component-driven layout:");
addBullet("AppSidebar (src/components/app-sidebar.tsx)", "Responsive navigation rail providing persona-scoped navigation links, live conflict badges, and institutional branding.");
addBullet("TopBar (src/components/top-bar.tsx)", "Header bar housing global search, notifications bell with unread badges, language selector (EN/HI), and staff profile menu.");
addBullet("CaseSchedulingPanel & RecommendationPanel", "Core operational panels rendering candidate slot cards, confidence progress bars, and soft-factor breakdown accordions.");
addBullet("DecisionReceiptCard (src/components/decision-receipt-card.tsx)", "Visual receipt component showing the hard constraints passed, soft factor weights, and timestamped registrar confirmation.");
addBullet("AssistantPanel (src/components/assistant-panel.tsx)", "Slide-out drawer housing the registry AI assistant with Markdown rendering, suggested prompts, and live database query responses.");

// PART 10
addTitle("PART 10 — DATA FLOW", 1);
addParagraph("Concrete Data Flow Example — Scheduling a Case:");
addParagraph("1. User selects Case 'CRL/2026/0104' on /smart-scheduling.");
addParagraph("2. TanStack Query evaluates casesQuery and schedulingDataQuery (fetching judges, courtrooms, slots, availability).");
addParagraph("3. runSchedulingEngine() executes in the browser client, testing 3 judges × 4 rooms × 8 slots = 96 permutations.");
addParagraph("4. Hard constraint checks eliminate 82 invalid permutations; soft preference scoring ranks the top 14 candidates.");
addParagraph("5. User reviews Candidate #1 (Judge Hon. K. Sharma, Courtroom 2, 10:30 AM) and clicks 'Confirm Listing'.");
addParagraph("6. TanStack Server Function recordDecision() executes a POST request with JWT authentication.");
addParagraph("7. Supabase inserts a confirmed schedule row into public.schedules and creates an audit record in public.audit_logs.");
addParagraph("8. QueryClient invalidates schedulesQuery; the UI re-renders, displaying the confirmed decision receipt.");

// PART 11
addTitle("PART 11 — API & BACKEND EXPLANATION", 1);
addParagraph("NyayaSetu leverages isomorphic server functions powered by @tanstack/react-start. Key endpoints include:");
addBullet("askRegistryAssistant (src/lib/assistant.functions.ts)", "POST endpoint accepting { question: string }. Sanitizes input, enforces rate-limiting, queries live registry stats, and streams Gemini/Groq responses.");
addBullet("lookupCaseStatus (src/lib/case-status.functions.ts)", "Public POST endpoint validating { caseNumber: string } and returning public hearing dates, courtroom numbers, and daily cause-list positions.");
addBullet("createFirstAdmin (src/lib/setup-admin.functions.ts)", "One-time bootstrapping POST endpoint creating the initial administrative authority with email and password.");
addBullet("createRegistryAccount (src/lib/admin-accounts.functions.ts)", "Admin-only POST endpoint creating registrar and bench credentials and linking judges to user accounts.");
addBullet("translateCaseStatus (src/lib/case-status-translate.functions.ts)", "Translates case particulars and legal proceedings into Hindi and Marathi using AI language models.");

doc.addPage();
currentY = margin + 20;
drawRunningHeader();

// PART 12
addTitle("PART 12 — DATABASE & DATA STORAGE", 1);
addParagraph("NyayaSetu utilizes PostgreSQL managed via Supabase. Core relational schema:");
const dbSchema = [
  ["cases", "id, case_number, category_id, filing_date, status, parties, priority_score, priority_tier"],
  ["judges", "id, name, specialisation, current_workload, user_id"],
  ["courtrooms", "id, name, capacity, type, current_allocation"],
  ["hearing_slots", "id, date, start_time, end_time"],
  ["schedules", "id, case_id, judge_id, courtroom_id, slot_id, status, cause_list_position"],
  ["case_categories", "id, name, typical_duration_minutes"],
  ["priority_settings", "id, weights (jsonb), max_judge_workload, limitation_threshold_days"],
  ["audit_logs", "id, user_id, action, entity_type, entity_id, details (jsonb), timestamp"],
  ["profiles & user_roles", "id, full_name, role ('admin' | 'registrar' | 'judge')"],
];
addTable(["Table Name", "Primary Columns & Attributes"], dbSchema);
addParagraph("Row Level Security (RLS) is enabled across all tables. Staff can view registry tables, administrators have full write permissions, and judicial officers are scoped to their bench records.");

// PART 13
addTitle("PART 13 — AUTHENTICATION & USER MANAGEMENT", 1);
addParagraph("Authentication is managed via Supabase Auth with JSON Web Tokens (JWT):");
addBullet("Public Registration", "Disabled by design. Court personnel cannot self-register; credentials are provisioned by registry administrators.");
addBullet("Session Persistence", "Client sessions persist securely in browser storage. State changes trigger onAuthStateChange, synchronizing query cache invalidation.");
addBullet("Role-Based Access Control", "Enforced via user_roles table and the has_role(uid, role) database function. Evaluated on both client routes and server function middleware.");

// PART 14
addTitle("PART 14 — UI/UX & JUDICIAL DESIGN SYSTEM", 1);
addParagraph("Design Philosophy: A dignified, authoritative, paper-inspired visual aesthetic designed for high data density, long working hours, and zero eye fatigue.");
addBullet("Color Tokens (OKLCH)", "Ink Navy (oklch(0.24 0.058 255)) for authority, Muted Brass (oklch(0.67 0.075 84)) for judicial accents, and Parchment (oklch(0.973 0.008 92)) for calm readability.");
addBullet("Typography", "IBM Plex Sans paired with tabular figures (tabular-nums), ensuring case numbers, CNR numbers, and hearing times align perfectly across tables.");
addBullet("Accessibility", "Adheres to WCAG 2.1 AA standards. High contrast ratios (11.4:1 on primary text), explicit form label bindings, and visible keyboard focus rings.");

// PART 15
addTitle("PART 15 — DETAILED USER JOURNEYS", 1);
addParagraph("Journey 1: Court Registrar Morning Workflow:");
addParagraph("1. Registrar signs in at /auth with official email. Dashboard displays 14 pending cases and 2 detected conflicts.");
addParagraph("2. Registrar navigates to /conflicts, identifies a double-booked courtroom, and resolves it.");
addParagraph("3. Registrar opens /smart-scheduling, runs the engine on newly filed POCSO matters, and accepts top recommendations.");
addParagraph("4. Registrar navigates to /cause-list, reviews the daily board, fine-tunes slot order, and publishes the official PDF.");
addParagraph("Journey 2: Judicial Officer Bench Workflow:");
addParagraph("1. Judge logs in and is automatically routed to /bench.");
addParagraph("2. Judge reviews today's 25 listed cases, viewing the legal factors behind the listing order via 'Why This Order'.");
addParagraph("3. Judge uses the Custom Judicial Schedule modal to block out afternoon chamber hours for judgment writing.");

// PART 16
addTitle("PART 16 — BUSINESS LOGIC & PRIORITY SCORING", 1);
addParagraph("Deterministic Scoring Equations:");
addParagraph("Priority Score P = min(100, Sum(Weight_i * Ratio_i)), where factors include: Case Age (30%), Mandated Fast-Track Category (30%), Senior Citizen Litigant (15%), Limitation Urgency (15%), and Adjournment Count (10%).");
addParagraph("Soft Preference Fit S = W_spec * SpecMatch + W_work * (1 - WorkloadRatio) + W_util * (1 - RoomLoadRatio) + W_early * Earliness.");
addParagraph("Deterministic Confidence Score = 15 (Base Hard Filter Clearance) + 85 * Normalized Soft Fit.");

doc.addPage();
currentY = margin + 20;
drawRunningHeader();

// PART 17
addTitle("PART 17 — THIRD-PARTY SERVICES & INTEGRATIONS", 1);
addBullet("Supabase Cloud", "Provides PostgreSQL database hosting, authentication engine, and row-level authorization.");
addBullet("Google Gemini API", "Powers conversational natural-language queries inside the Registry Assistant panel.");
addBullet("Groq Cloud", "Ultra-fast Llama-3 inference serving as a secondary failover engine for the AI assistant.");

// PART 18
addTitle("PART 18 — CONFIGURATION & ENVIRONMENT", 1);
addParagraph("Configuration files define fullstack operation without exposing private secrets:");
addBullet("vite.config.ts", "Configures Vite plugins (@tanstack/react-start/plugin/vite, nitro/vite, tailwindcss) and SSR server entry points.");
addBullet("tsconfig.json", "Enforces strict TypeScript compilation, ESNext module resolution, and path aliases (@/* -> ./src/*).");
addBullet(".env & Environment Variables", "SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, and GROQ_API_KEY.");

// PART 19
addTitle("PART 19 — DEPLOYMENT ARCHITECTURE", 1);
addParagraph("NyayaSetu is deployed as a universal edge service on Cloudflare Workers utilizing Nitro:");
addBullet("Build Pipeline", "npm run build executes vite build followed by node scripts/patch-ssr-circular.mjs, generating .output/server/ and .output/public/.");
addBullet("Edge Hosting", "Nitro compiles server handlers into Cloudflare Worker format, enabling sub-50ms cold starts across global edge nodes.");
addBullet("Static Assets", "Public assets (fonts, icons, compiled JS/CSS) are served via Cloudflare edge cache with immutable cache headers.");

// PART 20
addTitle("PART 20 — HOW THE PROJECT WORKS INTERNALLY", 1);
addParagraph("Detailed Internal Execution Trace: Running Smart Scheduling:");
addParagraph("1. User clicks 'Run Scheduling Engine' on src/routes/_authenticated/smart-scheduling.tsx.");
addParagraph("2. Event handler triggers runSchedulingEngine(targetCase, engineData).");
addParagraph("3. Function loops through slots. For each slot, it queries checkCourtHoliday(slot.date). If true, increments holidayClosure rejection count.");
addParagraph("4. Checks isEntityUnavailable() against judges and courtrooms. If unavailable, increments judgeUnavailable count.");
addParagraph("5. Checks existing active schedules. If a booking exists for that judge or room on that date and time, increments booked count.");
addParagraph("6. Surviving candidates are evaluated by scoreCombo(). Calculates specialisationMatch(judge, category), judge workload ratio, and courtroom utilization ratio.");
addParagraph("7. Output object EngineResult containing ranked candidates, rejection counts, and blockedCandidate fallback is returned.");
addParagraph("8. React component sets result state; UI displays the top candidate with confidence bar and factor breakdown.");

// PART 21
addTitle("PART 21 — CORE CODE SYMBOLS & ARCHITECTURE", 1);
addBullet("runSchedulingEngine() (src/lib/scheduling.ts)", "Deterministic constraint satisfaction solver. Evaluates 7 hard constraints and 4 soft preference dimensions.");
addBullet("recomputeCasePriority() (src/lib/priority.ts)", "Calculates mathematical priority scores and assigns Tier 1, Tier 2, or Tier 3 status to cases.");
addBullet("scanSystemConflicts() (src/lib/conflicts.ts)", "Audits live database schedules to identify booking clashes and workload breaches.");
addBullet("queryLLM() (src/lib/ai.server.ts)", "Dual-engine AI interface routing queries across Gemini 3.5 Flash and Groq LLaMA 3.3.");
addBullet("useCurrentStaff() (src/hooks/use-current-staff.ts)", "Custom React hook providing reactive authenticated staff role, judge link, and permission sets.");

// PART 22
addTitle("PART 22 — ARCHITECTURAL EVOLUTION & CHOICES", 1);
addParagraph("1. Why Deterministic Engine over Pure LLM: Early prototypes explored using LLMs to schedule cases. This was rejected because judicial scheduling requires zero hallucinations, mathematical proof of no double-booking, and compliance with court procedural codes.");
addParagraph("2. Why TanStack Start over Next.js: Selected for superior type-safe router contracts, isomorphic server functions, and native integration with TanStack Query and Nitro edge compiling.");

// PART 23
addTitle("PART 23 — STRENGTHS OF THE PROJECT", 1);
addParagraph("• Absolute Explainability: Every listing decision produces an explicit receipt documenting statutory weights.");
addParagraph("• Strict Constitutional Adherence: Protects judicial independence by keeping judges in control of their benches.");
addParagraph("• Real-World Legal Grounding: Models real Indian legal statutes (BNS, POCSO, Senior Citizens Act, Limitation Act).");
addParagraph("• Flawless Type Safety: Zero compiler errors across 100+ source files under strict TypeScript.");

// PART 24
addTitle("PART 24 — CURRENT LIMITATIONS", 1);
addParagraph("• Lack of Automated Test Suite: Currently lacks Vitest or Playwright test suites.");
addParagraph("• Single Court Complex Model: Currently optimized for a single district court complex rather than multi-court federations.");
addParagraph("• CIS 3.0 API Dependency: Requires production API integration with the official eCourts Case Information System (CIS).");

// PART 25
addTitle("PART 25 — FUTURE ROADMAP", 1);
addParagraph("Short-Term (1–3 Months): Integrate Vitest unit testing, configure automated CI/CD pipelines, and patch edge rate-limiting with Upstash Redis.");
addParagraph("Medium-Term (3–6 Months): Direct integration with eCourts CIS 3.0 APIs, lawyer schedule synchronization across district benches, and automated SMS/WhatsApp hearing alerts.");
addParagraph("Long-Term (6–12 Months): Nationwide NJDG interoperability, state-wide high court analytics dashboards, and automated translation across all 22 official Indian languages.");

// PART 26
addTitle("PART 26 — COMPLETE EXECUTIVE SUMMARY", 1);
addParagraph("NyayaSetu (Court Scheduler Pro) represents a paradigm shift in judicial administration technology. By combining rigorous, deterministic constraint-satisfaction algorithms with human-in-the-loop oversight and accessible, multi-lingual citizen portals, NyayaSetu solves the root operational cause of court delays in India.");
addParagraph("Engineered on React 19, TanStack Start, Nitro, and Supabase PostgreSQL, the system eliminates courtroom double-bookings, balances judicial workloads, and provides explainable, statutory priority ranking. It bridges the gap between complex legal administration and citizen access to justice, serving as a scalable, production-ready foundation for the future of digital justice.");

// Save the PDF
const outputPath = path.join(process.cwd(), "NyayaSetu_Technical_Documentation_Report.pdf");
const buffer = Buffer.from(doc.output("arraybuffer"));
fs.writeFileSync(outputPath, buffer);

console.log(`✅ Documentation PDF successfully generated at: ${outputPath}`);
console.log(`Total Pages: ${doc.getNumberOfPages()} pages | File Size: ${buffer.length} bytes`);
