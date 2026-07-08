#!/usr/bin/env node
/**
 * SummitReady App Store screenshots — 1290 × 2796 px (iPhone 6.7")
 * Style: large marketing headline (white + green), iPhone mockup, mountain backgrounds
 */
const { createCanvas } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

const W = 1290;
const H = 2796;
const OUT = path.join(__dirname, "../artifacts/summit-ready/assets/screenshots");
fs.mkdirSync(OUT, { recursive: true });

// Brand colours
const GREEN  = "#3ECF75";
const WHITE  = "#FFFFFF";
const DARK   = "#060D1B";
const CARD   = "#0F1D30";
const MUTED  = "#7A9BB5";
const DIM    = "#4A6580";
const ORANGE = "#FF9030";
const BLUE   = "#4A9FF5";
const PURPLE = "#9B7FD4";
const BORDER = "rgba(255,255,255,0.08)";

// ── Helpers ──────────────────────────────────────────────────────────────────

function rr(ctx, x, y, w, h, r, fill, stroke, sw = 2) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill)   { ctx.fillStyle   = fill;  ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw; ctx.stroke(); }
}

function txt(ctx, text, x, y, color, size, align = "left", weight = "normal") {
  ctx.textAlign = align; ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px sans-serif`;
  ctx.fillText(text, x, y); ctx.textAlign = "left";
}

function arcPct(ctx, cx, cy, r, pct, color, lw = 20) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = lw; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.stroke();
}

// Dark gradient background
function darkBg(ctx, topColor = "#060D1B", botColor = "#040A14") {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, topColor); g.addColorStop(1, botColor);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// Mountain silhouette (drawn with bezier curves)
function drawMountainSilhouette(ctx, y, color = "rgba(62,207,117,0.06)") {
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, y + 400);
  ctx.bezierCurveTo(150, y + 200, 250, y + 100, 380, y + 60);
  ctx.bezierCurveTo(450, y + 30, 500, y, 580, y + 20);
  ctx.bezierCurveTo(650, y + 40, 680, y + 80, 740, y + 60);
  ctx.bezierCurveTo(800, y + 40, 840, y + 10, 900, y + 30);
  ctx.bezierCurveTo(960, y + 50, 1000, y + 120, 1060, y + 140);
  ctx.bezierCurveTo(1120, y + 160, 1180, y + 200, 1290, y + 350);
  ctx.lineTo(1290, H);
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
}

// SummitReady logo text
function drawLogo(ctx, x, y, size = 52) {
  // Mountain icon
  const mx = x; const my = y - size * 0.8;
  ctx.strokeStyle = GREEN; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(mx, my + size * 0.6);
  ctx.lineTo(mx + size * 0.35, my + size * 0.2);
  ctx.lineTo(mx + size * 0.55, my + size * 0.4);
  ctx.lineTo(mx + size * 0.75, my);
  ctx.lineTo(mx + size, my + size * 0.6);
  ctx.stroke();
  // Text
  txt(ctx, "SUMMIT", x + size * 1.2, y - size * 0.3, WHITE, size * 0.75, "left", "bold");
  txt(ctx, "READY", x + size * 1.2, y + size * 0.4, GREEN, size * 0.75, "left", "bold");
}

// ── iPhone frame with app screen inside ──────────────────────────────────────
function drawIphone(ctx, cx, cy, iw, ih, drawScreen) {
  const r = iw * 0.12;
  const bw = iw * 0.015;

  // Phone shadow
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = iw * 0.15;
  ctx.shadowOffsetY = iw * 0.06;
  rr(ctx, cx - iw / 2, cy - ih / 2, iw, ih, r, "#111827");
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  // Body
  rr(ctx, cx - iw / 2, cy - ih / 2, iw, ih, r, "#111827", "rgba(255,255,255,0.14)", 3);

  // Side buttons
  const bh = ih * 0.08; const bx = cx + iw / 2 - bw;
  rr(ctx, bx, cy - ih * 0.18, bw * 2, bh, bw, "#1a2234");
  rr(ctx, cx - iw / 2 - bw, cy - ih * 0.24, bw * 2, bh * 0.55, bw, "#1a2234");
  rr(ctx, cx - iw / 2 - bw, cy - ih * 0.14, bw * 2, bh * 0.55, bw, "#1a2234");

  // Screen area
  const pad = iw * 0.04;
  const sx = cx - iw / 2 + pad; const sy = cy - ih / 2 + pad;
  const sw = iw - pad * 2; const sh = ih - pad * 2;
  const sr = r * 0.75;
  rr(ctx, sx, sy, sw, sh, sr, DARK);

  // Clip and draw screen content
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sx + sr, sy);
  ctx.lineTo(sx + sw - sr, sy); ctx.quadraticCurveTo(sx + sw, sy, sx + sw, sy + sr);
  ctx.lineTo(sx + sw, sy + sh - sr); ctx.quadraticCurveTo(sx + sw, sy + sh, sx + sw - sr, sy + sh);
  ctx.lineTo(sx + sr, sy + sh); ctx.quadraticCurveTo(sx, sy + sh, sx, sy + sh - sr);
  ctx.lineTo(sx, sy + sr); ctx.quadraticCurveTo(sx, sy, sx + sr, sy);
  ctx.closePath();
  ctx.clip();

  // Transform so drawScreen gets 0,0 → sw,sh coords
  ctx.translate(sx, sy);
  ctx.save(); drawScreen(ctx, sw, sh); ctx.restore();
  ctx.restore();

  // Dynamic island
  const diw = iw * 0.28; const dih = iw * 0.04;
  rr(ctx, cx - diw / 2, cy - ih / 2 + pad * 0.8, diw, dih, dih / 2, "#000000");

  // Screen glass glare
  const glare = ctx.createLinearGradient(sx, sy, sx + sw * 0.6, sy + sh * 0.3);
  glare.addColorStop(0, "rgba(255,255,255,0.05)");
  glare.addColorStop(1, "rgba(255,255,255,0)");
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sx + sr, sy); ctx.lineTo(sx + sw - sr, sy);
  ctx.quadraticCurveTo(sx + sw, sy, sx + sw, sy + sr);
  ctx.lineTo(sx + sw, sy + sh - sr); ctx.quadraticCurveTo(sx + sw, sy + sh, sx + sw - sr, sy + sh);
  ctx.lineTo(sx + sr, sy + sh); ctx.quadraticCurveTo(sx, sy + sh, sx, sy + sh - sr);
  ctx.lineTo(sx, sy + sr); ctx.quadraticCurveTo(sx, sy, sx + sr, sy);
  ctx.closePath(); ctx.clip();
  ctx.fillStyle = glare; ctx.fillRect(sx, sy, sw, sh);
  ctx.restore();
}

// ── Screen content drawers ────────────────────────────────────────────────────

function screenDashboard(ctx, sw, sh) {
  ctx.fillStyle = DARK; ctx.fillRect(0, 0, sw, sh);
  const g = ctx.createLinearGradient(0, 0, 0, sh);
  g.addColorStop(0, "#060D1B"); g.addColorStop(1, "#040A14");
  ctx.fillStyle = g; ctx.fillRect(0, 0, sw, sh);

  // Header (no simulated status bar — App Store Connect's Media Manager
  // frames the real iOS status bar automatically; drawing our own risks
  // non-iOS chrome, which is exactly what triggered the 2.3.10 rejection)
  txt(ctx, "My Plan", sw / 2, sh * 0.09, WHITE, sw * 0.075, "center", "bold");

  // Goal card
  rr(ctx, sw * 0.04, sh * 0.11, sw * 0.92, sh * 0.12, sw * 0.04, "#0F1D30", BORDER);
  ctx.fillStyle = GREEN; ctx.beginPath();
  ctx.arc(sw * 0.14, sh * 0.17, sw * 0.05, 0, Math.PI * 2); ctx.fill();
  txt(ctx, "K", sw * 0.14, sh * 0.175, DARK, sw * 0.065, "center", "bold");
  txt(ctx, "Kilimanjaro", sw * 0.24, sh * 0.16, WHITE, sw * 0.06, "left", "bold");
  txt(ctx, "5895m  Target: 20 Sep 2025", sw * 0.24, sh * 0.205, MUTED, sw * 0.042);

  // Progress bar
  txt(ctx, "WEEK 8 OF 20", sw * 0.04, sh * 0.26, MUTED, sw * 0.042, "left", "bold");
  txt(ctx, "Build Endurance", sw * 0.04, sh * 0.30, WHITE, sw * 0.055, "left", "bold");
  txt(ctx, "37%", sw * 0.88, sh * 0.30, GREEN, sw * 0.055, "right", "bold");
  rr(ctx, sw * 0.04, sh * 0.335, sw * 0.92, sh * 0.014, sw * 0.007, "rgba(255,255,255,0.08)");
  rr(ctx, sw * 0.04, sh * 0.335, sw * 0.92 * 0.37, sh * 0.014, sw * 0.007, GREEN);

  // Sessions
  const sessions = [
    { label: "Hill Repeats", sub: "6 x 5 min", done: true },
    { label: "Endurance Hike", sub: "16 km + 900m+", done: false },
    { label: "Strength Session", sub: "Full Body", done: false },
    { label: "Recovery", sub: "Easy Walk", done: false },
  ];
  sessions.forEach((s, i) => {
    const sy = sh * 0.38 + i * sh * 0.12;
    rr(ctx, sw * 0.04, sy, sw * 0.92, sh * 0.105, sw * 0.03,
      s.done ? "rgba(62,207,117,0.07)" : "#0F1D30", s.done ? "rgba(62,207,117,0.25)" : BORDER);
    if (s.done) {
      ctx.beginPath(); ctx.arc(sw * 0.16, sy + sh * 0.052, sw * 0.046, 0, Math.PI * 2);
      ctx.fillStyle = GREEN; ctx.fill();
      txt(ctx, "+", sw * 0.16, sy + sh * 0.066, DARK, sw * 0.065, "center", "bold");
    } else {
      ctx.beginPath(); ctx.arc(sw * 0.16, sy + sh * 0.052, sw * 0.046, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 2; ctx.stroke();
    }
    txt(ctx, s.label, sw * 0.27, sy + sh * 0.044, WHITE, sw * 0.057, "left", "bold");
    txt(ctx, s.sub, sw * 0.27, sy + sh * 0.082, MUTED, sw * 0.042);
  });

  // Tab bar
  const ty = sh * 0.9;
  ctx.fillStyle = "rgba(6,13,27,0.97)"; ctx.fillRect(0, ty, sw, sh - ty);
  ctx.strokeStyle = BORDER; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(sw, ty); ctx.stroke();
  [["Plan", true], ["Sessions", false], ["Progress", false], ["Profile", false]].forEach(([t, a], i) => {
    const x = sw / 4 * i + sw / 8;
    txt(ctx, t, x, sh * 0.96, a ? GREEN : DIM, sw * 0.042, "center", a ? "bold" : "normal");
  });
}

function screenHillSession(ctx, sw, sh) {
  ctx.fillStyle = "#060D1B"; ctx.fillRect(0, 0, sw, sh);

  // No simulated status bar — see note in screenDashboard().
  txt(ctx, "Hill Session", sw / 2, sh * 0.09, WHITE, sw * 0.07, "center", "bold");
  txt(ctx, "Workout", sw * 0.88, sh * 0.09, GREEN, sw * 0.05, "right", "bold");

  // Map area
  const mh = sh * 0.42;
  ctx.fillStyle = "#0A1A0A"; ctx.fillRect(0, sh * 0.11, sw, mh);
  ctx.strokeStyle = "rgba(62,207,117,0.06)"; ctx.lineWidth = 1;
  for (let x = 0; x < sw; x += 40) { ctx.beginPath(); ctx.moveTo(x, sh * 0.11); ctx.lineTo(x, sh * 0.11 + mh); ctx.stroke(); }
  for (let y = sh * 0.11; y < sh * 0.11 + mh; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(sw, y); ctx.stroke(); }

  // Route trace (oval/hill shape)
  ctx.save();
  ctx.translate(sw / 2, sh * 0.11 + mh / 2);
  ctx.scale(1, 0.65);
  ctx.beginPath(); ctx.arc(0, 0, sw * 0.3, 0, Math.PI * 2);
  ctx.strokeStyle = GREEN; ctx.lineWidth = 5; ctx.stroke();
  const gf = ctx.createRadialGradient(0, 0, sw * 0.1, 0, 0, sw * 0.32);
  gf.addColorStop(0, "rgba(62,207,117,0.18)"); gf.addColorStop(1, "rgba(62,207,117,0)");
  ctx.fillStyle = gf; ctx.fill();
  ctx.restore();

  // Dot on route
  ctx.beginPath(); ctx.arc(sw * 0.5 + sw * 0.3, sh * 0.11 + mh / 2, sw * 0.03, 0, Math.PI * 2);
  ctx.fillStyle = WHITE; ctx.fill();
  ctx.beginPath(); ctx.arc(sw * 0.5 + sw * 0.3, sh * 0.11 + mh / 2, sw * 0.018, 0, Math.PI * 2);
  ctx.fillStyle = GREEN; ctx.fill();

  // Session info
  txt(ctx, "Repeated Ascent", sw * 0.05, sh * 0.57, WHITE, sw * 0.065, "left", "bold");
  txt(ctx, "6 x 5 min uphill", sw * 0.05, sh * 0.61, MUTED, sw * 0.048);

  // Stats row
  const stats = [["ELEVATION GAIN", "720", "m"], ["DISTANCE", "8.4", "km"], ["TIME", "1:28:34", ""]];
  stats.forEach(([label, val, unit], i) => {
    const x = sw * (0.04 + i * 0.33);
    txt(ctx, label, x, sh * 0.68, MUTED, sw * 0.034, "left", "bold");
    txt(ctx, val, x, sh * 0.72, WHITE, sw * 0.065, "left", "bold");
    if (unit) txt(ctx, unit, x + ctx.measureText(val).width + 4, sh * 0.72, MUTED, sw * 0.04);
  });

  // Start button
  rr(ctx, sw * 0.06, sh * 0.77, sw * 0.88, sh * 0.08, sw * 0.04, GREEN);
  txt(ctx, "START SESSION", sw / 2, sh * 0.82, DARK, sw * 0.062, "center", "bold");

  txt(ctx, "Select a different route", sw / 2, sh * 0.88, GREEN, sw * 0.047, "center");

  // Tab bar
  const ty = sh * 0.9;
  ctx.fillStyle = "rgba(6,13,27,0.97)"; ctx.fillRect(0, ty, sw, sh - ty);
  ctx.strokeStyle = BORDER; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(sw, ty); ctx.stroke();
  [["Plan", false], ["Sessions", true], ["Progress", false], ["Profile", false]].forEach(([t, a], i) => {
    const x = sw / 4 * i + sw / 8;
    txt(ctx, t, x, sh * 0.96, a ? GREEN : DIM, sw * 0.042, "center", a ? "bold" : "normal");
  });
}

function screenProgress(ctx, sw, sh) {
  ctx.fillStyle = "#060D1B"; ctx.fillRect(0, 0, sw, sh);

  // No simulated status bar — see note in screenDashboard().
  txt(ctx, "Progress", sw / 2, sh * 0.09, WHITE, sw * 0.075, "center", "bold");

  // Readiness circle
  txt(ctx, "MOUNTAIN READINESS", sw / 2, sh * 0.16, MUTED, sw * 0.044, "center", "bold");
  arcPct(ctx, sw / 2, sh * 0.26, sw * 0.22, 0.78, GREEN, sw * 0.045);
  txt(ctx, "78%", sw / 2, sh * 0.272, WHITE, sw * 0.11, "center", "bold");
  txt(ctx, "On track", sw / 2, sh * 0.31, GREEN, sw * 0.048, "center");

  // Stats
  const sty = sh * 0.36;
  txt(ctx, "This Week", sw * 0.05, sty, MUTED, sw * 0.044, "left", "bold");
  [["12.4", "km"], ["1,250", "m+"], ["4", "Sessions"]].forEach(([v, u], i) => {
    const x = sw * (0.05 + i * 0.32);
    txt(ctx, v, x, sty + sh * 0.06, WHITE, sw * 0.075, "left", "bold");
    txt(ctx, u, x, sty + sh * 0.095, MUTED, sw * 0.042);
  });

  // Chart
  txt(ctx, "Elevation Gain", sw * 0.05, sty + sh * 0.14, WHITE, sw * 0.05, "left", "bold");
  ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 1;
  const chartH = sh * 0.2; const chartY = sty + sh * 0.17;
  for (let y = chartY; y < chartY + chartH; y += chartH / 4) {
    ctx.beginPath(); ctx.moveTo(sw * 0.05, y); ctx.lineTo(sw * 0.95, y); ctx.stroke();
  }

  const pts = [[0.05,0.8],[0.2,0.7],[0.35,0.6],[0.5,0.55],[0.6,0.4],[0.72,0.35],[0.85,0.25],[0.95,0.18]];
  const gg = ctx.createLinearGradient(0, chartY, 0, chartY + chartH);
  gg.addColorStop(0, "rgba(62,207,117,0.3)"); gg.addColorStop(1, "rgba(62,207,117,0)");
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const cx = sw * x; const cy = chartY + chartH * y;
    i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
  });
  ctx.lineTo(sw * 0.95, chartY + chartH); ctx.lineTo(sw * 0.05, chartY + chartH); ctx.closePath();
  ctx.fillStyle = gg; ctx.fill();

  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const cx = sw * x; const cy = chartY + chartH * y;
    i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
  });
  ctx.strokeStyle = GREEN; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.stroke();

  txt(ctx, "8,750 m Total", sw * 0.05, chartY + chartH + sh * 0.04, WHITE, sw * 0.07, "left", "bold");

  const months = ["MAR", "APR", "MAY", "JUN", "JUL"];
  months.forEach((m, i) => {
    txt(ctx, m, sw * (0.05 + i * 0.225), chartY + chartH + sh * 0.08, DIM, sw * 0.036);
  });

  const ty = sh * 0.9;
  ctx.fillStyle = "rgba(6,13,27,0.97)"; ctx.fillRect(0, ty, sw, sh - ty);
  ctx.strokeStyle = BORDER; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(sw, ty); ctx.stroke();
  [["Plan", false], ["Sessions", false], ["Progress", true], ["Profile", false]].forEach(([t, a], i) => {
    const x = sw / 4 * i + sw / 8;
    txt(ctx, t, x, sh * 0.96, a ? GREEN : DIM, sw * 0.042, "center", a ? "bold" : "normal");
  });
}

// ── Headline with green highlight word(s) ─────────────────────────────────────
// words: array of {text, color}[]
function multiColorHeadline(ctx, lines, cx, startY, size, lineH) {
  lines.forEach((words, row) => {
    const parts = words.map(({ text, color }) => ({ text, color, w: measureWord(ctx, text, size) }));
    const totalW = parts.reduce((s, p) => s + p.w + size * 0.3, -size * 0.3);
    let x = cx - totalW / 2;
    parts.forEach(({ text, color, w }) => {
      txt(ctx, text, x, startY + row * lineH, color, size, "left", "bold");
      x += w + size * 0.3;
    });
  });
}

function measureWord(ctx, text, size) {
  ctx.font = `bold ${size}px sans-serif`;
  return ctx.measureText(text).width;
}

function save(canvas, name) {
  const buf = canvas.toBuffer("image/png");
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(`  ${name}  (${(buf.length / 1024).toFixed(0)} KB)`);
}

// ── 5 Screenshots ────────────────────────────────────────────────────────────

function s1() {
  const canvas = createCanvas(W, H); const ctx = canvas.getContext("2d");
  darkBg(ctx, "#06100F", "#010809");

  // Mountain silhouettes (layered)
  drawMountainSilhouette(ctx, H * 0.38, "rgba(30,80,50,0.25)");
  drawMountainSilhouette(ctx, H * 0.46, "rgba(20,60,35,0.35)");
  drawMountainSilhouette(ctx, H * 0.54, "rgba(10,40,20,0.5)");

  // Green glow at horizon
  const glow = ctx.createRadialGradient(W / 2, H * 0.56, 0, W / 2, H * 0.56, W * 0.9);
  glow.addColorStop(0, "rgba(62,207,117,0.12)"); glow.addColorStop(1, "rgba(62,207,117,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  // Stars
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  [[120,200],[300,80],[540,160],[720,40],[900,130],[1050,200],[200,330],[460,300],[800,280],[1100,100]].forEach(([x, y]) => {
    ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
  });

  // Headline
  const hx = W / 2; let hy = H * 0.1;
  txt(ctx, "PREPARE FOR", hx, hy, WHITE, 110, "center", "bold"); hy += 120;
  txt(ctx, "ANY", hx, hy, GREEN, 148, "center", "bold"); hy += 156;
  txt(ctx, "MOUNTAIN", hx, hy, WHITE, 110, "center", "bold"); hy += 100;
  txt(ctx, "Personalised training plans using local hills.", hx, hy, "rgba(255,255,255,0.75)", 50, "center"); hy += 58;
  txt(ctx, "Track your progress. Arrive ready.", hx, hy, "rgba(255,255,255,0.75)", 50, "center");

  // Feature icons row
  const fy = H * 0.82;
  const features = [["Choose Your\nMountain", "⛰"], ["Get Your\nPlan", "📋"], ["Reach Your\nSummit", "🏆"]];
  features.forEach(([label, icon], i) => {
    const x = W / 4 + i * W / 4;
    txt(ctx, icon, x, fy, WHITE, 64, "center");
    label.split("\n").forEach((l, j) => txt(ctx, l, x, fy + 80 + j * 52, "rgba(255,255,255,0.75)", 38, "center"));
  });

  // Dividers
  ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W / 4 * 1.5, fy - 20); ctx.lineTo(W / 4 * 1.5, fy + 200); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W / 4 * 2.5, fy - 20); ctx.lineTo(W / 4 * 2.5, fy + 200); ctx.stroke();

  // Logo
  drawLogo(ctx, W / 2 - 160, H * 0.96);

  save(canvas, "01-prepare.png");
}

function s2() {
  const canvas = createCanvas(W, H); const ctx = canvas.getContext("2d");
  darkBg(ctx, "#060D1B", "#030610");

  const g2 = ctx.createRadialGradient(W * 0.15, H * 0.4, 0, W * 0.15, H * 0.4, W * 0.8);
  g2.addColorStop(0, "rgba(62,207,117,0.08)"); g2.addColorStop(1, "rgba(62,207,117,0)");
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

  // Headline
  let hy = H * 0.06;
  txt(ctx, "GET YOUR", W / 2, hy, WHITE, 108, "center", "bold"); hy += 116;
  txt(ctx, "PERSONALISED", W / 2, hy, WHITE, 98, "center", "bold"); hy += 110;
  txt(ctx, "TRAINING PLAN", W / 2, hy, GREEN, 98, "center", "bold"); hy += 86;
  txt(ctx, "Tailored to your mountain,", W / 2, hy, "rgba(255,255,255,0.7)", 48, "center"); hy += 56;
  txt(ctx, "your time and your fitness.", W / 2, hy, "rgba(255,255,255,0.7)", 48, "center");

  drawIphone(ctx, W / 2, H * 0.66, W * 0.72, H * 0.54, screenDashboard);

  save(canvas, "02-plan.png");
}

function s3() {
  const canvas = createCanvas(W, H); const ctx = canvas.getContext("2d");
  darkBg(ctx, "#051208", "#020908");

  const g3 = ctx.createRadialGradient(W * 0.8, H * 0.45, 0, W * 0.8, H * 0.45, W * 0.9);
  g3.addColorStop(0, "rgba(62,207,117,0.1)"); g3.addColorStop(1, "rgba(62,207,117,0)");
  ctx.fillStyle = g3; ctx.fillRect(0, 0, W, H);

  let hy = H * 0.06;
  txt(ctx, "TRAIN USING", W / 2, hy, WHITE, 108, "center", "bold"); hy += 116;
  txt(ctx, "LOCAL HILLS", W / 2, hy, GREEN, 108, "center", "bold"); hy += 90;
  txt(ctx, "Turn everyday hills into", W / 2, hy, "rgba(255,255,255,0.7)", 48, "center"); hy += 56;
  txt(ctx, "powerful mountain preparation.", W / 2, hy, "rgba(255,255,255,0.7)", 48, "center");

  drawIphone(ctx, W / 2, H * 0.66, W * 0.72, H * 0.54, screenHillSession);

  save(canvas, "03-hills.png");
}

function s4() {
  const canvas = createCanvas(W, H); const ctx = canvas.getContext("2d");
  darkBg(ctx, "#060D1B", "#030610");

  const g4 = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, W);
  g4.addColorStop(0, "rgba(62,207,117,0.07)"); g4.addColorStop(1, "rgba(62,207,117,0)");
  ctx.fillStyle = g4; ctx.fillRect(0, 0, W, H);

  let hy = H * 0.06;
  txt(ctx, "TRACK YOUR", W / 2, hy, WHITE, 108, "center", "bold"); hy += 116;
  txt(ctx, "PROGRESS", W / 2, hy, GREEN, 120, "center", "bold"); hy += 100;
  txt(ctx, "Monitor your training, elevation", W / 2, hy, "rgba(255,255,255,0.7)", 48, "center"); hy += 56;
  txt(ctx, "gain and mountain readiness.", W / 2, hy, "rgba(255,255,255,0.7)", 48, "center");

  drawIphone(ctx, W / 2, H * 0.66, W * 0.72, H * 0.54, screenProgress);

  save(canvas, "04-progress.png");
}

function s5() {
  const canvas = createCanvas(W, H); const ctx = canvas.getContext("2d");

  // Light blue/sky gradient background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#D6EAF8"); bg.addColorStop(0.4, "#AED6F1"); bg.addColorStop(1, "#85C1E9");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Mountain silhouette (darker blue)
  drawMountainSilhouette(ctx, H * 0.35, "rgba(52,120,170,0.3)");
  drawMountainSilhouette(ctx, H * 0.43, "rgba(40,100,150,0.4)");

  // Headline (dark text on light bg)
  let hy = H * 0.07;
  txt(ctx, "BUILT FOR", W / 2, hy, "#0A2540", 108, "center", "bold"); hy += 116;
  txt(ctx, "YOUR NEXT", W / 2, hy, "#0A2540", 108, "center", "bold"); hy += 116;
  txt(ctx, "ADVENTURE", W / 2, hy, GREEN, 108, "center", "bold"); hy += 90;
  txt(ctx, "From Kilimanjaro to Mont Blanc and beyond.", W / 2, hy, "#1a4060", 44, "center"); hy += 54;
  txt(ctx, "We'll help you get there.", W / 2, hy, "#1a4060", 44, "center");

  // Mountain cards
  const mountains = [
    { name: "KILIMANJARO", elev: "5895m" },
    { name: "MONT BLANC", elev: "4808m" },
    { name: "EVEREST BASE CAMP", elev: "5364m" },
    { name: "BEN NEVIS", elev: "1345m" },
    { name: "AND THOUSANDS MORE MOUNTAINS", elev: "" },
  ];
  mountains.forEach(({ name, elev }, i) => {
    const cy = H * 0.52 + i * 170;
    rr(ctx, W * 0.1, cy, W * 0.8, 148, 18, "rgba(255,255,255,0.5)", "rgba(255,255,255,0.7)");
    // Mountain icon
    ctx.strokeStyle = "#0A2540"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const ix = W * 0.14; const iy = cy + 44;
    ctx.beginPath(); ctx.moveTo(ix, iy + 60); ctx.lineTo(ix + 36, iy + 10); ctx.lineTo(ix + 60, iy + 40); ctx.lineTo(ix + 80, iy); ctx.lineTo(ix + 106, iy + 60); ctx.stroke();
    txt(ctx, name, W * 0.28, cy + 64, "#0A2540", 44, "left", "bold");
    if (elev) txt(ctx, elev, W * 0.28, cy + 108, "#2a5070", 36);
  });

  // SummitReady logo (dark version for light bg)
  ctx.strokeStyle = "#0A4020"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round";
  const lx = W / 2 - 170; const ly = H * 0.97;
  const ls = 56;
  ctx.beginPath();
  ctx.moveTo(lx, ly - ls * 0.4); ctx.lineTo(lx + ls * 0.38, ly - ls * 0.8);
  ctx.lineTo(lx + ls * 0.58, ly - ls * 0.55); ctx.lineTo(lx + ls * 0.78, ly - ls);
  ctx.lineTo(lx + ls, ly - ls * 0.4); ctx.stroke();
  txt(ctx, "SUMMIT", lx + ls * 1.25, ly - ls * 0.35, "#0A2540", ls * 0.7, "left", "bold");
  txt(ctx, "READY", lx + ls * 1.25, ly + ls * 0.36, GREEN, ls * 0.7, "left", "bold");

  save(canvas, "05-adventure.png");
}

console.log("Generating 5 App Store screenshots at 1290 x 2796 px...");
s1(); s2(); s3(); s4(); s5();
console.log("Done — artifacts/summit-ready/assets/screenshots/");
