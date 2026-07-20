import React from "react";
import { Link } from "react-router-dom";
import logoPath from "../assets/logo.gif";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function Terms() {
  usePageMeta({
    title: "Terms of Use — SummitReady",
    description: "Read the SummitReady Terms of Use covering your rights, subscription terms, health disclaimer, and our usage policies.",
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
        <h1 className="text-4xl font-display font-bold text-white mb-4">Terms of Use</h1>
        <p className="text-muted-foreground mb-12">Last updated: July 2026</p>

        <div className="prose prose-invert max-w-none space-y-10 text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By downloading, installing, or using the SummitReady app or website (summitready.uk), you agree to be bound by these Terms of Use. If you do not agree to these terms, please do not use the service.</p>
            <p className="mt-3">You must be at least 16 years old to create an account and use SummitReady.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Description of Service</h2>
            <p>SummitReady provides personalised mountain and hill training plans, a Summit Readiness Score, local hill and trail discovery, hike tracking, and AI-powered coaching insights. The service is designed to help you prepare for mountain goals using the terrain near you.</p>
            <p className="mt-3">The service is provided for fitness and informational purposes only. It does not constitute medical advice, professional athletic coaching, or mountaineering guidance. See Section 4 (Health and Safety Disclaimer).</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Subscriptions and Payments</h2>

            <h3 className="text-base font-bold text-white mt-4 mb-2">Free Trial</h3>
            <p>SummitReady Pro includes a <strong className="text-white">7-day free trial</strong> for new subscribers. You will not be charged during the trial period. If you do not cancel before the trial ends, your subscription will automatically convert to a paid subscription.</p>

            <h3 className="text-base font-bold text-white mt-4 mb-2">Auto-Renewal</h3>
            <p>SummitReady Pro is an auto-renewing subscription. Your subscription will automatically renew at the end of each billing period (monthly or annual, as selected) unless you cancel at least <strong className="text-white">24 hours before the end of the current period</strong>.</p>

            <h3 className="text-base font-bold text-white mt-4 mb-2">Cancellation</h3>
            <p>You can cancel your subscription at any time through your App Store or Google Play account settings:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li><strong className="text-white">iOS:</strong> Settings → [your name] → Subscriptions → SummitReady</li>
              <li><strong className="text-white">Android:</strong> Google Play Store → Account → Subscriptions → SummitReady</li>
            </ul>
            <p className="mt-3">Cancellation takes effect at the end of the current billing period. You will retain access to Pro features until then. No refunds are issued for unused portions of a subscription period, except as required by applicable law.</p>

            <h3 className="text-base font-bold text-white mt-4 mb-2">Pricing</h3>
            <p>Subscription prices are set in your local currency and displayed before purchase. Prices may change from time to time; we will provide reasonable notice of any price changes before they take effect. Continued use of the subscription after a price change constitutes acceptance of the new price.</p>

            <h3 className="text-base font-bold text-white mt-4 mb-2">Payment Processing</h3>
            <p>All payments are processed by Apple (App Store) or Google (Google Play). These transactions are governed by their respective terms of service. We do not store your payment card details.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Health and Safety Disclaimer</h2>
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 mt-4">
              <p className="font-semibold text-white mb-3">Please read this section carefully.</p>
              <ul className="space-y-3">
                <li><strong className="text-white">Not medical advice.</strong> The training plans, readiness scores, and coaching insights provided by SummitReady are generated for general fitness guidance only. They are not a substitute for advice from a qualified physician, physiotherapist, or certified mountain guide.</li>
                <li><strong className="text-white">Consult a doctor first.</strong> Before starting any new exercise programme — including those generated by SummitReady — you should consult a qualified healthcare provider, particularly if you have any pre-existing medical conditions, injuries, or health concerns.</li>
                <li><strong className="text-white">Mountain and outdoor activities carry inherent risk.</strong> Hill walking, mountain climbing, and related activities involve serious risks including terrain hazards, adverse weather, altitude sickness, and physical injury. SummitReady's hill and trail recommendations are provided for planning purposes. You are solely responsible for assessing conditions on the day and deciding whether it is safe to proceed.</li>
                <li><strong className="text-white">Use at your own risk.</strong> SummitReady does not accept responsibility for injury, illness, loss, or damage arising from following training plans, hike recommendations, or any other content provided by the service.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. User Responsibilities</h2>
            <p>When using SummitReady, you agree to:</p>
            <ul className="list-disc ml-6 mt-3 space-y-2">
              <li>Provide accurate fitness and health information so the training plans generated are appropriate for your level</li>
              <li>Use the service only for lawful purposes</li>
              <li>Not attempt to reverse-engineer, copy, or redistribute any part of the service without written permission</li>
              <li>Not share your account credentials with others</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Intellectual Property</h2>
            <p>All content, branding, software, training algorithms, and data within SummitReady are owned by or licensed to SummitReady and protected by applicable intellectual property laws. Nothing in these terms grants you any right to use our trademarks, logos, or branding without prior written consent.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Disclaimer of Warranties</h2>
            <p>SummitReady is provided <strong className="text-white">"as is" and "as available"</strong> without warranty of any kind, express or implied. We do not warrant that the service will be uninterrupted, error-free, or free of viruses or other harmful components. We do not warrant the accuracy or completeness of any training plan, readiness score, hill profile, or trail data.</p>
            <p className="mt-3">To the fullest extent permitted by law, we disclaim all implied warranties, including those of merchantability, fitness for a particular purpose, and non-infringement.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Limitation of Liability</h2>
            <p>To the fullest extent permitted by applicable law, SummitReady's total liability to you for any claims arising out of or related to these terms or the service shall not exceed the amount you paid for the service in the 12 months prior to the claim.</p>
            <p className="mt-3">We are not liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or goodwill, whether arising from the use or inability to use the service, or from participation in activities recommended by the service.</p>
            <p className="mt-3">Nothing in these terms limits our liability for death or personal injury caused by our negligence, fraud, or any other liability that cannot be excluded by law.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">9. Changes to the Service and Terms</h2>
            <p>We may update these Terms of Use at any time. When we make material changes, we will notify you via the app or by email. The updated terms will be effective from the date of posting. Continued use of SummitReady after that date constitutes your acceptance of the revised terms.</p>
            <p className="mt-3">We may also modify, suspend, or discontinue features of the service at any time, including during the free trial or subscription period, with reasonable notice where possible.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">10. Governing Law</h2>
            <p>These Terms of Use are governed by and construed in accordance with the laws of <strong className="text-white">England and Wales</strong>. Any disputes arising under these terms shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">11. Contact</h2>
            <p>Questions about these terms? Email us at <a href="mailto:support@summitready.uk" className="text-primary hover:underline">support@summitready.uk</a>.</p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-white/5">
          <Link to="/" className="text-primary hover:underline text-sm">← Back to SummitReady</Link>
        </div>
      </main>
    </div>
  );
}
