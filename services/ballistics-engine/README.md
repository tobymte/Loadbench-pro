# LoadBench Pro — Ballistics Engine (.NET service)

A small ASP.NET Core (net8.0) minimal-API service that the Next.js app calls
through an internal API route to compute **external / downrange** ballistics
only — trajectory, drop, drift, time of flight, retained velocity, and energy.

**Scope guardrails (intentional):**

- No chamber pressure / PSI prediction.
- No charge-weight recommendations or "safe / unsafe" verdicts.
- No powder substitutions or load advice.
- LoadBench Pro's internal pressure modeling remains separate and disabled.

## Why a separate service?

[gehtsoft-usa/BallisticCalculator1](https://github.com/gehtsoft-usa/BallisticCalculator1)
is a .NET library licensed **LGPL-2.1**. Wrapping it in a small out-of-process
service:

- Keeps the LGPL boundary clean (the Next.js app calls it over HTTP).
- Avoids porting the library into TypeScript, which would defeat the point of
  using a maintained external-ballistics implementation.
- Lets the Next.js app stay deployable on Vercel while the engine runs anywhere
  that can host a .NET app (Azure App Service, Fly, Railway, a container, a
  small VM, etc.).

## Endpoints

- `GET  /health` → liveness / engine identification.
- `POST /v1/trajectory` → compute a trajectory.

Request body (JSON):

```json
{
  "muzzleVelocityFps": 2800,
  "bulletWeightGr": 140,
  "bcG1": 0.535,
  "zeroDistanceYd": 100,
  "sightHeightIn": 1.5,
  "maxRangeYd": 1000,
  "intervalYd": 50,
  "tempF": 59,
  "altitudeFt": 0,
  "windMph": 10,
  "windAngleDeg": 90
}
```

Response body (JSON, abbreviated):

```json
{
  "engine": "placeholder",
  "engineNotice": "PLACEHOLDER external-ballistics estimate. Replace with BallisticCalculator1 (LGPL-2.1) before relying on these numbers.",
  "scopeNotice": "External/downrange only. No chamber pressure, no PSI, no load safety verdict, no charge recommendations.",
  "points": [
    {
      "rangeYd": 0,
      "velocityFps": 2800,
      "energyFtLb": 2438.2,
      "dropIn": -1.5,
      "driftIn": 0,
      "timeSec": 0,
      "moa": 0,
      "mil": 0,
      "windMoa": 0,
      "windMil": 0
    }
  ]
}
```

## Run locally

```bash
cd services/ballistics-engine
dotnet restore
dotnet run
# listens on http://localhost:5080 by default
```

Then set in the Next.js app's `.env.local`:

```
BALLISTICS_ENGINE_URL=http://localhost:5080
```

If `BALLISTICS_ENGINE_URL` is unset, the `/ballistics` page renders setup
instructions instead of crashing, and the internal API route returns 503 with a
`service_unconfigured` error.

## Wiring the real BallisticCalculator1 library

The current `Program.cs` ships a `PlaceholderBallisticsCalculator` that returns
clearly marked placeholder output. To swap in the real LGPL library:

1. Add the dependency in `BallisticsEngine.csproj`:

   ```xml
   <PackageReference Include="BallisticCalculator" Version="2.*" />
   ```

   (Confirm the latest published version on NuGet / GitHub. You may also
   reference the cloned source directly via `<ProjectReference>`.)

2. Replace `PlaceholderBallisticsCalculator.Compute` with a real
   implementation that maps `TrajectoryRequest` into the library's
   `Ammunition` / `Rifle` / `Atmosphere` / `ShotParameters` types and projects
   the returned trajectory into the `TrajectoryPoint` DTO list. Keep the
   request/response shapes intact so the Next.js client does not change.

3. Update the `engine` and `engineNotice` fields of the response so the UI
   stops showing the placeholder banner.

4. **License obligations (LGPL-2.1):**
   - Preserve required copyright and license notices from BallisticCalculator1.
   - If you modify the library source, publish those modifications.
   - Make the corresponding source of the library (and your modifications, if
     any) available to recipients of the service binary.
   - This service is structured so the library remains a separable dependency
     — keep it that way to satisfy LGPL's "user can replace the library"
     requirement.

## Hosting notes

- **Vercel**: the Next.js app deploys to Vercel; the .NET service does not. Run
  the service on Azure App Service, Fly.io, Railway, Render, or a container
  host. Whatever you choose, set `BALLISTICS_ENGINE_URL` in the Vercel project
  environment to the publicly reachable HTTPS URL (or private network URL if
  you use one).
- **Auth between Next.js and engine**: this scaffold is open by default. In
  production, restrict the engine to internal networking or add a shared-secret
  header check; the Next.js route is the only intended caller.
- **Resource sizing**: requests are CPU-bound and stateless. A small instance
  is fine. Long range × small interval = many rows; the service rejects
  requests with > 400 rows.
