import { initSchema, getRecargaConfig, saveRecargaConfig } from "../../../../lib/db.js";

export const dynamic = "force-dynamic";

// Guarda la config del Recarga Tracker en el servidor para que el cron
// pueda revisar el saldo y avisar aunque la página esté cerrada.
export async function POST(req) {
  try {
    const body = await req.json();
    const config = body.config || {};
    const email = body.email || config.email || null;
    const alertDays = Number(body.alertDays ?? config.buffer ?? 7);
    await initSchema();
    await saveRecargaConfig({ data: config, email, alertDays });
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await initSchema();
    const row = await getRecargaConfig();
    if (!row) return Response.json({ ok: true, config: null });
    return Response.json({
      ok: true,
      config: JSON.parse(row.data),
      email: row.email,
      updatedAt: row.updated_at,
    });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
