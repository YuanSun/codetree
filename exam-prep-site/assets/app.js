/* Index page: month chart, subject filter chips, live search. NOTES is injected by build.py. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthKey = (d) => d.slice(0, 7);
  const monthLabel = (k) => MONTHS[+k.slice(5, 7) - 1] + " " + k.slice(0, 4);
  let subject = "All";

  $("count").textContent = NOTES.length;
  $("files").textContent = NOTES.reduce((s, n) => s + n.files, 0);

  const perMonth = {};
  NOTES.forEach((n) => { const k = monthKey(n.date); perMonth[k] = (perMonth[k] || 0) + 1; });
  const keys = Object.keys(perMonth).sort();
  const max = Math.max(...keys.map((k) => perMonth[k]));
  $("chart").innerHTML = keys.map((k) =>
    `<div class="bar"><b>${perMonth[k]}</b><i style="height:${Math.round(perMonth[k] / max * 80)}%"></i><span>${MONTHS[+k.slice(5, 7) - 1]}</span></div>`).join("");

  const subjects = ["All"].concat([...new Set(NOTES.flatMap((n) => n.subjects))].sort());
  $("chips").innerHTML = subjects.map((s) =>
    `<button class="chip${s === "All" ? " on" : ""}" data-s="${s}">${s}${s === "All" ? "" : " (" + NOTES.filter((n) => n.subjects.includes(s)).length + ")"}</button>`).join("");
  $("chips").onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    subject = b.dataset.s;
    document.querySelectorAll("#chips button").forEach((x) => x.classList.toggle("on", x === b));
    render();
  };
  $("q").oninput = render;

  function snippet(n, q) {
    if (!q) return n.text.slice(0, 140);
    const i = n.text.toLowerCase().indexOf(q);
    if (i < 0) return "";
    const s = n.text.slice(Math.max(0, i - 50), i + q.length + 90);
    return esc(s).replace(new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (m) => "<mark>" + m + "</mark>");
  }

  function render() {
    const q = $("q").value.trim().toLowerCase();
    const rows = NOTES.filter((n) =>
      (subject === "All" || n.subjects.includes(subject)) &&
      (!q || (n.title + " " + n.text).toLowerCase().includes(q))).sort((a, b) => b.date.localeCompare(a.date));
    let last = "", out = "";
    rows.forEach((n) => {
      const k = monthKey(n.date);
      if (k !== last) { out += `<div class="month">${monthLabel(k)}</div>`; last = k; }
      const chips = n.subjects.map((s) => `<span class="chip s-${s.toLowerCase()}">${s}</span>`).join(" ");
      const sn = snippet(n, q);
      out += `<a class="card" href="n/${n.slug}.html"><h3>${esc(n.title)}</h3><div class="meta">${n.date} · ${n.kind} · ${n.files} file${n.files === 1 ? "" : "s"} ${chips}</div>${sn ? `<div class="snip">${q ? sn : esc(sn)}</div>` : ""}</a>`;
    });
    $("list").innerHTML = out || '<p class="empty">No notes match.</p>';
  }
  render();
})();
