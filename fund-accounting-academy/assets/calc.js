/* Pure calculation helpers used by tools.html and covered by tests/calc.test.js.
   No DOM access here, so it loads in the browser (window.FAA) and in Node (module.exports). */
(function (root) {
  "use strict";

  const round = (x, dp = 2) => {
    const f = Math.pow(10, dp);
    return Math.round((x + Number.EPSILON) * f) / f;
  };

  /* ---------- NAV ---------- */
  function nav({ assets, liabilities, shares }) {
    const net = assets - liabilities;
    return { nav: net, navPerShare: shares ? net / shares : null };
  }

  /* ---------- Day counts & accrued interest ---------- */
  const toUTC = (d) => (d instanceof Date ? d : new Date(d + "T00:00:00Z"));
  const actDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);

  function days30_360(a, b) {
    const s = toUTC(a), e = toUTC(b);
    let d1 = s.getUTCDate(), d2 = e.getUTCDate();
    if (d1 === 31) d1 = 30;
    if (d2 === 31 && d1 === 30) d2 = 30;
    return (e.getUTCFullYear() - s.getUTCFullYear()) * 360 +
           (e.getUTCMonth() - s.getUTCMonth()) * 30 + (d2 - d1);
  }

  /* Accrued interest from last coupon date to settlement date.
     convention: "30/360" | "ACT/360" | "ACT/365" | "ACT/ACT" (ICMA, needs nextCoupon) */
  function accruedInterest({ par, rate, convention, lastCoupon, settle, nextCoupon, freq = 2 }) {
    let fraction;
    switch (convention) {
      case "30/360": fraction = days30_360(lastCoupon, settle) / 360; break;
      case "ACT/360": fraction = actDays(lastCoupon, settle) / 360; break;
      case "ACT/365": fraction = actDays(lastCoupon, settle) / 365; break;
      case "ACT/ACT":
        if (!nextCoupon) throw new Error("ACT/ACT needs nextCoupon");
        fraction = (actDays(lastCoupon, settle) / actDays(lastCoupon, nextCoupon)) / freq;
        break;
      default: throw new Error("unknown convention " + convention);
    }
    const days = convention === "30/360" ? days30_360(lastCoupon, settle) : actDays(lastCoupon, settle);
    return { accrued: par * rate * fraction, days, fraction };
  }

  /* ---------- Fees ---------- */
  /* Management fee for a period: NAV x annual rate x days / basis. */
  function managementFee({ nav, annualRate, days, basis = 365 }) {
    return nav * annualRate * days / basis;
  }

  /* Performance fee for ONE investor/series without flows in the period.
     closingPreFee : NAV after mgmt fee but before performance fee
     openingNav    : NAV at start of period
     hwm           : high-water mark (NAV level the fund must exceed before a fee is due)
     rate          : e.g. 0.20
     hurdle        : periodic hurdle return, e.g. 0.02 (0 = none)
     hardHurdle    : true = fee only on excess over hurdle; false (soft) = fee on all profit once hurdle cleared */
  function performanceFee({ openingNav, closingPreFee, hwm, rate, hurdle = 0, hardHurdle = false }) {
    const base = Math.max(hwm, openingNav);
    const hurdleLevel = openingNav * (1 + hurdle);
    const threshold = Math.max(base, hurdleLevel);
    let chargeable = 0;
    if (closingPreFee > threshold) {
      chargeable = hardHurdle && hurdle > 0 ? closingPreFee - threshold : closingPreFee - base;
    }
    const fee = chargeable * rate;
    const closing = closingPreFee - fee;
    return { fee, closing, newHwm: Math.max(hwm, closing), chargeable };
  }

  /* ---------- Private-equity style distribution waterfall ---------- */
  /* Single-lump-sum European (whole-fund) waterfall.
     contributed, distributed : LP paid-in capital and total proceeds to split
     prefRate, years           : compounding preferred return
     carry                     : GP share of profit, e.g. 0.20
     catchup                   : share of the catch-up tier that goes to GP (1 = 100%, 0 = no catch-up) */
  function waterfall({ contributed, distributed, prefRate, years, carry, catchup = 1 }) {
    let left = distributed;
    const take = (x) => { const t = Math.min(left, Math.max(x, 0)); left -= t; return t; };

    const roc = take(contributed);
    const prefTarget = contributed * (Math.pow(1 + prefRate, years) - 1);
    const pref = take(prefTarget);

    let catchupTotal = 0, gpCatch = 0;
    if (catchup > carry) {
      const catchTarget = carry * pref / (catchup - carry);
      catchupTotal = take(catchTarget);
      gpCatch = catchupTotal * catchup;
    }
    const split = left;
    const gpSplit = split * carry;
    const gp = gpCatch + gpSplit;
    const lp = roc + pref + (catchupTotal - gpCatch) + (split - gpSplit);
    return { roc, pref, catchupTotal, split, gp, lp, check: round(gp + lp - distributed, 6) };
  }

  /* ---------- Returns metrics ---------- */
  const moic = (totalValue, paidIn) => totalValue / paidIn;
  const dpi = (distributions, paidIn) => distributions / paidIn;
  const tvpi = (distributions, nav, paidIn) => (distributions + nav) / paidIn;

  /* XIRR: flows = [{date:'YYYY-MM-DD', amount}], contributions negative. */
  function xirr(flows, guess = 0.1) {
    const t0 = toUTC(flows[0].date);
    const yrs = flows.map((f) => (toUTC(f.date) - t0) / 86400000 / 365);
    const f = (r) => flows.reduce((s, c, i) => s + c.amount / Math.pow(1 + r, yrs[i]), 0);
    let lo = -0.99, hi = 10;
    if (f(lo) * f(hi) > 0) return null;
    let r = guess;
    for (let i = 0; i < 200; i++) {
      r = (lo + hi) / 2;
      const v = f(r);
      if (Math.abs(v) < 1e-9) break;
      if (f(lo) * v < 0) hi = r; else lo = r;
    }
    return r;
  }

  /* ---------- Investor P&L allocation ---------- */
  /* Pro-rata by capital weight (the simplest method; real funds often weight by days held). */
  function allocate(pnl, accounts) {
    const total = accounts.reduce((s, a) => s + a.capital, 0);
    return accounts.map((a) => ({ name: a.name, share: a.capital / total, pnl: pnl * a.capital / total }));
  }

  /* ---------- Journal entry checker ---------- */
  /* Entries are arrays of {account, dr, cr}. Order-insensitive; amounts compared to the cent. */
  function entryBalances(lines) {
    const dr = lines.reduce((s, l) => s + (l.dr || 0), 0);
    const cr = lines.reduce((s, l) => s + (l.cr || 0), 0);
    return Math.abs(dr - cr) < 0.005;
  }
  function sameEntry(expected, given) {
    const norm = (ls) => ls.filter((l) => (l.dr || 0) || (l.cr || 0))
      .map((l) => `${l.account}|${round(l.dr || 0)}|${round(l.cr || 0)}`).sort().join(";");
    return norm(expected) === norm(given);
  }

  const api = { round, nav, actDays, days30_360, accruedInterest, managementFee, performanceFee,
                waterfall, moic, dpi, tvpi, xirr, allocate, entryBalances, sameEntry };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FAA = api;
})(typeof window !== "undefined" ? window : globalThis);
