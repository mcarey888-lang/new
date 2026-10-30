import { useEffect, useState } from "react";

const KEY = "summitready_website_analytics_v1";
const ID = "G-7SM4V1G0L1";
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
export function setWebsiteMeasurement(allowed: boolean) {
  const win = window as AnalyticsWindow;
  (win as unknown as Record<string, unknown>)[`ga-disable-${ID}`] = !allowed;
  if (!allowed) {
    document.querySelector("[data-optional-analytics]")?.remove();
    win.dataLayer = [];
    win.gtag = undefined;
    // Remove first-party GA cookies on both host and parent-domain scopes.
    document.cookie.split(";").map(c => c.split("=")[0].trim())
      .filter(name => /^_ga($|_)/.test(name) || name === "_gid" || name === "_gat")
      .forEach(name => {
        for (const domain of ["", location.hostname, "." + location.hostname]) {
          document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
        }
      });
    return;
  }
  if (document.querySelector("[data-optional-analytics]")) return;
  win.dataLayer = [];
  win.gtag = function () { win.dataLayer?.push(arguments); };
  win.gtag("consent", "default", {
    analytics_storage: "granted", ad_storage: "denied",
    ad_user_data: "denied", ad_personalization: "denied",
  });
  win.gtag("js", new Date());
  win.gtag("config", ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
  const script = document.createElement("script");
  script.async = true; script.dataset.optionalAnalytics = "true";
  script.src = `https://www.googletagmanager.com/gtag/js?id=${ID}`;
  document.head.appendChild(script);
}
export function WebsitePrivacy() {
  const [choice, setChoice] = useState<string | null>(() => {
    if (document.cookie.includes("sr_measurement_declined=1")) return "no";
    try { return localStorage.getItem(KEY); } catch { return null; }
  });
  const [open, setOpen] = useState(choice !== "yes" && choice !== "no");
  const [error, setError] = useState("");
  useEffect(() => { setWebsiteMeasurement(choice === "yes"); }, [choice]);
  function choose(allowed: boolean) {
    setWebsiteMeasurement(false);
    if (!allowed) document.cookie = "sr_measurement_declined=1; Max-Age=31536000; path=/; SameSite=Lax";
    try {
      localStorage.setItem(KEY, allowed ? "yes" : "no");
      if (allowed) document.cookie = "sr_measurement_declined=; Max-Age=0; path=/; SameSite=Lax";
      setChoice(allowed ? "yes" : "no"); setWebsiteMeasurement(allowed);
      setOpen(false); setError("");
    } catch {
      setChoice("no");
      setError("This browser could not save your choice. Measurement remains off until you can save it.");
    }
  }
  return <>
    <button onClick={() => setOpen(true)} className="fixed bottom-3 left-3 z-40 rounded-lg border border-white/30 bg-slate-950 p-3 text-sm text-white">Privacy choices</button>
    {open && <section aria-label="Privacy choices" className="fixed bottom-16 left-3 right-3 z-50 mx-auto max-w-xl rounded-xl border border-white/30 bg-slate-950 p-5 text-white shadow-xl">
      <h2 className="text-lg font-semibold">Optional website analytics</h2>
      <p className="my-3 text-sm">May we use Google Analytics to measure visits and improve this website? It uses browser identifiers. Advertising storage and personalised advertising signals remain off. The website and app links work if you decline. Reopen Privacy choices to withdraw; withdrawal stops future measurement, not data already sent.</p>
      <div className="flex flex-wrap gap-3">
        <button className="rounded border px-4 py-3" onClick={() => choose(false)}>Decline / withdraw</button>
        <button className="rounded border px-4 py-3" onClick={() => choose(true)}>Allow analytics</button>
        {choice !== null && <button className="rounded border px-4 py-3" onClick={() => setOpen(false)}>Close</button>}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>}
  </>;
}
