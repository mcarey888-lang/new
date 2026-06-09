import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import TrainingGuides from "./pages/TrainingGuides";
import MontBlancPlan from "./pages/training-guides/MontBlancPlan";
import KilimanjaroPlan from "./pages/training-guides/KilimanjaroPlan";
import MatterhornGuide from "./pages/training-guides/MatterhornGuide";
import EBCPlan from "./pages/training-guides/EBCPlan";
import GranParadisoPlan from "./pages/training-guides/GranParadisoPlan";
import SixWeekHikingPlan from "./pages/training-guides/SixWeekHikingPlan";
import BeginnerMountainFitnessPlan from "./pages/training-guides/BeginnerMountainFitnessPlan";
import LocalHillsGuide from "./pages/training-guides/LocalHillsGuide";
import CanIClimb from "./pages/CanIClimb";
import MontBlancCIC from "./pages/can-i-climb/MontBlancCIC";
import KilimanjaroCIC from "./pages/can-i-climb/KilimanjaroCIC";
import MatterhornCIC from "./pages/can-i-climb/MatterhornCIC";
import GranParadisoCIC from "./pages/can-i-climb/GranParadisoCIC";
import EBCCIC from "./pages/can-i-climb/EBCCIC";
import ScreenshotHelper from "./pages/ScreenshotHelper";
import Mountains from "./pages/Mountains";
import MontBlancMtn from "./pages/mountains/MontBlancMtn";
import KilimanjaroMtn from "./pages/mountains/KilimanjaroMtn";
import MatterhornMtn from "./pages/mountains/MatterhornMtn";
import NotFound from "./pages/not-found";
import ReadinessCheck from "./pages/ReadinessCheck";
import MountainVerification from "./pages/admin/MountainVerification";
import "./index.css";

import { ThemeProvider } from "./lib/ThemeContext";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />

      {/* Training Guides */}
      <Route path="/training-guides" element={<TrainingGuides />} />
      <Route path="/training-guides/mont-blanc-training-plan" element={<MontBlancPlan />} />
      <Route path="/training-guides/kilimanjaro-training-plan" element={<KilimanjaroPlan />} />
      <Route path="/training-guides/matterhorn-preparation-guide" element={<MatterhornGuide />} />
      <Route path="/training-guides/everest-base-camp-training-plan" element={<EBCPlan />} />
      <Route path="/training-guides/gran-paradiso-training-plan" element={<GranParadisoPlan />} />
      <Route path="/training-guides/6-week-hiking-training-plan" element={<SixWeekHikingPlan />} />
      <Route path="/training-guides/beginner-mountain-fitness-plan" element={<BeginnerMountainFitnessPlan />} />
      <Route path="/training-guides/train-for-mountains-using-local-hills" element={<LocalHillsGuide />} />

      {/* Can I Climb */}
      <Route path="/can-i-climb" element={<CanIClimb />} />
      <Route path="/can-i-climb/mont-blanc" element={<MontBlancCIC />} />
      <Route path="/can-i-climb/kilimanjaro" element={<KilimanjaroCIC />} />
      <Route path="/can-i-climb/matterhorn" element={<MatterhornCIC />} />
      <Route path="/can-i-climb/gran-paradiso" element={<GranParadisoCIC />} />
      <Route path="/can-i-climb/everest-base-camp" element={<EBCCIC />} />

      {/* Mountains */}
      <Route path="/mountains" element={<Mountains />} />
      <Route path="/mountains/mont-blanc" element={<MontBlancMtn />} />
      <Route path="/mountains/kilimanjaro" element={<KilimanjaroMtn />} />
      <Route path="/mountains/matterhorn" element={<MatterhornMtn />} />

      <Route path="/readiness-check" element={<ReadinessCheck />} />
      <Route path="/screenshot-helper" element={<ScreenshotHelper />} />
      <Route path="/admin/mountain-verification" element={<MountainVerification />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
  </ThemeProvider>
);
