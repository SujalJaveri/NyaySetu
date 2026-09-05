# ⚖️ NyayaSetu (न्यायसेतु)

### AI-Assisted Smart Court Case Scheduling & Cause-List Optimisation Platform

**Smart India Hackathon (SIH) 2026 | Built for Indian District & Taluka Courts**

---

## 📌 Executive Summary

India's judicial system bears a backlog of **50+ million pending court cases**. A major operational bottleneck in daily court administration is **manual cause-list scheduling and resource allocation**, which frequently causes double-booked judges/courtrooms, avoidable adjournments, sub-optimal workload distribution, and delay in urgent matters.

**NyayaSetu** is a cloud-native, deterministic, explainable decision-support platform designed for court registries, judges, and citizens. It optimizes hearing schedules using a **hard-constraint satisfaction solver**, **8-factor statutory priority scoring**, and **zero-risk digital twin simulations**, while keeping judicial administration strictly **human-in-the-loop**.

---

## ✨ Core Pillars & Key Features

### 1. 🧠 Multi-Constraint Smart Scheduling Solver
- **Hard Constraints (Disqualifying Rules)**:
  - 🟢 Judge Availability Verification (no leave/unavailability clash)
  - 🟢 Courtroom Allocation Check (hall open and functional)
  - 🟢 Zero Concurrent Double-Booking for bench or courtroom
  - 🟢 Slot Duration Fit Check (estimated duration fits slot)
  - 🟢 Workload Ceiling Check (enforces maximum active hearings per judge)
  - 🟢 Gazetted Court Holiday & Non-Sitting Day Check
- **Soft Preferences (Ranking Weights)**:
  - 📊 Subject-Matter Specialisation matching (POCSO, Commercial, Civil, Criminal, Labour)
  - 📊 Balanced judicial workload distribution across benches
  - 📊 Statutory urgency and Priority Tier weighting
  - 📊 Courtroom slot capacity and utilization optimization

---

### 2. 🧾 Explainable Decision Receipts
- **Transparent Audit Tickets**: Displays a machine-readable audit receipt for every scheduling recommendation.
- **Explainability**: Clear visual separation of all 6 passed hard constraints (green ✓ checkmarks) and soft preference score breakdown (`+points / weight`).
- **No Black-Box AI**: Eliminates unpredictability — scheduling is solved by deterministic mathematical constraint satisfaction.

---

### 3. 🎯 Direct Alternative Selection
- Review and select any valid candidate from the **Alternative Scheduling Options** list (Option 2, Option 3, Option 4) with a direct 1-click **"Select & Schedule Option"** action.

---

### 4. ⚖️ Custom Judicial Directive & Judge Self-Scheduling
- **Custom / Judge's Directive Modal (`CustomJudicialScheduleModal`)**:
  - Allows Registrars or Judges to manually schedule any case to a specific Judge, Courtroom, and Slot.
  - Features directive presets (*"Urgent Mention allowed by Bench"*, *"Part-heard matter fixed per Bench order"*, *"Special Sitting requested by Judge"*).
  - **Live Pre-Flight Conflict Checking**: Validates constraints in real time before confirmation and logs judicial override justification to the immutable audit trail.
- **Judge's Bench Portal (`/bench`)**:
  - Judges have a dedicated **Direct Bench Listing** tab to search open registry cases and pull them directly onto their bench.

---

### 5. 🔮 Zero-Risk What-If Simulation Sandbox (Digital Twin)
- Deep-clones the active registry in memory to model emergency disruptions (e.g. sudden judge leave or courtroom infrastructure closure).
- Traces all affected hearings in real time, generates conflict-free alternative slots, and allows the registrar to commit changes with 1-click.

---

### 6. 🏛️ 8-Factor Statutory Priority Scoring Engine
Computes transparent 0–100 urgency scores aligned with Government of India mandates:
- **Fast Track Special Court (FTSC) / POCSO Act matters**
- **Senior Citizen litigants**
- **Long-pending property disputes (5+ years)**
- **Statutory Limitation Act deadlines approaching**
- **Historical adjournment count & pending duration**
- **Case category baseline weightings & administrative priority boost**

---

### 7. 📋 3-Stage Procedural Cause List Optimizer
Generates balanced daily cause lists organized into judicial sitting stages:
- **Stage 1 (Morning)**: Urgent Mentions, Bail Applications & Fresh Admissions (10:30 AM – 11:30 AM)
- **Stage 2 (Midday)**: Contested Arguments, Framing of Issues & Evidence (11:30 AM – 01:30 PM)
- **Stage 3 (Afternoon)**: Final Orders, Pronouncements & Miscellaneous Disposals (02:30 PM – 04:30 PM)

---

### 8. 🌐 Dual-Engine Full-Page Hindi Translation (`EN ⇄ हिं`)
- **Instant DOM TreeWalker Engine**: Translates 500+ Indian legal, procedural, and UI terms in real time.
- **Seamless Dynamic Translation Layer**: Translates long case titles, party names, and AI responses.
- **Lossless Toggle**: Instantly switch between English and Hindi across the entire app.

---

### 9. 📈 Real-Time Impact Counter Banner
- Animated live counters on the Dashboard displaying:
  - *Conflicts Detected & Prevented*
  - *Tier 1 Cases Prioritised*
  - *AI Recommendations Issued*
  - *Active Scheduled Hearings*

---

### 10. 💬 AI Registry Copilot (NLP Q&A)
- Natural language query assistant powered by resilient dual-tier engine (**Google Gemini 3.5 Flash → Groq LLaMA 3.3**).
- Answers registry questions regarding caseload, judge capacity, conflict resolution, and procedural rules.

---

### 11. 🛡️ Governance, Compliance & Audit Trail
- **Supreme Court AI Regulation Alignment**: Tracks recommendation acceptance rates and human override justifications.
- **Immutable Audit Logging**: Every scheduling, modification, and adjournment action is timestamped with user credentials.
- **NyayaSetu Branded PDF Exports**: Professional cause lists, hearing schedules, and case reports.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend & Fullstack SSR** | React 19, TanStack Start, TanStack Router, Vite 8, Nitro Engine |
| **Language & Typing** | TypeScript (Strict Mode, 0 Type Errors), Zod |
| **Styling & UI Primitives** | Tailwind CSS v4, Radix UI Primitives, Lucide Icons, Sonner Toast |
| **Data Visualisation** | Recharts |
| **Database & Auth** | Supabase PostgreSQL with Row Level Security (RLS) & Triggers |
| **PDF Generation** | jsPDF & jsPDF-AutoTable |
| **AI Layer** | Google Gemini 3.5 Flash, Groq Cloud API, Type-Safe Server Functions |

---

## 📂 Project Architecture

```
court-scheduler-pro/
├── src/
│   ├── components/                 # Reusable UI & judicial components
│   │   ├── custom-judicial-schedule-modal.tsx  # Manual / Judge directive modal
│   │   ├── decision-receipt-card.tsx           # AI explainability audit receipt
│   │   ├── recommendation-panel.tsx            # Smart scheduling recommendation card
│   │   ├── app-sidebar.tsx                     # Main navigation sidebar with i18n
│   │   ├── top-bar.tsx                         # Topbar with EN/HI language toggle
│   │   └── ...
│   ├── routes/                     # TanStack Router file-based routes
│   │   ├── _authenticated/
│   │   │   ├── dashboard.tsx       # Live metrics, readiness check, impact banner
│   │   │   ├── smart-scheduling.tsx # Multi-constraint scheduling engine workbench
│   │   │   ├── conflicts.tsx       # Real-time 8-conflict type scanner
│   │   │   ├── what-if-simulation.tsx # Zero-risk digital twin disruption sandbox
│   │   │   ├── cause-list.tsx      # 3-Stage procedural cause list generator
│   │   │   ├── bench.tsx           # Judge portal & direct bench listing
│   │   │   ├── backlog-simulator.tsx # FIFO vs Priority disposal comparison
│   │   │   ├── cases/              # Case intake, dossiers & adjournment tracking
│   │   │   ├── calendar.tsx        # Registry hearing calendar & PDF export
│   │   │   └── governance.tsx      # Compliance, AI acceptance rate & audit log
│   │   ├── case-status.tsx         # Litigant public lookup portal
│   │   └── auth.tsx                # Supabase authentication login
│   ├── lib/                        # Core algorithms, queries & server functions
│   │   ├── scheduling.ts           # Multi-constraint satisfaction solver
│   │   ├── conflicts.ts            # Conflict detection engine & occupancy models
│   │   ├── priority.ts             # 8-factor statutory priority scoring engine
│   │   ├── recommendations.ts      # Recommendation persistence & reasoning builder
│   │   ├── i18n.tsx                # Dual-engine Hindi/English translation system
│   │   └── pdf.ts                  # Branded PDF document generator
│   └── styles.css                  # Tailwind v4 theme tokens & custom animations
├── docs/                           # SIH analysis and strategy documentation
└── supabase/                       # Database schema, RLS policies & SQL migrations
```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: `v20.x` or higher
- **npm** or **bun**

### 2. Installation & Environment Configuration
```bash
# Clone the repository
git clone https://github.com/SujalJaveri/NyaySetu.git
cd NyaySetu

# Install dependencies
npm install

# Copy environment variables template
cp .env.example .env
```

Configure your `.env` file with your credentials:
```env
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_PUBLISHABLE_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# AI Copilot Keys
GEMINI_API_KEY="your-gemini-api-key"
GROQ_API_KEY="your-groq-api-key"
```

### 3. Run Locally
```bash
# Start Vite development server
npm run dev

# Or build and run production bundle
npm run build
npm run preview
```
Open **`http://localhost:3000`** in your browser.

---

## 👥 User Roles & Access Control

| Role | Access Scope |
|---|---|
| **Admin** | Full registry control, user role management, statutory priority weight tuner, system audit logs |
| **Registrar** | Case intake, smart scheduling engine, conflict resolution, What-If simulation, cause list publishing |
| **Judge (`/bench`)** | Self-scoped daily cause list, bench hearing calendar, direct case scheduling onto bench |
| **Public / Litigant** | No-login multilingual case status lookup (`/case-status`) with hearing dates and courtroom allotments |

---

## 📄 License & Attribution

Developed for the **Smart India Hackathon (SIH) 2026**.  
Built by **Team NyayaSetu** for the modernization of Indian District & Taluka Judiciary.
