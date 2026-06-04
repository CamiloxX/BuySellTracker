// lib/calc.js — Lógica pura del Recarga Tracker (YouTube Premium · Nigeria)
// Sin dependencias. Solo Date nativo. Todas las funciones son puras.

export const DEFAULT_CONFIG = {
  balance: 32500, // saldo actual ₦
  charge: 3600, // cobro mensual ₦
  chargeDay: 9, // día del mes del cobro
  buffer: 7, // días de aviso antes
  discountEnd: "2027-02-28", // fin del descuento (ISO)
  priceAfter: "", // precio normal ₦ tras el descuento (vacío = desconocido)
  copRate: 2.66, // COP por cada ₦1
  target: "", // ISO de la fecha de cobro hasta la que quiero estar cubierto
  balanceDate: "", // ISO del día en que se registró/confirmó el saldo (ancla)
};

const HORIZON = 14; // cuántos cobros futuros generamos

/* ----------------------------- helpers de fecha ---------------------------- */

export function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function parseISO(s) {
  if (!s) return null;
  const [y, m, d] = String(s).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / 86400000);
}

function lastDayOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// Construye la fecha del cobro para un año/mes dado (monthIndex puede ser >11,
// Date lo normaliza). Si el mes no tiene ese día, usa el último día del mes.
function makeChargeDate(year, monthIndex, chargeDay) {
  const base = new Date(year, monthIndex, 1);
  const y = base.getFullYear();
  const m = base.getMonth();
  const day = Math.min(chargeDay, lastDayOfMonth(y, m));
  return new Date(y, m, day);
}

/* --------------------------- generación de cobros -------------------------- */

// Próximas N fechas de cobro empezando por la primera hoy o futura.
// Si el cobro de este mes ya pasó, empieza el siguiente.
export function generateChargeDates(today, chargeDay, count = HORIZON) {
  const t0 = startOfDay(today);
  const y = t0.getFullYear();
  let m = t0.getMonth();
  const first = makeChargeDate(y, m, chargeDay);
  if (first < t0) m += 1; // ya pasó este mes
  const out = [];
  for (let i = 0; i < count; i++) out.push(makeChargeDate(y, m + i, chargeDay));
  return out;
}

// Precio de un cobro según su fecha y la config.
// ≤ discountEnd → charge. Posterior con priceAfter>0 → priceAfter.
// Posterior sin priceAfter → charge pero marcado "sin confirmar".
export function priceForDate(date, config) {
  const discountEnd = parseISO(config.discountEnd);
  const charge = Number(config.charge) || 0;
  const priceAfter = Number(config.priceAfter) || 0;
  if (discountEnd && startOfDay(date) <= startOfDay(discountEnd)) {
    return { amount: charge, unconfirmed: false };
  }
  if (priceAfter > 0) return { amount: priceAfter, unconfirmed: false };
  return { amount: charge, unconfirmed: true };
}

/* ---------------------- descuento automático por fecha --------------------- */

// Cobros que ocurren estrictamente entre 'after' y 'before' (after < d < before).
export function chargesInRange(after, before, chargeDay) {
  const a = startOfDay(after);
  const b = startOfDay(before);
  const out = [];
  if (b <= a) return out;
  let cursor = new Date(a.getFullYear(), a.getMonth(), 1);
  let guard = 0;
  while (guard < 600) {
    const d = makeChargeDate(cursor.getFullYear(), cursor.getMonth(), chargeDay);
    if (d >= b) break;
    if (d > a) out.push(d);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    guard++;
  }
  return out;
}

// Saldo efectivo hoy = saldo registrado − cobros que pasaron desde la fecha de
// registro (ancla) hasta hoy. Se calcula en vivo: nunca descuenta dos veces.
export function effectiveBalance(config, today) {
  const stored = Number(config.balance) || 0;
  const anchor = parseISO(config.balanceDate);
  if (!anchor) return { value: stored, deducted: 0, count: 0, anchor: null };
  const past = chargesInRange(anchor, today, Number(config.chargeDay) || 1);
  const deducted = past.reduce((s, d) => s + priceForDate(d, config).amount, 0);
  return {
    value: Math.max(0, stored - deducted),
    deducted,
    count: past.length,
    anchor,
  };
}

/* ------------------------------ cálculo central ---------------------------- */

// Calcula todo el plan a partir de la config y la fecha de hoy.
export function computePlan(config, today = new Date()) {
  const t0 = startOfDay(today);
  const eff = effectiveBalance(config, t0);
  const balance = eff.value; // saldo ya con los cobros pasados descontados
  const buffer = Number(config.buffer) || 0;
  const copRate = Number(config.copRate) || 0;

  const dates = generateChargeDates(t0, Number(config.chargeDay) || 1, HORIZON);

  // Recorre los cobros restando del saldo. El primero que no alcanza "falla".
  let running = balance;
  let failed = false;
  const charges = dates.map((date, index) => {
    const { amount, unconfirmed } = priceForDate(date, config);
    const balanceBefore = running;
    const paid = !failed && amount <= balanceBefore;
    if (!paid) failed = true;
    const balanceAfter = paid ? balanceBefore - amount : balanceBefore;
    if (paid) running = balanceAfter;
    return { index, date, amount, unconfirmed, balanceBefore, balanceAfter, paid };
  });

  const firstFailIdx = charges.findIndex((c) => !c.paid);
  const failingCharge = firstFailIdx >= 0 ? charges[firstFailIdx] : null;

  // Cubierto hasta = último cobro que el saldo alcanza a pagar.
  let coveredUntil = null;
  if (firstFailIdx === -1) coveredUntil = charges[charges.length - 1];
  else if (firstFailIdx > 0) coveredUntil = charges[firstFailIdx - 1];

  // Recargar antes de = fecha del cobro que falla menos buffer días.
  let rechargeBefore = null;
  let daysUntilRecharge = null;
  if (failingCharge) {
    rechargeBefore = addDays(failingCharge.date, -buffer);
    daysUntilRecharge = daysBetween(t0, rechargeBefore);
  }

  // Tabla: hasta el cobro que falla, o ~9 si ninguno falla.
  const visibleCount =
    firstFailIdx >= 0 ? firstFailIdx + 1 : Math.min(9, charges.length);
  const visibleCharges = charges.slice(0, visibleCount);

  // Meta: target por defecto = primer cobro que el saldo NO alcanza a cubrir
  // (así el plan muestra un monto útil); si todo está cubierto, próximo enero.
  const targetDate =
    parseISO(config.target) ||
    (failingCharge ? failingCharge.date : defaultTargetDate(dates));
  const amountForTarget = computeAmountForTarget(charges, targetDate, balance);

  // Urgencia por días hasta recargar.
  let urgency = "ok"; // ok | soon | urgent
  if (daysUntilRecharge != null) {
    if (daysUntilRecharge <= 4) urgency = "urgent";
    else if (daysUntilRecharge <= 18) urgency = "soon";
    else urgency = "ok";
  }

  // % del saldo respecto al monto necesario para la meta.
  const neededForTarget = amountForTarget + balance; // total que cuesta la meta
  const coveragePct =
    neededForTarget > 0
      ? Math.max(0, Math.min(100, (balance / neededForTarget) * 100))
      : 100;

  return {
    today: t0,
    balance,
    storedBalance: Number(config.balance) || 0,
    autoDeducted: eff.deducted,
    autoCount: eff.count,
    anchor: eff.anchor,
    charges,
    visibleCharges,
    failingCharge,
    coveredUntil,
    rechargeBefore,
    daysUntilRecharge,
    urgency,
    targetDate,
    amountForTarget,
    neededForTarget,
    coveragePct,
    copRate,
    chargeDates: dates,
  };
}

// Suma el precio de todos los cobros desde el próximo hasta target (inclusive)
// y le resta el balance. Mínimo 0.
export function computeAmountForTarget(charges, targetDate, balance) {
  if (!targetDate) return 0;
  const t = startOfDay(targetDate);
  const total = charges
    .filter((c) => startOfDay(c.date) <= t)
    .reduce((s, c) => s + c.amount, 0);
  return Math.max(0, total - balance);
}

// Próximo cobro de enero dentro de las fechas generadas (o la última si no hay).
export function defaultTargetDate(dates) {
  const jan = dates.find((d) => d.getMonth() === 0);
  return jan || dates[dates.length - 1] || null;
}

/* -------------------------------- formato ---------------------------------- */

export function formatNaira(n) {
  return "₦" + Math.round(Number(n) || 0).toLocaleString("es-CO");
}

export function formatCOP(ngn, rate) {
  return "$" + Math.round((Number(ngn) || 0) * (Number(rate) || 0)).toLocaleString("es-CO");
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function formatLongDate(d) {
  if (!d) return "—";
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export function formatMonthYear(d) {
  if (!d) return "—";
  const mes = MESES[d.getMonth()];
  return `${mes.charAt(0).toUpperCase() + mes.slice(1)} ${d.getFullYear()}`;
}

export function formatShortDate(d) {
  if (!d) return "—";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}
