import React from "react";
import { Link } from "react-router-dom";
import logoPath from "../../../summit-ready/assets/images/logo.gif";

export default function Privacy() {
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
        <p className="text-muted-foreground mb-12">Last updated: May 2025</p>

        <div className="prose prose-invert max-w-none space-y-10 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Information We Collect</h2>
            <p>When you use SummitReady, we collect information you provide directly — such as your fitness assessment answers, target summit, and training logs — as well as usage data to improve the app experience.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. How We Use Your Information</h2>
            <p>We use your data solely to generate and personalise your training plan, calculate your Readiness Score, and improve the SummitReady service. We do not sell your personal data to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Data Storage</h2>
            <p>Your training data is stored securely. We use industry-standard encryption in transit and at rest. You may request deletion of your account and all associated data at any time by contacting us.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Third-Party Services</h2>
            <p>SummitReady uses RevenueCat for subscription management. Their privacy policy applies to payment and subscription data. We may use analytics services to understand aggregate usage patterns.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal data. To exercise these rights, contact us at <a href="mailto:hello@summitready.uk" className="text-primary hover:underline">hello@summitready.uk</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Changes to This Policy</h2>
            <p>We may update this policy from time to time. We will notify you of significant changes via the app or email.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Contact</h2>
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
