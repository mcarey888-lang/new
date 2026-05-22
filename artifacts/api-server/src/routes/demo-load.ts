import { Router, type IRouter } from "express";

const router: IRouter = Router();

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

router.get("/demo-load", (req, res) => {
  const profile = String(req.query.p ?? "kilimanjaro");
  const goto = String(req.query.goto ?? "/mobile/");

  const goal = {
    mountainName: profile === "montblanc" ? "Mont Blanc (Goûter Route)" : "Kilimanjaro (Marangu Route)",
    summitDate: daysFromNow(84),
    distance: profile === "montblanc" ? 19 : 90,
    elevationGain: profile === "montblanc" ? 2800 : 3700,
    highestAltitude: profile === "montblanc" ? 4808 : 5895,
    difficulty: "Alpine",
    fitnessLevel: profile === "montblanc" ? "Strong" : "Average",
    location: profile === "montblanc" ? "Leeds" : "Sheffield",
    maxRadius: 30,
    equipment: ["gym", "weights"],
    trainingDaysPerWeek: 4,
    hillDaysPerWeek: 2,
  };

  const hillA = profile === "montblanc" ? "Ilkley Moor" : "Carl Wark";
  const hillB = profile === "montblanc" ? "Rombald's Moor" : "Stanage Edge";
  const hillElev = profile === "montblanc" ? 402 : 390;

  function makeWeek(wk: number, phase: string, purpose: string, elev: number, offset: number, isCurrent: boolean, hill: string) {
    const reps = Math.max(1, Math.ceil(elev / hillElev));
    return {
      weekNumber: wk,
      phase,
      purpose,
      targetElevation: elev,
      isPeakWeek: phase === "Peak",
      isTaperWeek: phase === "Taper",
      isCurrentWeek: isCurrent,
      startDate: daysFromNow(offset * 7),
      endDate: daysFromNow(offset * 7 + 6),
      sessions: [
        { type: "cardio", label: "Easy Run", description: "Zone 2 aerobic run.", targetElevation: 0, duration: "45 min" },
        { type: "hill", label: `${hill} Reps`, description: `${reps} repeats on ${hill}.`, targetElevation: reps * hillElev, duration: "90 min" },
        { type: "bigDay", label: "Long Hike", description: "Extended hill session with pack.", targetElevation: Math.round(elev * 1.3), duration: "3–4 hrs" },
      ],
      hills: [{ name: hill, elevation: hillElev, distance: 2.8, repeats: reps, totalElevation: reps * hillElev }],
    };
  }

  const plan = [
    makeWeek(1,  "Base",  "Establish aerobic base",          400,  -7,  false, hillA),
    makeWeek(2,  "Base",  "Build hill tolerance",             500,  -6,  false, hillA),
    makeWeek(3,  "Base",  "Introduce weighted pack",          600,  -5,  false, hillB),
    makeWeek(4,  "Build", "First build phase",                750,  -4,  false, hillB),
    makeWeek(5,  "Build", "Increase session intensity",       850,  -3,  false, hillA),
    makeWeek(6,  "Build", "Back-to-back hill days",           950,  -2,  false, hillB),
    makeWeek(7,  "Build", "Long day simulation",             1050,  -1,  false, hillB),
    makeWeek(8,  "Peak",  "Peak load — highest training week",1200, 0,  true,  hillA),
    makeWeek(9,  "Peak",  "Sustain peak load",               1200,  1,  false, hillB),
    makeWeek(10, "Taper", "Begin taper",                      700,  2,  false, hillA),
    makeWeek(11, "Taper", "Final taper",                      400,  3,  false, hillA),
  ];

  const sessions = [
    { id: "s1",  date: daysFromNow(-49), type: "cardio", completed: true, weekNumber: 1, distance: 7.2,  elevationGain: 120, duration: 48,  effort: 3, notes: "Steady Zone 2" },
    { id: "s2",  date: daysFromNow(-46), type: "hill",   completed: true, weekNumber: 1, distance: 4.8,  elevationGain: 460, duration: 80,  effort: 4, notes: "4 reps", hillName: hillA },
    { id: "s3",  date: daysFromNow(-42), type: "bigDay", completed: true, weekNumber: 2, distance: 14.2, elevationGain: 720, duration: 210, effort: 4, notes: "Long day with pack" },
    { id: "s4",  date: daysFromNow(-38), type: "cardio", completed: true, weekNumber: 3, distance: 7.2,  elevationGain: 120, duration: 48,  effort: 3, notes: "" },
    { id: "s5",  date: daysFromNow(-35), type: "hill",   completed: true, weekNumber: 3, distance: 4.8,  elevationGain: 460, duration: 80,  effort: 4, notes: "", hillName: hillB },
    { id: "s6",  date: daysFromNow(-32), type: "bigDay", completed: true, weekNumber: 4, distance: 14.2, elevationGain: 720, duration: 210, effort: 4, notes: "" },
    { id: "s7",  date: daysFromNow(-28), type: "cardio", completed: true, weekNumber: 5, distance: 7.2,  elevationGain: 120, duration: 48,  effort: 3, notes: "" },
    { id: "s8",  date: daysFromNow(-24), type: "hill",   completed: true, weekNumber: 5, distance: 4.8,  elevationGain: 460, duration: 80,  effort: 4, notes: "", hillName: hillA },
    { id: "s9",  date: daysFromNow(-21), type: "bigDay", completed: true, weekNumber: 6, distance: 14.2, elevationGain: 720, duration: 210, effort: 4, notes: "" },
    { id: "s10", date: daysFromNow(-17), type: "cardio", completed: true, weekNumber: 7, distance: 7.2,  elevationGain: 120, duration: 48,  effort: 3, notes: "" },
    { id: "s11", date: daysFromNow(-14), type: "hill",   completed: true, weekNumber: 7, distance: 4.8,  elevationGain: 460, duration: 80,  effort: 4, notes: "", hillName: hillB },
    { id: "s12", date: daysFromNow(-10), type: "bigDay", completed: true, weekNumber: 7, distance: 14.2, elevationGain: 720, duration: 210, effort: 4, notes: "" },
  ];

  const storageEntries: Array<[string, string]> = [
    ["summitready_app_mode",       "summit"],
    ["summitready_goal",            JSON.stringify(goal)],
    ["summitready_plan",            JSON.stringify(plan)],
    ["summitready_sessions",        JSON.stringify(sessions)],
    ["summitready_has_viewed_plan", "true"],
    ["summitready_achievements",    JSON.stringify(["first_session", "5_sessions", "hill_week"])],
  ];

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Loading demo…</title></head>
<body>
<script>
  var entries = ${JSON.stringify(storageEntries)};
  var ALL_KEYS = [
    "summitready_goal","summitready_sessions","summitready_plan","summitready_nearby_hills",
    "summitready_completed_plan_sessions","summitready_assigned_hills","summitready_adjust_note",
    "summitready_submitted_plan_sessions","summitready_hills_in_plan","summitready_session_reps",
    "summitready_session_efforts","summitready_has_viewed_plan","summitready_achievements",
    "summitready_completed_goals","summitready_app_mode","summitready_explore_hikes",
    "summitready_saved_trails","summitready_completed_trails","summitready_custom_routes",
    "summitready_last_trail_location","summitready_live_trails_cache","summitready_challenges",
    "summitready_questionnaire_data"
  ];
  ALL_KEYS.forEach(function(k) { localStorage.removeItem(k); });
  entries.forEach(function(e) { localStorage.setItem(e[0], e[1]); });
  window.location.replace(${JSON.stringify(goto)});
</script>
<p>Loading demo data…</p>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

export default router;
