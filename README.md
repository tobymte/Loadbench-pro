# LoadBench Pro — Starter

A safety-first reloading notebook scaffold. **Next.js 15 (App Router) · TypeScript · Tailwind CSS · Prisma · Postgres · Clerk.**

> **Production / beta operators:** see [`app/(app)/settings/deployment/page.tsx`](app/(app)/settings/deployment/page.tsx) (also visible in the app at `/settings/deployment`) for the full deployment guide, [`/admin/deployment-check`](app/(app)/admin/deployment-check/page.tsx) for env-var diagnostics, and [`/admin/beta`](app/(app)/admin/beta/page.tsx) for release readiness. Tester onboarding lives at [`/beta`](app/(app)/beta/page.tsx). First-login walkthrough is at [`/onboarding`](app/(app)/onboarding/page.tsx). CSV exports are served from `/api/export/csv/<entity>` (see [`/data-tools`](app/(app)/data-tools/page.tsx)).

> ⚠ **This is a notebook, not a load engine.**
> LoadBench Pro records what you load and the published source you cite. It does **not** recommend, predict, or correct charges. Read [`app/safety/page.tsx`](app/safety/page.tsx) before recording anything.

---

## Stack

| Layer       | Choice                                            |
| ----------- | ------------------------------------------------- |
| Framework   | Next.js 15 App Router (RSC + route handlers)      |
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

### Beginner local-development checklist

If you are new to the project, work through these in order. Each step is a
real check — don't skip ahead if the previous one is failing.

1. **Node + npm installed.** Run `node -v` (Node 18+ is fine).
2. **Postgres available.** Local Postgres, Neon, Supabase, or Railway all
   work. You just need a connection string.
3. **`.env.local` exists.** Copy `.env.example` and set `DATABASE_URL`. For
   Neon/Supabase also set `DIRECT_URL`.
4. **Prisma client generated.** `npm run prisma:generate`.
5. **Database migrated.** On a fresh database run
   `npm run prisma:migrate -- --name init`. If you are coming back to an
   existing database, `npx prisma migrate deploy` is the right call.
6. **Auth decision.** Leave `LOADBENCH_DISABLE_AUTH=true` in `.env.local`
   while you explore. Flip to `false` only once Clerk keys are wired.
7. **Start the dev server.** `npm run dev`. Visit
   <http://localhost:3000/dashboard>.

If the dashboard shows a **"Workspace not ready yet"** card, the message
text tells you which check failed. The usual fixes are steps 3 – 5 above.

### Recommended in-app setup path

Once the dev server is running, the dashboard's **Recommended setup path**
walks you through this. The order matters because each step references the
previous one.

1. **Cite a published source** at `/sources` — a manual, manufacturer PDF,
   or data sheet you will reference when you record a load.
2. **Add the cartridges you reload for** at `/cartridges`.
3. **Stock bullets, powders, primers, and cases** at `/components`. Record
   each lot separately — lot numbers carry through to sessions.
4. **Add at least one rifle** at `/rifles`.
5. **Record your first load** at `/loads/new`. A charge will only save if
   it is at or below the published max on the source you cited.
6. **Log a range session** at `/sessions`, or paste a chronograph CSV at
   `/chrono-import`.

Premium users can then continue into the pressure-engine workspace via the
**Setup wizard → Run builder → Run detail** flow described below. None of
those screens produce a PSI value, charge recommendation, or safe/unsafe
verdict — they are non-operational by design.

Open <http://localhost:3000>. The landing page lives at `/`; the app shell lives under the `(app)` route group (`/dashboard`, `/cartridges`, `/components`, `/rifles`, `/sources`, `/loads`, `/loads/new`, `/loads/[id]`, `/sessions`, `/notebook`, `/compare`, `/ballistics`, `/chrono-import`, `/pressure-modeling`, `/pressure-engine`, `/simulation-sandbox`, `/solver-inputs`, `/published-data-review`, `/data-quality`, `/data-tools`, `/settings`). The required-reading safety page is at `/safety`.

### Tools

| Route                | Purpose                                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `/compare`           | Filterable side-by-side load comparison from observed session data only. No safety or pressure validation.                                   |
| `/chrono-import`     | Paste chronograph CSV or upload a file from Garmin / LabRadar / MagnetoSpeed / Caldwell. Detects m/s, tab, semicolon delimiters; warns on suspicious velocities, duplicate shots, missing shot numbers. Saves as a `RangeSession`.|
| `/ballistics`        | External G1 trajectory estimate (drop, drift, velocity, energy, time of flight) with SVG charts. Downrange-only — no pressure, no charge advice. |
| `/data-quality`      | Reference data review center. Surfaces missing fields, unverified rows, duplicate-looking sources, incomplete citations, source confidence badges. Completeness only — never a safety verdict. |
| `/notebook`          | Printable range cards, load labels, component lot labels, and source verification cards. Browser print with proper @page CSS and high-contrast layout. |
| `/admin/model-validation/reporting` | Admin-only validation harness reporting: aggregate stats, run history, adapter status, guardrail failure telemetry, dataset coverage, completeness trends, JSON export. |

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
| `BALLISTICS_ENGINE_URL`                 | for `/ballistics`    | URL of the separate .NET downrange-ballistics service. Blank ⇒ `/ballistics` shows setup help instead of crashing. |

---

## Ballistics engine (external/downrange only) — separate .NET service

LoadBench Pro's `/ballistics` page is wired to a separate **.NET minimal-API
service** under [`services/ballistics-engine/`](services/ballistics-engine/).
That service is the integration point for
[gehtsoft-usa/BallisticCalculator1](https://github.com/gehtsoft-usa/BallisticCalculator1),
a LGPL-2.1 external-ballistics library.

**Scope (intentional):**

- Computes **external / downrange** quantities only: trajectory, drop, drift,
  time of flight, retained velocity, and energy.
- Does **not** predict chamber pressure / PSI.
- Does **not** issue safe / unsafe verdicts.
- Does **not** recommend charge weights or powder substitutions.
- LoadBench Pro's internal pressure modeling remains **separate and
  disabled** (see "Pressure engine — non-operational shell" below). The
  ballistics engine never touches that surface.

**Architecture:**

```
+-------------------+        POST /api/ballistics/calculate        +-------------------------------+
| Next.js (Vercel)  | --------------------------------------------> | Next.js route handler         |
|  /ballistics UI   |                                               |  - validates user input (zod) |
+-------------------+                                               |  - drops non-external fields  |
                                                                    +---------------+---------------+
                                                                                    |
                                                                                    | POST /v1/trajectory
                                                                                    v
                                                                    +-------------------------------+
                                                                    | .NET service                  |
                                                                    |  services/ballistics-engine/  |
                                                                    |  wraps BallisticCalculator1   |
                                                                    |  (LGPL-2.1)                   |
                                                                    +-------------------------------+
```

### Running the .NET service locally

```bash
cd services/ballistics-engine
dotnet restore
dotnet run            # listens on http://localhost:5080
```

Health-check: `curl http://localhost:5080/health`.

### Wiring the Next.js app to the service

Add to `.env.local`:

```
BALLISTICS_ENGINE_URL=http://localhost:5080
```

Then start the Next.js app as usual (`npm run dev`) and open `/ballistics`.
If `BALLISTICS_ENGINE_URL` is unset, the page renders setup instructions
instead of crashing, and the internal API route returns `503
service_unconfigured`.

### Vercel / hosting notes

- The Next.js app deploys to Vercel as before.
- The .NET service does **not** deploy on Vercel. Host it on Azure App
  Service, Fly.io, Railway, Render, or any container host that can run a
  net8.0 ASP.NET Core app. Set `BALLISTICS_ENGINE_URL` in the Vercel project
  environment to the engine's reachable URL.
- The internal API route is the only intended caller of the engine. In
  production, restrict the engine to private networking or add a
  shared-secret header check.

### Placeholder vs. real BallisticCalculator1

The current `Program.cs` in `services/ballistics-engine/` ships a clearly
marked `PlaceholderBallisticsCalculator` so the contract and UI work end to
end without network access to NuGet. To swap in the real LGPL library, add a
`PackageReference` to `BallisticCalculator` (or a `ProjectReference` to a
cloned `BallisticCalculator1` source tree) and replace the placeholder with a
real adapter — see [`services/ballistics-engine/README.md`](services/ballistics-engine/README.md)
for the exact steps. The Next.js client and request/response DTOs are
designed to stay unchanged across that swap.

### License attribution (LGPL-2.1)

This service is designed to wrap
[gehtsoft-usa/BallisticCalculator1](https://github.com/gehtsoft-usa/BallisticCalculator1),
which is distributed under the **GNU Lesser General Public License v2.1
(LGPL-2.1)**. Once the real library is linked:

- Preserve the upstream copyright and license notices in the deployed binary
  and in any source you redistribute.
- If you **modify** the library source, you must publish those modifications
  under LGPL-2.1 and make them available to recipients of the deployed
  binary.
- Make the corresponding source of the library available to recipients of
  the service binary (or include written instructions for obtaining it from
  the upstream repository).
- Keep the library a separable dependency — the LGPL "user can replace the
  library" requirement is satisfied here because the engine is a separate
  process the Next.js app reaches over HTTP, not statically linked into the
  Next.js bundle.

A short version of this attribution is shown to users on the `/ballistics`
page.

---

## Pressure engine — non-operational shell

The `/pressure-engine` page is the controlled validation workspace gated by
the `pressure_modeling` entitlement. **Pressure prediction is disabled.**
Every run on this page persists `pressurePredictionStatus = "disabled"` on
its audit row, and the runner intentionally produces:

- No predicted PSI / peak pressure / chamber pressure value.
- No `recommendedCharge`, `maxChargeRecommendation`, or load advice.
- No `safe` / `unsafe` verdict.
- No powder substitution or increase/decrease charge advice.

What it does produce:

| Output                          | Description                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `dataCompleteness`              | 0..1 fraction of expected solver-input / chrono / reference fields supplied.   |
| `missingFields`                 | Names of fields that are absent or null.                                       |
| `inputConsistencyWarnings`      | Descriptive warnings — e.g. observed velocity without a reference to compare.  |
| `sourceCoverage`                | Which categories of reference / observation supplied data.                     |
| `velocityDeltaFps`, `…Pct`      | Velocity-only delta when both reference and observed velocity are supplied.    |
| `pressurePredictionStatus`      | Literal string `"disabled"` on every run, persisted to the audit log.          |

### Forbidden-output guardrails

`lib/validation/pressureEngine.ts` defines `FORBIDDEN_OUTPUT_KEYS` (case-
insensitive) covering `predictedPressurePsi`, `peakPressure`,
`chamberPressure`, `safe`, `unsafe`, `recommendedCharge`,
`maxChargeRecommendation`, `loadAdvice`, `powderSubstitution`,
`increaseCharge`, `decreaseCharge`, and aliases. The API route at
`POST /api/pressure-engine/runs`:

1. Rejects any request body that contains a forbidden key at any depth
   (recursive scan of objects and arrays). A `REJECTED_BY_GUARDRAIL`
   audit row is persisted so the attempt is visible in the history view.
2. Re-strips the candidate output object through the same forbidden-key
   filter before persistence, as defence-in-depth.
3. Always sets `pressurePredictionStatus = "disabled"` on the persisted
   row, regardless of caller input.

An in-process smoke check is exposed at `GET /api/pressure-engine/smoke`.
It verifies that `findForbiddenKeys` catches every documented key
(top-level, nested-object, nested-array, case-insensitive variants) and
that `stripForbiddenKeys` drops them.

### Setup wizard workflow

`/pressure-engine/setup` is a premium-gated readiness checklist for users
about to record their first (or next) validation run. It performs no
pressure math and renders no PSI, charge advice, or safe/unsafe verdict.
For each required and important input it shows present/missing status, why
the data matters, and a button to the existing entry page:

1. Cartridge defined (`/cartridges`).
2. Verified published reference row (`/published-data-review`).
3. Load created (`/loads`, `/loads/new`).
4. Rifle and barrel geometry (`/rifles`, `/solver-inputs`).
5. Case capacity measurement (`/solver-inputs`).
6. Bullet dimensions (`/solver-inputs`).
7. Powder metadata (`/solver-inputs`).
8. Chrono calibration (`/solver-inputs`).
9. Observed chrono / range session (`/sessions`).
10. Pressure validation reference record (`/pressure-modeling`).

The page renders an overall readiness score, a required-only readiness
score, and a single **Start validation run →** CTA that is only enabled
when every required step is ready. The CTA links to
`/pressure-engine/new` — where runs still record only data completeness,
missing fields, source coverage, velocity-only delta, and
`pressurePredictionStatus = "disabled"`. Entry points to the wizard live in
the topbar of `/pressure-engine` and `/pressure-engine/new`.

### Routes

| Route                              | Method | Purpose                                                                                  |
| ---------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| `/pressure-engine`                 | GET    | Premium-gated workspace UI (paywall when no entitlement).                                |
| `/pressure-engine/setup`           | GET    | Premium-gated setup wizard — readiness checklist for validation runs; renders no math.   |
| `/pressure-engine/new`             | GET    | Premium-gated run builder. Records non-operational runs only.                            |
| `/api/pressure-engine/runs`        | POST   | Record a non-operational engine run; rejects forbidden keys with 400.                    |
| `/api/pressure-engine/runs`        | GET    | List recent engine runs for the audit / history view.                                    |
| `/api/pressure-engine/smoke`       | GET    | In-process guardrail smoke check.                                                        |

### Model governance

`PressureModelVersion` now records additional governance metadata
(additive, all nullable):

- `governanceStatus` — `"draft"` / `"validation_only"` / `"disabled"` /
  `"retired"`. Documentation only; engine runs remain non-operational
  regardless of value.
- `blockedOutputsPolicy` — free-form text declaring what the model is
  forbidden from emitting.
- `validationNotes` — free-form notes about validation progress.

### Requirements before any model can be enabled

Engine runs are non-operational pending **all** of:

1. A validated lab pressure model with documented variance bounds.
2. SAAMI / CIP / manufacturer data review covering every supported
   cartridge / powder / bullet combination.
3. Legal and safety review of the model and its outputs.
4. Instrumented test validation across the operating envelope.

Until those are in place, no pressure / charge / safe-or-unsafe output
will be produced by this app under any circumstance.

---

## Internal ballistics model adapter — admin-only validation harness

LoadBench Pro defines a controlled adapter contract for future internal
ballistics models in `lib/ballistics/modelAdapter.ts`. **The only adapter
shipped is the disabled default.** It returns:

- `pressurePredictionStatus: "disabled"`
- `dataCompleteness`, `missingFields`, `warnings`
- `sourceCoverage` (bullet / powder / case / barrel / reference / observed)
- `velocityDeltaFps` / `velocityDeltaPct` when both reference and observed
  velocity are present (velocity, never pressure)
- `validation` metadata: adapter name, version, governance status, blocked-
  outputs policy

The adapter contract:

| Field                                          | Type                                     | Notes                                                                                           |
| ---------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `pressurePredictionStatus`                     | `"disabled" \| "validation_only" \| "awaiting_review"` | Default adapter always emits `"disabled"`. Anything else is treated as still non-operational. |
| `dataCompleteness`                             | `number` (0..1)                          | Descriptive, never a safety verdict.                                                            |
| `missingFields`                                | `string[]`                               | Field names that were absent or null.                                                           |
| `warnings`                                     | `string[]`                               | Input-consistency warnings only; never a safe / unsafe verdict.                                 |
| `sourceCoverage`                               | object                                   | Categories of reference / observation supplied.                                                 |
| `velocityDeltaFps`, `velocityDeltaPct`         | `number \| null`                         | Velocity-only. Pressure is never computed.                                                      |
| `validation`                                   | object                                   | Adapter name, version, governance status, blocked-outputs policy.                               |

### Forbidden output keys (rejected by sanitizer)

`sanitizeAdapterResponse` reuses the centralized
`FORBIDDEN_OUTPUT_KEYS` list from `lib/validation/pressureEngine.ts` and
rejects any response containing — at any depth, case-insensitively —
`predictedPressurePsi`, `peakPressure`, `chamberPressure`, `safe`,
`unsafe`, `recommendedCharge`, `maxChargeRecommendation`, `loadAdvice`,
`powderSubstitution`, `increaseCharge`, `decreaseCharge`, and aliases.

### Validation harness workflow (admin-only)

Admins (Clerk emails listed in `LOADBENCH_ADMIN_EMAILS`, or local-dev with
`LOADBENCH_DISABLE_AUTH=true`) can:

1. Browse `/admin/model-validation` to see existing validation datasets and
   the hardcoded adapter registry.
2. Create a new validation dataset (kind: `published`, `manufacturer`,
   `lab`, or `internal_test`) with a reference identifier and licensing
   note. Acknowledgement that the dataset is validation-only is required.
3. Open a dataset at `/admin/model-validation/{id}` to add reference
   cases. Each case carries the published / lab inputs (cartridge, bullet
   weight & diameter, charge, case capacity, barrel length, twist, OAL,
   powder burn rate, temperature, reference velocity, observed velocity).
   **Reference pressure**, when present, is admin-only validation metadata
   transcribed from the source — it is never rendered as load guidance and
   the field name (`referencePressurePsi`) is intentionally distinct from
   any forbidden output key.
4. Run the harness against the dataset by selecting an adapter. The
   forbidden-key sanitizer scrubs every adapter response. A
   `ModelValidationRun` row is persisted with `pressurePredictionStatus`
   echoed from the adapter (always `"disabled"` for the default adapter)
   and a JSON-encoded summary (total cases, completed, guardrail
   rejections, mean velocity delta, mean |velocity delta|).

Non-admins are unauthorized. Premium non-admins (with the
`pressure_modeling` entitlement) see only an aggregate dataset count on
the unauthorized landing — no cases, no pressure values, no run outputs.

### Routes (model validation)

| Route                                            | Method | Purpose                                                                          |
| ------------------------------------------------ | ------ | -------------------------------------------------------------------------------- |
| `/admin/model-validation`                        | GET    | Admin dataset list + adapter registry + create-dataset form.                      |
| `/admin/model-validation/{id}`                   | GET    | Admin dataset detail: cases, run harness, run results.                            |
| `/api/admin/model-validation/datasets`           | GET    | Admin: list datasets in the workspace.                                            |
| `/api/admin/model-validation/datasets`           | POST   | Admin: create dataset (rejects forbidden keys).                                   |
| `/api/admin/model-validation/cases`              | POST   | Admin: add a validation case (rejects forbidden keys).                            |
| `/api/admin/model-validation/runs`               | POST   | Admin: run a harness; persists a `ModelValidationRun` row with disabled status.   |

### Data model

`ModelValidationDataset`, `ModelValidationCase`, and `ModelValidationRun`
are additive tables. `ModelValidationRun.pressurePredictionStatus`
defaults to `"disabled"`, and `ModelValidationRun.status` uses the
`ModelValidationRunStatus` enum which includes `REJECTED_BY_GUARDRAIL` for
auditability. No existing model is changed by this migration.

### Adapter status workflow

Adapters carry a `governanceStatus` field with values `"disabled"`,
`"draft"`, `"validation_only"`, or `"retired"`. The default adapter is
`"disabled"`. **No adapter shipped with this app is ever
`"approved_pending_review"` or analogous — and approval would not on its
own enable pressure outputs.** Before any future adapter could leave
`"validation_only"`, the gates documented above (validated lab model,
SAAMI / CIP / manufacturer review, legal / safety review, instrumented
test validation) all have to be met, plus a code review of the adapter
implementation itself.

### Required environment

Admin gating uses the existing variables:

- `LOADBENCH_ADMIN_EMAILS` — comma-separated lowercase Clerk emails.
- `LOADBENCH_DISABLE_AUTH=true` — local dev only; bypasses Clerk so the
  admin UI can be exercised without setting up auth.
- `DATABASE_URL` — Postgres connection string.

After deploying this feature, run:

```
npx prisma migrate deploy
npx prisma generate
```

Pressure prediction remains disabled regardless of setup state.

---

## Premium access via BigCommerce

LoadBench Pro gates the **advanced pressure-modeling workspace** behind a
purchase processed by your existing BigCommerce store. The velocity-only
validation sandbox at `/simulation-sandbox` remains accessible without a
purchase; what paid access unlocks is the full `/pressure-modeling` test
bench (model-version records, validation-record review, load-readiness
selection, expanded solver-input data capture).

Payment details are collected on BigCommerce's hosted "redirected
checkout". This server only creates a cart and redirects the user — card
numbers never reach LoadBench Pro.

> Premium access is **infrastructure only**. It does **not** grant load
> recommendations, pressure predictions, or safe/unsafe verdicts. All
> calculations are experimental validation tools and must be independently
> verified against published manufacturer data before being used to inform
> any handload.

### Required environment variables

| Variable                              | Required for billing | Notes |
| ------------------------------------- | -------------------- | ----- |
| `BIGCOMMERCE_STORE_HASH`              | yes                  | Store hash from Settings → API accounts. |
| `BIGCOMMERCE_ACCESS_TOKEN`            | yes                  | API account token with `Carts: modify`, `Checkouts: modify`, `Orders: read-only`. |
| `BIGCOMMERCE_PRESSURE_PRODUCT_ID`     | yes                  | Numeric product id of the digital "Pressure Modeling Access" product. |
| `BIGCOMMERCE_CHANNEL_ID`              | optional             | Sales channel id. Blank → default storefront. |
| `BIGCOMMERCE_WEBHOOK_SECRET`          | recommended          | HMAC-SHA256 secret used to sign webhook bodies. |
| `BIGCOMMERCE_CLIENT_SECRET`           | optional             | Alternative env var name for the webhook secret. |
| `NEXT_PUBLIC_APP_URL`                 | yes                  | Base URL of this app (used for paywall return links). |

### BigCommerce dashboard setup

1. **Create the digital product**.
   - In your BigCommerce control panel: **Products → Add**.
   - Name it e.g. *LoadBench Pro — Pressure Modeling Access*.
   - Set type to **Digital** and disable shipping.
   - Price is whatever you choose. Save.
   - Note the numeric Product ID (visible in the URL when editing the
     product — `/manage/products/123` → `123`). Paste into
     `BIGCOMMERCE_PRESSURE_PRODUCT_ID`.

2. **Create an API account / store-level access token**.
   - **Settings → API accounts → Create API account → Store API
     account**.
   - Grant these scopes:
     - **Carts**: modify
     - **Checkouts**: modify
     - **Orders**: read-only
     - **Information & Settings**: read-only
   - Save and copy:
     - the **store hash** (from the API path) → `BIGCOMMERCE_STORE_HASH`
     - the **access token** → `BIGCOMMERCE_ACCESS_TOKEN`

3. **Configure the webhook**.
   - The webhook endpoint is `POST /api/billing/bigcommerce/webhook`.
   - Create webhooks for these scopes:
     - `store/order/created`
     - `store/order/updated`
     - `store/order/statusUpdated`
     - `store/order/transaction/created`
   - Set the destination to
     `https://<your-domain>/api/billing/bigcommerce/webhook`.
   - If you set a signing secret on the webhook, copy it into
     `BIGCOMMERCE_WEBHOOK_SECRET` so the handler can verify signatures.

4. **Set env vars locally and in Vercel**.
   - **Local**: copy `.env.example` to `.env.local` and fill in the
     `BIGCOMMERCE_*` and `NEXT_PUBLIC_APP_URL` values.
   - **Vercel**: Project Settings → Environment Variables → add the same
     keys under Production (and Preview if desired).

5. **Run the migration**.
   ```bash
   npm run prisma:migrate -- --name bigcommerce_entitlement_fields
   # or, in CI / production:
   npm run prisma:deploy
   ```

   The pressure-engine shell ships its own additive migration
   (`20260523220000_pressure_engine_runs`) that adds the
   `PressureEngineRun` table, the `PressureEngineRunStatus` enum, and three
   governance metadata columns on `PressureModelVersion`. It is included
   in `npm run prisma:deploy`.

6. **Test the flow**.
   - From `/pressure-modeling` or `/simulation-sandbox`, click
     **Unlock with BigCommerce Checkout**.
   - You will be redirected to BigCommerce's hosted checkout. Complete a
     test purchase (BigCommerce sandbox or a real low-priced sale, your
     choice).
   - Once BigCommerce posts the order webhook, the workspace's
     `WorkspaceEntitlement` row for `pressure_modeling` is set to
     `ACTIVE` and the premium UI unlocks on next page load.

### Customer → workspace matching

The webhook matches BigCommerce orders to LoadBench workspaces in this
order:

1. By BigCommerce order id (idempotent retries).
2. By the cart id the LoadBench checkout route persisted on the
   `WorkspaceEntitlement` row when it created the cart.
3. By **billing email** — if the BigCommerce shopper's billing email
   exactly matches the LoadBench `User.email`, the access is granted to
   that user's earliest workspace.

If none of those match, the order is logged and dropped. To unlock access
manually after a mis-matched order, run a one-off SQL update (or use
Prisma Studio) — there is intentionally no public unlock endpoint:

```sql
UPDATE "WorkspaceEntitlement"
   SET status = 'ACTIVE',
       "bigcommerceOrderId" = '<order id from BigCommerce>'
 WHERE "workspaceId" = '<workspace id>'
   AND "featureKey"  = 'pressure_modeling';
```

### Routes

| Route                                   | Method | Purpose                                       |
| --------------------------------------- | ------ | --------------------------------------------- |
| `/api/billing/bigcommerce/checkout`     | POST   | Creates a BigCommerce cart and 303-redirects to the hosted checkout. |
| `/api/billing/bigcommerce/webhook`      | POST   | BigCommerce-signed webhook. Updates `WorkspaceEntitlement` on paid orders. |
| `/api/billing/checkout` (legacy Stripe) | POST   | Retained for stores still on Stripe; inactive unless `STRIPE_*` vars are set. |
| `/api/billing/portal` (legacy Stripe)   | POST   | Stripe billing portal. Inactive unless `STRIPE_*` vars are set. |
| `/api/billing/webhook` (legacy Stripe)  | POST   | Stripe webhook. Inactive unless `STRIPE_*` vars are set. |

`WorkspaceEntitlement` (in `prisma/schema.prisma`) is the single source of
truth for whether a workspace has unlocked a given feature key (currently
`pressure_modeling`). Server-side helpers in `lib/billing/entitlements.ts`
expose `hasPremiumAccess(workspaceId, featureKey)` and
`getEntitlement(...)` for use in route handlers and server components.

### Manual entitlement (admin override)

While BigCommerce is not yet configured, the app owner can grant or revoke
`pressure_modeling` directly from `/admin/entitlements`. The page is gated
by `LOADBENCH_ADMIN_EMAILS` and never bypasses the safety guardrails — a
manual grant unlocks the **display scaffolding** only. Pressure prediction,
charge recommendations, and safe/unsafe verdicts remain disabled
regardless of entitlement state.

1. Add a comma-separated list of admin emails to `.env.local` (and your
   Vercel project's environment variables):

   ```
   LOADBENCH_ADMIN_EMAILS="owner@example.com,ops@example.com"
   ```

   The check is case-insensitive and matched against the authenticated
   Clerk user's primary email. Leave the variable blank in production to
   lock the admin UI for everyone.

2. Restart the dev server (or redeploy on Vercel) so Next.js picks up the
   new env var, then visit <http://localhost:3000/admin/entitlements> as
   one of the configured admin accounts.

3. Identify a workspace by id/slug or a user email (resolves to the user's
   first workspace), enter an optional reason, and click **Grant
   pressure_modeling** or **Revoke pressure_modeling**. Each action writes
   a `WorkspaceEntitlement` upsert and an `AuditEvent` row tagged
   `manual_entitlement.grant` or `manual_entitlement.revoke`.

4. The page lists the most recent 200 entitlement rows and the last 50
   audit events, so you can confirm the grant / revoke landed.

**Local development without Clerk:** when `LOADBENCH_DISABLE_AUTH=true`
the admin UI is reachable without a signed-in Clerk session (a warning
banner is shown). Do not deploy with `LOADBENCH_DISABLE_AUTH=true`.

**No database migration is required.** Manual grants reuse the existing
`WorkspaceEntitlement` row and tag the source in the existing optional
`bigcommerceCustomerEmail` column with a `manual:<admin-email>` prefix.
The audit trail reuses the existing `AuditEvent` model.

| Route                                  | Method | Purpose                                                  |
| -------------------------------------- | ------ | -------------------------------------------------------- |
| `/admin/entitlements`                  | GET    | Operator-only UI. Non-admins see an unauthorized notice. |
| `/api/admin/entitlements`              | POST   | Grant or revoke. `op=grant\|revoke`, optional `workspaceId`/`email`/`reason`. Form or JSON. |

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

## Shooters World / CIP Reference Center

LoadBench Pro ships a dedicated, verified-reference workspace for published
CIP and Shooters World (Explosia) metadata.

**Safety boundary (load-bearing):**

- This feature stores **reference metadata only**. It records the Pmax /
  maximum-average piezo pressure values published by CIP / Shooters World
  alongside the source URL and revision used to verify each row.
- The app **never** converts these rows into a per-handload pressure
  estimate, charge recommendation, increase/decrease advice, powder
  substitution, or safe/unsafe verdict. Every CIP-related screen surfaces
  `pressurePredictionStatus: "disabled"` and the safety reminder.
- The registry-only `shooters-world-cip` adapter (in
  `lib/ballistics/modelAdapter.ts`) returns the same disabled-default
  response shape as the base adapter; it exists as a label so the
  validation harness can record which workflow produced a citation.

**Routes:**

- `/cip-reference` — user-facing browser. Lists verified rows only,
  filterable by cartridge, powder, and manufacturer.
- `/cip-reference/compare` — comparison panel. Lays a verified CIP row
  next to a saved load and surfaces readiness notes (missing fields,
  unset safety acknowledgement). No pressure prediction is performed.
- `/admin/shooters-world-cip` — admin entry workspace. Admin-only.
  Non-admins see a graceful unauthorized notice. Workspace-scoped.
- `/api/admin/cip-reference/records` — POST to add a draft row.
  Forbidden output keys are rejected on the inbound boundary.
- `/api/admin/cip-reference/verify` — POST to promote a row to
  `VERIFIED`. Requires an explicit "I have compared this row against
  the cited source" acknowledgement and a non-empty `sourceUrl`.
- `/api/admin/cip-reference/retire` — POST to retire a row.
- `/api/admin/cip-reference/template` — GET a headers-only CSV
  template (with one synthetic example row labelled
  `PLACEHOLDER`). Admin-only download.
- `/admin/shooters-world-cip/bulk-import` — admin-only page for
  uploading or pasting a CSV of CIP reference rows. Validates each
  row, shows a per-row preview with errors and warnings (missing
  source URL, non-CIP host, missing cartridge/powder, invalid units
  or numerics, intra-batch duplicates), and requires an explicit
  admin acknowledgement before saving. All imported rows are saved
  as `DRAFT` — never auto-verified. Forbidden output keys in the
  CSV body cause the upload to be rejected.
- `/api/admin/cip-reference/bulk-import` — POST endpoint backing the
  bulk-import page. Accepts `{ csv, mode: 'preview' | 'commit',
  acknowledgedDraftOnly }` (or equivalent form fields). Hard limits:
  1 MB CSV body, 500 rows per import. Robust when `DATABASE_URL` is
  missing or the Prisma client is stale: failures surface as
  per-row failures rather than crashing the import.

**Fields supported per row:**

- Cartridge: `cartridgeName`, `cartridgeCaliberLabel`.
- Powder: `powderManufacturer` (e.g. Shooters World / Explosia),
  `powderFamily`, `powderName`.
- Source citation: `sourceUrl` (cip-bob.org or equivalent),
  `sourceLabel`, `sourceRevision`, `sourceDate`.
- Published reference pressure metadata: `pmaxValue`, `pmaxUnit`
  (`BAR`, `MPA`, or `PSI`).
- Reference volumes: `referenceChamberVolume`,
  `referenceCombustionVolume`, `volumeUnit` (`CM3`, `ML`, or
  `GRAIN_H2O`).
- CIP TDCC rifling geometry: `riflingF`, `riflingZ`, `riflingG`.
- Workflow: `verificationStatus` (`DRAFT`, `PENDING_REVIEW`,
  `VERIFIED`, `RETIRED`), `verifiedByEmail`, `verifiedAt`,
  `createdByEmail`, `createdAt`, `updatedAt`, `notes`.

**Data-entry process:**

1. An admin opens `/admin/shooters-world-cip` and enters a row one at a
   time using the form. The Pmax value and unit are transcribed from the
   published CIP / Shooters World source.
2. Rows are always created as `DRAFT`. There is no auto-verification on
   create or import.
3. The admin opens the cited source (CIP TDCC PDF, manufacturer page) in a
   new tab, compares each value, and only then ticks the
   "I have compared this row against the cited source" checkbox and
   submits the verify action. The row moves to `VERIFIED` and is surfaced
   on `/cip-reference`. Rows without a `sourceUrl` cannot be verified.
4. To prepare a CSV in advance, download the template at
   `/api/admin/cip-reference/template`, delete the synthetic example,
   transcribe values, and either add rows one per submission OR upload
   the completed CSV via
   `/admin/shooters-world-cip/bulk-import`. The bulk-import page
   validates each row, previews errors and warnings, and requires an
   admin acknowledgement before saving — imported rows always land as
   `DRAFT`, never `VERIFIED`. There is no scraping of cip-bob.org.

**Bulk CSV import (`/admin/shooters-world-cip/bulk-import`):**

- Admin-only. Non-admins see a graceful unauthorized notice.
- The downloaded template now uses the operator-facing Shooters World /
  CIP printed-table column row: `Cartridge`, `CASE`, `Bullet weight`,
  `PROJECTILE`, `COAL`, `POWDER`, `ST LOAD`, `ST VEL`, `MAX LOAD`,
  `MAX VEL`, `MAX PSI`. Headers are matched case-insensitively, ignoring
  spaces and underscores. Mapping onto `CipReferenceRecord`:
  - `Cartridge` → `cartridgeName` (required)
  - `POWDER` → `powderName`
  - `MAX PSI` → `pmaxValue` with implicit `pmaxUnit=PSI` (reference
    metadata only; never a per-handload prediction; left empty when blank)
  - `CASE`, `Bullet weight`, `PROJECTILE`, `COAL`, `ST LOAD`, `ST VEL`,
    `MAX LOAD`, `MAX VEL` → preserved as a structured suffix on the
    row's `notes` field (e.g. `CASE=6.5x48; Bullet weight=140 gr; …`).
    No schema migration was required and no data is dropped silently.
- Back-compat: previous canonical headers (`cartridgeName`,
  `pmaxValue`, `pmaxUnit`, `referenceChamberVolume`,
  `referenceCombustionVolume`, `volumeUnit`, `riflingF/Z/G`,
  `sourceUrl/Label/Revision/Date`, `powderManufacturer/Family/Name`,
  `cartridgeCaliberLabel`, `notes`) and friendly aliases such as
  `CARTRIDGE`, `MFR`, `URL`, `PRESSURE UNIT` are still accepted so older
  templates continue to import.
- `ST LOAD`, `MAX LOAD`, `ST VEL`, `MAX VEL`, `COAL` are stored as
  transcribed labels only. The app never recommends charges, predicts
  pressure, advises increases/decreases, or issues safe/unsafe verdicts
  based on them.
- Per-row warnings (non-blocking): missing `sourceUrl`, non-CIP
  source host, missing powder identification, `pmaxValue` without
  `pmaxUnit`, volume without `volumeUnit`, looks-like duplicate of
  an earlier row in the batch.
- Per-row errors (blocking): missing `cartridgeName`, invalid URL,
  invalid date, invalid number, invalid unit enum, schema
  rejection. Errors must be fixed before the commit button is
  enabled.
- The same forbidden-output-key filter used elsewhere
  (`predictedPressurePsi`, `recommendedCharge`, etc.) is run
  against the raw CSV body and against each parsed row. Any match
  rejects the upload — bulk import never accepts these keys, not
  even transiently.

**Assisted CIP Source Import (`/admin/shooters-world-cip/import`):**

An optional admin-only workflow that helps an operator open a draft row
from an official CIP URL without retyping the source citation. It is
deliberately narrow:

- The admin pastes a CIP TDCC / source URL (allow-list:
  `cip-bobp.org`, `bobp.cip-bobp.org`, `cip-bob.org`, plus `www.` and
  obvious subdomain variants). Non-CIP hosts are warned and require an
  explicit acknowledgement before a draft is created.
- A server-side fetch (`POST /api/admin/cip-reference/source-preview`)
  collects basic source metadata only: HTTP status, content type,
  content length, last-modified, an HTML `<title>` if and only if the
  body is HTML and small enough to sniff, or a PDF filename derived
  from the URL / `Content-Disposition`. Fetch is timeout-bounded and
  capped at 64 KiB of body for title extraction.
- The importer **does not** parse PDF bodies, **does not** extract Pmax /
  volume / rifling values, **does not** predict chamber pressure, **does
  not** recommend or adjust charges, and **does not** auto-verify. The
  numeric reference fields are left blank on create — the admin
  transcribes them on the main admin page after the draft is saved.
- `POST /api/admin/cip-reference/source-import` creates a `DRAFT`
  `CipReferenceRecord` seeded with the URL, an auto-derived
  `sourceLabel` (HTML title or PDF filename), and an auto-derived
  `sourceDate` (parsed from `Last-Modified` when present). Forbidden
  output keys are rejected at this boundary as well. Verification still
  goes through the existing acknowledgement-gated verify endpoint.
- If the server cannot reach the URL the importer still works: the
  fetch is skippable (checkbox on the form) and the draft is created
  from whatever the admin pasted.

**Validation harness integration:** verified CIP rows are intended as
reference citations for dataset cases created in
`/admin/model-validation`. The harness still uses its own
`ModelValidationCase` schema; the CIP entry stores the published
metadata an admin would copy into a dataset case (cartridge, powder
context, reference Pmax). The harness produces no pressure prediction,
in line with `lib/ballistics/modelAdapter.ts`.

**Degradation:**

- Missing `DATABASE_URL` or unreachable database: the user page shows an
  "Unavailable" card; the admin page shows the same setup prompt as the
  rest of the admin surfaces.
- Unauthenticated users: `getWorkspaceContext()` throws and the user
  page surfaces the same friendly notice.
- Non-admins hitting `/admin/shooters-world-cip` get an `Unauthorized`
  card with a link to `/cip-reference`.
- Stale Prisma client: surfaces the "Setup required" notice with the
  exact `prisma generate` / `prisma migrate deploy` commands.

---

## What's intentionally _not_ here

- **No load development engine.** No charge recommendations, no pressure modelling, no "predicted velocity". This is a deliberate product decision.
- **No localStorage / sessionStorage for critical data.** All durable state goes through Prisma → Postgres.
- **No real secrets.** `.env.example` carries placeholders; real keys must be set per-environment.

---

## Beta feedback & issue tracker

LoadBench Pro ships an in-app feedback flow for beta testers and an admin
issue tracker for operators.

**As a tester:**

- Open `/beta/feedback` (linked from the sidebar, the dashboard, and the
  `/beta` package page).
- Pick a type — bug, usability, feature request, data issue, safety
  concern, performance, mobile, deployment/login.
- Fill in title, severity, page/area, description, steps to reproduce,
  expected vs actual, device/browser (auto-filled), and an optional
  contact preference.
- If you are signed in, your workspace is auto-associated and your
  recent reports are listed below the form.
- If you are not signed in (or the dev fallback is active), you can still
  submit and an admin will see the row.

**As an operator:**

- Open `/admin/beta/issues` (linked from the Admin sidebar group and from
  `/admin/beta`).
- Filter by status, type, and severity.
- Expand any row to read the full report and update status / admin
  notes. Statuses cycle `NEW → TRIAGED → IN_PROGRESS → (BLOCKED) →
  RESOLVED / WONT_FIX / ARCHIVED`.
- Counts by status are surfaced at the top of the page.

**Safety boundary:** a `SAFETY_CONCERN` type is accepted so users can
flag perceived safety problems. The app stores these as user reports
only. It does NOT turn them into pressure estimates, charge
recommendations, safe/unsafe verdicts, powder substitutions, or any
other load advice. Human triage only.

**Migration:** the feature is shipped as the additive migration
`20260525120000_beta_feedback_issue` — three enums and one table. To
apply against an existing database run `npx prisma migrate deploy`. The
pages and API routes degrade gracefully if the migration has not been
applied yet (you'll see a "setup required" notice instead of a crash).

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
