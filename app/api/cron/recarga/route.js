import {
  initSchema,
  getRecargaConfig,
  setRecargaAlertTarget,
} from "../../../../lib/db.js";
import {
  computePlan,
  formatNaira,
  formatCOP,
  formatLongDate,
  toISO,
} from "../../../../lib/calc.js";
import { sendAlert } from "../../../../lib/notify.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (!isVercelCron && secret && auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    await initSchema();
    const row = await getRecargaConfig();
    if (!row) return Response.json({ ok: true, status: "sin config guardada" });

    const config = JSON.parse(row.data);
    const plan = computePlan(config, new Date());

    // Sin cobro que falle dentro del horizonte → nada que avisar.
    if (!plan.failingCharge) {
      return Response.json({ ok: true, status: "saldo de sobra" });
    }
    // Aún no entramos en zona de recarga.
    if (plan.daysUntilRecharge > 0) {
      return Response.json({
        ok: true,
        status: "cubierto",
        diasParaRecargar: plan.daysUntilRecharge,
      });
    }
    // Ya avisamos para este mismo cobro → no repetir.
    const target = toISO(plan.failingCharge.date);
    if (row.last_alert_target === target) {
      return Response.json({ ok: true, status: "ya avisado", target });
    }

    const saldo = formatNaira(plan.balance);
    const saldoCop = formatCOP(plan.balance, plan.copRate);
    const recarga = formatNaira(plan.amountForTarget);
    const recargaCop = formatCOP(plan.amountForTarget, plan.copRate);
    const cubierto = plan.coveredUntil
      ? formatLongDate(plan.coveredUntil.date)
      : "ningún cobro";
    const cobroFalla = formatLongDate(plan.failingCharge.date);

    const text =
      `Recarga YouTube Premium\n\n` +
      `Saldo actual: ${saldo} (≈ ${saldoCop} COP)\n` +
      `Te alcanza hasta el cobro del ${cubierto}.\n` +
      `El cobro del ${cobroFalla} se quedaría sin saldo.\n\n` +
      `Recargá ${recarga} (≈ ${recargaCop} COP) para seguir cubierto.`;

    const html =
      `⏰ <b>Recarga YouTube Premium</b>\n\n` +
      `Saldo actual: <b>${saldo}</b> (≈ ${saldoCop} COP)\n` +
      `Te alcanza hasta el cobro del <b>${cubierto}</b>.\n` +
      `El cobro del <b>${cobroFalla}</b> se quedaría sin saldo.\n\n` +
      `Recargá <b>${recarga}</b> (≈ ${recargaCop} COP) para seguir cubierto.`;

    const result = await sendAlert(
      { subject: "⏰ Hora de recargar YouTube Premium", text, html },
      { email: row.email },
    );

    // Solo marcamos como avisado si al menos un canal salió bien.
    if (result.sent.length > 0) await setRecargaAlertTarget(target);

    return Response.json({ ok: true, status: "aviso enviado", target, ...result });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
