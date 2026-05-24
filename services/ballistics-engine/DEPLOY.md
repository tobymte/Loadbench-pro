# LoadBench Pro — Ballistics Engine deployment

This is a standalone ASP.NET Core 8 service. It speaks JSON over HTTP on a
single port and is stateless. Pick whichever host can run a .NET 8 container
or a small VM.

> **Scope reminder.** External / downrange ballistics only. No chamber
> pressure / PSI, no charge recommendations, no safe/unsafe verdicts. The
> deployment instructions below do not unlock any of those — the guardrails
> live in the code.

## 1. Container (recommended)

```bash
# from the repository root
docker build -t loadbench-ballistics-engine services/ballistics-engine

# run on port 8080
docker run --rm -p 8080:8080 \
  -e ASPNETCORE_URLS=http://+:8080 \
  loadbench-ballistics-engine

# smoke-test
curl -fsSL http://localhost:8080/health
```

In the Next.js app's environment, set:

```
BALLISTICS_ENGINE_URL=http://<host>:8080
```

## 2. Hosts that take a Dockerfile

| Provider                    | Notes                                                    |
| --------------------------- | -------------------------------------------------------- |
| **Fly.io**                  | `fly launch` in `services/ballistics-engine`. Internal networking gives you a `*.internal` URL. |
| **Railway / Render**        | Point at the directory; auto-detects Dockerfile.         |
| **Azure App Service**       | Linux App Service with a containerized deployment.       |
| **AWS Fargate / ECS**       | Push image to ECR, run as a Fargate task.                |
| **GCP Cloud Run**           | `gcloud run deploy --source services/ballistics-engine`. |

## 3. Bare metal / VM (no container)

```bash
cd services/ballistics-engine
dotnet publish -c Release -o /var/loadbench/ballistics

# systemd unit (excerpt)
# ExecStart=/usr/bin/dotnet /var/loadbench/ballistics/BallisticsEngine.dll
# Environment=ASPNETCORE_URLS=http://0.0.0.0:5080
```

## 4. Reverse proxy

If the engine sits behind nginx / Cloudflare / etc., make sure:

- HTTPS terminates at the proxy and the upstream is plain HTTP.
- `Host` header is forwarded.
- Timeouts are at least 15 s — large trajectories with small intervals can be CPU-bound.

## 5. Auth between Next.js and the engine

The scaffold is open by default. In production, restrict it to your private
network or add a shared-secret header check. Suggested patterns:

- Fly.io / Tailscale: use the private `*.internal` URL.
- Public deployment: terminate behind your CDN and require a shared
  `X-LoadBench-Auth` header in the engine `Program.cs`. The Next.js client
  currently does not send a header — add the read in the engine first, then
  extend `lib/ballistics/engineClient.ts` once the secret is provisioned.

## 6. Wiring the real LGPL library

The repository ships with a clearly-marked placeholder calculator. To swap in
the real BallisticCalculator package:

1. Add the package reference in `BallisticsEngine.csproj`:

   ```xml
   <PackageReference Include="BallisticCalculator" Version="2.*" />
   ```

   (Confirm the published version on NuGet.)

2. Replace `PlaceholderBallisticsCalculator.Compute` in `Program.cs` with a
   real implementation that maps the request DTO to the library's
   `Ammunition` / `Rifle` / `Atmosphere` / `ShotParameters` types and
   projects the trajectory into the `TrajectoryPoint` DTO list. Keep the
   request/response shapes intact so the Next.js client does not change.

3. Update the `engine` and `engineNotice` fields of the response so the UI
   stops showing the placeholder banner.

4. **License obligations (LGPL-2.1):**
   - Preserve required copyright and license notices from BallisticCalculator1.
   - If you modify the library source, publish those modifications.
   - Make the corresponding source of the library (and your modifications, if
     any) available to recipients of the service binary.
   - Keep the library as a separable dependency so users can replace it.
   - Do **not** statically link the library into a single self-contained
     executable without also providing object files / source per LGPL §6.

## 7. Health check & monitoring

- `GET /health` returns `{ status: "ok", engine, notice }`.
- Wire it into your host's healthcheck (k8s probe, ECS healthcheck, Fly
  service checks). The Dockerfile ships a HEALTHCHECK using `wget`.
- The Next.js app exposes `/api/ballistics/health` which proxies the result
  — useful for end-to-end uptime monitoring without exposing the engine URL.
- Admin operators can sanity-check the wiring at `/admin/deployment-check`.

## 8. Resource sizing

- CPU-bound, stateless, ~10–50 ms per trajectory at the default
  step. The service rejects requests with > 200 rows
  (`maxRangeYd / intervalYd <= 200`).
- 256 MB RAM is plenty for the placeholder; 512 MB is a safe floor with the
  real LGPL library.
