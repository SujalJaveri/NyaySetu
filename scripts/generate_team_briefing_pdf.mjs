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
const margin = 42;
const contentWidth = pageWidth - margin * 2; // 511.28 pt

// Judicial Palette
const NAVY = [18, 34, 64];       // Deep judicial navy
const GOLD = [175, 125, 30];     // Muted brass/gold
const CHARCOAL = [30, 35, 45];   // Body text
const MUTED = [95, 105, 120];    // Secondary text
const LIGHT_BG = [247, 249, 252];// Box background
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
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("NYAYASETU - Internal Team Briefing, Training & Meeting Master Script", margin, margin - 10);
  doc.text(`Page ${pageNum}`, pageWidth - margin, margin - 10, { align: "right" });
  doc.setDrawColor(...LINE_COLOR);
  doc.setLineWidth(0.5);
  doc.line(margin, margin - 4, pageWidth - margin, margin - 4);
}

function addTitle(text, level = 1) {
  if (level === 1) {
    checkPage(60);
    currentY += 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...NAVY);
    doc.text(text, margin, currentY);
    currentY += 4;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(1.5);
    doc.line(margin, currentY, margin + 60, currentY);
    currentY += 12;
  } else if (level === 2) {
    checkPage(30);
    currentY += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...NAVY);
    doc.text(text, margin, currentY);
    currentY += 10;
  } else if (level === 3) {
    checkPage(20);
    currentY += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...GOLD);
    doc.text(text, margin, currentY);
    currentY += 8;
  }
}

function addParagraph(text, spacing = 5) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...CHARCOAL);
  const lines = doc.splitTextToSize(text, contentWidth);
  for (const line of lines) {
    checkPage(12);
    doc.text(line, margin, currentY);
    currentY += 10.8;
  }
  currentY += spacing;
}

function addBullet(bulletTitle, bulletText) {
  checkPage(18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  const prefix = "*  " + bulletTitle + ": ";
  doc.text(prefix, margin, currentY);
  const prefixWidth = doc.getTextWidth(prefix);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...CHARCOAL);
  
  const words = bulletText.split(" ");
  let line = "";
  let isFirst = true;
  for (let i = 0; i < words.length; i++) {
    const testLine = line ? line + " " + words[i] : words[i];
    const maxWidth = isFirst ? contentWidth - prefixWidth : contentWidth - 10;
    if (doc.getTextWidth(testLine) <= maxWidth) {
      line = testLine;
    } else {
      checkPage(12);
      doc.text(line, isFirst ? margin + prefixWidth : margin + 10, currentY);
      currentY += 10.8;
      isFirst = false;
      line = words[i];
    }
  }
  if (line) {
    checkPage(12);
    doc.text(line, isFirst ? margin + prefixWidth : margin + 10, currentY);
    currentY += 10.8;
  }
  currentY += 2;
}

function addCallout(title, text) {
  checkPage(45);
  const lines = doc.splitTextToSize(text, contentWidth - 18);
  const boxHeight = lines.length * 10.5 + 20;
  
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(margin, currentY, contentWidth, boxHeight, 3, 3, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.5);
  doc.line(margin, currentY, margin, currentY + boxHeight);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text(title, margin + 8, currentY + 12);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...CHARCOAL);
  let textY = currentY + 23;
  for (const line of lines) {
    doc.text(line, margin + 8, textY);
    textY += 10.5;
  }
  currentY += boxHeight + 8;
}

function addTable(headers, rows) {
  checkPage(50);
  autoTable(doc, {
    startY: currentY,
    head: [headers],
    body: rows,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 3.5,
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
  currentY = doc.lastAutoTable.finalY + 10;
}

// -------------------------------------------------------------
// COVER PAGE / BANNER
// -------------------------------------------------------------
doc.setFillColor(...NAVY);
doc.rect(0, 0, pageWidth, 230, "F");

doc.setFont("helvetica", "bold");
doc.setFontSize(22);
doc.setTextColor(255, 255, 255);
doc.text("NYAYASETU (Court Scheduler Pro)", margin, 70);

doc.setFont("helvetica", "normal");
doc.setFontSize(11);
doc.setTextColor(220, 230, 245);
doc.text("Internal Team Training, Meeting Script & Comprehensive Knowledge Transfer", margin, 92);

doc.setFontSize(8.5);
doc.setTextColor(...GOLD);
doc.text("ZERO-TO-HERO BRIEFING SCRIPT FOR ALL TEAM MEMBERS (PARTS 1 TO 24)", margin, 116);

doc.setDrawColor(...GOLD);
doc.setLineWidth(1.5);
doc.line(margin, 128, pageWidth - margin, 128);

doc.setFont("helvetica", "normal");
doc.setFontSize(8);
doc.setTextColor(205, 220, 240);
doc.text("Purpose: Transform Team from Passive Observers to Confident, Independent Presenters", margin, 145);
doc.text("Scope: Concept, Problem, Solution, Live Web App Demo, Code, Tech Stack, Q&A Defense", margin, 159);
doc.text("Target Event: Smart India Hackathon (SIH) 2026 / Academic Viva / Grand Evaluation", margin, 173);
doc.text("Author & Lead Presenter: Sujal Javeri (Team Leader) | Date: Tomorrow's Team Briefing", margin, 187);

currentY = 245;

addCallout(
  "TEAM LEADER'S CORE DIRECTIVE & MINDSET",
  "This document is an actionable, word-for-word briefing script designed for tomorrow's team training. By the end of this session, every single teammate will possess the knowledge, vocabulary, and practical competence to explain the project, demonstrate the live web application, defend the technical architecture, and confidently handle tough questions from evaluators and hackathon judges."
);

addTitle("TRAINING SESSION ROADMAP (24 PRACTICAL MODULES)", 2);

const agendaTable = [
  ["Part 1: Meeting Objectives & Outcomes", "Part 9: Simple & Real Architecture", "Part 17: Judge Question Preparation"],
  ["Part 2: 95-Min & 15-Min Agendas", "Part 10: Complete Data Flow Tracing", "Part 18: 'Don't Say This' Guardrails"],
  ["Part 3: Word-for-Word Opening Script", "Part 11: Code Map (Must/Should/Nice)", "Part 19: Handling Unknown Questions"],
  ["Part 4: Explaining Project from Zero", "Part 12: Slide-by-Slide PPT Guide", "Part 20: 20 Mock Judge Q&A Drills"],
  ["Part 5: The 'One Story' Narrative", "Part 13: Project Report & Artifacts", "Part 21: Team Interactive Exercises"],
  ["Part 6: Web App Click-by-Click Demo", "Part 14: 20 Facts Everyone Must Know", "Part 22: Concrete Action Plan"],
  ["Part 7: Every Major Feature Explained", "Part 15: Role Allocation & Ownership", "Part 23: 15-Min Emergency Version"],
  ["Part 8: Tech Stack Taught Simply", "Part 16: 'Who Knows What' Matrix", "Part 24: Team Leader's Cheat Sheet"],
];

addTable(["Section Group 1 (1-8)", "Section Group 2 (9-16)", "Section Group 3 (17-24)"], agendaTable);

doc.addPage();
currentY = margin + 20;
drawRunningHeader();

// PART 1 - 3
addTitle("PART 1 - START WITH THE MEETING OBJECTIVE", 1);
addParagraph("What I must accomplish in tomorrow's team meeting. By the end of this 90-minute session, every teammate must achieve these 10 concrete outcomes:");
addBullet("Outcome 1", "Deliver the 30-second and 1-minute project elevator pitch with zero hesitation.");
addBullet("Outcome 2", "Explain the real Indian court backlog problem (50 million cases, manual listing, advocate clashes).");
addBullet("Outcome 3", "Articulate why our solution is deterministic constraint programming rather than black-box AI.");
addBullet("Outcome 4", "Navigate and demonstrate the live web application (Dashboard, Smart Scheduling, Cause List, What-If).");
addBullet("Outcome 5", "Explain the 7 hard constraints and 4 soft criteria that power our scheduling engine.");
addBullet("Outcome 6", "Understand the technology stack (React 19, TanStack Start, Nitro, Supabase PostgreSQL, Gemini/Groq).");
addBullet("Outcome 7", "Know their assigned team persona and technical domain inside out.");
addBullet("Outcome 8", "Confidently answer common and tough judge questions without passing the mic to me.");
addBullet("Outcome 9", "Understand the PPT presentation and how every slide connects to the live software.");
addBullet("Outcome 10", "Operate as a unified, cohesive team where no single person is a single point of failure.");

addTitle("PART 2 - THE PRACTICAL MEETING AGENDA", 1);
addParagraph("The 95-Minute Master Training Schedule:");
addBullet("00:00 - 05:00 (5 min)", "Introduction & Ground Rules: Why we are here and why everyone must speak.");
addBullet("05:00 - 15:00 (10 min)", "The Origin & The Problem: 50 million cases, paper diaries, and double-booked advocates.");
addBullet("15:00 - 25:00 (10 min)", "The Solution & 'The One Story': Deterministic math + explainable receipts.");
addBullet("25:00 - 45:00 (20 min)", "Live Web Application Walkthrough: Screen-by-screen click demo on screen.");
addBullet("45:00 - 55:00 (10 min)", "Technology Stack & Architecture: React 19, Nitro, Supabase, and Gemini/Groq.");
addBullet("55:00 - 65:00 (10 min)", "PPT Slide-by-Slide Walkthrough: Connecting slides to software.");
addBullet("65:00 - 75:00 (10 min)", "Role Allocation & Ownership: Who speaks on what during the viva.");
addBullet("75:00 - 90:00 (15 min)", "Judge Mock Q&A Drills: Rapid-fire practice questions.");
addBullet("90:00 - 95:00 (5 min)", "Action Plan & Wrap-up: Next steps for tonight and tomorrow.");

addTitle("PART 3 - EXACT WORD-FOR-WORD OPENING SCRIPT", 1);
addParagraph("What I will say out loud to open the meeting (natural, peer-to-peer tone):");
addCallout(
  "SPOKEN OPENING SCRIPT (READ ALOUD TO TEAM)",
  "\"Hey guys, thank you for being here. Let's get straight to the point: I called this meeting because tomorrow is huge for all of us, and right now, I'm the only one who has been deep in the weeds of the code, the PPT, and the report. If a judge or evaluator asks anyone in this room a basic question tomorrow, we cannot have awkward silence or everyone looking at me.\n\nHere is the deal: I do not expect anyone here to become an overnight full-stack developer or write database triggers. But I DO expect every single one of us to understand our project so well that any of you could stand up, explain what we built, demonstrate the live website, and answer questions with complete confidence. By the time we leave this room today, nobody will be confused. We are going to walk through the problem, the solution, the website, the tech stack, and the exact questions judges will throw at us. Let's make this fun, interactive, and lock this down.\""
);

doc.addPage();
currentY = margin + 20;
drawRunningHeader();

// PART 4 - 6
addTitle("PART 4 - EXPLAINING THE PROJECT FROM ZERO", 1);
addParagraph("How I explain the project in plain English without jargon:");
addBullet("Forget the Code First", "Imagine a typical district court in India. There are 50 million cases pending in India. But why? People think judges are lazy. That is false. The real reason is administrative chaos.");
addBullet("The Physical Diary Problem", "Every morning, a court clerk (called a Peshkar) sits with a paper register and manually writes down 120 cases to be heard that day. He has no computer system cross-referencing other courtrooms.");
addBullet("The Advocate Clashing Trap", "Advocate Sharma is listed in Courtroom 1 for a property case at 11:00 AM. But he is also listed in Courtroom 3 for a bail hearing at 11:00 AM! When his name is called in Courtroom 1, he is physically absent. The judge has no choice: 'Adjourned for 3 months.' 40% of all trial delays happen because of this exact scheduling clash.");
addBullet("The Human Tragedy", "A 70-year-old grandfather travels 50 km by bus, spends his pension money, waits outside in the heat until 4:30 PM, only to be told: 'Your case could not be reached today. Come back in November.'");
addBullet("What NyayaSetu Does", "NyayaSetu is air traffic control for the courtroom. It replaces paper diaries with a smart scheduling engine that checks 7 hard rules (no double-booking, room availability, court holidays) and orders cases by statutory urgency (like POCSO child abuse trials or senior citizens). It guarantees zero clashes, cuts daily boards to a realistic 25 cases, and lets citizens check their queue on mobile in Hindi.");

addTitle("PART 5 - THE 'ONE STORY' EVERY TEAM MEMBER MUST MEMORIZE", 1);
addCallout(
  "THE UNIFIED 90-SECOND ELEVATOR STORY",
  "\"India's courts are paralyzed by 50 million pending cases, largely because trial scheduling is done manually on paper. Court clerks overbook daily boards with 150 cases, causing lawyers to clash across courtrooms and forcing judges to adjourn 70% of matters without a hearing.\n\nExisting tools like eCourts CIS act as passive digital ledgers - they record yesterday's order, but do not optimize tomorrow's hearing. NyayaSetu is the intelligent scheduling brain that court systems lack. It uses mathematical constraint satisfaction to evaluate 7 hard rules, ranks open slots using statutory urgency like POCSO and Senior Citizen laws, and gives clerks an explainable Decision Receipt. Registrars confirm listings in one click, judges get clean bench calendars, and citizens track their exact queue in Hindi and Marathi on mobile.\""
);

addTitle("PART 6 - WEB APPLICATION CLICK-BY-CLICK WALKTHROUGH", 1);
addParagraph("Keep this script open beside you as you share your screen and click through the website:");

addBullet("Step 1: Open Landing Page (/)", "Say: 'This is our public portal. Notice the three doors: Judge, Registrar, and Citizen. Also notice our live impact counter showing conflicts prevented.'");
addBullet("Step 2: Log in as Registrar (/auth)", "Say: 'Let us log in as a court registrar. Notice how fast it loads.'");
addBullet("Step 3: Show Dashboard (/dashboard)", "Point to: Utilization Heatmap. Say: 'This heatmap shows chamber occupancy. Notice how it flags overbooked courtrooms in amber and available rooms in blue.'");
addBullet("Step 4: Smart Scheduling Workbench (/smart-scheduling)", "Click: A pending POCSO case (e.g., State vs. Verma). Say: 'Watch this. The algorithm tests 96 permutations across judges and rooms in 5 milliseconds. Look at this card: it gives us Candidate 1 with a 94% confidence score.' Point to: The Decision Receipt. Say: 'This is our hero feature. It proves all 7 hard rules passed and shows the mathematical breakdown.' Click: 'Confirm Listing'. Say: 'Boom. Scheduled. Logged to audit trail.'");
addBullet("Step 5: Daily Cause List (/cause-list)", "Say: 'Now look at today's cause list. Notice how it groups hearings into 3 procedural stages: Morning Urgent Motions, Midday Evidence, and Afternoon Arguments.' Click: 'Export Official PDF'. Say: 'It automatically formats and downloads a High Court standard PDF for courtroom notice boards.'");
addBullet("Step 6: Digital Twin What-If Sandbox (/what-if-simulation)", "Say: 'What happens if a judge suddenly falls ill at 9:00 AM? In normal courts, chaos. In NyayaSetu, we click Run Simulation. It clones the court in memory, finds the 3 displaced hearings, and reassigns them to alternate rooms in 2 seconds.'");
addBullet("Step 7: Citizen Portal (/case-status)", "Switch to mobile view. Enter: Case number 'BNS/2026/0014'. Click: 'Search'. Say: 'A villager sees their judge, room number, and exact cause list position (#3). Click Hindi - the entire card translates instantly.'");

doc.addPage();
currentY = margin + 20;
drawRunningHeader();

// PART 7 - 9
addTitle("PART 7 - EXPLAINING EVERY MAJOR FEATURE TO THE TEAM", 1);
addParagraph("Summary of our 6 core functional pillars for quick reference:");

addBullet("1. Deterministic Scheduling Solver", "What it does: Matches cases to judges and rooms without clashes. Why: Eliminates double-booking. For Judges: 'It is a mathematical constraint solver, not an unpredictable AI.'");
addBullet("2. 8-Factor Statutory Priority Scorer", "What it does: Calculates urgency (0-100) based on POCSO, Senior Citizen, and Limitation acts. Why: Ensures urgent cases aren't buried. For Judges: 'It directly models Indian statutory mandates.'");
addBullet("3. Explainable Decision Receipts", "What it does: Shows green checkmarks for all passed constraints and weighted scores. Why: Eliminates black-box AI distrust. For Judges: 'Every scheduling recommendation is machine-verifiable.'");
addBullet("4. What-If Digital Twin Sandbox", "What it does: In-memory simulation of judge leaves and room repairs. Why: Stress-tests disruptions without database corruption. For Judges: 'It is a zero-risk operational digital twin.'");
addBullet("5. 3-Stage Procedural Cause List", "What it does: Groups daily lists into Urgent, Evidence, and Arguments. Why: Prevents advocates from waiting all day. For Judges: 'It aligns daily boards with courtroom procedural reality.'");
addBullet("6. Multilingual Citizen Lookup", "What it does: Instant case queue lookup in English, Hindi, and Marathi. Why: Removes touts and corridor waiting. For Judges: 'Zero-barrier vernacular public digital infrastructure.'");

addTitle("PART 8 - EXPLAINING THE TECH STACK LIKE A TEACHER", 1);
addParagraph("How to explain our technical choices without intimidation:");

addBullet("React 19 (Frontend UI)", "Think of React as the building blocks. It builds the interactive buttons, tables, and forms the user clicks. React 19 brings fine-grained rendering so the page updates instantly.");
addBullet("TanStack Start & Router (Fullstack Framework)", "TanStack Router manages our URLs and pages with 100% type safety. TanStack Start lets us write server functions that connect the frontend directly to the database with zero API boilerplate.");
addBullet("Nitro Server Engine (Edge Hosting)", "Nitro is the engine that compiles our server code so it can run on Cloudflare Workers edge nodes across India with sub-50ms cold starts.");
addBullet("Supabase PostgreSQL (Database & Security)", "PostgreSQL is our enterprise relational database. Supabase provides Row Level Security (RLS), meaning the database itself checks who is logged in and stops unauthorized data access.");
addBullet("Google Gemini 3.5 Flash (AI Copilot)", "We use Gemini 3.5 Flash for natural language Q&A in the Registry Assistant. It is grounded in live database telemetry. If Gemini hits rate limits, Groq LLaMA 3 provides sub-second failover.");
addBullet("Tailwind CSS v4 (Design System)", "Our styling system uses OKLCH color spaces: Ink Navy, Muted Brass/Gold, and Parchment. It gives our app a dignified, constitutional judicial aesthetic.");

addTitle("PART 9 - SYSTEM ARCHITECTURE EXPLAINED SIMPLY", 1);
addParagraph("How to draw and explain the 5-tier architecture on a whiteboard:");
addCallout(
  "WHITEBOARD ARCHITECTURE (TIERS 1 TO 5)",
  "Tier 1: Client Browser (React 19 SPA + In-Memory Scheduling Solver)\n   | (Encrypted HTTPS / Type-Safe RPC)\nTier 2: Edge Gateway (Nitro Engine on Cloudflare Workers)\n   |\nTier 3: Isomorphic Server Functions (src/lib/*.functions.ts)\n   |\nTier 4: Security & Middleware (JWT Auth Verification & Prompt Filtering)\n   +---> AI Copilot Gateway (Google Gemini 3.5 Flash + Groq LLaMA 3 Failover)\n   v\nTier 5: Persistence Layer (Supabase PostgreSQL 15 + RLS Policies + Immutable Audit Logs)"
);
addParagraph("Speaking Script: 'Our architecture separates deterministic scheduling from AI. The scheduling solver runs in pure TypeScript in Tier 1 and Tier 3 with mathematical certainty. The AI is strictly an external advisory copilot in Tier 4. Everything persists in PostgreSQL with strict Row Level Security.'");

doc.addPage();
currentY = margin + 20;
drawRunningHeader();

// PART 10 - 13
addTitle("PART 10 - TRACING COMPLETE DATA FLOWS", 1);
addParagraph("Action 1: Confirming a Hearing Schedule:");
addBullet("1. User clicks 'Confirm Listing'", "CaseSchedulingPanel passes candidate slot to recordDecision() server function.");
addBullet("2. Server Function Execution", "Nitro edge worker extracts Bearer JWT, validates user role ('registrar' or 'admin').");
addBullet("3. Database Transaction", "Supabase inserts row into public.schedules and appends entry into public.audit_logs.");
addBullet("4. UI Reactivity", "TanStack Query invalidates 'schedules' key; UI instantly re-renders with confirmed status.");

addTitle("PART 11 - WHAT YOU ACTUALLY NEED TO KNOW ABOUT THE CODE", 1);
addParagraph("Don't memorize all files. Focus strictly on these 3 tiers:");
addBullet("MUST KNOW (Everyone)", "src/lib/scheduling.ts (the 7 hard rules), src/lib/priority.ts (the 8 urgency factors), and src/routes/_authenticated/smart-scheduling.tsx (the main workbench).");
addBullet("SHOULD KNOW (Tech Members)", "src/lib/conflicts.ts (clash scanner), src/lib/simulation.ts (digital twin clone), and supabase/supabase_setup.sql (table structures).");
addBullet("NICE TO KNOW (Only if asked)", "scripts/patch-ssr-circular.mjs (post-build circular dependency patch) and src/lib/ai.server.ts (Gemini/Groq fetch cascade).");

addTitle("PART 12 - SLIDE-BY-SLIDE PPT PRESENTATION GUIDE", 1);
addParagraph("How to present each slide and what teammates must know:");

addBullet("Slide 1: Title & Team", "Say: 'We are Team NyayaSetu, presenting an AI-assisted deterministic court scheduling platform.'");
addBullet("Slide 2: The 50M Backlog Crisis", "Say: '50 million cases are pending. 50,000 hearings are adjourned every day due to manual scheduling clashes.'");
addBullet("Slide 3: Why eCourts is Not Enough", "Say: 'eCourts records what happened yesterday; it does not optimize what happens tomorrow.'");
addBullet("Slide 4: Our Solution Paradigm", "Say: 'We apply mathematical constraint satisfaction to guarantee zero clashes and balanced daily dockets.'");
addBullet("Slide 5: The 7 Hard Constraints", "Say: 'A hearing is valid ONLY if it satisfies 7 non-negotiable checks: holidays, judge availability, room capacity, and no clashes.'");
addBullet("Slide 6: Statutory Urgency Scoring", "Say: 'Cases are weighted by law: POCSO, senior citizens, and limitation deadlines get Tier 1 urgency.'");
addBullet("Slide 7: Live Web App Demo", "Action: Switch to browser and run the 3-minute demo flow (Smart Scheduling -> Cause List -> Simulation).");
addBullet("Slide 8: Digital Twin What-If Sandbox", "Say: 'When disruptions occur, we reassign cases in memory in 60 seconds without touching live records.'");
addBullet("Slide 9: Architecture & Security", "Say: 'React 19, TanStack Start, Nitro on Cloudflare Workers, and Supabase PostgreSQL with RLS.'");
addBullet("Slide 10: Regulation 9 AI Governance", "Say: 'We comply with Supreme Court Draft Regulation 9: AI only advises; human judges and registrars decide.'");
addBullet("Slide 11: Impact & Scale Roadmap", "Say: 'Piloting at district courts, scaling to State High Courts and national NJDG integration.'");

addTitle("PART 13 - CONNECTING THE REPORT, PPT, AND WEBSITE", 1);
addParagraph("Every teammate must understand that our four artifacts tell ONE single story:");
addParagraph("IDEA (Zero clashes) <--> REPORT (Full mathematical & legal proof) <--> PPT (Visual summary & pitch) <--> WEB APP (Live functional proof). Never contradict between what is on the slide and what is on the screen.");

doc.addPage();
currentY = margin + 20;
drawRunningHeader();

// PART 14 - 16
addTitle("PART 14 - 20 FACTS EVERY TEAM MEMBER MUST MEMORIZE", 1);
addParagraph("Revise these 20 bullet points before walking into the presentation:");
const facts = [
  ["1. Project Name", "NyayaSetu (meaning 'Bridge to Justice'). Codebase: Court Scheduler Pro."],
  ["2. Core Crisis", "India has 50M pending cases; 40% of trial delays stem from scheduling clashes."],
  ["3. Target Domain", "Indian Subordinate District and Taluka Courts (Articles 233-237)."],
  ["4. Core Nature", "Deterministic constraint satisfaction solver; NOT a black-box AI."],
  ["5. Hard Constraints", "7 mandatory checks: Holidays, sitting hours, room fit, no double-booking, workload cap."],
  ["6. Soft Preferences", "4 scoring criteria: Specialization, workload balance, room utilization, early slot."],
  ["7. Priority Formula", "0-100 score driven by POCSO Act, Senior Citizens Act, Limitation Act, and age."],
  ["8. Decision Receipt", "Transparent audit ticket pinned to recommendations showing why a slot was chosen."],
  ["9. What-If Sandbox", "Digital twin cloning court state in memory to model judge illness or repairs."],
  ["10. Cause List", "3-stage procedural board: Morning Urgent, Midday Evidence, Afternoon Orders."],
  ["11. Frontend Tech", "React 19 with TanStack Router, TanStack Query, and Tailwind CSS v4."],
  ["12. Backend Tech", "TanStack Start with Nitro engine deployed to Cloudflare Workers edge."],
  ["13. Database Tech", "Supabase PostgreSQL 15 with Row Level Security (RLS) and triggers."],
  ["14. AI Engine", "Google Gemini 3.5 Flash REST API with Groq Cloud LLaMA 3.3 failover."],
  ["15. AI Restriction", "AI only answers natural language questions; it NEVER decides schedules."],
  ["16. Regulation 9", "Complies with Supreme Court AI draft guidelines: Human-in-the-loop oversight."],
  ["17. Multilingual", "Public lookup supports English, Hindi, and Marathi without user logins."],
  ["18. Bench Portal", "Private judge workspace (/bench) with direct listing and 'Why This Order' notes."],
  ["19. Performance", "Sub-50ms cold starts on edge; evaluates 100 slots in < 5ms client-side."],
  ["20. Zero Clashes", "Mathematically impossible to double-book once hard constraints pass."],
];
addTable(["Fact / Topic", "Mandatory Knowledge Summary"], facts);

addTitle("PART 15 - TEAM ROLE ALLOCATION", 1);
addParagraph("Assign these 4 clear roles to our team members for tomorrow's presentation:");
addBullet("Role 1: Team Lead & Problem Presenter", "Opens meeting, delivers 1-minute crisis story, presents Slides 1-4, conducts demo.");
addBullet("Role 2: Frontend & UX Specialist", "Explains React 19, TanStack Router, OKLCH design, Decision Receipt, and vernacular i18n.");
addBullet("Role 3: Algorithm & Scheduling Specialist", "Explains the 7 hard constraints, 4 soft weights, 8-factor priority formula, and What-If sandbox.");
addBullet("Role 4: Backend, Database & Security Specialist", "Explains Supabase PostgreSQL, Row Level Security, Cloudflare edge deployment, and Regulation 9 audit trails.");

addTitle("PART 16 - WHO KNOWS WHAT MATRIX", 1);
const matrix = [
  ["50M Problem & Crisis", "Deep", "Basic", "Basic", "Basic"],
  ["Live Web App Demo", "Deep", "Deep", "Basic", "Basic"],
  ["7 Hard Constraints & Math", "Deep", "Basic", "Deep", "Basic"],
  ["React 19 & UI Styling", "Deep", "Deep", "Basic", "Basic"],
  ["Postgres RLS & Security", "Deep", "Basic", "Basic", "Deep"],
  ["AI Copilot & Regulation 9", "Deep", "Basic", "Deep", "Deep"],
  ["PPT Slide Narration", "Deep", "Deep", "Deep", "Deep"],
];
addTable(["Topic / Area", "Role 1 (Lead)", "Role 2 (UI)", "Role 3 (Algo)", "Role 4 (Backend)"], matrix);

doc.addPage();
currentY = margin + 20;
drawRunningHeader();

// PART 17 - 20
addTitle("PART 17 - JUDGE QUESTION PREPARATION & MODEL ANSWERS", 1);
addParagraph("Practice these high-frequency evaluation questions:");

addBullet("Q1: Why did you not use an LLM to schedule cases directly?", "Answer: 'In court administration, hallucinations are disastrous. An LLM might book two trials in the same room. We use deterministic mathematical constraint programming for 100% certainty, restricting LLMs to natural language Q&A.'");
addBullet("Q2: How do you handle advocate schedule clashes across courtrooms?", "Answer: 'Our engine tracks advocate representation registry-wide. Hard Constraint #3 checks whether an advocate is booked in another courtroom; if so, that slot is disqualified.'");
addBullet("Q3: Does your system comply with judicial ethics and AI guidelines?", "Answer: 'Yes. We strictly adhere to Supreme Court Draft Regulation 9. The algorithm never auto-commits hearings; human registrars and judges retain full authority.'");
addBullet("Q4: How does this integrate with the existing eCourts CIS system?", "Answer: 'NyayaSetu is designed as an intelligent operational brain for eCourts. It ingests CNR numbers from CIS via API, optimizes schedules, and posts cause lists back to CIS.'");

addTitle("PART 18 - 'DON'T SAY THIS' GUARDRAILS", 1);
addParagraph("Never say these phrases in front of evaluators. Use the professional alternatives:");
addBullet("NEVER SAY", "'Our AI predicts case verdicts or outcomes.' -> INSTEAD SAY: 'We predict scheduling duration and procedural urgency based on legal rules.'");
addBullet("NEVER SAY", "'Only our developer knows how that works.' -> INSTEAD SAY: 'Our system architecture is modular, and our backend specialist can detail that exact pipeline.'");
addBullet("NEVER SAY", "'We used a deep learning neural network for scheduling.' -> INSTEAD SAY: 'Our scheduling engine is a deterministic constraint satisfaction solver.'");
addBullet("NEVER SAY", "'This is already deployed in 20,000 courts.' -> INSTEAD SAY: 'This is an enterprise-grade production pilot engineered for district court deployment.'");

addTitle("PART 19 - HANDLING QUESTIONS WE DON'T KNOW", 1);
addCallout(
  "THE PROFESSIONAL BRIDGE PHRASE",
  "If a judge asks an unexpected question you don't know the exact answer to, stay calm and say:\n\"That is an insightful operational consideration. In our current architecture, that scenario is handled by our constraint validation layer, but expanding that specific edge case is part of our Phase 2 roadmap.\""
);

addTitle("PART 20 - RAPID-FIRE MOCK PRACTICE ROUNDS", 1);
addParagraph("Conduct this 10-minute drill at the end of the meeting:");
addBullet("Drill 1 (Pitch)", "Pick a random teammate. Give them 60 seconds to explain the project problem and solution.");
addBullet("Drill 2 (Screen Demo)", "Have a teammate share screen and execute one case scheduling flow on /smart-scheduling.");
addBullet("Drill 3 (Tech Defense)", "Ask: 'What happens when a judge is on leave?' Teammate must demonstrate /what-if-simulation.");
addBullet("Drill 4 (Security Defense)", "Ask: 'How do you prevent a judge from editing another judge's docket?' Teammate answers: 'Postgres RLS and BenchScopeGuard.'");

doc.addPage();
currentY = margin + 20;
drawRunningHeader();

// PART 21 - 24
addTitle("PART 21 - INTERACTIVE TEAM PRACTICE EXERCISES", 1);
addParagraph("End the meeting with 5 rapid exercises to ensure 100% participation:");
addBullet("Exercise 1", "Everyone speaks their 30-second elevator pitch out loud once.");
addBullet("Exercise 2", "Each person explains their single assigned feature without looking at notes.");
addBullet("Exercise 3", "Simulate a live evaluator throwing a curveball question.");
addBullet("Exercise 4", "Test the click flow of /cause-list PDF export.");
addBullet("Exercise 5", "Final high-five and team confidence check.");

addTitle("PART 22 - CONCRETE ACTION PLAN & TIMELINE", 1);
addBullet("TODAY (After Meeting)", "Review this script, memorize the 20 Facts Sheet (Part 14), and log into the web app.");
addBullet("TONIGHT (Before Bed)", "Practice your assigned role out loud 3 times. Ensure your laptop has the website bookmarked.");
addBullet("TOMORROW (30 Min Before Presentation)", "Run the 15-Minute Emergency Review (Part 23) together as a team.");
addBullet("DURING PRESENTATION", "Smile, make eye contact, support each other, and pass questions smoothly to the assigned role.");

addTitle("PART 23 - THE 15-MINUTE EMERGENCY VERSION", 1);
addParagraph("If our meeting gets cut short, cover ONLY these 4 essentials:");
addBullet("1. The Problem (3 min)", "50M pending cases, manual listing in paper registers, 40% delays from advocate clashes.");
addBullet("2. The Solution (4 min)", "Deterministic constraint solver + statutory urgency + explainable receipts.");
addBullet("3. The Demo (5 min)", "Show /smart-scheduling (Candidate Card + Receipt) and /what-if-simulation.");
addBullet("4. The Winning Answer (3 min)", "'Why not an LLM? Because court scheduling requires mathematical zero-hallucination certainty.'");

addTitle("PART 24 - TEAM LEADER'S ONE-PAGE CHEAT SHEET", 1);
addCallout(
  "TEAM LEADER'S INSTANT POCKET SUMMARY",
  "* Project: NyayaSetu (Court Scheduler Pro) - AI-Assisted Smart Court Scheduling Platform.\n* Crisis: 50M cases, 50,000 daily adjournments due to manual listing clashes.\n* Mechanism: 7 Hard Constraints (Disqualify) + 4 Soft Criteria (Rank) + 8-Factor Urgency (0-100).\n* AI Role: Purely advisory NLP copilot (Gemini 3.5 Flash + Groq LLaMA 3); NEVER decides schedules.\n* Tech: React 19, TanStack Start, Nitro Engine on Cloudflare Workers, Supabase PostgreSQL with RLS.\n* Golden Rule: If a judge asks why we chose this, say: 'Because justice delayed is justice denied, and deterministic scheduling makes court time predictable, transparent, and clash-free.'"
);

// Save the PDF
const outputPath = path.join(process.cwd(), "NyayaSetu_Team_Briefing_Script.pdf");
const buffer = Buffer.from(doc.output("arraybuffer"));
fs.writeFileSync(outputPath, buffer);

console.log(`[OK] Team Briefing Script PDF successfully generated at: ${outputPath}`);
console.log(`Total Pages: ${doc.getNumberOfPages()} pages | File Size: ${buffer.length} bytes`);
