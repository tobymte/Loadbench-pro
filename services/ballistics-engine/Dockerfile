# LoadBench Pro — Ballistics Engine
#
# Multi-stage Dockerfile building a small ASP.NET Core 8 runtime image.
# External / downrange ballistics only — no pressure or load-safety output.
#
# Build:    docker build -t loadbench-ballistics-engine services/ballistics-engine
# Run:      docker run --rm -p 8080:8080 -e ASPNETCORE_URLS=http://+:8080 loadbench-ballistics-engine
# Then set BALLISTICS_ENGINE_URL=http://<host>:8080 in the Next.js app.
#
# LGPL-2.1 note: when BallisticCalculator (the upstream LGPL library) is added
# to BallisticsEngine.csproj, the user MUST be able to replace that library.
# Keep it as a separable dependency — do not statically link it into a single
# self-contained executable without also providing object files / source per
# LGPL-2.1 §6.

# ---------- build ----------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src

# Copy only the csproj first so the restore layer is cached across iterations
# where only source files change.
COPY BallisticsEngine.csproj ./
RUN dotnet restore BallisticsEngine.csproj

# Copy the rest of the source and publish a framework-dependent release.
COPY . .
RUN dotnet publish BallisticsEngine.csproj \
    -c Release \
    -o /app \
    --no-restore \
    /p:UseAppHost=false

# ---------- runtime --------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS runtime
WORKDIR /app

# Run as a non-root user — ASP.NET images include the `app` user (uid 1654).
USER app

ENV ASPNETCORE_URLS=http://+:8080 \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_NOLOGO=true \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=true

EXPOSE 8080

# Lightweight healthcheck — calls the /health endpoint inside the container.
# Alpine ships wget by default.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:8080/health || exit 1

COPY --from=build /app ./

ENTRYPOINT ["dotnet", "BallisticsEngine.dll"]
