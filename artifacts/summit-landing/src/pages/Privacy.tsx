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
        <p className="text-muted-foreground mb-12">Last updated: 29 October 2026</p>

        <div className="prose prose-invert max-w-none space-y-10 text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Who We Are</h2>
            <p>SummitReady is a UK-based mountain discovery, hike recording, expedition, community and personalised training service ("we", "us", "our"). This policy covers our iOS and Android apps, browser app and website at summitready.uk, including Explore Free, Expeditions and Pro. It explains our use of personal data and your rights under UK GDPR and the Data Protection Act 2018.</p>
            <p className="mt-3">For any privacy enquiries, contact us at <a href="mailto:support@summitready.uk" className="text-primary hover:underline">support@summitready.uk</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. What Data We Collect</h2>
            <p>We collect the following categories of data when you use SummitReady:</p>

            <h3 className="text-base font-bold text-white mt-5 mb-2">Account Information</h3>
            <p>When you create an account by email/password, Sign in with Apple or Sign in with Google, Clerk handles authentication. Account data includes your name or display name, email address (which may be an Apple relay address), account ID, sign-in/session information and any profile image supplied through sign-in. We use account IDs to associate saved activity, community content and subscriptions with you. We do not receive your Apple or Google password.</p>

            <h3 className="text-base font-bold text-white mt-5 mb-2">Fitness and Training Data</h3>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Fitness assessment answers (current fitness level, training goals)</li>
              <li>Your target summit and planned route</li>
              <li>Workout logs and hike session history</li>
              <li>Summit readiness score</li>
              <li>Saved expeditions, stage selections, completion evidence, achievements and manual activity totals</li>
              <li>Recorded distance, ascent, duration, timestamps, route points and optional activity notes or photos</li>
            </ul>
            <p className="mt-3">Some information is kept on your device; records submitted for backup, community features, activity verification or AI guidance are processed by our servers and relevant providers. Locally stored information is not necessarily synchronised across devices. Fitness information can reveal information about your health; please avoid including medical or other sensitive details in free-text questions or public posts.</p>

            <h3 className="text-base font-bold text-white mt-5 mb-2">Location Data</h3>
            <p>SummitReady requests access to your device location for two purposes:</p>
            <ul className="list-disc ml-6 mt-2 space-y-2">
              <li><strong className="text-white">Foreground location</strong> — to find hills and hiking trails near you and pre-populate your training plan with local terrain.</li>
              <li><strong className="text-white">Background location (during active hike tracking only)</strong> — when you start a hike recording session, the app continues tracking your GPS position even when your screen is locked, so your route is recorded accurately. Background tracking stops as soon as you end the session.</li>
            </ul>
            <p className="mt-3">Saved GPS routes, coordinates and activity timestamps uploaded to us are linked to your account; they are not anonymous location data. Search places, map areas, route endpoints and forecast locations may also be sent to mapping, search, routing or weather providers. Sharing a route can reveal where you have been. We do not send your GPS track to Reddit through our conversion integration. You can revoke location permission in device settings, but that does not delete previously saved records. Manual searches remain available without device location permission; background recording may be less reliable without background permission.</p>

            <h3 className="text-base font-bold text-white mt-5 mb-2">Community, Photos and Profile Covers</h3>
            <p>We process posts, captions, comments, likes, follows, shared routes, moderation reports and photos you choose to upload, including profile covers. These records are associated with account IDs. Private content is not automatically a public contribution: you choose whether to share supported content with other members. Shared content can display your name, profile image, date, caption, photo and route/activity information. Other members can view or copy content you share; deleting it cannot recall copies they have already made. Do not upload someone else's personal information without permission. Our photo upload features do not give us access to your entire photo library.</p>

            <h3 className="text-base font-bold text-white mt-5 mb-2">AI Coaching and Planning</h3>
            <p>AI features send the question you submit and relevant planning/training context to OpenAI through our hosting integration. Context can include your mountain goal, intended date, fitness level, readiness score, schedule and recent activity summaries. Your question may itself identify you or contain sensitive information. Routine coaching prompts do not need your account email or full GPS track, but service requests are authenticated and should not be treated as anonymous. Do not include medical records, passwords or unnecessary personal details. AI guidance is not medical advice.</p>

            <h3 className="text-base font-bold text-white mt-5 mb-2">Analytics and Usage Data</h3>
            <p><strong className="text-white">Android:</strong> Firebase Analytics receives screen views and events such as sign-in method, mountain/challenge selections, training and hike summaries, readiness scores, AI feature use and subscription interactions, together with SDK installation/device and app information. Our event wrapper does not attach your account ID, name or email. Installation identifiers and event details can still distinguish users; this is not a claim that the data is anonymous.</p>
            <p className="mt-3">The Android app also sends selected conversion events to Reddit through our server to measure advertising effectiveness: first open, readiness test completed, readiness score viewed, subscription/trial started and purchase. The payload includes a random persistent app-installation ID, event time and conversion ID; our server adds the request IP address and user-agent. A confirmed purchase can include plan/product, value and currency. This integration does not send your account name/email, numerical readiness score, GPS track, coaching text or photos. Reddit may match these signals with information it holds for advertising measurement. This is advertising-related sharing, even without an advertising ID.</p>
            <p className="mt-3"><strong className="text-white">iOS:</strong> our custom Firebase event and Reddit conversion calls are Android-only. The iOS app includes Firebase components, with analytics marked disabled in the supplied Firebase configuration. Authentication, subscription, hosting and other service providers still process the data needed for their services.</p>
            <p className="mt-3"><strong className="text-white">Web:</strong> the marketing website loads Google Analytics, which can use cookies/browser identifiers and receive page views, browser/device information and network information. The browser app does not invoke our Android Firebase/Reddit event wrapper. Website analytics and app account records are different data flows.</p>
            <p className="mt-3">Android analytics/conversion calls and the website analytics tag currently start automatically; there is no dedicated in-app analytics consent/opt-out setting or website consent banner. A location permission is not consent to advertising measurement. Browser privacy controls may restrict cookies; contact us to object to processing. This disclosure does not replace any consent required by applicable law.</p>

            <h3 className="text-base font-bold text-white mt-5 mb-2">Subscription and Purchase Data</h3>
            <p>For Expeditions and Pro, RevenueCat processes store transaction/receipt information, product and purchase history, subscription status, expiry, entitlement and trial eligibility information. We identify signed-in RevenueCat customers using their app account ID; an anonymous RevenueCat customer ID may exist before sign-in. Apple or Google processes native payments. We do not receive or store your payment card details. Deleting your SummitReady account does not itself cancel a store subscription; manage cancellation through Apple or Google.</p>

            <h3 className="text-base font-bold text-white mt-5 mb-2">Device Information</h3>
            <p>Our hosting and service providers process network and technical information such as IP address, user-agent, request URL, app/browser version, status/error information and timestamps to operate, secure and troubleshoot the service. Support enquiries contain the contact details and information you send us. Server requests, saved records and errors may be attributable to an account; diagnostics are not guaranteed anonymous. We do not request access to your contacts or use HealthKit/Health Connect to import medical records in the current app.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. How We Use Your Data</h2>
            <p>We use your data to:</p>
            <ul className="list-disc ml-6 mt-3 space-y-2">
              <li>Create and personalise your mountain training plan and Readiness Score</li>
              <li>Find local hills and trails suited to your fitness level and summit goal</li>
              <li>Record and display your hike sessions and training history</li>
              <li>Process and manage your subscription payments</li>
              <li>Display chosen community contributions and handle likes, comments and moderation</li>
              <li>Provide AI coaching using the question and relevant training context</li>
              <li>Improve the service using usage analytics and measure advertising conversions where used</li>
              <li>Protect accounts and investigate failures or abuse</li>
              <li>Respond to your support enquiries</li>
            </ul>
            <p className="mt-4">We rely on contract performance for account, recording, expedition, subscription and requested community/training services; legitimate interests for proportionate security and support; and legal obligations where records must be retained. Optional device permissions control access to location and selected media. Non-essential analytics and advertising technologies require a separate assessment under UK GDPR and PECR, including consent where required; a device permission is not a substitute. Fitness or other information revealing health may also require an appropriate special-category condition. We do not claim that accepting this policy supplies all of those consents.</p>
          </section>

          <section id="account-deletion">
            <h2 className="text-xl font-bold text-white mb-3">4. Data Retention and Deletion</h2>
            <p>We keep account-linked saved records while needed to provide your account and requested features. Subscription expiry does not itself erase your hike history or expedition progress. There is no automatic account-inactivity deletion schedule in the current app. Device data remains until removed through the app, account deletion or device/browser controls; other devices and downloaded copies may retain their own data.</p>
            <p className="mt-3">To request deletion in-app, open <strong className="text-white">You → Account → Delete account</strong> and confirm. The authenticated deletion flow removes the sign-in account and associated server-side hike backups, community posts/reactions, sharing preferences, owned shared routes and canonical activity records, and attempts removal of uploaded community/cover images. It also clears account-scoped data on the device performing deletion. You can request deletion without opening the app by emailing <a href="mailto:support@summitready.uk" className="text-primary hover:underline">support@summitready.uk</a> from your account email, stating that you want your SummitReady account and associated personal data deleted. We may need to verify ownership; do not send your password.</p>
            <p className="mt-3">Automated account deletion does not guarantee immediate removal of every historical record, failed image deletion, backup, server log, analytics event or third-party record. Some legacy activity records may require additional cleanup. RevenueCat, store, analytics and AI-provider records are not automatically erased by the app's account-deletion request. Contact us about remaining records or a complete erasure request. Records needed for legal, fraud-prevention or accounting purposes may be retained where permitted. Provider retention periods and backup/log expiry are not governed by a single verified 30-day deletion schedule.</p>
            <p className="mt-3">We handle rights requests without undue delay, normally within one calendar month, subject to lawful extensions. Account deletion and subscription cancellation are separate: cancel any active subscription in your Apple or Google subscription settings.</p>
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
                <strong className="text-white">Google Firebase and Google Analytics</strong> — Android app analytics and website analytics, using events and installation/browser identifiers rather than guaranteed anonymous data. Firebase components are also present in iOS as described above.{" "}
                <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">firebase.google.com/support/privacy</a>
              </li>
              <li>
                <strong className="text-white">RevenueCat</strong> — Expeditions/Pro subscription, purchase and entitlement management, associated with your app account ID after sign-in.{" "}
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
                <strong className="text-white">Reddit</strong> — Android advertising conversion measurement using the limited event, installation and network signals described in Section 2.{" "}
                <a href="https://www.reddit.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Reddit privacy policy</a>
              </li>
              <li>
                <strong className="text-white">OpenAI</strong> — powers AI coaching insights and personalised training guidance. Training data sent to OpenAI is processed in accordance with{" "}
                <a href="https://openai.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">openai.com/privacy</a>
              </li>
              <li><strong className="text-white">Replit and cloud storage/infrastructure providers</strong> — host our API, database, uploaded photos and other files, and process service requests and logs. AI requests pass through our hosting integration. <a href="https://replit.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Replit privacy policy</a></li>
              <li><strong className="text-white">Mapping, routing, search and weather providers</strong> — depending on the selected feature these include Ordnance Survey, OpenStreetMap/Overpass/Nominatim services, Mapbox, openrouteservice, WeatherAPI, and Apple/Google maps or directions. Requests may include map tile/view areas, search places or route/forecast coordinates. Providers contacted directly by your device also receive network/browser information. Opening external directions passes the chosen destination to that provider; these services have their own privacy notices.</li>
            </ul>
            <p className="mt-4">We do not sell your GPS tracks, photos or account details. We do share information with service providers to deliver the app, and with Reddit for Android advertising measurement as described above. Do not interpret this policy as a promise that no advertising-related data sharing occurs.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. International Data Transfers</h2>
            <p>Our hosting and third-party providers, including Clerk, Google, RevenueCat, Reddit and OpenAI, may process data outside the UK, including in the United States. Their processing locations and retention arrangements vary. International transfers require an applicable UK legal mechanism, such as an adequacy decision or appropriate contractual safeguards where relevant. Contact us for information about the arrangements applicable to your data; this policy does not certify that every provider's contract or transfer assessment has been independently audited.</p>
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
            <p className="mt-4">To exercise any of these rights, email us at <a href="mailto:support@summitready.uk" className="text-primary hover:underline">support@summitready.uk</a>. We normally respond within one calendar month, subject to lawful extensions. Withdrawing a device permission does not erase data already saved. You also have the right to lodge a complaint with the <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Information Commissioner's Office (ICO)</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">9. Changes to This Policy</h2>
            <p>We may update this policy as features or processing change. We publish revisions here with an updated date and provide additional notice of significant changes where required.</p>
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
