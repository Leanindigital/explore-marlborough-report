const $ = s => document.querySelector(s);
const nzd = (v, dp = 0) => v == null ? "–" : "$" + v.toLocaleString("en-NZ", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const int = v => Math.round(v).toLocaleString("en-NZ");
const pct = v => v == null ? "–" : (v * 100).toFixed(1) + "%";
const share = v => v == null ? "N/A" : (v * 100).toFixed(1) + "%";
const BENCH = 0.20;
const shareCls = v => v == null ? "" : v < BENCH ? "pos" : "neg";
const fmtDate = d => new Date(d + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
const addDays = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

function sum(rows) {
  const t = { impr: 0, clicks: 0, cost: 0, bookings: 0, value: 0 };
  rows.forEach(r => { for (const k in t) t[k] += r[k]; });
  t.ctr = t.impr ? t.clicks / t.impr : null;
  t.cpb = t.bookings ? t.cost / t.bookings : null;
  t.share = t.value > 0 ? t.cost / t.value : null; // ad spend as share of booking value
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
  ];
  $("#updated").textContent = "Data last updated: " + new Date(data.generated).toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" });
  const wrap = $("#presets");
  presets.forEach(([id, label]) => {
    const b = document.createElement("button"); b.textContent = label; b.dataset.id = id;
    b.onclick = () => { location.hash = "range=" + id; render(id); }; wrap.appendChild(b);
  });
  function render(id) {
    const p = presets.find(p => p[0] === id) || presets[2];
    const from = p[2] < data.start ? data.start : p[2], to = p[3];
    wrap.querySelectorAll("button").forEach(b => b.classList.toggle("is-active", b.dataset.id === p[0]));
    const rows = data.rows.filter(r => r.date >= from && r.date <= to);
    const t = sum(rows);
    const days = Math.round((new Date(to) - new Date(from)) / 864e5) + 1;
    $("#results-sub").textContent = `${fmtDate(from)} to ${fmtDate(to)} (${days} days, to yesterday). All figures NZD.`;
    const ok = t.share != null && t.share < BENCH;
    $("#headline").innerHTML = `<div class="gauge ${t.share == null ? "" : ok ? "gauge--ok" : "gauge--over"}">
      <div><div class="kpi__label">Ad spend as % of booking value</div><div class="gauge__value">${share(t.share)}</div>
      <div class="gauge__sub">${nzd(t.cost, 2)} spend ÷ ${nzd(t.value)} attributed booking value</div></div>
      <div class="gauge__bench"><div class="gauge__benchlabel">Katt's benchmark</div><div class="gauge__benchvalue">Under 20%</div>
      <div class="gauge__status">${t.share == null ? "No booking value in this period" : ok ? "✓ Within benchmark" : "Above benchmark"}</div></div></div>`;
    $("#kpis").innerHTML = [
      ["Attributed bookings", int(t.bookings), "GA4 purchases credited to Google Ads"],
      ["Attributed booking value", nzd(t.value), "Value of those bookings"],
      ["Total Google Ads spend", nzd(t.cost, 2), "All campaigns"],
      ["Cost per booking", nzd(t.cpb, 2), "Spend ÷ bookings"],
      ["Average booking value", nzd(t.aov), "Booking value ÷ bookings"],
    ].map(([l, v, s]) => `<div class="kpi"><div class="kpi__label">${l}</div><div class="kpi__value">${v}</div><div class="kpi__sub">${s}</div></div>`).join("");
    $("#stats").innerHTML = [
      ["Impressions", int(t.impr)], ["Clicks", int(t.clicks)], ["Click-through rate", pct(t.ctr)],
      ["Cost per click", nzd(t.cpc, 2)], ["Clicks to booking", pct(t.cvr)],
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

    // Campaign > ad group
    const line = (n, s, cls = "") => `<td class="${cls}">${n}</td><td class="num">${nzd(s.cost, 2)}</td><td class="num">${int(s.clicks)}</td><td class="num">${int(s.bookings)}</td><td class="num">${nzd(s.value)}</td><td class="num">${nzd(s.aov)}</td><td class="num">${nzd(s.cpb, 2)}</td><td class="num ${shareCls(s.share)}">${share(s.share)}</td>`;
    const camps = {};
    rows.forEach(r => { const c = camps[r.campaign] = camps[r.campaign] || {}; (c[r.ad_group] = c[r.ad_group] || []).push(r); });
    const label = n => n.replace(/^Explore Marlborough – /, "").replace(/ \/\/ LIDM #\d+$/, "");
    $("#ag-table tbody").innerHTML = Object.entries(camps).map(([cn, ags]) => {
      const all = Object.values(ags).flat();
      return `<tr class="row-camp">${line(label(cn), sum(all))}</tr>` + Object.entries(ags).map(([n, rs]) => [n, sum(rs)])
        .sort((a, b) => b[1].cost - a[1].cost).map(([n, s]) => `<tr>${line(n, s, "indent")}</tr>`).join("");
    }).join("") || `<tr><td colspan="8">No spend in this period.</td></tr>`;
    $("#ag-table tfoot").innerHTML = `<tr>${line("Total", t)}</tr>`;
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
  render(m ? m[1] : "last30");
});
