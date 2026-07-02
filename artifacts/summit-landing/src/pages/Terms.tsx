import React from "react";
import { Link } from "react-router-dom";
import logoPath from "../assets/logo.gif";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function Terms() {
  usePageMeta({
    title: "Terms of Service — SummitReady",
    description: "Read the SummitReady terms of service covering your rights, responsibilities, and our usage policies.",
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
        <h1 className="text-4xl font-display font-bold text-white mb-4">Terms of Service</h1>
        <p className="text-muted-foreground mb-12">Last updated: May 2025</p>

        <div className="prose prose-invert max-w-none space-y-10 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By downloading or using SummitReady, you agree to be bound by these Terms of Service. If you do not agree, do not use the app.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Description of Service</h2>
            <p>SummitReady provides AI-generated mountain training plans and a Readiness Score based on data you provide. The service is for informational and fitness purposes only and does not constitute medical or professional athletic advice.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Health Disclaimer</h2>
            <p>Mountain activities carry inherent risks. SummitReady training plans are AI-generated and should not replace advice from a qualified fitness professional or doctor. Always consult a healthcare provider before starting a new exercise programme.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Subscriptions and Payments</h2>
            <p>SummitReady offers a free tier and a paid subscription. Subscriptions are processed through the App Store or Google Play and are governed by their respective terms. Cancellations take effect at the end of the current billing period.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. User Responsibilities</h2>
            <p>You are responsible for providing accurate fitness information. Misrepresenting your fitness level may result in unsuitable training loads. You must be 16 or older to use SummitReady.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Intellectual Property</h2>
            <p>All content, branding, and software in SummitReady is owned by SummitReady and protected by applicable intellectual property laws. You may not reproduce or distribute any part of the service without written permission.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Limitation of Liability</h2>
            <p>SummitReady is provided "as is". We are not liable for any injury, loss, or damage arising from use of the app or participation in activities suggested by training plans.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Changes to Terms</h2>
            <p>We may update these terms at any time. Continued use of the app after changes constitutes acceptance of the new terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">9. Contact</h2>
            <p>Questions? Email us at <a href="mailto:hello@summitready.uk" className="text-primary hover:underline">hello@summitready.uk</a>.</p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-white/5">
          <Link to="/" className="text-primary hover:underline text-sm">← Back to SummitReady</Link>
        </div>
      </main>
    </div>
  );
}
