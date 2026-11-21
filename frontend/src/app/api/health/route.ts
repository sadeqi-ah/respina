/**
 * GET /api/health: the container's HEALTHCHECK target (Dockerfile). Docker restarts or stops routing
 * to the container when this fails repeatedly, so it answers one question: is this Next.js
 * process able to serve requests? Not proxied by the BFF and not behind proxy.ts (matcher skips api/).
 */
export const dynamic = "force-dynamic"; // never cached or prerendered: every probe hits the process

export async function GET(): Promise<Response> {
  // Liveness only: no Django call. A Django outage must not mark every frontend container
  // unhealthy, because restarting them can't fix Django. Uptime helps spot restart loops; nothing
  // else (versions, env values, hostnames) is exposed.
  return Response.json(
    { status: "ok", uptime_seconds: Math.round(process.uptime()) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
