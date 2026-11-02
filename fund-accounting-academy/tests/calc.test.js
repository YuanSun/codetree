// Run:  node --test tests/        (from fund-accounting-academy/)
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../assets/calc.js");

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test("nav and nav per share", () => {
  const r = C.nav({ assets: 1050, liabilities: 50, shares: 100 });
  assert.equal(r.nav, 1000);
  assert.equal(r.navPerShare, 10);
});

test("accrued interest 30/360 and ACT/365 agree on day counts", () => {
  const base = { par: 100000, rate: 0.05, lastCoupon: "2024-01-15", settle: "2024-03-10" };
  const a = C.accruedInterest({ ...base, convention: "30/360" });
  assert.equal(a.days, 55);
  close(a.accrued, 100000 * 0.05 * 55 / 360);
  const b = C.accruedInterest({ ...base, convention: "ACT/365" });
  assert.equal(b.days, 55); // leap-year Feb has 29 days
  close(b.accrued, 100000 * 0.05 * 55 / 365);
});

test("30/360 end-of-month rule", () => {
  assert.equal(C.days30_360("2024-01-31", "2024-03-31"), 60);
});

test("ACT/ACT uses the coupon period", () => {
  const r = C.accruedInterest({ par: 1000, rate: 0.06, convention: "ACT/ACT",
    lastCoupon: "2024-01-01", settle: "2024-04-01", nextCoupon: "2024-07-01", freq: 2 });
  close(r.accrued, 1000 * 0.06 / 2 * (91 / 182));
});

test("performance fee: plain, soft hurdle, hard hurdle, below HWM", () => {
  const p = { openingNav: 100, closingPreFee: 110, hwm: 100, rate: 0.2 };
  close(C.performanceFee(p).fee, 2);
  close(C.performanceFee(p).closing, 108);
  close(C.performanceFee({ ...p, hurdle: 0.05 }).fee, 2);
  close(C.performanceFee({ ...p, hurdle: 0.05, hardHurdle: true }).fee, 1);
  assert.equal(C.performanceFee({ ...p, hwm: 120 }).fee, 0);
  assert.equal(C.performanceFee({ ...p, hurdle: 0.15 }).fee, 0); // hurdle not cleared
  close(C.performanceFee({ ...p, hwm: 120, closingPreFee: 130 }).fee, 2);
  close(C.performanceFee(p).newHwm, 108);
});

test("management fee", () => {
  close(C.managementFee({ nav: 1_000_000, annualRate: 0.02, days: 31 }), 1698.63013698, 1e-6);
});

test("waterfall: GP ends with exactly carry x profit when fully caught up", () => {
  const w = C.waterfall({ contributed: 100, distributed: 200, prefRate: 0.08, years: 3, carry: 0.2 });
  close(w.gp, 20, 1e-9);
  close(w.lp, 180, 1e-9);
  assert.equal(w.check, 0);
});

test("waterfall: not enough to clear the pref means GP gets nothing", () => {
  const w = C.waterfall({ contributed: 100, distributed: 110, prefRate: 0.08, years: 3, carry: 0.2 });
  assert.equal(w.gp, 0);
  close(w.lp, 110);
});

test("waterfall: no catch-up splits only above the pref", () => {
  const w = C.waterfall({ contributed: 100, distributed: 200, prefRate: 0.08, years: 3, carry: 0.2, catchup: 0 });
  close(w.gp, (200 - 100 - 25.97120) * 0.2, 1e-4);
});

test("return metrics and xirr", () => {
  close(C.moic(150, 100), 1.5);
  close(C.dpi(50, 100), 0.5);
  close(C.tvpi(50, 100, 100), 1.5);
  const r = C.xirr([{ date: "2020-01-01", amount: -100 }, { date: "2022-01-01", amount: 121 }]);
  assert.ok(Math.abs(r - 0.1) < 0.002, r);
});

test("allocation sums to total", () => {
  const out = C.allocate(1000, [{ name: "A", capital: 600 }, { name: "B", capital: 400 }]);
  assert.equal(out[0].pnl, 600);
  assert.equal(out.reduce((s, x) => s + x.pnl, 0), 1000);
});

test("journal entry checks", () => {
  const exp = [{ account: "Investments", dr: 1000 }, { account: "Cash", cr: 1000 }];
  assert.ok(C.entryBalances(exp));
  assert.ok(C.sameEntry(exp, [{ account: "Cash", cr: 1000 }, { account: "Investments", dr: 1000 }]));
  assert.ok(!C.sameEntry(exp, [{ account: "Cash", dr: 1000 }, { account: "Investments", cr: 1000 }]));
});
