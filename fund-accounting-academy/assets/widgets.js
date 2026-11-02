/* Interactive lesson widgets: <div data-widget="name"></div>. Each one is a small form with a live chart and
   clickable examples. Calculations come from calc.js (window.FAA) so they match the calculators page. */
(function () {
  "use strict";
  const C = window.FAA;
  const W = {};
  let uid = 0;
  const fm = (x, d = 0) => Number(x).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  const FMT = { m: (v) => "$" + fm(v / 1e6, 1) + "m", usd: (v) => "$" + fm(v), pct: (v) => fm(v, 1) + "%", num: (v) => fm(v), d: (v) => v + " days", x: (v) => fm(v, 1) + "x", yr: (v) => fm(v, 1) + " yrs" };
  const row = (id, label, min, max, step, val, fmt) =>
    `<div class="wrow"><label for="${id}">${label}</label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-fmt="${fmt}"><output for="${id}"></output></div>`;
  const pills = (items, cls = "") => `<div class="pills ${cls}">${items.map(([k, t], i) => `<button type="button" data-k="${k}"${i === 0 ? ' class="on"' : ""}>${t}</button>`).join("")}</div>`;

  /* Re-renders on any input; keeps each slider's <output> in sync. Returns a function to force a refresh. */
  function wire(root, update) {
    const sync = () => {
      root.querySelectorAll('input[type="range"]').forEach((i) => { i.nextElementSibling.textContent = FMT[i.dataset.fmt](+i.value); });
      update();
    };
    root.addEventListener("input", sync);
    sync();
    return sync;
  }
  const g = (root, id) => +root.querySelector("#" + id).value;
  const set = (root, id, v) => { root.querySelector("#" + id).value = v; };
  const head = (title, sub) => `<h3>${title}</h3><p class="sub">${sub}</p>`;

  /* ---------- 1. NAV builder (module 03) ---------- */
  W["nav-builder"] = (root) => {
    const p = "nb" + ++uid + "-";
    root.innerHTML = head("Build a NAV", "Move the sliders and watch assets, liabilities and NAV stay in balance. Then try the examples to see how common errors distort NAV per share.") +
      pills([["base", "Base case"], ["fee", "Missed fee accrual"], ["px", "Stale price (+5%)"], ["red", "Large redemption payable"]]) +
      '<p class="sub" id="' + p + 'msg"></p>' +
      row(p + "inv", "Investments (fair value)", 0, 120e6, 1e6, 82e6, "m") + row(p + "cash", "Cash", 0, 30e6, 0.5e6, 6e6, "m") +
      row(p + "rec", "Receivables (dividends, sales)", 0, 15e6, 0.5e6, 2e6, "m") + row(p + "pay", "Payable for purchases", 0, 15e6, 0.5e6, 3e6, "m") +
      row(p + "acc", "Accrued fees and expenses", 0, 6e6, 0.1e6, 1.2e6, "m") + row(p + "red", "Redemptions payable", 0, 20e6, 0.5e6, 0, "m") +
      row(p + "sh", "Shares outstanding (millions)", 1, 20, 0.5, 8, "num") +
      '<div class="navbars"><div><div class="stackcol" id="' + p + 'A"></div><div class="colcap">Assets</div></div><div><div class="stackcol" id="' + p + 'L"></div><div class="colcap">Liabilities + NAV</div></div></div>' +
      '<p class="bigno" id="' + p + 'out"></p>';
    const base = { inv: 82e6, cash: 6e6, rec: 2e6, pay: 3e6, acc: 1.2e6, red: 0, sh: 8 };
    const ex = {
      base: [base, "Assets = liabilities + NAV. Everything is booked, so NAV per share is the fair baseline."],
      fee: [{ ...base, acc: 0 }, "The management fee was never accrued. Liabilities are too low, so NAV and NAV per share are overstated; investors who redeem now are overpaid."],
      px: [{ ...base, inv: 82e6 * 1.05 }, "A stale or wrong price makes investments 5% too high. Assets (and NAV) jump by about $4.1m with no real gain. Always sanity-check big movers."],
      red: [{ ...base, red: 10e6 }, "A redemption has been struck but not yet paid. It's a liability from the dealing day, so NAV falls even though the cash is still in the fund."]
    };
    const upd = () => {
      const v = (k) => g(root, p + k);
      const assets = [["a1", "Investments", v("inv")], ["a2", "Cash", v("cash")], ["a3", "Receivables", v("rec")]];
      const liabs = [["l1", "Payables", v("pay")], ["l2", "Accrued fees", v("acc")], ["l1", "Redemptions", v("red")]];
      const totA = assets.reduce((s, a) => s + a[2], 0), liabTot = liabs.reduce((s, a) => s + a[2], 0), nav = totA - liabTot;
      const scale = Math.max(totA, liabTot + Math.max(nav, 0), 1);
      const seg = (cls, label, val) => `<div class="${cls}" style="flex:0 0 ${(Math.max(val, 0) / scale) * 100}%">${val / scale > 0.07 ? label : ""}</div>`;
      root.querySelector("#" + p + "A").innerHTML = assets.map((a) => seg(a[0], a[1], a[2])).join("");
      root.querySelector("#" + p + "L").innerHTML = liabs.map((a) => seg(a[0], a[1], a[2])).join("") + seg("nv", "NAV", nav);
      const nps = nav / (v("sh") * 1e6);
      root.querySelector("#" + p + "out").innerHTML = `NAV ${FMT.usd(nav)} <small>· NAV per share $${fm(nps, 4)}</small>`;
    };
    const sync = wire(root, upd);
    root.querySelector(".pills").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      root.querySelectorAll(".pills button").forEach((x) => x.classList.toggle("on", x === b));
      const [s, msg] = ex[b.dataset.k];
      Object.entries(s).forEach(([k, val]) => set(root, p + k, val));
      root.querySelector("#" + p + "msg").textContent = msg;
      sync();
    });
    root.querySelector("#" + p + "msg").textContent = ex.base[1];
  };

  /* ---------- 2. Trade lifecycle stepper (module 02) ---------- */
  W["trade-lifecycle"] = (root) => {
    const S = [
      { t: "Start", c: "The fund starts with cash only.", s: [1000000, 0, 0, 0], je: "No entry yet" },
      { t: "Trade date: buy", c: "Buy 1,000 shares at $50 plus $25 commission. You are exposed from today, so book it today. Cash has not moved: a payable covers the gap, and NAV is unchanged.", s: [1000000, 50025, 0, 50025], je: "Dr Investments at cost 50,025   Cr Payable for investments purchased 50,025" },
      { t: "Price rises to $54", c: "The position is marked to fair value ($54,000). The $3,975 gain is unrealized and lifts NAV.", s: [1000000, 54000, 0, 50025], je: "Dr Investments (unrealized appreciation) 3,975   Cr Net change in unrealized gain 3,975" },
      { t: "Settlement", c: "Cash leaves the fund and the payable clears. Nothing changes in NAV: settlement is a cash event, not a P&L event.", s: [949975, 54000, 0, 0], je: "Dr Payable for investments purchased 50,025   Cr Cash 50,025" },
      { t: "Trade date: sell", c: "Sell at $54 less $25 commission. The $3,975 of unrealized gain is reversed and $3,950 of realized gain recorded (proceeds 53,975 less cost 50,025). NAV falls only by the $25 commission.", s: [949975, 0, 53975, 0], je: "Dr Receivable for investments sold 53,975   Dr Net change in unrealized 3,975\nCr Investments at cost 50,025   Cr Investments unrealized 3,975   Cr Realized gain 3,950" },
      { t: "Sale settles", c: "The receivable becomes cash. Total P&L over the life of the trade is $3,950: the same whether you look at it as unrealized then realized.", s: [1003950, 0, 0, 0], je: "Dr Cash 53,975   Cr Receivable for investments sold 53,975" }
    ];
    root.innerHTML = head("Follow one trade from trade date to settlement", "Step through a purchase and a sale. Highlighted cells show what each step changed.") +
      '<div class="stepper-nav"><button class="btn ghost" data-d="-1">← Back</button><div class="dots"></div><button class="btn" data-d="1">Next →</button></div>' +
      '<p><b class="st"></b> <span class="sc"></span></p><div class="bs"><table class="bt"></table><table class="bn"></table></div><div class="je-line"></div>';
    let i = 0;
    const dots = root.querySelector(".dots");
    dots.innerHTML = S.map(() => "<i></i>").join("");
    const draw = () => {
      const st = S[i], prev = (S[i - 1] || S[0]).s, nav = (a) => a[0] + a[1] + a[2] - a[3];
      const names = ["Cash", "Investments", "Receivable for sales", "Payable for purchases"];
      root.querySelector(".bt").innerHTML = "<tr><th>Account</th><th class='num'>Balance</th></tr>" +
        st.s.map((v, k) => `<tr><td>${names[k]}${k === 3 ? " (liability)" : ""}</td><td class="num ${i && v !== prev[k] ? "changed" : ""}">${fm(v)}</td></tr>`).join("");
      root.querySelector(".bn").innerHTML = `<tr><th>Result</th><th class='num'>Amount</th></tr><tr><td>NAV</td><td class="num ${i && nav(st.s) !== nav(prev) ? "changed" : ""}">${fm(nav(st.s))}</td></tr><tr><td>P&amp;L since start</td><td class="num">${fm(nav(st.s) - 1000000)}</td></tr>`;
      root.querySelector(".st").textContent = `${i + 1}. ${st.t}.`;
      root.querySelector(".sc").textContent = st.c;
      root.querySelector(".je-line").textContent = st.je;
      dots.querySelectorAll("i").forEach((d, k) => d.classList.toggle("on", k <= i));
      root.querySelector('[data-d="-1"]').disabled = i === 0;
      root.querySelector('[data-d="1"]').disabled = i === S.length - 1;
    };
    root.addEventListener("click", (e) => { const b = e.target.closest("[data-d]"); if (b) { i = Math.max(0, Math.min(S.length - 1, i + +b.dataset.d)); draw(); } });
    draw();
  };

  /* ---------- 3. Bond accrual (module 04) ---------- */
  W["accrual-slider"] = (root) => {
    const p = "ac" + ++uid + "-";
    root.innerHTML = head("Watch accrued interest build up", "A semi-annual bond with its last coupon on 15 Jan 2025. Slide the settlement date and switch the day-count convention to see how the accrued amount and dirty price change.") +
      '<div class="fields"><label>Par<input id="' + p + 'par" type="number" value="1000000"></label><label>Coupon %<input id="' + p + 'rate" type="number" step="0.25" value="5"></label>' +
      '<label>Clean price (per 100)<input id="' + p + 'px" type="number" step="0.05" value="99.5"></label>' +
      '<label>Day count<select id="' + p + 'conv"><option>30/360</option><option>ACT/360</option><option>ACT/365</option><option>ACT/ACT</option></select></label></div>' +
      row(p + "day", "Calendar days since last coupon", 0, 181, 1, 55, "d") +
      '<div class="chartbox" id="' + p + 'ch"></div><div class="out" id="' + p + 'out"></div>';
    const last = "2025-01-15", next = "2025-07-15", n = 181;
    const addDays = (d, k) => new Date(Date.parse(d + "T00:00:00Z") + k * 864e5).toISOString().slice(0, 10);
    const upd = () => {
      const par = g(root, p + "par"), rate = g(root, p + "rate") / 100, conv = root.querySelector("#" + p + "conv").value, px = g(root, p + "px"), day = g(root, p + "day");
      const at = (k) => C.accruedInterest({ par, rate, convention: conv, lastCoupon: last, settle: addDays(last, k), nextCoupon: next, freq: 2 }).accrued;
      const pts = Array.from({ length: n + 1 }, (_, k) => at(k));
      const top = Math.max(...pts, 1), Wd = 640, H = 190, pad = 34;
      const X = (k) => pad + (k / n) * (Wd - pad - 12), Y = (v) => H - 26 - (v / top) * (H - 46);
      const path = pts.map((v, k) => `${k ? "L" : "M"}${X(k).toFixed(1)},${Y(v).toFixed(1)}`).join("");
      const cur = pts[day];
      root.querySelector("#" + p + "ch").innerHTML = `<svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Accrued interest over the coupon period">
        <line x1="${pad}" y1="${H - 26}" x2="${Wd - 12}" y2="${H - 26}" stroke="var(--line)"/><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>
        <line x1="${X(day)}" y1="${Y(cur)}" x2="${X(day)}" y2="${H - 26}" stroke="var(--senior)" stroke-dasharray="4 3"/><circle cx="${X(day)}" cy="${Y(cur)}" r="6" fill="var(--senior)"/>
        <text x="${pad}" y="${H - 8}">15 Jan</text><text x="${Wd - 50}" y="${H - 8}">15 Jul (coupon)</text><text x="${pad}" y="14">$${fm(top)}</text></svg>`;
      const dirty = px + (cur / par) * 100;
      root.querySelector("#" + p + "out").innerHTML = `<div><span>Settlement date</span><span>${addDays(last, day)}</span></div><div><span>Accrued interest</span><span>$${fm(cur, 2)}</span></div>
        <div><span>Clean price</span><span>${fm(px, 3)}</span></div><div><span>Dirty price (clean + accrued)</span><span>${fm(dirty, 4)}</span></div><div><span>Cash you pay for the bond</span><span>$${fm((dirty / 100) * par)}</span></div>`;
    };
    wire(root, upd);
    root.addEventListener("change", upd);
  };

  /* ---------- 4. Fair-value hierarchy donut (module 05) ---------- */
  W["fv-donut"] = (root) => {
    const p = "fv" + ++uid + "-";
    root.innerHTML = head("How much of this fund is Level 3?", "Enter holdings by level, or pick an example fund. Level 3 assets rely on unobservable inputs, so they get the most pricing scrutiny and disclosure.") +
      pills([["eq", "Listed equity fund"], ["cr", "Credit fund"], ["vc", "Venture fund"]]) +
      row(p + "l1", "Level 1 (quoted prices)", 0, 100e6, 1e6, 95e6, "m") + row(p + "l2", "Level 2 (observable inputs)", 0, 100e6, 1e6, 5e6, "m") + row(p + "l3", "Level 3 (unobservable inputs)", 0, 100e6, 1e6, 0, "m") +
      '<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap"><div class="chartbox" id="' + p + 'ch" style="width:200px"></div><div class="out" id="' + p + 'out" style="flex:1;min-width:230px"></div></div>';
    const ex = { eq: [95e6, 5e6, 0], cr: [5e6, 70e6, 25e6], vc: [0, 5e6, 95e6] };
    const upd = () => {
      const v = [g(root, p + "l1"), g(root, p + "l2"), g(root, p + "l3")], tot = v.reduce((s, x) => s + x, 0) || 1;
      const R = 70, Cc = 2 * Math.PI * R, cols = ["var(--core)", "var(--geneva)", "var(--senior)"];
      let off = 0;
      const arcs = v.map((x, k) => { const len = (x / tot) * Cc, s = `<circle r="${R}" cx="100" cy="100" fill="none" stroke="${cols[k]}" stroke-width="32" stroke-dasharray="${len} ${Cc - len}" stroke-dashoffset="${-off}" transform="rotate(-90 100 100)"/>`; off += len; return s; }).join("");
      root.querySelector("#" + p + "ch").innerHTML = `<svg viewBox="0 0 200 200" role="img" aria-label="Fair value levels">${arcs}<text x="100" y="98" text-anchor="middle" style="font-size:20px;font-weight:700;fill:var(--text)">${FMT.m(tot)}</text><text x="100" y="116" text-anchor="middle">total</text></svg>`;
      const pc = v.map((x) => (x / tot) * 100), flag = pc[2] > 20 ? "High Level 3 share: expect valuation committee review, extra support and audit focus." : pc[2] > 0 ? "Some Level 3: keep a Level 3 rollforward and the unobservable-input disclosures." : "No Level 3: no rollforward needed.";
      root.querySelector("#" + p + "out").innerHTML = ["Level 1", "Level 2", "Level 3"].map((n, k) => `<div><span><b style="color:${cols[k]}">■</b> ${n}</span><span>${fm(pc[k], 1)}%</span></div>`).join("") + `<div style="display:block;font-weight:400;font-size:14px">${flag}</div>`;
    };
    const sync = wire(root, upd);
    root.querySelector(".pills").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      root.querySelectorAll(".pills button").forEach((x) => x.classList.toggle("on", x === b));
      ex[b.dataset.k].forEach((val, k) => set(root, p + "l" + (k + 1), val)); sync();
    });
  };

  /* ---------- 5. Capital account rollforward + NAV tie-out (module 06) ---------- */
  W["capital-account"] = (root) => {
    const p = "ca" + ++uid + "-";
    root.innerHTML = head("Roll forward a capital account, then tie it to NAV", "Edit any line. The chart shows how the balance moves; the check at the bottom is the control every administrator runs.") +
      '<div class="fields">' + [["open", "Opening capital", 1000000], ["sub", "+ Subscriptions", 200000], ["red", "− Redemptions", 100000], ["pnl", "+ Allocated trading P&L", 60000], ["mf", "− Management fee", 2000], ["pf", "− Performance fee", 9600], ["ex", "− Allocated expenses", 1400]]
        .map(([k, l, v]) => `<label>${l}<input id="${p}${k}" type="number" value="${v}"></label>`).join("") + "</div>" +
      '<div class="chartbox" id="' + p + 'ch"></div><div class="fields"><label>Fund NAV per the portfolio books<input id="' + p + 'nav" type="number" value="1147000"></label></div><div class="out" id="' + p + 'out"></div>';
    const upd = () => {
      const v = (k) => +root.querySelector("#" + p + k).value || 0;
      const steps = [["Open", v("open"), "t"], ["Subs", v("sub"), "d"], ["Reds", -v("red"), "d"], ["P&L", v("pnl"), "d"], ["Mgmt fee", -v("mf"), "d"], ["Perf fee", -v("pf"), "d"], ["Expenses", -v("ex"), "d"]];
      const close = steps.reduce((s, x) => s + x[1], 0);
      let run = 0; const bars = [];
      steps.forEach(([n, a, t]) => { const from = t === "t" ? 0 : run, to = t === "t" ? a : run + a; bars.push([n, from, to, a >= 0 || t === "t"]); run = to; });
      bars.push(["Closing", 0, close, true]);
      const lo = 0, hi = Math.max(...bars.flatMap((b) => [b[1], b[2]]), 1) * 1.08, Wd = 640, H = 220, bw = Wd / bars.length;
      const Y = (x) => H - 34 - ((x - lo) / (hi - lo)) * (H - 54);
      root.querySelector("#" + p + "ch").innerHTML = `<svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Capital account rollforward">` + bars.map(([n, a, b, up], k) => {
        const y1 = Y(Math.max(a, b)), h = Math.max(Math.abs(Y(a) - Y(b)), 1.5), x = k * bw + 10;
        const col = n === "Open" || n === "Closing" ? "var(--accent)" : up ? "var(--ok)" : "var(--bad)";
        return `<rect x="${x}" y="${y1}" width="${bw - 20}" height="${h}" rx="4" fill="${col}"/><text x="${x + (bw - 20) / 2}" y="${H - 16}" text-anchor="middle">${n}</text><text x="${x + (bw - 20) / 2}" y="${y1 - 5}" text-anchor="middle">${fm(Math.abs(b - a) >= 0 && (n === "Open" || n === "Closing") ? b : b - a)}</text>`;
      }).join("") + "</svg>";
      const diff = close - v("nav"), ok = Math.abs(diff) < 0.5;
      root.querySelector("#" + p + "out").innerHTML = `<div><span>Closing capital</span><span>${fm(close)}</span></div><div><span>Fund NAV</span><span>${fm(v("nav"))}</span></div><div><span>Difference</span><span class="${ok ? "ok-text" : "bad-text"}">${ok ? "Ties ✓" : fm(diff) + "  ✗ investigate"}</span></div>`;
    };
    root.addEventListener("input", upd); upd();
  };

  /* ---------- 6. Performance fee + HWM chart (module 07) ---------- */
  W["hwm-chart"] = (root) => {
    const p = "hw" + ++uid + "-";
    const presets = { chop: [5, -4, 6, -3, 4, 3], steady: [2, 2, 2, 2, 2, 2], dd: [6, -8, -5, 4, 6, 7] };
    root.innerHTML = head("High-water mark in action", "Set the return for each of six periods. The investor only pays a performance fee when NAV exceeds the previous peak (the high-water mark), so recovering from a loss is free of fees.") +
      pills([["chop", "Choppy"], ["steady", "Steady +2%"], ["dd", "Drawdown then recovery"]]) +
      presets.chop.map((r, i) => row(p + "r" + i, "Period " + (i + 1) + " return", -12, 15, 0.5, r, "pct")).join("") +
      row(p + "rate", "Performance fee rate", 0, 30, 1, 20, "pct") + '<div class="chartbox" id="' + p + 'ch"></div><div class="out" id="' + p + 'out"></div>';
    const upd = () => {
      const rate = g(root, p + "rate") / 100;
      let nav = 100, hwm = 100, noHwm = 0, fees = 0; const navs = [100], hwms = [100], fs = [0];
      for (let i = 0; i < 6; i++) {
        const r = g(root, p + "r" + i) / 100, pre = nav * (1 + r);
        const res = C.performanceFee({ openingNav: nav, closingPreFee: pre, hwm, rate });
        noHwm += rate * Math.max(0, pre - nav);
        fees += res.fee; nav = res.closing; hwm = res.newHwm; navs.push(nav); hwms.push(hwm); fs.push(res.fee);
      }
      const all = navs.concat(hwms), lo = Math.min(...all) - 3, hi = Math.max(...all) + 3, Wd = 640, H = 230, pad = 36;
      const X = (i) => pad + (i / 6) * (Wd - pad - 14), Y = (v) => 190 - ((v - lo) / (hi - lo)) * 160;
      const step = hwms.map((v, i) => `${i ? "L" : "M"}${X(i)},${Y(v)}`).join("");
      const line = navs.map((v, i) => `${i ? "L" : "M"}${X(i)},${Y(v)}`).join("");
      root.querySelector("#" + p + "ch").innerHTML = `<svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="NAV versus high-water mark">
        <path d="${step}" fill="none" stroke="var(--senior)" stroke-width="2" stroke-dasharray="6 4"/><path d="${line}" fill="none" stroke="var(--accent)" stroke-width="3"/>
        ${navs.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="4.5" fill="var(--accent)"/>${fs[i] > 0 ? `<rect x="${X(i) - 9}" y="${Y(v) + 8}" width="18" height="${Math.min(fs[i] * 10, 26)}" rx="3" fill="var(--bad)"/><text x="${X(i)}" y="${Y(v) + 24 + Math.min(fs[i] * 10, 26)}" text-anchor="middle">fee ${fm(fs[i], 2)}</text>` : ""}<text x="${X(i)}" y="${H - 6}" text-anchor="middle">${i ? "P" + i : "Start"}</text>`).join("")}
        <text x="${pad}" y="14" style="fill:var(--accent)">— NAV after fees</text><text x="${pad + 130}" y="14" style="fill:var(--senior)">- - High-water mark</text></svg>`;
      root.querySelector("#" + p + "out").innerHTML = `<div><span>Ending NAV (started at 100)</span><span>${fm(nav, 2)}</span></div><div><span>Performance fees paid with a high-water mark</span><span>${fm(fees, 2)}</span></div>
        <div><span>Fees if charged on every up period (no HWM)</span><span>${fm(noHwm, 2)}</span></div><div><span>Fees the HWM saved the investor</span><span>${fm(noHwm - fees, 2)}</span></div>`;
    };
    const sync = wire(root, upd);
    root.querySelector(".pills").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      root.querySelectorAll(".pills button").forEach((x) => x.classList.toggle("on", x === b));
      presets[b.dataset.k].forEach((r, i) => set(root, p + "r" + i, r)); sync();
    });
  };

  /* ---------- 7. PE waterfall chart (module 07) ---------- */
  W["waterfall-chart"] = (root) => {
    const p = "wf" + ++uid + "-";
    root.innerHTML = head("Where does each dollar of proceeds go?", "A 100 investment held for 3 years with an 8% preferred return and 20% carry. Slide the total proceeds up and watch the tiers fill in, and how the GP's share of profit climbs to 20% after the catch-up.") +
      row(p + "d", "Total proceeds", 0, 400, 5, 200, "num") + row(p + "pref", "Preferred return", 0, 12, 0.5, 8, "pct") + row(p + "carry", "Carry", 0, 30, 1, 20, "pct") +
      '<div class="fields"><label>GP catch-up<select id="' + p + 'cu"><option value="1">100% catch-up</option><option value="0.5">50% catch-up</option><option value="0">No catch-up</option></select></label></div>' +
      '<div class="chartbox" id="' + p + 'ch"></div><div class="out" id="' + p + 'out"></div>';
    const upd = () => {
      const o = { contributed: 100, distributed: g(root, p + "d"), prefRate: g(root, p + "pref") / 100, years: 3, carry: g(root, p + "carry") / 100, catchup: +root.querySelector("#" + p + "cu").value };
      const w = C.waterfall(o), cu = o.catchup;
      const segs = [["Return of capital", w.roc, "var(--core)"], ["Preferred return", w.pref, "var(--geneva)"], ["Catch-up to GP", w.catchupTotal * cu, "var(--senior)"], ["Catch-up to LP", w.catchupTotal * (1 - cu), "#7aa9e8"], ["Split: LP", w.split * (1 - o.carry), "#4b8be0"], ["Split: GP", w.split * o.carry, "#e07b39"]];
      const Wd = 640, scale = 400; let x = 12;
      const bar = segs.map(([n, v, c]) => { const wpx = (v / scale) * (Wd - 24); const r = `<rect x="${x}" y="30" width="${Math.max(wpx, 0)}" height="34" fill="${c}"/>`; x += wpx; return r; }).join("");
      // GP share of profit versus proceeds
      const pts = []; for (let d = 100; d <= 400; d += 5) { const r = C.waterfall({ ...o, distributed: d }); pts.push([d, d > 100 ? r.gp / (d - 100) : 0]); }
      const top = Math.max(o.carry * 1.15, 0.05), X = (d) => 36 + ((d - 100) / 300) * (Wd - 50), Y = (s) => 190 - (s / top) * 90;
      const path = pts.map(([d, s], i) => `${i ? "L" : "M"}${X(d)},${Y(s)}`).join("");
      const cur = o.distributed > 100 ? w.gp / (o.distributed - 100) : 0;
      root.querySelector("#" + p + "ch").innerHTML = `<svg viewBox="0 0 ${Wd} 232" role="img" aria-label="Waterfall tiers and GP share of profit">
        <rect x="12" y="30" width="${Wd - 24}" height="34" fill="var(--line)" opacity=".5"/>${bar}<text x="12" y="20">Proceeds split by tier (full width = 400)</text>
        <text x="12" y="86">GP share of total profit as proceeds grow</text><line x1="36" y1="190" x2="${Wd - 14}" y2="190" stroke="var(--line)"/>
        <line x1="36" y1="${Y(o.carry)}" x2="${Wd - 14}" y2="${Y(o.carry)}" stroke="var(--senior)" stroke-dasharray="4 4" opacity=".6"/><text x="${Wd - 70}" y="${Y(o.carry) - 5}">carry ${fm(o.carry * 100)}%</text>
        <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>${o.distributed > 100 ? `<circle cx="${X(o.distributed)}" cy="${Y(cur)}" r="6" fill="var(--senior)"/>` : ""}
        <text x="36" y="208">100</text><text x="${Wd - 40}" y="208">400</text></svg>`;
      root.querySelector("#" + p + "out").innerHTML = segs.map(([n, v, c]) => `<div><span><b style="color:${c}">■</b> ${n}</span><span>${fm(v, 2)}</span></div>`).join("") +
        `<div><span>GP total / LP total</span><span>${fm(w.gp, 2)} / ${fm(w.lp, 2)}</span></div>`;
    };
    wire(root, upd);
    root.addEventListener("change", upd);
  };

  /* ---------- 8. Geneva knowledge-date time machine (module 10) ---------- */
  W["knowledge-date"] = (root) => {
    const T = [
      ["Buy 10,000 XYZ at $45", "2025-03-12", "2025-03-12", 10000, -450000],
      ["Sell 2,000 XYZ at $49 (booked late)", "2025-03-29", "2025-04-03", -2000, 98000],
      ["Management fee true-up (booked late)", "2025-03-31", "2025-04-04", 0, -5000]
    ];
    const KD = [["2025-04-01", "1 Apr: when we released the NAV"], ["2025-04-03", "3 Apr: after the late sale was entered"], ["2025-04-05", "5 Apr: today (latest knowledge)"]];
    root.innerHTML = head("Geneva's two clocks", "The same report for the same period end (31 Mar) gives different answers depending on the knowledge date, because two transactions were entered after month end. Pick a knowledge date.") +
      pills(KD.map(([d, t]) => [d, t]).slice(0, 3)) + '<div class="tablewrap"><table class="kdtable"><thead><tr><th>Transaction</th><th>Effective date</th><th>Knowledge date (entered)</th><th>Included?</th></tr></thead><tbody></tbody></table></div><div class="out"></div>';
    const draw = (kd) => {
      let sh = 0, cash = 1000000; const base = 50;
      root.querySelector("tbody").innerHTML = T.map(([n, eff, ent, dq, dc]) => {
        const inc = ent <= kd; if (inc) { sh += dq; cash += dc; }
        return `<tr><td>${n}</td><td>${eff}</td><td>${ent}</td><td class="${inc ? "in" : "out"}">${inc ? "Yes" : "Not known yet"}</td></tr>`;
      }).join("");
      const nav = sh * base + cash, released = 10000 * base + (1000000 - 450000);
      root.querySelector(".out").innerHTML = `<div><span>Shares of XYZ at 31 Mar</span><span>${fm(sh)}</span></div><div><span>Cash at 31 Mar</span><span>$${fm(cash)}</span></div>
        <div><span>NAV at 31 Mar (price $50)</span><span>$${fm(nav)}</span></div><div><span>Difference vs the NAV released on 1 Apr</span><span class="${nav === released ? "ok-text" : "bad-text"}">${nav === released ? "none" : "$" + fm(nav - released)}</span></div>`;
    };
    root.querySelector(".pills").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      root.querySelectorAll(".pills button").forEach((x) => x.classList.toggle("on", x === b));
      draw(b.dataset.k);
    });
    root.querySelectorAll(".pills button").forEach((b, i) => { b.textContent = KD[i][1]; });
    draw(KD[0][0]);
  };

  document.querySelectorAll("[data-widget]").forEach((n) => {
    const f = W[n.dataset.widget];
    n.classList.add("widget");
    if (f && C) { try { f(n); } catch (e) { n.textContent = "Widget failed to load: " + e.message; } }
  });
})();
