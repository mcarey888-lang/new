import { chromium } from "playwright";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";

const METRO_URL = "http://localhost:20885";
const OUT_DIR = "/home/runner/workspace/screenshots";

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

const goal = {
  mountainName: "Kilimanjaro (Marangu Route)",
  summitDate: daysFromNow(84),
  distance: 90, elevationGain: 3700, highestAltitude: 5895,
  difficulty: "Alpine", fitnessLevel: "Average", location: "Sheffield",
  maxRadius: 30, equipment: ["gym","weights"], trainingDaysPerWeek: 4, hillDaysPerWeek: 2,
};

const hillA = "Carl Wark";
const hillB = "Stanage Edge";
const hillElev = 390;

function makeWeek(wk, phase, purpose, elev, offset, isCurrent, hill) {
  const reps = Math.max(1, Math.ceil(elev / hillElev));
  return {
    weekNumber: wk, phase, purpose, targetElevation: elev,
    isPeakWeek: phase === "Peak", isTaperWeek: phase === "Taper", isCurrentWeek: isCurrent,
    startDate: daysFromNow(offset * 7), endDate: daysFromNow(offset * 7 + 6),
    sessions: [
      { type: "cardio", label: "Easy Run", description: "Zone 2 aerobic run.", targetElevation: 0, duration: "45 min" },
      { type: "hill", label: `${hill} Reps`, description: `${reps} repeats on ${hill}.`, targetElevation: reps * hillElev, duration: "90 min" },
      { type: "bigDay", label: "Long Hike", description: "Extended hill session with pack.", targetElevation: Math.round(elev * 1.3), duration: "3–4 hrs" },
    ],
    hills: [{ name: hill, elevation: hillElev, distance: 2.8, repeats: reps, totalElevation: reps * hillElev }],
  };
}

const plan = [
  makeWeek(1,  "Base",  "Establish aerobic base",           400,  -7,  false, hillA),
  makeWeek(2,  "Base",  "Build hill tolerance",              500,  -6,  false, hillA),
  makeWeek(3,  "Base",  "Introduce weighted pack",           600,  -5,  false, hillB),
  makeWeek(4,  "Build", "First build phase",                 750,  -4,  false, hillB),
  makeWeek(5,  "Build", "Increase session intensity",        850,  -3,  false, hillA),
  makeWeek(6,  "Build", "Back-to-back hill days",            950,  -2,  false, hillB),
  makeWeek(7,  "Build", "Long day simulation",              1050,  -1,  false, hillB),
  makeWeek(8,  "Peak",  "Peak load — highest training week",1200,   0,  true,  hillA),
  makeWeek(9,  "Peak",  "Sustain peak load",               1200,   1,  false, hillB),
  makeWeek(10, "Taper", "Begin taper",                      700,   2,  false, hillA),
  makeWeek(11, "Taper", "Final taper",                      400,   3,  false, hillA),
];

function makeSession(id, daysAgo, type, weekNumber, hillName) {
  const t = { cardio: { distance:7.2,elevationGain:120,duration:48,effort:3,notes:"Steady Zone 2" }, hill: { distance:4.8,elevationGain:460,duration:80,effort:4,notes:"4 reps",hillName }, bigDay: { distance:14.2,elevationGain:720,duration:210,effort:4,notes:"Long day" } };
  return { id, date: daysFromNow(-daysAgo), type, completed: true, weekNumber, ...t[type] };
}

const sessions = [
  makeSession("s1", 49, "cardio", 1), makeSession("s2", 46, "hill", 1, hillA),
  makeSession("s3", 42, "bigDay", 2), makeSession("s4", 38, "cardio", 3),
  makeSession("s5", 35, "hill", 3, hillB), makeSession("s6", 32, "bigDay", 4),
  makeSession("s7", 28, "cardio", 5), makeSession("s8", 24, "hill", 5, hillA),
  makeSession("s9", 21, "bigDay", 6), makeSession("s10", 17, "cardio", 7),
  makeSession("s11", 14, "hill", 7, hillB), makeSession("s12", 10, "bigDay", 7),
];

const ALL_KEYS = [
  "summitready_goal","summitready_sessions","summitready_plan","summitready_nearby_hills",
  "summitready_completed_plan_sessions","summitready_assigned_hills","summitready_adjust_note",
  "summitready_submitted_plan_sessions","summitready_hills_in_plan","summitready_session_reps",
  "summitready_session_efforts","summitready_has_viewed_plan","summitready_achievements",
  "summitready_completed_goals","summitready_app_mode","summitready_explore_hikes",
  "summitready_saved_trails","summitready_completed_trails","summitready_custom_routes",
];

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });

  // Inject demo data
  await page.goto(METRO_URL, { waitUntil: "domcontentloaded" });
  await wait(3000); // wait for JS to boot

  await page.evaluate(({ ALL_KEYS, goal, plan, sessions }) => {
    ALL_KEYS.forEach(k => localStorage.removeItem(k));
    localStorage.setItem("summitready_app_mode", "summit");
    localStorage.setItem("summitready_goal", JSON.stringify(goal));
    localStorage.setItem("summitready_plan", JSON.stringify(plan));
    localStorage.setItem("summitready_sessions", JSON.stringify(sessions));
    localStorage.setItem("summitready_has_viewed_plan", "true");
    localStorage.setItem("summitready_achievements", JSON.stringify(["first_session","5_sessions","hill_week"]));
  }, { ALL_KEYS, goal, plan, sessions });

  console.log("localStorage injected, reloading...");
  await page.reload({ waitUntil: "networkidle" });
  await wait(5000); // wait for React to mount, AppContext to load, and redirect to dashboard

  console.log("Current URL after reload:", page.url());

  // Dashboard screenshot
  await page.screenshot({ path: `${OUT_DIR}/screen-dashboard-kili.jpg`, type: "jpeg", quality: 95 });
  console.log("Saved dashboard screenshot");

  // Navigate to plan tab
  await wait(1000);
  console.log("Navigating to plan...");
  // Click Plan tab or navigate directly
  await page.evaluate(() => { window.history.pushState({}, "", "/plan"); window.dispatchEvent(new PopStateEvent("popstate")); });
  await wait(3000);
  await page.screenshot({ path: `${OUT_DIR}/screen-plan-kili.jpg`, type: "jpeg", quality: 95 });
  console.log("Saved plan screenshot");

  // Navigate to log tab
  await page.evaluate(() => { window.history.pushState({}, "", "/log"); window.dispatchEvent(new PopStateEvent("popstate")); });
  await wait(3000);
  await page.screenshot({ path: `${OUT_DIR}/screen-log-kili.jpg`, type: "jpeg", quality: 95 });
  console.log("Saved log screenshot");

  // Navigate to hills tab
  await page.evaluate(() => { window.history.pushState({}, "", "/hills"); window.dispatchEvent(new PopStateEvent("popstate")); });
  await wait(3000);
  await page.screenshot({ path: `${OUT_DIR}/screen-hills-kili.jpg`, type: "jpeg", quality: 95 });
  console.log("Saved hills screenshot");

  await browser.close();
  console.log("Done! Screenshots saved to", OUT_DIR);
}

main().catch(err => { console.error(err); process.exit(1); });
