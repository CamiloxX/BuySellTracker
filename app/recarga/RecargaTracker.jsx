"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DEFAULT_CONFIG,
  computePlan,
  computeAmountForTarget,
  formatNaira,
  formatCOP,
  formatLongDate,
  formatMonthYear,
  formatShortDate,
  toISO,
  parseISO,
} from "../../lib/calc.js";
import "./recarga.css";

const STORAGE_KEY = "recarga_config";

function loadConfig() {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export default function RecargaTracker() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [mounted, setMounted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [alertState, setAlertState] = useState({ saving: false, msg: "" });

  // Cargar config persistida solo en el cliente (evita mismatch de hidratación).
  useEffect(() => {
    const c = loadConfig();
    // Si no hay fecha de registro del saldo, anclar a hoy para empezar a
    // descontar los cobros que pasen a partir de ahora.
    if (!c.balanceDate) c.balanceDate = toISO(new Date());
    setConfig(c);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config, mounted]);

  const plan = useMemo(() => computePlan(config, new Date()), [config]);

  const set = (key) => (e) => {
    const v = e.target.value;
    setConfig((c) => ({ ...c, [key]: v === "" ? "" : v }));
  };

  // Editar el saldo = "este es mi saldo de HOY": re-ancla la fecha a hoy,
  // así no se le restan cobros anteriores.
  const setBalance = (e) => {
    const v = e.target.value;
    setConfig((c) => ({ ...c, balance: v === "" ? "" : v, balanceDate: toISO(new Date()) }));
  };

  const reset = () =>
    setConfig({ ...DEFAULT_CONFIG, balanceDate: toISO(new Date()) });

  const recargarYa = () => {
    const add = Number(plan.amountForTarget) || 0;
    // Nuevo saldo real = saldo efectivo de hoy + lo recargado, anclado a hoy.
    setConfig((c) => ({
      ...c,
      balance: plan.balance + add,
      balanceDate: toISO(new Date()),
    }));
  };

  const setTarget = (e) =>
    setConfig((c) => ({ ...c, target: e.target.value }));

  // Guarda la config en el servidor para que el cron diario revise el saldo
  // y avise por los canales configurados aunque la página esté cerrada.
  const guardarAlertas = async () => {
    setAlertState({ saving: true, msg: "" });
    try {
      const res = await fetch("/api/recarga/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config,
          email: config.email || "",
          alertDays: Number(config.buffer) || 7,
        }),
      });
      const j = await res.json();
      setAlertState({
        saving: false,
        msg: j.ok
          ? "Listo. Revisaremos tu saldo a diario y te avisaremos."
          : `Error: ${j.error || "no se pudo guardar"}`,
      });
    } catch (e) {
      setAlertState({ saving: false, msg: `Error: ${e.message}` });
    }
  };

  // Texto y datos del hero según urgencia.
  const heroBig = !plan.failingCharge
    ? "Vas sobrado"
    : plan.daysUntilRecharge <= 0
      ? "Recarga ya"
      : `Recarga antes del ${formatLongDate(plan.rechargeBefore)}`;

  const heroTag =
    plan.urgency === "ok"
      ? "Todo en orden"
      : plan.urgency === "soon"
        ? "Recarga pronto"
        : "Atención";

  const today = new Date();
  const todayChip = today.toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  // Evita render con datos sin hidratar.
  if (!mounted) return <div className="rt-root" />;

  return (
    <div className="rt-root">
      <div className="rt-wrap">
        <Link href="/" className="rt-back">← Volver al tracker de stock</Link>

        {/* Header */}
        <header className="rt-header rt-anim" style={{ animationDelay: "0ms" }}>
          <div className="rt-logo">
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
              <path fill="#FF0000" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8z" />
              <path fill="#fff" d="M9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
            </svg>
          </div>
          <div>
            <h1 className="rt-htitle">Recarga Tracker</h1>
            <p className="rt-hsub">YouTube Premium · Plan familiar (Nigeria)</p>
          </div>
          <span className="rt-chip rt-tnum">{todayChip}</span>
        </header>

        {/* Hero de estado */}
        <section
          className={`rt-hero ${plan.urgency} rt-anim`}
          style={{ animationDelay: "70ms" }}
        >
          <div className="rt-hero-tag">
            <span className="rt-dot" /> {heroTag}
          </div>
          <h2 className="rt-hero-big">{heroBig}</h2>
          <p className="rt-hero-sub">
            {plan.coveredUntil ? (
              <>
                Tu saldo alcanza hasta el cobro del{" "}
                <strong>{formatLongDate(plan.coveredUntil.date)}</strong>.
              </>
            ) : (
              <>El saldo no cubre ni el próximo cobro.</>
            )}
            {plan.daysUntilRecharge != null && (
              <>
                {" "}
                {plan.daysUntilRecharge > 0 ? (
                  <>
                    Quedan <strong className="rt-tnum">{plan.daysUntilRecharge}</strong>{" "}
                    días para recargar.
                  </>
                ) : (
                  <>Ya estás en zona de recarga.</>
                )}
              </>
            )}
          </p>

          <div className="rt-bar">
            <div
              className="rt-bar-fill"
              style={{ width: `${plan.coveragePct.toFixed(0)}%` }}
            />
          </div>
          <div className="rt-bar-cap rt-tnum">
            <span>{formatNaira(plan.balance)} de saldo</span>
            <span>meta {formatNaira(plan.neededForTarget)}</span>
          </div>
          {plan.autoCount > 0 && (
            <p className="rt-hero-sub" style={{ marginTop: 10, fontSize: 11.5 }}>
              Descuento automático: se restaron{" "}
              <strong className="rt-tnum">{plan.autoCount}</strong>{" "}
              {plan.autoCount === 1 ? "cobro" : "cobros"} (
              <strong className="rt-tnum">−{formatNaira(plan.autoDeducted)}</strong>) desde el{" "}
              {formatLongDate(plan.anchor)} que registraste el saldo.
            </p>
          )}
        </section>

        {/* Plan de recarga */}
        <section className="rt-card rt-anim" style={{ animationDelay: "140ms" }}>
          <div className="rt-label">Plan de recarga</div>
          <div className="rt-plan-row" style={{ marginTop: 12 }}>
            <span>Cubierto hasta el cobro de</span>
            <select
              className="rt-select"
              value={plan.targetDate ? toISO(plan.targetDate) : ""}
              onChange={setTarget}
            >
              {plan.chargeDates.map((d) => (
                <option key={toISO(d)} value={toISO(d)}>
                  {formatMonthYear(d)}
                </option>
              ))}
            </select>
          </div>

          <div className="rt-amount rt-tnum">{formatNaira(plan.amountForTarget)}</div>
          <div className="rt-amount-cop rt-tnum">
            ≈ {formatCOP(plan.amountForTarget, plan.copRate)} COP
          </div>

          <button className="rt-btn" onClick={recargarYa}>
            Ya recargué · sumar al saldo
          </button>

          <p className="rt-note">
            {plan.amountForTarget > 0 ? (
              <>
                Al recargar quedarías con{" "}
                <strong className="rt-tnum" style={{ color: "var(--rt-text)" }}>
                  {formatNaira(plan.neededForTarget)}
                </strong>{" "}
                y cubrirías hasta el cobro de {formatMonthYear(plan.targetDate)}.
              </>
            ) : (
              <>Ya tienes saldo suficiente para llegar a esa meta.</>
            )}
          </p>
        </section>

        {/* Calendario de cobros */}
        <section className="rt-card rt-anim" style={{ animationDelay: "210ms" }}>
          <div className="rt-label">Calendario de cobros</div>
          <table className="rt-table" style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cobro</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody className="rt-tnum">
              {plan.visibleCharges.map((c, i) => {
                const isNext = i === 0;
                const isFail = !c.paid;
                return (
                  <tr
                    key={toISO(c.date)}
                    className={isFail ? "rt-row-fail" : isNext ? "rt-row-next" : ""}
                  >
                    <td>
                      {formatShortDate(c.date)}
                      {isNext && <span className="rt-tag-mini rt-tag-next">próximo</span>}
                      {isFail && <span className="rt-tag-mini rt-tag-fail">sin saldo</span>}
                      {c.unconfirmed && !isFail && (
                        <span className="rt-tag-mini rt-tag-q">precio s/c</span>
                      )}
                    </td>
                    <td>{formatNaira(c.amount)}</td>
                    <td>{c.paid ? formatNaira(c.balanceAfter) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="rt-note">
            "Precio s/c" = sin confirmar (tras el {formatLongDate(parseISO(config.discountEnd))} de{" "}
            {parseISO(config.discountEnd)?.getFullYear()} no se conoce el precio normal).
          </p>
        </section>

        {/* Alertas */}
        <section className="rt-card rt-anim" style={{ animationDelay: "280ms" }}>
          <div className="rt-label">Alertas</div>
          <p className="rt-note" style={{ marginTop: 8 }}>
            Te avisamos cuando entres en zona de recarga (~{config.buffer} días antes
            del cobro que te deja sin saldo) por los canales configurados:
            Telegram, email, WhatsApp.
          </p>
          <div className="rt-field full" style={{ marginTop: 12 }}>
            <label>Tu email (para aviso por correo)</label>
            <input
              className="rt-input"
              type="email"
              value={config.email || ""}
              onChange={set("email")}
              placeholder="tucorreo@gmail.com"
            />
          </div>
          <button className="rt-btn" onClick={guardarAlertas} disabled={alertState.saving}>
            {alertState.saving ? "Guardando…" : "Guardar para alertas"}
          </button>
          {alertState.msg && (
            <p className="rt-note" style={{ marginTop: 10 }}>{alertState.msg}</p>
          )}
        </section>

        {/* Ajustes (acordeón) */}
        <section className="rt-card rt-anim" style={{ animationDelay: "350ms" }}>
          <div
            className="rt-acc-head"
            onClick={() => setShowSettings((s) => !s)}
          >
            <span>Ajustes</span>
            <span className={`rt-acc-arrow ${showSettings ? "open" : ""}`}>▶</span>
          </div>

          {showSettings && (
            <>
              <div className="rt-grid">
                <Field label="Saldo actual (₦)" value={plan.balance} onChange={setBalance} type="number" />
                <Field label="Cobro mensual (₦)" value={config.charge} onChange={set("charge")} type="number" />
                <Field label="Día del cobro" value={config.chargeDay} onChange={set("chargeDay")} type="number" />
                <Field label="Aviso (días antes)" value={config.buffer} onChange={set("buffer")} type="number" />
                <Field label="Fin del descuento" value={config.discountEnd} onChange={set("discountEnd")} type="date" />
                <Field label="Precio tras descuento (₦)" value={config.priceAfter} onChange={set("priceAfter")} type="number" placeholder="desconocido" />
                <Field label="COP por ₦1" value={config.copRate} onChange={set("copRate")} type="number" step="0.01" />
              </div>
              <p className="rt-note">
                El saldo baja solo en cada cobro (día {config.chargeDay}). Al editarlo aquí,
                se toma como tu saldo de hoy y el conteo arranca de nuevo desde esta fecha.
              </p>
              <hr className="rt-dash" />
              <button className="rt-btn ghost" onClick={reset}>
                Restablecer valores por defecto
              </button>
            </>
          )}
        </section>

        <footer className="rt-footer">
          Los datos se guardan solo en este dispositivo (localStorage).<br />
          Tasa de referencia: ₦1 ≈ {Number(config.copRate).toLocaleString("es-CO")} COP.
        </footer>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", step, placeholder }) {
  return (
    <div className={`rt-field ${type === "date" ? "full" : ""}`}>
      <label>{label}</label>
      <input
        className="rt-input rt-tnum"
        type={type}
        step={step}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        inputMode={type === "number" ? "decimal" : undefined}
      />
    </div>
  );
}
