# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
cd eurospec-timesheet
npm install        # install dependencies
npm start          # dev server at http://localhost:3000
npm run build      # production build
```

No test or lint scripts are configured.

## Architecture

The entire app lives in a **single file**: [eurospec-timesheet/src/App.jsx](eurospec-timesheet/src/App.jsx) (~1670 lines). There are no separate component files, hooks, or utilities. All styles are in [eurospec-timesheet/src/App.css](eurospec-timesheet/src/App.css).

### Backend: Supabase (REST, no SDK)

All database access goes through three thin wrappers at the top of `App.jsx` — no Supabase client library is used:

- `db.get/post/patch/delete` — raw REST calls to the Supabase PostgREST endpoint
- `auth.signIn/signOut/resetPassword` — Supabase Auth via fetch
- `rpc(fn, params)` — calls Supabase stored procedures (RPC)

The Supabase URL and anon key are hardcoded as `SUPABASE_URL` and `SUPABASE_KEY` constants.

### Database tables (inferred from API calls)

- `employees` — `id`, `name`, `role`, `category`, `password` (plain text fallback), `supervisor`, `work_email`, `must_change_password`, `auth_email`
- `entries` — `id`, `employee_id`, `employee_name`, `date`, `day`, `job` (project code), `hours`, `rnd` (boolean), `status` (pending/approved/rejected), `supervisor_id`, `notes`
- `project_codes` — `code`, `description`

### Supabase RPC functions

- `create_employee_auth_user(emp_id, emp_password)` — creates Supabase Auth user on new employee
- `update_employee_password(emp_id, new_password)` — syncs password to both `employees` table and Supabase Auth
- `link_work_email(emp_id, emp_work_email)` — attaches work email to Supabase Auth user (used for supervisor/finance/admin password resets)

### Auth pattern

- Toolmakers/CNC authenticate with internal email `{emp_id.toLowerCase()}@euroclock.eurospec.internal`
- Supervisors/Finance/Admin try their work email first, then fall back to the internal email
- If Supabase Auth has no user (returns 500), login falls back to plain-text comparison against `employees.password`
- Sessions are persisted in `sessionStorage` under key `es_user`; auto-logout fires after 10 minutes of inactivity (`INACTIVITY_MS`)

### Role system and tab routing

The `tabMap` object in `App` controls which tabs each role sees:

| Role | Tabs |
|------|------|
| `toolmaker` | Log Time |
| `cnc` | Log Time (entries auto-approved, skip supervisor) |
| `supervisor` | Review, AI |
| `finance` | Overview, Export, Codes, AI |
| `admin` | Admin, Overview, Export, Codes, AI |

`role` is stored on the employee record; `category` is a sub-type (e.g. `cnc` within the `toolmaker` role group). The CNC auto-approval logic checks `user.category || user.role === "cnc"`.

### AI integrations (Groq API)

Two AI features both use the Groq API (`GROQ_KEY` constant, model `llama-3.3-70b-versatile`):

1. **Project code suggester** (`suggestProjectCode`) — fires 800ms after a work comment reaches 5+ characters in `ToolmakerForm`; only triggers when no project code is manually selected yet.
2. **AI Assistant** (`AIAssistant` component) — chat interface that summarizes all approved entries into a system prompt and sends questions to Groq.

### Key component map

| Component | Purpose |
|-----------|---------|
| `Login` | Login by Employee ID or name; blurs auto-fill the other field |
| `ForgotPasswordScreen` | Routes higher roles to email reset, toolmakers/CNC to "contact admin" |
| `ChangePasswordScreen` | Forced on first login (`must_change_password: true`) |
| `ToolmakerForm` | Multi-row time entry with AI project code suggestion |
| `SupervisorView` | Approve/reject/edit entries; detects anomalies (>12 hrs, duplicates, >14 hrs/day) |
| `HoursDashboard` | Read-only bar charts — hours by project, employee, day of week |
| `FinanceDashboard` | Filter approved entries and export Epicor-format CSV |
| `ProjectCodesManager` | CRUD for project codes; CSV/TSV bulk import with preview modal |
| `AdminView` | Employee management — create/edit/delete, password visibility toggle |
| `AIAssistant` | Groq-powered chat over summarized timesheet data |
| `HelpModal` | Role-specific help overlay, accessible from every view |

### Epicor CSV export format

Finance exports use this exact column order: `Project Code, Date of Work, Employee Code, Date Seq, Hours Work, Project Part, Project Cost, Comment, Plant`. `Plant` is always `"PET"`. `Project Part` is always blank. `Project Cost` is `"RD"` or `"LB"`. `Date Seq` is computed by `computeSeq()` — a sequence number when the same employee logs the same job multiple times on one day.

### Demo credentials (from README)

| Role | ID | Password |
|------|----|----------|
| Toolmaker | E001 | pass1 |
| Supervisor | S001 | sup1 |
| Finance | F001 | fin1 |
| Admin | A001 | admin |
