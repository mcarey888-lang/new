import React from "react";
import { Link } from "react-router-dom";
import logoPath from "../assets/logo.gif";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function Privacy() {
  usePageMeta({
    title: "Privacy Policy — SummitReady",
    description: "Read the SummitReady privacy policy to learn how we collect, use, and protect your data.",
  });
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-white/5 py-4">
        <div className="container mx-auto px-6 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src={logoPath} alt="SummitReady Logo" className="h-8 w-auto" />
            <span className="font-display font-bold text-lg tracking-tight">SummitReady</span>
          </Link>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-20 max-w-3xl">
        <h1 className="text-4xl font-display font-bold text-white mb-4">Privacy Policy</h1>
        <p className="text-muted-foreground mb-12">Last updated: May 2026</p>

        <div className="prose prose-invert max-w-none space-y-10 text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Information We Collect</h2>
            <p>When you use SummitReady, we collect information you provide directly — such as your fitness assessment answers, target summit, and training logs — as well as usage data to improve the app experience.</p>
            <ul className="list-disc ml-6 mt-3 space-y-1">
              <li>Fitness and health data you enter (e.g. current fitness level, training goals)</li>
              <li>Your target summit and planned route</li>
              <li>Workout logs and session history</li>
              <li>Device location data (when you grant permission — see Section 2)</li>
              <li>App usage and performance data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Location Data</h2>
            <p>SummitReady requests access to your device's location <strong className="text-white">only while the app is open</strong> (foreground location). We never collect your location in the background.</p>
            <p className="mt-3">We use your location solely to:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Find hiking trails and hills close to where you are</li>
              <li>Pre-populate the trail search with nearby results so you can start training immediately</li>
            </ul>
            <p className="mt-3">Your precise coordinates are used momentarily to search for nearby trails and are not stored on our servers or shared with third parties. You can deny or revoke location permission at any time in your device settings — the app will continue to work; you will simply need to enter your location manually.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. How We Use Your Information</h2>
            <p>We use your data solely to generate and personalise your training plan, calculate your Readiness Score, and improve the SummitReady service. We do not sell your personal data to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Data Storage</h2>
            <p>Your training data is stored securely. We use industry-standard encryption in transit and at rest. You may request deletion of your account and all associated data at any time by contacting us.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Third-Party Services</h2>
            <p>SummitReady uses the following third-party services, each with their own privacy policy:</p>
            <ul className="list-disc ml-6 mt-3 space-y-2">
              <li><strong className="text-white">RevenueCat</strong> — subscription and payment management. Their privacy policy is available at <a href="https://www.revenuecat.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">revenuecat.com/privacy</a>.</li>
              <li><strong className="text-white">Mapbox</strong> — interactive trail maps and satellite imagery. Their privacy policy is available at <a href="https://www.mapbox.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">mapbox.com/legal/privacy</a>.</li>
              <li><strong className="text-white">OpenAI</strong> — AI-generated training plans and trail recommendations. Their privacy policy is available at <a href="https://openai.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">openai.com/privacy</a>.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Children's Privacy</h2>
            <p>SummitReady is not directed at children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal data, please contact us and we will delete it promptly.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal data. To exercise these rights, contact us at <a href="mailto:hello@summitready.uk" className="text-primary hover:underline">hello@summitready.uk</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Changes to This Policy</h2>
            <p>We may update this policy from time to time. We will notify you of significant changes via the app or email. The "last updated" date at the top of this page will always reflect the most recent revision.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">9. Contact</h2>
            <p>Questions about this policy? Email us at <a href="mailto:hello@summitready.uk" className="text-primary hover:underline">hello@summitready.uk</a>.</p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-white/5">
          <Link to="/" className="text-primary hover:underline text-sm">← Back to SummitReady</Link>
        </div>
      </main>
    </div>
  );
}
