# ⚖️ NyayaSetu (न्यायसेतु)

### AI-Assisted Smart Court Case Scheduling & Cause-List Optimisation System

**Smart India Hackathon (SIH) 2026 Prototype**

---

## 📌 Executive Summary

India's judicial system faces an immense pendency burden across district and taluka courts. A significant operational bottleneck in daily court administration is **manual cause-list scheduling and resource allocation**, which frequently leads to double-booked judges/courtrooms, avoidable adjournments, sub-optimal workload distribution, and delay in urgent matters.

**NyayaSetu** is a cloud-native, explainable decision-support platform designed for court registries, judges, and citizens. It optimizes hearing schedules using a deterministic constraint solver and multi-factor statutory priority scoring, while keeping judicial administration strictly **human-in-the-loop**.

---

## ✨ Key Features

1. **Smart Constraint-Based Scheduling**:
   - **Hard Constraints**: Validates judge availability, courtroom allocation, overlapping hearings, slot capacity, and daily maximum workload thresholds.
   - **Soft Preferences**: Matches judge subject-matter specialisations (POCSO, Commercial, Civil, Criminal), balances bench workloads, and prioritises urgent tiers.

2. **Statutory Priority Scoring Engine**:
   - Computes transparent 0–100 urgency scores factoring in statutory limitation deadlines, FTSC/POCSO mandates, senior citizen litigants, long-pending property disputes (5+ years), and historical adjournments.

3. **Multi-Persona Portals**:
   - **Court Registry / Admin**: Full case intake, smart scheduling workbench, conflict scanner, what-if disruption simulator, and governance report exports.
   - **Judge Bench View (`/bench`)**: Personalised daily hearing calendar, listing rationale, and case dossiers.
   - **Public Litigant Portal (`/case-status`)**: Instant, no-login case hearing lookup in **English, Hindi, and Marathi**.

4. **What-If Disruption Simulator**:
   - Proactively simulates emergency scenarios (e.g. sudden judge leave or courtroom maintenance) and proposes optimal conflict-free reallocations before changes are committed.

5. **Backlog Simulation & Governance**:
   - Simulates 6- and 12-month pendency reduction comparing legacy FIFO listing vs. Priority-Optimised listing.
   - Generates auditable PDF Cause Lists and compliance evidence reports.

---

## 🛠️ Technology Stack

- **Frontend / Fullstack SSR**: React 19, TanStack Start, Vite 8, Nitro Engine
- **Type Safety & Validation**: TypeScript, Zod
- **Styling & UI Components**: Tailwind CSS v4, Radix UI Primitives, Lucide Icons, Sonner
- **Data Visualisation**: Recharts
- **Database & Authentication**: Supabase (PostgreSQL with Row Level Security policies)
- **PDF Export**: jsPDF & jsPDF-AutoTable

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites

- **Node.js**: v20 or higher
- **npm** or **bun**

### 2. Installation & Setup

```bash
# Clone the repository
git clone <repository-url>
cd nyayasetu-court-scheduler

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_PUBLISHABLE_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### 3. Run Locally

```bash
# Start local development server
npm run dev

# Or build and preview production SSR bundle
npm run build
npm run preview
```

Open `http://localhost:3000` in your browser.

---

## 📜 Deployment

This application is ready for 100% free deployment to **Cloudflare Pages**, **Vercel**, or **Netlify** with a **Supabase** backend.

---

## 📄 License

Developed for Smart India Hackathon (SIH) 2026.
