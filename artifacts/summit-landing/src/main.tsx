import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import TrainingGuides from "./pages/TrainingGuides";
import MontBlancPlan from "./pages/training-guides/MontBlancPlan";
import KilimanjaroPlan from "./pages/training-guides/KilimanjaroPlan";
import MatterhornGuide from "./pages/training-guides/MatterhornGuide";
import CanIClimb from "./pages/CanIClimb";
import MontBlancCIC from "./pages/can-i-climb/MontBlancCIC";
import KilimanjaroCIC from "./pages/can-i-climb/KilimanjaroCIC";
import Mountains from "./pages/Mountains";
import MontBlancMtn from "./pages/mountains/MontBlancMtn";
import KilimanjaroMtn from "./pages/mountains/KilimanjaroMtn";
import MatterhornMtn from "./pages/mountains/MatterhornMtn";
import NotFound from "./pages/not-found";
import "./index.css";

createRoot(document.getElementById("root")!).render(
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

      {/* Can I Climb */}
      <Route path="/can-i-climb" element={<CanIClimb />} />
      <Route path="/can-i-climb/mont-blanc" element={<MontBlancCIC />} />
      <Route path="/can-i-climb/kilimanjaro" element={<KilimanjaroCIC />} />

      {/* Mountains */}
      <Route path="/mountains" element={<Mountains />} />
      <Route path="/mountains/mont-blanc" element={<MontBlancMtn />} />
      <Route path="/mountains/kilimanjaro" element={<KilimanjaroMtn />} />
      <Route path="/mountains/matterhorn" element={<MatterhornMtn />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);
