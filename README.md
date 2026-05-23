# LoadBench Pro — Starter

A safety-first reloading notebook scaffold. **Next.js 14 (App Router) · TypeScript · Tailwind CSS · Prisma · Postgres · Clerk-ready.**

> ⚠ **This is a notebook, not a load engine.**
> LoadBench Pro records what you load and the published source you cite. It does **not** recommend, predict, or correct charges. Read [`app/safety/page.tsx`](app/safety/page.tsx) before recording anything.

---

## Stack

| Layer       | Choice                                            |
| ----------- | ------------------------------------------------- |
| Framework   | Next.js 14 App Router (RSC + route handlers)      |
| Language    | TypeScript (strict)                               |
| Styling     | Tailwind CSS v3 with a custom dark palette        |
| ORM         | Prisma 5                                          |
| Database    | Postgres (Neon, Supabase, Railway, local)         |
| Auth        | Clerk (placeholder wiring — see _Enabling Clerk_) |
| Validation  | Zod                                               |

---

## Quick start

```bash
# 1. install
npm install

# 2. configure env
cp .env.example .env.local
# edit .env.local — set DATABASE_URL (and DIRECT_URL for Neon/Supabase)

# 3. generate the Prisma client and run the first migration
npm run prisma:generate
npm run prisma:migrate -- --name init

# 4. start the app
npm run dev
```

Open <http://localhost:3000>. The landing page lives at `/`; the app shell lives under the `(app)` route group (`/dashboard`, `/cartridges`, `/components`, `/rifles`, `/sources`, `/loads`, `/loads/new`, `/loads/[id]`, `/sessions`, `/notebook`, `/compare`, `/ballistics`, `/chrono-import`, `/data-tools`, `/settings`). The required-reading safety page is at `/safety`.

### Tools

| Route             | Purpose                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `/compare`        | Filterable side-by-side load comparison from observed session data only. No safety or pressure validation.                                   |
| `/chrono-import`  | Paste chronograph CSV and import it as a `RangeSession` with computed avg / ES / SD. Schema-compatible aggregate import only.                |
| `/ballistics`     | Educational G1 external-ballistics trajectory estimate from user-entered muzzle velocity, weight, BC, zero, etc. Not a load engine.          |

---

## Scripts

| Script                   | What it does                                 |
| ------------------------ | -------------------------------------------- |
| `npm run dev`            | Start the Next.js dev server                 |
| `npm run build`          | `prisma generate` then build for production  |
| `npm run start`          | Start the built app                          |
| `npm run lint`           | ESLint via `next lint`                       |
| `npm run prisma:generate`| Generate the Prisma client                   |
| `npm run prisma:migrate` | Create + apply a migration (development)     |
| `npm run prisma:deploy`  | Apply migrations in production / CI          |
| `npm run prisma:studio`  | Browse the database in Prisma Studio         |

---

## Environment variables

Copy `.env.example` to `.env.local`. Never commit real secrets.

| Variable                                | Required             | Notes                                                                |
| --------------------------------------- | -------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`                          | yes                  | Pooled Postgres connection used by the app.                          |
| `DIRECT_URL`                            | on Neon / Supabase   | Non-pooled connection used by Prisma Migrate.                        |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`     | when enabling auth   | From the Clerk dashboard.                                            |
| `CLERK_SECRET_KEY`                      | when enabling auth   | Server-side Clerk key.                                               |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`         | optional             | Defaults to `/sign-in`.                                              |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`         | optional             | Defaults to `/sign-up`.                                              |
| `LOADBENCH_DISABLE_AUTH`                | optional             | `"true"` lets the scaffold render without Clerk; flip to `"false"` once Clerk is wired. |
| `NEXT_PUBLIC_APP_NAME` / `..._APP_URL`  | optional             | Used for window titles / OG metadata.                                |

---

## Premium access via Stripe

LoadBench Pro gates the **advanced pressure-modeling workspace** behind a
recurring Stripe subscription. The velocity-only validation sandbox at
`/simulation-sandbox` remains accessible without a subscription; what paid
access unlocks is the full `/pressure-modeling` test bench (model-version
records, validation-record review, load-readiness selection, expanded
solver-input data capture).

> Premium access is **infrastructure only**. It does **not** grant load
> recommendations, pressure predictions, or safe/unsafe verdicts. All
> calculations are experimental validation tools and must be independently
> verified against published manufacturer data before being used to inform
> any handload.

### Required environment variables

| Variable                                | Required for billing | Notes |
| --------------------------------------- | -------------------- | ----- |
| `STRIPE_SECRET_KEY`                     | yes                  | Server-side Stripe secret (`sk_test_…` / `sk_live_…`). |
| `STRIPE_WEBHOOK_SECRET`                 | yes                  | Signing secret for the `/api/billing/webhook` endpoint. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`    | optional             | Reserved for future client-side Stripe.js usage. |
| `STRIPE_PRESSURE_MODELING_PRICE_ID`     | yes                  | Stripe Price id (`price_…`) for the recurring subscription. |
| `NEXT_PUBLIC_APP_URL`                   | yes                  | Base URL used to build Checkout success / cancel / portal return URLs. |

### Creating the Stripe product / price

1. Sign in to <https://dashboard.stripe.com>.
2. **Products → Add product**. Name it e.g. *LoadBench Pro — Pressure
   Modeling*. Add a **recurring** price (monthly or annual).
3. Copy the resulting **Price** id (starts with `price_`) into
   `STRIPE_PRESSURE_MODELING_PRICE_ID`.
4. Under **Developers → API keys**, copy the **Secret key** into
   `STRIPE_SECRET_KEY`.

### Configuring the webhook

The webhook endpoint is `POST /api/billing/webhook` and must receive these
events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

**Local development** (with the Stripe CLI):

```bash
stripe login
stripe listen --forward-to localhost:3000/api/billing/webhook
# Copy the printed whsec_… into STRIPE_WEBHOOK_SECRET in .env.local
```

Trigger a test event:

```bash
stripe trigger checkout.session.completed
```

**Production / Vercel**:

1. In the Stripe dashboard go to **Developers → Webhooks → Add endpoint**.
2. URL: `https://<your-domain>/api/billing/webhook`.
3. Select the four events listed above.
4. Copy the endpoint's **Signing secret** into the Vercel project's
   `STRIPE_WEBHOOK_SECRET` environment variable (Production scope).
5. Also set `STRIPE_SECRET_KEY`, `STRIPE_PRESSURE_MODELING_PRICE_ID`,
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (optional), and `NEXT_PUBLIC_APP_URL`
   in Vercel.

### Routes

| Route                          | Method | Purpose                                       |
| ------------------------------ | ------ | --------------------------------------------- |
| `/api/billing/checkout`        | POST   | Creates a Stripe Checkout session and 303-redirects the caller. |
| `/api/billing/portal`          | POST   | Opens the Stripe Billing Portal for the workspace's customer. |
| `/api/billing/webhook`         | POST   | Stripe-signed webhook. Updates `WorkspaceEntitlement`. |

`WorkspaceEntitlement` (in `prisma/schema.prisma`) is the single source of
truth for whether a workspace has unlocked a given feature key (currently
`pressure_modeling`). Server-side helpers in `lib/billing/entitlements.ts`
expose `hasPremiumAccess(workspaceId, featureKey)` and
`getEntitlement(...)` for use in route handlers and server components.

---

## Enabling Clerk

The scaffold ships in **auth-disabled** mode so the UI renders end-to-end without secrets. To enable Clerk:

1. Create an application at <https://dashboard.clerk.com> and copy the publishable + secret keys into `.env.local`.
2. Set `LOADBENCH_DISABLE_AUTH=false`.
3. In `middleware.ts`, uncomment the `clerkMiddleware` block and remove the no-op middleware.
4. In `app/layout.tsx`, wrap `<body>` in `<ClerkProvider>` (an inline comment marks the spot).
5. Add `/sign-in` and `/sign-up` route pages — Clerk's `<SignIn />` / `<SignUp />` components are the fastest path.
6. Replace the stub in `lib/auth/workspace.ts#getWorkspaceContext` with the real Clerk lookup (a TODO comment marks the spot). The replacement should:
   - Call `auth()` from `@clerk/nextjs/server`.
   - Look up or upsert the matching `User` and the user's primary `WorkspaceMember`.
   - Return `{ userId, workspaceId, role }`.

---

## Data model

Defined in [`prisma/schema.prisma`](prisma/schema.prisma). Every workspace-scoped entity carries a `workspaceId` and a unique-per-workspace constraint where the domain demands it.

| Model              | Purpose                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `User`             | Identity, keyed by Clerk's `clerkUserId`.                                                     |
| `Workspace`        | Top-level tenant; everything else hangs off it.                                               |
| `WorkspaceMember`  | Joins a `User` to a `Workspace` with a `WorkspaceRole` (`OWNER` / `ADMIN` / `MEMBER` / `VIEWER`). |
| `Cartridge`        | Cartridge reference (e.g. 6.5 Creedmoor) with SAAMI / max pressure / bullet diameter.         |
| `Component`        | Bullets, powders, primers, cases (discriminated by `kind`).                                   |
| `Rifle`            | Rifles you reload for, optionally linked to a `Cartridge`.                                    |
| `Source`           | Published reference you cite (manual, manufacturer data) with optional `publishedMaxGr`.      |
| `Load`             | The notebook entry: cartridge + components + (optional) charge / OAL + source citation + safety acknowledgement. |
| `RangeSession`     | What you shot, when, where, with what conditions, and what came out of the chrono.            |
| `AuditEvent`       | Append-only log of create / update / delete / export / print.                                 |
| `ImportBatch` + `ImportBatchRow` | Staged imports for review before commit.                                            |
| `PrintJob`         | Queued print artifacts (load cards, session reports, labels).                                 |
| `FileObject`       | Metadata for attachments stored in object storage.                                            |

### Safety-relevant fields on `Load`

| Field                   | Why it exists                                                                 |
| ----------------------- | ----------------------------------------------------------------------------- |
| `chargeGr`              | The powder charge in grains. Triggers the safety validation when non-null.    |
| `sourceId`              | **Required** for any non-null `chargeGr`. Enforced in `lib/validation/load.ts`. |
| `safetyAcknowledged`    | **Required `true`** for any non-null `chargeGr`. The UI surfaces an explicit acknowledgement checkbox. |
| `safetyNotes`           | Free-form context the loader wants to capture (e.g. "starting work-up").      |
| `cartridgeOalIn`, `cartridgeBaseToOgiveIn`, `caseTrimLengthIn`, `neckTensionThou` | Dimensional discipline. |
| `createdById`, `updatedById` | Audit trail at the row level.                                            |

---

## Server-side validation

[`lib/validation/load.ts`](lib/validation/load.ts) is the single source of truth for safety rules and is invoked from every write path (`/api/loads`). It enforces:

1. **Shape** — required references (cartridge, bullet, powder) and types via Zod.
2. **Source required for charge** — saving with `chargeGr` set requires `sourceId`. Drafts without a charge can be saved without a source.
3. **Acknowledgement required for charge** — `safetyAcknowledged === true` is required for any charge-bearing save.
4. **Charge ≤ published max** — if the cited `Source` records a `publishedMaxGr`, the validator rejects any `chargeGr` above it.
5. **Never suggest a replacement.** Errors describe what the user must change. The validator never returns a corrected charge.

All five rules return discriminated `ValidationIssue` codes the UI surfaces inline.

---

## Workspace access

`lib/auth/workspace.ts` exposes three helpers used by every route handler:

- `getWorkspaceContext()` — resolves `{ userId, workspaceId, role }` for the request.
- `assertCanWrite(ctx)` — throws if the caller is a `VIEWER`.
- `scopeToWorkspace(ctx, where)` — adds `workspaceId` to a Prisma where-clause.

The scaffold ships with `LOADBENCH_DISABLE_AUTH="true"` returning a deterministic dev context. **Wire Clerk before deploying to production.**

---

## Deployment notes

### Database — Neon or Supabase

Both work out of the box:

- **Neon**: create a project, take the **pooled** connection string for `DATABASE_URL` and the **direct** connection for `DIRECT_URL`.
- **Supabase**: under _Database → Connection pooling_, take the **Transaction** mode string for `DATABASE_URL` and the **Session** string for `DIRECT_URL`.

Then:

```bash
npm run prisma:deploy
```

…to apply migrations against the target database.

### App — Vercel

1. Push the repo to GitHub.
2. Import it in Vercel.
3. Set `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `LOADBENCH_DISABLE_AUTH=false` in the Vercel project's Environment Variables.
4. Vercel runs `npm run build`, which runs `prisma generate`. Migrations are **not** applied at build time — run `npm run prisma:deploy` via a one-off command or a deploy hook before promoting.

### Auth — Clerk

In the Clerk dashboard:

1. Add your production domain (and the Vercel preview wildcard).
2. Configure the JWT template if you use Clerk JWTs elsewhere.
3. Copy the publishable + secret keys into Vercel.

---

## What's intentionally _not_ here

- **No load development engine.** No charge recommendations, no pressure modelling, no "predicted velocity". This is a deliberate product decision.
- **No localStorage / sessionStorage for critical data.** All durable state goes through Prisma → Postgres.
- **No real secrets.** `.env.example` carries placeholders; real keys must be set per-environment.

---

## Known limitations of this scaffold

- **Reference data is stubbed** in the UI (Cartridge / Component / Source dropdowns in `LoadForm` are empty until you wire workspace-scoped fetches — there are `TODO(forms)` markers in place).
- **AuditEvent writes are TODO** in every mutating route. The schema is ready; the handlers need to insert the audit row inside the same transaction as the mutation.
- **Sign-in / sign-up routes are not generated.** Add `app/sign-in/[[...rest]]/page.tsx` and `app/sign-up/[[...rest]]/page.tsx` when you enable Clerk.
- **Imports / print jobs / file uploads** have schema + UI placeholders but no backend handlers yet.
- **Tests** are not included. Add Vitest or Playwright before shipping.

---

## Safety disclaimer

LoadBench Pro is provided **as-is, with no warranty of any kind**. The authors are not responsible for damage, injury, or death resulting from any load recorded in or derived from this software. Reloading is inherently dangerous. **If you are not qualified to evaluate a load yourself, do not load it.** See [`/safety`](app/safety/page.tsx) for the full policy.
