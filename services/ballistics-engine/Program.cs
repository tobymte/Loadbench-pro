// LoadBench Pro — Ballistics Engine (external/downrange only)
//
// Minimal ASP.NET Core service that the Next.js app calls through an internal
// API route. Scope is strictly EXTERNAL ballistics: trajectory, drop, drift,
// time of flight, retained velocity, energy. This service intentionally does
// NOT compute or expose chamber pressure, PSI, load safety verdicts, charge
// weight recommendations, or powder substitutions. Those are out of scope and
// LoadBench Pro's internal pressure modeling remains separate and disabled.
//
// License note: this service is designed to wrap gehtsoft-usa/BallisticCalculator1
// (LGPL-2.1). Until that dependency is added (see BallisticsEngine.csproj),
// it returns clearly marked PLACEHOLDER deterministic output so the Next.js
// integration can be developed and tested end to end.

using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy =
        System.Text.Json.JsonNamingPolicy.CamelCase;
    options.SerializerOptions.DefaultIgnoreCondition =
        JsonIgnoreCondition.WhenWritingNull;
});

builder.Services.AddSingleton<IBallisticsCalculator, PlaceholderBallisticsCalculator>();

var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new
{
    status = "ok",
    service = "loadbench-ballistics-engine",
    engine = "placeholder",
    notice = "External ballistics only. No pressure / load advice.",
}));

app.MapPost("/v1/trajectory", (TrajectoryRequest req, IBallisticsCalculator calc) =>
{
    var problems = req.Validate();
    if (problems.Count > 0)
    {
        return Results.BadRequest(new { error = "invalid_request", problems });
    }

    var result = calc.Compute(req);
    return Results.Ok(result);
});

app.Run();


public interface IBallisticsCalculator
{
    TrajectoryResponse Compute(TrajectoryRequest req);
}

// PLACEHOLDER implementation. Returns a deterministic, physically plausible
// flat-fire trajectory using a simple drag-free + linear-drop approximation
// so the contract and UI can be exercised. Swap with a BallisticCalculator1-
// backed implementation before relying on these numbers for anything real.
public sealed class PlaceholderBallisticsCalculator : IBallisticsCalculator
{
    public TrajectoryResponse Compute(TrajectoryRequest req)
    {
        var points = new List<TrajectoryPoint>();

        double mv = req.MuzzleVelocityFps;
        double bw = req.BulletWeightGr;
        double bc = req.BcG1;
        double zero = req.ZeroDistanceYd;
        double sight = req.SightHeightIn;
        double maxR = req.MaxRangeYd;
        double step = req.IntervalYd;

        double wind = req.WindMph ?? 0.0;
        double windAngleDeg = req.WindAngleDeg ?? 90.0;
        double windCross = wind * Math.Sin(windAngleDeg * Math.PI / 180.0);

        for (double r = 0; r <= maxR + 1e-9; r += step)
        {
            // Retained velocity: exponential decay scaled by BC. Placeholder.
            double decay = Math.Exp(-r / (3500.0 * Math.Max(bc, 0.05)));
            double v = mv * decay;

            // Time of flight: numerical integration of 1/v over range.
            // Simple trapezoidal estimate from muzzle to range r.
            double t = r > 0
                ? 3.0 * r / (mv + v)        // yards / ((fps+fps)/2 / 3)
                : 0.0;

            // Energy in ft-lb: (gr * fps^2) / 450240
            double energy = (bw * v * v) / 450240.0;

            // Drop in inches: gravity drop minus zeroing correction. Placeholder.
            double dropRaw = 0.5 * 386.088 * t * t; // inches (g = 386.088 in/s^2)
            double zeroT = 3.0 * zero / (mv + mv * Math.Exp(-zero / (3500.0 * Math.Max(bc, 0.05))));
            double zeroDropRaw = 0.5 * 386.088 * zeroT * zeroT;
            // Solve for sight-line correction so drop at zero range = 0.
            double zeroSlopeIn = (zeroDropRaw + sight) / Math.Max(zero, 1e-6);
            double drop = -(dropRaw - zeroSlopeIn * r - sight);

            // Drift in inches: classic Didion approximation, crosswind only.
            // drift_in = wind_fps * (t - r_ft / mv_fps) * 12
            double windFps = windCross * 1.46667;
            double rFt = r * 3.0;
            double drift = windFps * (t - rFt / Math.Max(mv, 1e-6)) * 12.0;

            // Angular conversions. 1 MOA ≈ 1.047 in / 100 yd; 1 mil = 3.6 in / 100 yd.
            double per100 = r > 0 ? (100.0 / r) : 0.0;
            double moa = r > 0 ? (-drop * per100 / 1.047) : 0.0;
            double mil = r > 0 ? (-drop * per100 / 3.6) : 0.0;
            double windMoa = r > 0 ? (drift * per100 / 1.047) : 0.0;
            double windMil = r > 0 ? (drift * per100 / 3.6) : 0.0;

            points.Add(new TrajectoryPoint(
                RangeYd: Math.Round(r, 2),
                VelocityFps: Math.Round(v, 1),
                EnergyFtLb: Math.Round(energy, 1),
                DropIn: Math.Round(drop, 2),
                DriftIn: Math.Round(drift, 2),
                TimeSec: Math.Round(t, 4),
                Moa: Math.Round(moa, 2),
                Mil: Math.Round(mil, 2),
                WindMoa: Math.Round(windMoa, 2),
                WindMil: Math.Round(windMil, 2)
            ));
        }

        return new TrajectoryResponse(
            Engine: "placeholder",
            EngineNotice:
                "PLACEHOLDER external-ballistics estimate. Replace with " +
                "BallisticCalculator1 (LGPL-2.1) before relying on these numbers.",
            ScopeNotice:
                "External/downrange only. No chamber pressure, no PSI, no " +
                "load safety verdict, no charge recommendations.",
            Points: points
        );
    }
}


public sealed record TrajectoryRequest(
    double MuzzleVelocityFps,
    double BulletWeightGr,
    double BcG1,
    double ZeroDistanceYd,
    double SightHeightIn,
    double MaxRangeYd,
    double IntervalYd,
    double? TempF,
    double? AltitudeFt,
    double? WindMph,
    double? WindAngleDeg)
{
    public List<string> Validate()
    {
        var problems = new List<string>();
        if (!(MuzzleVelocityFps > 0)) problems.Add("muzzleVelocityFps must be > 0");
        if (!(BulletWeightGr > 0)) problems.Add("bulletWeightGr must be > 0");
        if (!(BcG1 > 0)) problems.Add("bcG1 must be > 0");
        if (!(ZeroDistanceYd > 0)) problems.Add("zeroDistanceYd must be > 0");
        if (!(MaxRangeYd > 0)) problems.Add("maxRangeYd must be > 0");
        if (!(IntervalYd > 0)) problems.Add("intervalYd must be > 0");
        if (IntervalYd > 0 && MaxRangeYd / IntervalYd > 400)
            problems.Add("too many rows requested; raise intervalYd or lower maxRangeYd");
        return problems;
    }
}

public sealed record TrajectoryPoint(
    double RangeYd,
    double VelocityFps,
    double EnergyFtLb,
    double DropIn,
    double DriftIn,
    double TimeSec,
    double Moa,
    double Mil,
    double WindMoa,
    double WindMil);

public sealed record TrajectoryResponse(
    string Engine,
    string EngineNotice,
    string ScopeNotice,
    List<TrajectoryPoint> Points);
