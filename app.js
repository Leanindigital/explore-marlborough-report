const $ = s => document.querySelector(s);
const nzd = (v, dp = 0) => v == null ? "–" : "$" + v.toLocaleString("en-NZ", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const int = v => Math.round(v).toLocaleString("en-NZ");
const pct = v => v == null ? "–" : (v * 100).toFixed(1) + "%";
const x = v => v == null ? "–" : v.toFixed(1) + "x";
const fmtDate = d => new Date(d + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
const addDays = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

function sum(rows) {
  const t = { impr: 0, clicks: 0, cost: 0, bookings: 0, value: 0 };
  rows.forEach(r => { for (const k in t) t[k] += r[k]; });
  t.ctr = t.impr ? t.clicks / t.impr : null;
  t.cpb = t.bookings ? t.cost / t.bookings : null;
  t.roas = t.cost ? t.value / t.cost : null;
  t.cpc = t.clicks ? t.cost / t.clicks : null;
  t.cvr = t.clicks ? t.bookings / t.clicks : null;
  t.aov = t.bookings ? t.value / t.bookings : null;
  return t;
}

fetch("data/google-daily.json", { cache: "no-store" }).then(r => r.json()).then(data => {
  const end = data.end;
  const presets = [
    ["last7", "Last 7 days", addDays(end, -6), end],
    ["last14", "Last 14 days", addDays(end, -13), end],
    ["last30", "Last 30 days", addDays(end, -29), end],
    ["all", "Since launch", data.start, end],
  ];
  $("#updated").textContent = "Data last updated: " + new Date(data.generated).toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" });
  const wrap = $("#presets");
  presets.forEach(([id, label]) => {
    const b = document.createElement("button"); b.textContent = label; b.dataset.id = id;
    b.onclick = () => { location.hash = "range=" + id; render(id); }; wrap.appendChild(b);
  });
  function render(id) {
    const p = presets.find(p => p[0] === id) || presets[3];
    const from = p[2] < data.start ? data.start : p[2], to = p[3];
    wrap.querySelectorAll("button").forEach(b => b.classList.toggle("is-active", b.dataset.id === p[0]));
    const rows = data.rows.filter(r => r.date >= from && r.date <= to);
    const t = sum(rows);
    $("#results-sub").textContent = `${fmtDate(from)} to ${fmtDate(to)}. Campaign: Search – Biking Tours.`;
    $("#kpis").innerHTML = [
      ["Bookings", int(t.bookings), "GA4 purchases from FareHarbor"],
      ["Booking value", nzd(t.value), "As reported by GA4"],
      ["Return on ad spend", x(t.roas), "Booking value ÷ spend"],
      ["Cost per booking", nzd(t.cpb, 2), "Spend ÷ bookings"],
    ].map(([l, v, s]) => `<div class="kpi"><div class="kpi__label">${l}</div><div class="kpi__value">${v}</div><div class="kpi__sub">${s}</div></div>`).join("");
    $("#stats").innerHTML = [
      ["Ad spend", nzd(t.cost, 2)], ["Impressions", int(t.impr)], ["Clicks", int(t.clicks)],
      ["Click-through rate", pct(t.ctr)], ["Cost per click", nzd(t.cpc, 2)], ["Conversion rate", pct(t.cvr)], ["Average booking value", nzd(t.aov)],
    ].map(([l, v]) => `<div class="stat"><div class="stat__label">${l}</div><div class="stat__value">${v}</div></div>`).join("");

    // Weekly (Monday start)
    const weeks = {};
    rows.forEach(r => { const d = new Date(r.date + "T00:00:00Z"); const m = addDays(r.date, -((d.getUTCDay() + 6) % 7)); (weeks[m] = weeks[m] || []).push(r); });
    const wk = Object.keys(weeks).sort().map(k => [k, sum(weeks[k])]);
    const max = Math.max(1, ...wk.map(([, s]) => Math.max(s.cost, s.value)));
    $("#weeks").innerHTML = wk.map(([k, s]) => `<div class="week"><div>w/c ${new Date(k + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}</div>
      <div class="bars"><div class="bar bar--spend" style="width:${s.cost / max * 100}%"></div><div class="bar bar--value" style="width:${s.value / max * 100}%"></div></div>
      <div class="week__nums">${nzd(s.cost)} → ${nzd(s.value)} · ${int(s.bookings)} bkg</div></div>`).join("") +
      `<div class="legend"><span><i style="background:#9ca3af"></i>Spend</span><span><i style="background:var(--blue)"></i>Booking value</span></div>`;

    // Ad groups
    const ag = {};
    rows.forEach(r => (ag[r.ad_group] = ag[r.ad_group] || []).push(r));
    const line = (n, s) => `<td>${n}</td><td class="num">${nzd(s.cost, 2)}</td><td class="num">${int(s.clicks)}</td><td class="num">${pct(s.ctr)}</td><td class="num">${int(s.bookings)}</td><td class="num">${pct(s.cvr)}</td><td class="num">${nzd(s.value)}</td><td class="num">${nzd(s.aov)}</td><td class="num">${nzd(s.cpb, 2)}</td><td class="num">${x(s.roas)}</td>`;
    $("#ag-table tbody").innerHTML = Object.entries(ag).map(([n, rs]) => [n, sum(rs)]).sort((a, b) => b[1].cost - a[1].cost).map(([n, s]) => `<tr>${line(n, s)}</tr>`).join("");
    let tf = $("#ag-table tfoot"); if (!tf) { tf = document.createElement("tfoot"); $("#ag-table").appendChild(tf); }
    tf.innerHTML = `<tr>${line("Total", t)}</tr>`;
  }
  // Monthly ROI (whole data set, independent of date filter)
  const FEE = 750, months = {};
  data.rows.forEach(r => (months[r.date.slice(0, 7)] = months[r.date.slice(0, 7)] || []).push(r));
  const roiRow = (label, s, fee) => {
    const inv = s.cost + fee, net = s.value - inv, roi = inv ? net / inv : null;
    return `<td>${label}</td><td class="num">${nzd(s.cost, 2)}</td><td class="num">${nzd(fee, fee % 1 ? 2 : 0)}</td><td class="num">${nzd(inv, 2)}</td><td class="num">${int(s.bookings)}</td><td class="num">${nzd(s.value)}</td><td class="num ${net >= 0 ? "pos" : "neg"}">${net < 0 ? "−" : ""}${nzd(Math.abs(net))}</td><td class="num ${net >= 0 ? "pos" : "neg"}">${roi == null ? "–" : Math.round(roi * 100) + "%"}</td>`;
  };
  const mk = Object.keys(months).sort(), curMonth = end.slice(0, 7);
  const feeFor = k => { // pro-rate the launch month by days live
    if (k !== data.start.slice(0, 7)) return FEE;
    const [y, mo] = k.split("-").map(Number), dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    return Math.round(FEE * (dim - Number(data.start.slice(8)) + 1) / dim * 100) / 100;
  };
  $("#roi-table tbody").innerHTML = mk.map(k => {
    const label = new Date(k + "-01T00:00:00").toLocaleDateString("en-NZ", { month: "long", year: "numeric" }) + (k === curMonth ? " (to date)" : k === data.start.slice(0, 7) && data.start.slice(8) !== "01" ? " (from " + fmtDate(data.start).replace(/ \d{4}$/, "") + ")" : "");
    return `<tr>${roiRow(label, sum(months[k]), feeFor(k))}</tr>`;
  }).join("");
  $("#roi-table tfoot").innerHTML = `<tr>${roiRow("Total", sum(data.rows), mk.reduce((a, k) => a + feeFor(k), 0))}</tr>`;

  const m = location.hash.match(/range=(\w+)/);
  render(m ? m[1] : "all");
});
