import { runScrape } from "../../../../lib/runScrape.js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (!isVercelCron && secret && auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const result = await runScrape();
    return Response.json({
      ok: true,
      products: result.snapshot.length,
      competitors: result.competitors.length,
      alerts: result.alerts.length,
    });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
