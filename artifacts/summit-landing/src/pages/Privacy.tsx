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
        <p className="text-muted-foreground mb-12">Last updated: July 2026</p>

        <div className="prose prose-invert max-w-none space-y-10 text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Who We Are</h2>
            <p>SummitReady is a UK-based service ("we", "us", "our") providing personalised mountain training plans through our mobile app and website at summitready.uk. This policy explains what personal data we collect, how we use it, and your rights under UK GDPR and the Data Protection Act 2018.</p>
            <p className="mt-3">For any privacy enquiries, contact us at <a href="mailto:support@summitready.uk" className="text-primary hover:underline">support@summitready.uk</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. What Data We Collect</h2>
            <p>We collect the following categories of data when you use SummitReady:</p>

            <h3 className="text-base font-bold text-white mt-5 mb-2">Account Information</h3>
            <p>When you create an account — whether by email/password, Sign in with Apple, or Sign in with Google — we collect your name and email address. Authentication is handled by Clerk (see Section 5). For social sign-in, Clerk receives a token from Apple or Google; we do not receive your Apple ID or Google password.</p>

            <h3 className="text-base font-bold text-white mt-5 mb-2">Fitness and Training Data</h3>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Fitness assessment answers (current fitness level, training goals)</li>
              <li>Your target summit and planned route</li>
              <li>Workout logs and hike session history</li>
              <li>Summit readiness score</li>
            </ul>

            <h3 className="text-base font-bold text-white mt-5 mb-2">Location Data</h3>
            <p>SummitReady requests access to your device location for two purposes:</p>
            <ul className="list-disc ml-6 mt-2 space-y-2">
              <li><strong className="text-white">Foreground location</strong> — to find hills and hiking trails near you and pre-populate your training plan with local terrain.</li>
              <li><strong className="text-white">Background location (during active hike tracking only)</strong> — when you start a hike recording session, the app continues tracking your GPS position even when your screen is locked, so your route is recorded accurately. Background tracking stops as soon as you end the session.</li>
            </ul>
            <p className="mt-3">Your precise location data is used to provide the service and is not sold to advertisers. You can deny or revoke location permission at any time in your device Settings. If you deny foreground location, you can search for hills manually. If you deny background location, hike tracking will still work but may be less accurate when the screen is locked.</p>

            <h3 className="text-base font-bold text-white mt-5 mb-2">Analytics and Usage Data</h3>
            <p>On Android, we use Firebase Analytics to collect anonymised usage events such as screen views, training session completions, and feature interactions. This helps us understand how the app is used and improve it. Firebase Analytics data is processed by Google — see Section 5 for details.</p>

            <h3 className="text-base font-bold text-white mt-5 mb-2">Subscription and Purchase Data</h3>
            <p>If you subscribe to SummitReady Pro, your subscription status and entitlements are managed by RevenueCat. Payment transactions themselves are processed directly by Apple (App Store) or Google (Google Play) — we do not receive or store your payment card details.</p>

            <h3 className="text-base font-bold text-white mt-5 mb-2">Device Information</h3>
            <p>We may collect basic device information (operating system, device type, app version) for diagnostic and support purposes.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. How We Use Your Data</h2>
            <p>We use your data to:</p>
            <ul className="list-disc ml-6 mt-3 space-y-2">
              <li>Create and personalise your mountain training plan and Readiness Score</li>
              <li>Find local hills and trails suited to your fitness level and summit goal</li>
              <li>Record and display your hike sessions and training history</li>
              <li>Process and manage your subscription payments</li>
              <li>Improve the app through anonymised usage analytics</li>
              <li>Respond to your support enquiries</li>
            </ul>
            <p className="mt-4">Our legal basis for processing is <strong className="text-white">contract performance</strong> (delivering the service you signed up for) and <strong className="text-white">legitimate interests</strong> (improving the product). For location data, processing is based on your explicit consent (the permission prompt on your device).</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Data Retention and Deletion</h2>
            <p>We retain your account and training data for as long as your account is active. If you delete your account, your personal data is removed from our systems within 30 days.</p>
            <p className="mt-3">The app includes an in-app <strong className="text-white">Delete Account</strong> feature (found in the Account tab) which permanently deletes your account and all associated training data. You can also request deletion by emailing <a href="mailto:support@summitready.uk" className="text-primary hover:underline">support@summitready.uk</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Third-Party Services</h2>
            <p>SummitReady works with the following third-party services, each of which has its own privacy policy:</p>
            <ul className="list-disc ml-6 mt-3 space-y-3">
              <li>
                <strong className="text-white">Clerk</strong> — handles user authentication including email/password, Sign in with Apple, and Sign in with Google. Clerk processes your email address and authentication tokens.{" "}
                <a href="https://clerk.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">clerk.com/privacy</a>
              </li>
              <li>
                <strong className="text-white">Firebase Analytics (Google)</strong> — anonymised usage analytics on Android. Data is processed by Google LLC.{" "}
                <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">firebase.google.com/support/privacy</a>
              </li>
              <li>
                <strong className="text-white">RevenueCat</strong> — subscription and entitlement management. RevenueCat processes your subscription status and receipt data.{" "}
                <a href="https://www.revenuecat.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">revenuecat.com/privacy</a>
              </li>
              <li>
                <strong className="text-white">Apple App Store</strong> — processes in-app purchase transactions for iOS users. Subject to Apple's privacy policy at{" "}
                <a href="https://www.apple.com/legal/privacy/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">apple.com/legal/privacy</a>
              </li>
              <li>
                <strong className="text-white">Google Play</strong> — processes in-app purchase transactions for Android users. Subject to Google's privacy policy at{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">policies.google.com/privacy</a>
              </li>
              <li>
                <strong className="text-white">OpenAI</strong> — powers AI coaching insights and personalised training guidance. Training data sent to OpenAI is processed in accordance with{" "}
                <a href="https://openai.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">openai.com/privacy</a>
              </li>
            </ul>
            <p className="mt-4">We do not sell your personal data to any third party.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. International Data Transfers</h2>
            <p>Some of our third-party providers (including Clerk, Firebase, RevenueCat, and OpenAI) are based in the United States. Where your data is transferred outside the UK, we ensure appropriate safeguards are in place — including the UK International Data Transfer Agreement or reliance on providers' Standard Contractual Clauses — in accordance with UK GDPR Chapter V.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Children's Privacy</h2>
            <p>SummitReady is not directed at children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal data, please contact us at <a href="mailto:support@summitready.uk" className="text-primary hover:underline">support@summitready.uk</a> and we will delete it promptly.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Your Rights Under UK GDPR</h2>
            <p>As a UK resident, you have the following rights regarding your personal data:</p>
            <ul className="list-disc ml-6 mt-3 space-y-2">
              <li><strong className="text-white">Access</strong> — request a copy of the personal data we hold about you</li>
              <li><strong className="text-white">Rectification</strong> — ask us to correct inaccurate data</li>
              <li><strong className="text-white">Erasure</strong> — request deletion of your personal data (also available in-app via Delete Account)</li>
              <li><strong className="text-white">Restriction</strong> — ask us to stop processing your data in certain circumstances</li>
              <li><strong className="text-white">Portability</strong> — receive your data in a structured, machine-readable format</li>
              <li><strong className="text-white">Object</strong> — object to processing based on legitimate interests</li>
              <li><strong className="text-white">Withdraw consent</strong> — withdraw location permission at any time via your device Settings</li>
            </ul>
            <p className="mt-4">To exercise any of these rights, email us at <a href="mailto:support@summitready.uk" className="text-primary hover:underline">support@summitready.uk</a>. We will respond within 30 days. You also have the right to lodge a complaint with the <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Information Commissioner's Office (ICO)</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">9. Changes to This Policy</h2>
            <p>We may update this policy from time to time. We will notify you of significant changes via the app or by email. The "last updated" date at the top of this page will always reflect the most recent revision.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">10. Contact</h2>
            <p>Questions about this policy? Email us at <a href="mailto:support@summitready.uk" className="text-primary hover:underline">support@summitready.uk</a>.</p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-white/5">
          <Link to="/" className="text-primary hover:underline text-sm">← Back to SummitReady</Link>
        </div>
      </main>
    </div>
  );
}
