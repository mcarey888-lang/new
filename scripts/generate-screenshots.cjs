#!/usr/bin/env node
const { createCanvas } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

const W = 1320;
const H = 2868;

const T = {
  bg: "#060D1B", card: "#0F1D30", surface: "#142236",
  green: "#3ECF75", orange: "#FF9030", blue: "#4A9FF5",
  purple: "#9B7FD4", red: "#FF4444",
  text: "#F0F8FF", textMuted: "#7A9BB5", textDim: "#4A6580",
  border: "rgba(255,255,255,0.07)",
};

const OUT = path.join(__dirname, "../artifacts/summit-ready/assets/screenshots");
fs.mkdirSync(OUT, { recursive: true });

function rr(ctx, x, y, w, h, r, fill, stroke, sw = 2) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw; ctx.stroke(); }
}

function lbl(ctx, text, x, y, color, size, align = "left", weight = "normal") {
  ctx.textAlign = align; ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px sans-serif`;
  ctx.fillText(text, x, y); ctx.textAlign = "left";
}

function drawBg(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#060D1B"); g.addColorStop(0.5, "#0A1628"); g.addColorStop(1, "#060E1C");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function drawStatusBar(ctx) {
  ctx.fillStyle = T.text; ctx.font = "bold 42px sans-serif"; ctx.fillText("9:41", 70, 90);
  ctx.textAlign = "right"; ctx.fillStyle = T.textMuted; ctx.font = "36px sans-serif";
  ctx.fillText("LTE  WiFi  100%", W - 70, 90); ctx.textAlign = "left";
  rr(ctx, W / 2 - 80, 18, 160, 36, 18, "rgba(0,0,0,0.55)");
}

function drawHdr(ctx, line1, line2) {
  ctx.textAlign = "center";
  ctx.fillStyle = T.green; ctx.font = "bold 74px sans-serif"; ctx.fillText(line1, W / 2, 210);
  if (line2) { ctx.fillStyle = T.text; ctx.font = "50px sans-serif"; ctx.fillText(line2, W / 2, 290); }
  ctx.textAlign = "left";
}

function arcPct(ctx, cx, cy, r, pct, color, lw = 24) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = lw; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.stroke();
}

function tabBar(ctx) {
  const tb = H - 160;
  rr(ctx, 0, tb, W, 160, 0, "rgba(6,13,27,0.96)");
  ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, tb); ctx.lineTo(W, tb); ctx.stroke();
  ["Home", "Hills", "Plan", "Log", "Profile"].forEach((t, i) => {
    const x = W / 5 * i + W / 10; const a = i === 0;
    lbl(ctx, t, x, H - 44, a ? T.green : T.textDim, 30, "center", a ? "bold" : "normal");
  });
}

function save(canvas, name) {
  const buf = canvas.toBuffer("image/png");
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(`  ${name}  (${(buf.length / 1024).toFixed(0)} KB)`);
}

// ── 1. Dashboard ──────────────────────────────────────────────────────────────
function s1() {
  const canvas = createCanvas(W, H); const ctx = canvas.getContext("2d");
  drawBg(ctx); drawStatusBar(ctx);
  drawHdr(ctx, "Know When You're Ready", "Your summit readiness, updated daily.");

  const cy = 440;
  rr(ctx, 60, cy, W - 120, 560, 28, T.card, T.border);
  lbl(ctx, "Readiness Score", W / 2, cy + 80, T.textMuted, 38, "center");
  arcPct(ctx, W / 2, cy + 278, 158, 0.73, T.green, 28);
  lbl(ctx, "73", W / 2, cy + 312, T.green, 108, "center", "bold");
  lbl(ctx, "Close to Ready", W / 2, cy + 396, T.orange, 38, "center", "bold");
  lbl(ctx, "Ben Nevis  1,345 m  Aug 14, 2026", W / 2, cy + 456, T.textMuted, 32, "center");
  lbl(ctx, "6 weeks to go", W / 2, cy + 504, T.textDim, 30, "center");

  const sy = cy + 590;
  rr(ctx, 60, sy, W - 120, 210, 24, T.surface, T.border);
  [["24", "Sessions"], ["6,840 m", "Elevation"], ["8 days", "Streak"]].forEach(([v, l], i) => {
    const cx = 60 + ((W - 120) / 3) * i + (W - 120) / 6;
    lbl(ctx, v, cx, sy + 96, T.green, 54, "center", "bold");
    lbl(ctx, l, cx, sy + 150, T.textMuted, 30, "center");
  });

  const wy = sy + 250;
  lbl(ctx, "THIS WEEK", 60, wy - 18, T.textMuted, 28, "left", "bold");
  [
    { d: "Mon", t: "Hill Reps x4 — Latrigg", done: true },
    { d: "Wed", t: "Treadmill 50 min", done: true },
    { d: "Fri", t: "Long Hill — Cat Bells", done: false },
    { d: "Sun", t: "Big Day — Helvellyn", done: false },
  ].forEach(({ d, t, done }, i) => {
    const ry = wy + i * 152;
    rr(ctx, 60, ry, W - 120, 132, 20,
      done ? "rgba(62,207,117,0.06)" : T.card,
      done ? "rgba(62,207,117,0.22)" : T.border);
    lbl(ctx, done ? "+" : "o", 110, ry + 82, done ? T.green : T.textDim, 46, "left", "bold");
    lbl(ctx, t, 184, ry + 66, done ? T.text : T.textMuted, 38, "left", done ? "bold" : "normal");
    lbl(ctx, d, 184, ry + 112, T.textDim, 28);
    if (!done) {
      rr(ctx, W - 226, ry + 44, 144, 48, 12, "rgba(255,144,48,0.14)", "rgba(255,144,48,0.4)");
      lbl(ctx, "Upcoming", W - 218, ry + 74, T.orange, 28);
    }
  });

  tabBar(ctx);
  save(canvas, "01-dashboard.png");
}

// ── 2. Hill Finder ────────────────────────────────────────────────────────────
function s2() {
  const canvas = createCanvas(W, H); const ctx = canvas.getContext("2d");
  drawBg(ctx); drawStatusBar(ctx);
  drawHdr(ctx, "Find Training Hills", "Nearby climbs matched to your goal.");

  rr(ctx, 60, 430, W - 120, 96, 48, T.card, T.border);
  lbl(ctx, "Search hills near you...", 130, 492, T.textDim, 38);

  let fx = 60;
  ["All", "< 5 km", "> 200 m", "Saved"].forEach((f, i) => {
    const fw = f.length * 24 + 52;
    rr(ctx, fx, 554, fw, 68, 34, i === 0 ? "rgba(62,207,117,0.15)" : T.card, i === 0 ? "rgba(62,207,117,0.5)" : T.border);
    lbl(ctx, f, fx + 26, 598, i === 0 ? T.green : T.textMuted, 30);
    fx += fw + 20;
  });

  [
    { name: "Latrigg", dist: "2.3 km", elev: "200 m", reps: "5 reps", match: 94, mc: T.green },
    { name: "Skiddaw Little Man", dist: "4.1 km", elev: "380 m", reps: "3 reps", match: 87, mc: T.green },
    { name: "Cat Bells", dist: "6.7 km", elev: "451 m", reps: "2 reps", match: 79, mc: T.orange },
    { name: "Grisedale Pike", dist: "8.2 km", elev: "570 m", reps: "1 rep", match: 65, mc: T.blue },
    { name: "Fairfield", dist: "11 km", elev: "680 m", reps: "1 rep", match: 58, mc: T.blue },
  ].forEach(({ name, dist, elev, reps, match, mc }, i) => {
    const hy = 650 + i * 216;
    rr(ctx, 60, hy, W - 120, 194, 22, T.card, T.border);
    rr(ctx, W - 238, hy + 22, 156, 54, 10, mc + "22", mc + "55");
    lbl(ctx, `${match}% match`, W - 230, hy + 58, mc, 28, "left", "bold");
    lbl(ctx, name, 110, hy + 74, T.text, 44, "left", "bold");
    lbl(ctx, `${dist}  |  ${elev} gain  |  ${reps} needed`, 110, hy + 126, T.textMuted, 30);
    arcPct(ctx, W - 100, hy + 136, 32, match / 100, mc, 10);
  });

  tabBar(ctx);
  save(canvas, "02-hills.png");
}

// ── 3. Training Plan ──────────────────────────────────────────────────────────
function s3() {
  const canvas = createCanvas(W, H); const ctx = canvas.getContext("2d");
  drawBg(ctx); drawStatusBar(ctx);
  drawHdr(ctx, "Your Personal Plan", "Built for your mountain. Adapts as you train.");

  const pw = (W - 120 - 36) / 4;
  [["Base", T.green, false], ["Build", T.blue, true], ["Peak", T.orange, false], ["Taper", T.purple, false]].forEach(([n, c, a], i) => {
    const px = 60 + i * (pw + 12);
    rr(ctx, px, 430, pw, 110, 14, a ? c + "22" : T.card, a ? c : T.border, a ? 3 : 2);
    lbl(ctx, n, px + pw / 2, 492, a ? c : T.textMuted, 34, "center", "bold");
    lbl(ctx, ["Wk 1-4", "Wk 5-8", "Wk 9-11", "Wk 12"][i], px + pw / 2, 526, a ? c : T.textDim, 24, "center");
  });

  lbl(ctx, "WEEK 6 - BUILD PHASE", 60, 582, T.blue, 32, "left", "bold");

  [
    { d: "Mon", t: "Hill Reps x4", s: "Latrigg  200 m", c: T.green, done: true },
    { d: "Tue", t: "Rest Day", s: "Active recovery", c: T.textDim, done: true },
    { d: "Wed", t: "Treadmill 50 min", s: "10% incline  4.5 km/h", c: T.blue, done: true },
    { d: "Thu", t: "Stepper 35 min", s: "Glutes and calves", c: T.blue, done: false, today: true },
    { d: "Fri", t: "Long Hill", s: "Cat Bells  451 m", c: T.orange, done: false },
    { d: "Sat", t: "Rest Day", s: "Recovery walk optional", c: T.textDim, done: false },
    { d: "Sun", t: "Big Day", s: "Helvellyn  950 m target", c: T.orange, done: false },
  ].forEach(({ d, t, s, c, done, today }, i) => {
    const ry = 612 + i * 148;
    rr(ctx, 60, ry, W - 120, 128, 18,
      today ? c + "15" : done ? "rgba(62,207,117,0.05)" : T.card,
      today ? c : done ? "rgba(62,207,117,0.2)" : T.border, today ? 3 : 2);
    lbl(ctx, d, 110, ry + 50, today ? c : done ? T.green : T.textMuted, 28, "left", "bold");
    lbl(ctx, t, 210, ry + 56, done || today ? T.text : T.textMuted, 38, "left", done || today ? "bold" : "normal");
    lbl(ctx, s, 210, ry + 102, T.textDim, 28);
    if (today) {
      rr(ctx, W - 228, ry + 40, 146, 50, 10, c + "22", c + "44");
      lbl(ctx, "Today", W - 220, ry + 72, c, 30, "left", "bold");
    } else if (done) {
      lbl(ctx, "+", W - 100, ry + 74, T.green, 56, "center", "bold");
    }
  });

  tabBar(ctx);
  save(canvas, "03-plan.png");
}

// ── 4. Hike Tracking ─────────────────────────────────────────────────────────
function s4() {
  const canvas = createCanvas(W, H); const ctx = canvas.getContext("2d");
  drawBg(ctx); drawStatusBar(ctx);
  drawHdr(ctx, "Track Every Ascent", "Live elevation, distance and time on the mountain.");

  const my = 430; const mh = 660;
  ctx.fillStyle = "#080F1E"; ctx.fillRect(0, my, W, mh);
  ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, my); ctx.lineTo(x, my + mh); ctx.stroke(); }
  for (let y = my; y < my + mh; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  const pts = [[120,my+600],[260,my+520],[400,my+450],[540,my+370],[660,my+290],[780,my+230],[900,my+190],[1020,my+162],[1140,my+140],[1240,my+128]];

  const grd = ctx.createLinearGradient(0, my + 128, 0, my + mh);
  grd.addColorStop(0, "rgba(62,207,117,0.28)"); grd.addColorStop(1, "rgba(62,207,117,0)");
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.lineTo(pts[pts.length-1][0], my+mh); ctx.lineTo(pts[0][0], my+mh); ctx.closePath();
  ctx.fillStyle = grd; ctx.fill();

  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.strokeStyle = T.green; ctx.lineWidth = 9; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();

  const [lx, ly] = pts[pts.length - 1];
  ctx.beginPath(); ctx.arc(lx, ly, 20, 0, Math.PI * 2); ctx.fillStyle = T.green; ctx.fill();
  ctx.beginPath(); ctx.arc(lx, ly, 10, 0, Math.PI * 2); ctx.fillStyle = "#080F1E"; ctx.fill();

  const st = my + mh + 28; const sw = (W - 120 - 40) / 3;
  [["284 m", "Elevation", T.green], ["3.2 km", "Distance", T.blue], ["1h 12m", "Duration", T.orange]].forEach(([v, l, c], i) => {
    const sx = 60 + i * (sw + 20);
    rr(ctx, sx, st, sw, 196, 20, T.card, T.border);
    lbl(ctx, v, sx + sw / 2, st + 94, c, 50, "center", "bold");
    lbl(ctx, l, sx + sw / 2, st + 148, T.text, 28, "center");
  });

  const py = st + 226;
  rr(ctx, 60, py, W - 120, 126, 20, T.card, T.border);
  lbl(ctx, "Current pace", 110, py + 50, T.textMuted, 32);
  lbl(ctx, "22 min/km  Target: 20-25 min/km", 110, py + 100, T.text, 36, "left", "bold");

  const by = py + 166;
  rr(ctx, 60, by, W - 120, 136, 68, "rgba(255,68,68,0.12)", "rgba(255,68,68,0.4)");
  lbl(ctx, "End Session", W / 2, by + 80, T.red, 48, "center", "bold");

  tabBar(ctx);
  save(canvas, "04-tracking.png");
}

// ── 5. Goal Setup ─────────────────────────────────────────────────────────────
function s5() {
  const canvas = createCanvas(W, H); const ctx = canvas.getContext("2d");
  drawBg(ctx); drawStatusBar(ctx);
  drawHdr(ctx, "Pick Your Mountain", "We build your training plan automatically.");

  rr(ctx, 60, 430, W - 120, 320, 28, T.card, T.border);
  lbl(ctx, "Your Goal Mountain", 110, 494, T.textMuted, 34);
  lbl(ctx, "Ben Nevis", 110, 572, T.text, 72, "left", "bold");
  lbl(ctx, "Scotland  1,345 m  Grade: Moderate", 110, 626, T.textMuted, 32);

  let tx = 110;
  ["12 weeks", "Aug 14, 2026", "2 people"].forEach(tag => {
    const tw = tag.length * 22 + 52;
    rr(ctx, tx, 664, tw, 62, 31, "rgba(62,207,117,0.12)", "rgba(62,207,117,0.4)");
    lbl(ctx, tag, tx + 26, 704, T.green, 28); tx += tw + 20;
  });

  lbl(ctx, "YOUR 12-WEEK PLAN", 60, 800, T.textMuted, 28, "left", "bold");

  [
    ["Base Phase", "Weeks 1-4", "Build aerobic fitness with hill reps and steady cardio", T.green],
    ["Build Phase", "Weeks 5-8", "Increase elevation gain and tackle harder hills", T.blue],
    ["Peak Phase", "Weeks 9-11", "Long hill days and full summit simulations", T.orange],
    ["Taper Phase", "Week 12", "Rest, recover and arrive fresh on summit day", T.purple],
  ].forEach(([phase, weeks, desc, c], i) => {
    const ry = 830 + i * 212;
    rr(ctx, 60, ry, W - 120, 190, 22, T.card, c + "44");
    ctx.fillStyle = c;
    ctx.fillRect(60, ry + 16, 6, 158);
    lbl(ctx, phase, 100, ry + 74, T.text, 42, "left", "bold");
    lbl(ctx, weeks, 100, ry + 120, c, 30);
    lbl(ctx, desc, 100, ry + 162, T.textMuted, 28);
  });

  const bny = 830 + 4 * 212 + 24;
  rr(ctx, 60, bny, W - 120, 136, 22, "rgba(62,207,117,0.1)", "rgba(62,207,117,0.35)");
  lbl(ctx, "Plan adapts automatically as you log sessions", W / 2, bny + 80, T.green, 36, "center", "bold");

  tabBar(ctx);
  save(canvas, "05-goal-setup.png");
}

console.log("Generating 5 App Store screenshots at 1320 x 2868 px...");
s1(); s2(); s3(); s4(); s5();
console.log("Done. Files saved to artifacts/summit-ready/assets/screenshots/");
