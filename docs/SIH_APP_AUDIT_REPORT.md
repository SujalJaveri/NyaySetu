# NyaySetu - SIH App Audit Report

Prepared on: 16 August 2026

## 1. Current Status

The app is a high-performance TanStack Start fullstack web application for a district-court style registry. It supports three access modes:

- Registry/administrator users who register cases, maintain judges/courtrooms, run scheduling, publish cause lists, view conflicts, simulate disruptions, and generate governance reports.
- Judge users who get a self-scoped bench view of their own hearings and listing rationale.
- Public/litigant users who can check case status without signing in, including multilingual support in English, Hindi, and Marathi.

The app builds successfully after installing dependencies. Lint now passes with warnings only.

Important limitation: the original SIH PPT format and your starting project report have not yet been provided in the workspace, so a perfect report-to-app matching audit is still pending. Once those files are attached, compare them against the checklist in section 8.

## 2. Exact App Context

This app is an AI-assisted smart court case scheduling and registry platform designed to reduce manual scheduling effort, avoid double-booking, prioritise urgent matters, and make every scheduling decision explainable to court staff, judges, and auditors.

The system digitises these court registry workflows:

- Case intake and case category assignment.
- Priority scoring based on legal and administrative factors.
- Judge, courtroom, and hearing-slot management.
- Smart scheduling recommendations.
- Conflict detection before listing.
- Cause-list generation and manual override tracking.
- Public case-status lookup.
- Judge bench dashboard.
- What-if simulation for disruptions such as judge unavailability.
- Backlog simulation comparing first-in-first-out scheduling with priority-based scheduling.
- Governance and compliance reporting with downloadable PDF evidence.

## 3. How It Works

### Case Registration

The registrar enters case details such as case number, parties, filing date, category, expected duration, previous adjournments, and priority flags. The app stores these in Supabase and calculates a priority score.

### Priority Engine

The priority engine calculates a 0-100 score from:

- Case category urgency.
- Pending duration.
- Previous adjournments.
- Legal/administrative priority flag.
- Fast Track Special Court / POCSO marker.
- Senior-citizen litigant marker.
- Property dispute pending five years or more.
- Statutory limitation deadline.

Scores are grouped into Tier 1, Tier 2, and Tier 3, with a reproducible factor-by-factor explanation.

### Scheduling Engine

The smart scheduling engine first applies hard constraints:

- Judge must not be unavailable.
- Courtroom must not be unavailable.
- Judge must not already be booked in an overlapping hearing.
- Courtroom must not already be booked in an overlapping hearing.
- Slot must not already be allocated.
- Estimated case duration must fit the hearing slot.
- Judge workload must remain within the configured threshold.

Only valid combinations are ranked. Ranking uses soft preferences:

- Judge specialisation match.
- Workload balance.
- Case priority and earliness of slot.
- Courtroom utilisation.

The registrar can accept the top recommendation, choose an alternative, or reject it. The final human decision is stored with reasoning and an audit-log entry.

### Conflict Detection

Conflict Detection scans live schedules and flags double-booked judges, double-booked courtrooms, occupied slots, unavailable judges/courtrooms, duration overflow, and workload threshold issues.

### Cause List

The app can show/publish a cause list. Manual cause-list reorder actions are tracked so governance reports can show how often registry staff override the system’s suggested order.

### Public Case Status

A litigant can enter a case number and view the next hearing date, judge, courtroom, cause-list position, and summary status without exposing internal scoring logic.

### What-If Simulation

The app can simulate a judge becoming unavailable on a date, identify affected hearings, and propose alternative valid assignments before committing changes.

### Backlog Simulator

The backlog simulator compares filing-date order with priority-score order over 6- and 12-month horizons using a fixed weekly disposal rate. This is labelled as a demo-data simulation, not a real-world forecast.

### Governance and Reports

Reports show recommendation acceptance, modification, rejection, conflicts avoided, live conflicts, utilisation heatmaps, scheduling turnaround, audit entries, and downloadable compliance evidence.

## 4. Why This Is Useful for India

India’s courts face a very large pendency and scheduling burden. The official National Judicial Data Grid is described by the eCourts project as a national repository for cases pending and disposed of in district and taluka courts, and as an Ease of Doing Business innovation: https://ecommitteesci.gov.in/service/national-judicial-data-grid/

As of the current public NJDG crawl used during this audit, district-court data shows large volumes of pending, long-pending, senior-citizen, women-filed, undated, and excessive-dated matters: https://njdg.ecourts.gov.in/

High-court NJDG also shows millions of pending matters: https://njdg.ecourts.gov.in/hcnjdg_v2/

PIB notes that NJDG gives access to institution, pendency, disposal, case type, and year-wise breakup data across the judiciary: https://www.pib.gov.in/PressReleasePage.aspx?PRID=1957318

This app is useful because it targets one practical operational bottleneck: daily listing and resource allocation. Better scheduling can help courts:

- Reduce avoidable adjournments caused by unavailable judges, unavailable courtrooms, or duration mismatches.
- Prioritise urgent statutory and vulnerable-party cases more consistently.
- Improve transparency because each schedule has a readable explanation.
- Support registrars instead of replacing them; every final decision remains human-controlled.
- Give judges a cleaner bench calendar and workload view.
- Give citizens simpler hearing-status visibility without needing registry staff for basic enquiries.
- Produce audit records for accountability and governance.

## 5. Current Strengths

- Strong end-to-end court workflow coverage: cases, judges, courtrooms, slots, scheduling, cause list, reports, public status.
- Explainable scheduling logic with hard constraints separated from soft ranking.
- Human-in-the-loop decisions with audit logging.
- Conflict prevention and conflict scanning.
- India-specific priority features such as FTSC/POCSO, senior citizen, long-pending property dispute, and statutory limitation deadlines.
- Judge-only bench access and public case lookup.
- Governance/compliance page and PDF export.
- Backlog and what-if simulation, which are strong SIH demo features.
- Build succeeds after dependency installation.

## 6. Bugs / Risks Found

### Fixed During Audit

- Dependencies were not installed locally, so `npm run build` initially failed because `vite` was missing.
- Lint originally reported 1,300+ formatting errors.
- Five `any` type errors were fixed in chart tooltip/setup-admin code.
- Code was formatted with Prettier.

### Remaining Warnings

- Some shadcn/ui files export helpers alongside components, producing Fast Refresh warnings. This is common and does not block production builds.
- Some useMemo dependency warnings exist in Activity Log, Admin, and Calendar pages. They are not build-breaking, but can be cleaned later.
- Several TanStack server functions use deprecated `.inputValidator()` instead of `.validator()`. Build still works, but this should be modernised before a final SIH submission.
- The build warns about large chunks, especially chart/PDF libraries. This is acceptable for a hackathon demo, but route-level dynamic imports could improve performance.

### Product Risk

The code repeatedly states that the scheduling engine, assistant, simulations, and reports are deterministic and that no AI model is involved. Some UI labels still say "AI Recommendation". For SIH, either:

- frame this honestly as explainable AI-style decision support / deterministic optimisation, or
- add a real optional AI layer for natural-language summarisation, anomaly detection, or historical pattern learning.

Avoid claiming generative AI is making judicial decisions.

## 7. Features to Add to Maximise SIH 2026 Winning Chances

Highest-impact additions:

- NJDG/eCourts-style import connector: import case and pendency data from CSV/export format so the app feels deployable in Indian courts.
- Multilingual citizen notifications: SMS/WhatsApp/email templates in English, Hindi, and state language for next hearing and rescheduling alerts.
- Fairness dashboard: show whether priority scheduling is over/under-listing categories, age groups, senior-citizen matters, women-filed cases, or old cases.
- Explainable AI certificate per listing: downloadable one-page explanation with hard constraints passed, soft factors, human decision, and audit ID.
- Adjournment reason analytics: track why hearings fail and surface common causes such as counsel absence, judge leave, summons pending, or evidence not ready.
- Data privacy mode: redact party names and sensitive case details in public and demo views.
- Offline-first court mode: allow registry data entry during internet outages and sync later.
- Role-specific SIH demo personas: Admin, Registrar, Judge, Litigant, Auditor.
- Real AI assistant option: use an LLM only for natural-language query interpretation and report drafting, while scheduling remains rule-bound and auditable.

## 8. Report-to-App Matching Checklist

Use this once the original project report is attached:

- Problem statement matches court case scheduling, pendency, and resource allocation.
- Proposed solution includes judge/courtroom/slot scheduling.
- Priority factors in report match implemented priority factors.
- Report mentions public/litigant access if the app includes it.
- Report mentions judge dashboard if the app includes it.
- Report mentions conflict detection if the app includes it.
- Report mentions explainability/audit if the app includes it.
- Report avoids unsupported claims such as autonomous judicial decision-making.
- PPT screenshots match actual app screens and route names.
- Tech stack section matches current stack: React, TanStack Start, TypeScript, Tailwind CSS, Supabase.
- AI section accurately describes the implemented engine or planned AI enhancement.

## 9. Recommended SIH Positioning

Best title:

AI-Assisted Smart Court Case Scheduling and Cause-List Optimisation System

Best one-line pitch:

A transparent, human-controlled registry platform that prioritises urgent cases, prevents scheduling conflicts, balances judge/courtroom workload, and produces auditable cause-list decisions for Indian courts.

Best claim:

The system improves scheduling quality and transparency by combining deterministic constraint solving, priority scoring, explainable recommendations, simulations, citizen status lookup, and governance reporting.

Avoid this claim:

The system replaces judges or autonomously decides case outcomes.

## 10. Immediate Next Step

Attach the SIH official PPT format and your original starting report. Then update this document and the PPT content so the final submission exactly matches both the app and the SIH template.
