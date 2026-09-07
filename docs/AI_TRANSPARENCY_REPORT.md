# NyayaSetu: Official AI Transparency & Architecture Report
**Submission Document for Evaluation Panel & Judicial Bench**

---

### Executive Summary: Does NyayaSetu Use AI?

> **The Short Answer:**  
> **YES, but strictly as an Advisory & Accessibility Layer.**  
> **NyayaSetu does NOT use Generative AI (LLMs) to schedule hearings, pick judges, allocate courtrooms, or make judicial decisions.**

In Indian district and taluka courts, algorithmic hallucination, unpredictable slot allocation, or opaque black-box decisions are completely unacceptable. Therefore, NyayaSetu uses a **Two-Pillar Architecture**:

1. **Scheduling & Allocation:** **100% Mathematical & Deterministic (Zero AI Hallucination).**
2. **Citizen Interface & Registry Support:** **Targeted AI (LLMs) for Translation & Copilot Q&A.**

![NyayaSetu Architecture Infographic](nyayasetu_ai_architecture.jpg)

---

## 1. Clear Separation: What Uses AI vs. What Does NOT

| Function in NyayaSetu | Technology Used | Is it AI / LLM? | Why this design choice? |
| :--- | :--- | :--- | :--- |
| **Case Scheduling (Date & Time Allocation)** | Constraint Satisfaction Logic (Hard Constraints) | ❌ **NO AI** | Prevents double-booking, court holiday clashes, and slot overflow with 100% mathematical certainty. |
| **Judge Bench Assignment** | Multi-Factor Weighted Scoring (Soft Preferences) | ❌ **NO AI** | Pure deterministic math: 35% Specialisation, 30% Workload, 20% Priority, 15% Room efficiency. |
| **Case Priority Scoring (POCSO, Senior Citizen, etc.)** | Statutory Rules Matrix (0–100 points) | ❌ **NO AI** | 100% audit-traceable statutory scoring based on High Court / Supreme Court case management guidelines. |
| **Conflict & Double-Booking Detection** | Direct Relational Validation Checks | ❌ **NO AI** | Instant database scans across judicial benches and physical rooms. |
| **Multilingual Litigant Translation** | Gemini 2.5 Flash / Groq LLM | ✅ **YES (AI)** | Converts dense legalese into simple, respectful Hindi and Marathi for ordinary citizens. |
| **Registry Staff Copilot (Help Assistant)** | RAG / LLM Advisory Assistant | ✅ **YES (AI)** | Answers clerical queries regarding court circulars, scheduling SOPs, and user navigation. |
| **Plain-Language Rationale Summaries** | Advisory LLM (with Rule-based Fallback) | ✅ **Advisory Only** | Translates already-calculated mathematical scores into plain English sentences for human review. |

---

## 2. System Architecture: The Two-Pillar Model

```
                     ╔══════════════════════════════════════════════╗
                     ║           NYAYASETU CORE PLATFORM            ║
                     ╚══════════════════════════════════════════════╝
                                            │
        ┌───────────────────────────────────┴───────────────────────────────────┐
        ▼                                                                       ▼
┌──────────────────────────────────────┐               ┌──────────────────────────────────────┐
│       PILLAR 1: SCHEDULING CORE      │               │     PILLAR 2: ACCESSIBILITY & AI     │
│   (100% Deterministic & Rule-Based)  │               │        (Targeted Advisory LLM)       │
├──────────────────────────────────────┤               ├──────────────────────────────────────┤
│ • 6 Hard Constraints (No Overlap)    │               │ • Multilingual Translation (Hindi/   │
│ • 4 Weighted Soft Ranks (Math)       │               │   Marathi for Litigants)             │
│ • Statutory Priority Points (POCSO,  │               │ • Registry Helpdesk & SOP Copilot    │
│   Senior Citizen, Commercial, etc.)  │               │ • Human-Readable Explanation Cards   │
│ • Audit Trail for Human Registrar    │               │ • STRICTLY ISOLATED from scheduling  │
│                                      │               │   engine and database writes         │
└──────────────────────────────────────┘               └──────────────────────────────────────┘
        │                                                                       │
        ▼                                                                       ▼
[ 100% Deterministic Mathematical Output ]                   [ Contextual Plain-Text Assistance ]
        │                                                                       │
        └───────────────────────────────────┬───────────────────────────────────┘
                                            ▼
                      ╔════════════════════════════════════════╗
                      ║    HUMAN REGISTRAR IN-THE-LOOP         ║
                      ║ (Full Authority to Approve/Modify/     ║
                      ║  Reject Any System Recommendation)     ║
                      ╚════════════════════════════════════════╝
                                            │
                                            ▼
                             [ Official Cause-List Published ]
```

---

## 3. How the Scheduling Engine Actually Works (Zero Hallucination)

When a case is listed, the scheduling engine (`src/lib/scheduling.ts`) executes pure mathematical filtering:

```
[ Unscheduled Case ]
        │
        ▼
[ STEP 1: Hard Constraint Filter (Zero Hallucination) ]
   ├── Check 1: Is the selected date a Court Holiday / Weekend?
   ├── Check 2: Does the hearing duration fit inside the available slot?
   ├── Check 3: Is the Judge on leave or assigned elsewhere?
   ├── Check 4: Does the Judge already have an overlapping hearing?
   ├── Check 5: Is the Courtroom physically available and open?
   └── Check 6: Is the Courtroom double-booked by another bench?
        │
   (Only valid, conflict-free combinations pass forward)
        ▼
[ STEP 2: Multi-Criteria Mathematical Ranking ]
   ├── Specialisation Match Score : 35% Weight
   ├── Workload Balancing Score   : 30% Weight
   ├── Statutory Urgency / Tier   : 20% Weight
   └── Courtroom Utilisation Rate : 15% Weight
        │
        ▼
[ Recommended Best Candidate with Exact Score Breakdown ]
        │
        ▼
[ Human Registrar Review (Approve / Modify / Reject) ]
```

> **Legal Significance:**  
> Because Step 1 and Step 2 are pure code and mathematics, **no LLM or AI model is ever asked "Which judge should take this case?" or "What date should this be scheduled?"**. This completely eliminates bias, corruption, and hallucinations.

---

## 4. Why Does the Dashboard Say "AI Recommendations"?

In the user interface and database schema, you will see labels such as:
- Table: `ai_recommendations`
- UI Metric: *"AI Recommendations Issued: 24"*
- Button: *"View AI Recommendation"*

### Why is it named that way?
1. **Industry Product Terminology:** In software development, automated smart decision-support systems are frequently branded as "AI Recommendations" to communicate intelligent automation to non-technical end users.
2. **Audit Logging Container:** The database table `ai_recommendations` simply stores the mathematically generated slot options alongside the **Human Registrar's final audit verdict** (`ACCEPTED`, `MODIFIED`, `REJECTED`) and the mandatory justification note.
3. **Who is the Registrar?** The Registrar is the **human judicial clerk** who retains final legal authority. The system **never recommends, replaces, or alters registrars**.

---

## 5. Where AI (LLMs) is Strictly Used in the Codebase

All external LLM interactions route through a single hardened endpoint (`src/lib/ai.server.ts` -> `queryLLM()` using Gemini / Groq):

```
                   ┌───────────────────────────────────────────────┐
                   │    src/lib/ai.server.ts (Isolated Service)   │
                   └───────────────────────┬───────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         ▼                                 ▼                                 ▼
1. Case Status Translation         2. Registry Copilot             3. Post-Calculation Summary
   (case-status-translate.ts)         (assistant.functions.ts)        (explain-candidate.ts)
   Translates case outcomes into      Answers clerical queries        Translates already-calculated
   simple Hindi & Marathi for         about court circulars &         math scores into human-friendly
   ordinary litigants.                scheduling procedures.          English sentences.
```

### Safety & Fallback Mechanism:
If the internet is down, or if the external AI API is unresponsive:
- **Court scheduling continues 100% uninterrupted.**
- The system automatically serves built-in, rule-based deterministic text explanations without throwing errors.

---

## 6. Summary for Evaluators & Judges

1. **No Judicial Encroachment:** The machine does not adjudicate cases, make legal judgments, or replace court officers.
2. **Zero-Hallucination Scheduling:** Date, time, bench, and courtroom allocations are calculated by strict mathematical constraint satisfaction rules.
3. **Responsible AI Application:** Generative AI is deployed strictly where it adds maximum humanitarian and operational value: **breaking language barriers for citizens** and **simplifying administrative guidelines for staff**.
4. **100% Human-in-the-Loop Governance:** Every proposed schedule must be explicitly validated and signed off by a human court registrar with full audit logging.

---
*NyayaSetu Architecture & Compliance Documentation — Verified against production codebase.*
