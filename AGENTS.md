# NyayaSetu Developer & Contributor Guidelines

NyayaSetu is an AI-assisted smart court case scheduling and cause-list optimisation platform built for Indian district and taluka courts.

## Architecture Overview

- **Frontend & Fullstack SSR**: React 19 + TanStack Start + Nitro engine.
- **Routing & State**: TanStack Router (file-based routing under `src/routes/`) + TanStack Query.
- **Styling & UI**: Tailwind CSS v4, Lucide React icons, and Radix UI accessible primitives.
- **Backend & Database**: Supabase PostgreSQL with Row Level Security (RLS) policies and database triggers.
- **Server Functions**: Type-safe isomorphic server functions powered by `@tanstack/react-start` under `src/lib/*.functions.ts`.

## Key Architectural Principles

1. **Deterministic & Explainable Scheduling**: Hard constraints (no double booking, availability, room allocation) are strictly solved, while soft constraints (specialisation, workload, priority tiers) rank options transparently.
2. **Human-in-the-Loop**: All automated listing recommendations require human registrar approval, modification, or rejection with full audit trails.
3. **Multi-Persona Access**: Distinct portals for Registrars/Admins, Judges (Bench View), and Public/Litigants (Multilingual status lookup).
