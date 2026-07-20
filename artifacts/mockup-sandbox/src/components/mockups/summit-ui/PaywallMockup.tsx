import React, { useState } from 'react';
import { MapPin, TrendingUp, Navigation, Activity, Cpu, X, Zap, Gift } from 'lucide-react';

const G = '#3ECF75';
const GDIM = 'rgba(62,207,117,0.08)';
const GBORDER = 'rgba(62,207,117,0.25)';
const SURFACE = '#111827';
const BORDER = 'rgba(255,255,255,0.08)';
const MUTED = '#6B7280';
const DIM = '#374151';
const WHITE = '#F9FAFB';

const FEATURES = [
  { Icon: MapPin,     title: 'Personalised summit training',   desc: 'Plans built entirely around your mountain, date, and fitness' },
  { Icon: TrendingUp, title: 'Adaptive progression plans',     desc: 'Your plan updates as you train — smarter every week' },
  { Icon: Navigation, title: 'Local hikes matched to fitness', desc: 'Unlimited hill recommendations near you' },
  { Icon: Activity,   title: 'Summit readiness tracking',      desc: 'Know exactly how ready you are, week by week' },
  { Icon: Cpu,        title: 'AI-powered coaching insights',   desc: 'Get personalised feedback from your AI summit coach' },
];

export default function PaywallMockup() {
  const [plan, setPlan] = useState<'monthly' | 'annual'>('monthly');

  return (
    <div style={{
      width: 390,
      minHeight: 844,
      background: 'linear-gradient(180deg, #0A0C10 0%, #0D1A12 50%, #0A0C10 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
      color: WHITE,
      overflowY: 'auto',
      margin: '0 auto',
    }}>
      <div style={{ padding: '52px 24px 48px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={18} color={MUTED} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg, #3ECF75, #2AB860)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>S</span>
            </div>
            <span style={{ fontSize: 17, fontWeight: 800, color: WHITE, letterSpacing: -0.3 }}>SummitReady</span>
          </div>
          <div style={{ width: 36 }} />
        </div>

        {/* Hero */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: GDIM, borderRadius: 20,
            padding: '5px 12px',
            border: `1px solid ${GBORDER}`,
          }}>
            <Zap size={12} color={G} />
            <span style={{ fontSize: 11, fontWeight: 700, color: G, letterSpacing: 0.8 }}>SUMMIT READY PRO</span>
          </div>
          <h1 style={{
            fontSize: 26, fontWeight: 700, color: WHITE,
            textAlign: 'center', lineHeight: 1.3, margin: 0, letterSpacing: -0.3,
          }}>
            Give Yourself The Best Chance Of Reaching The Summit
          </h1>
          <p style={{
            fontSize: 15, color: MUTED, textAlign: 'center',
            lineHeight: 1.5, margin: 0,
          }}>
            Train smarter with personalised mountain preparation designed around your summit goal.
          </p>
        </div>

        {/* Trial + Plans */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            background: GDIM, borderRadius: 12,
            padding: '10px 14px',
            border: `1px solid ${GBORDER}`,
          }}>
            <Gift size={14} color={G} />
            <span style={{ fontSize: 13, fontWeight: 600, color: G }}>7-day free trial included — cancel anytime</span>
          </div>

          <p style={{ fontSize: 15, fontWeight: 700, color: WHITE, margin: 0 }}>Then choose your plan</p>

          <div style={{ display: 'flex', gap: 10 }}>
            {/* Monthly */}
            <button
              onClick={() => setPlan('monthly')}
              style={{
                flex: 1, background: plan === 'monthly'
                  ? `linear-gradient(135deg, ${GDIM} 0%, transparent 100%)`
                  : SURFACE,
                border: plan === 'monthly' ? `1.5px solid ${G}` : `1px solid ${BORDER}`,
                borderRadius: 16, padding: 14, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                position: 'relative',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>Monthly</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: plan === 'monthly' ? G : WHITE }}>£3.99</span>
              <span style={{ fontSize: 11, color: DIM }}>per month</span>
            </button>

            {/* Annual */}
            <button
              onClick={() => setPlan('annual')}
              style={{
                flex: 1, background: plan === 'annual'
                  ? `linear-gradient(135deg, ${GDIM} 0%, transparent 100%)`
                  : SURFACE,
                border: plan === 'annual' ? `1.5px solid ${G}` : `1px solid ${BORDER}`,
                borderRadius: 16, padding: 14, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}
            >
              <div style={{
                background: 'rgba(62,207,117,0.2)', borderRadius: 6,
                padding: '2px 7px', marginBottom: 4,
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: G, letterSpacing: 0.5 }}>BEST VALUE</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>Annual</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: plan === 'annual' ? G : WHITE }}>£29.99</span>
              <span style={{ fontSize: 11, color: DIM }}>per year</span>
            </button>
          </div>
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <button style={{
            width: '100%', borderRadius: 18, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #3ECF75, #2AB860)',
            padding: '17px 0',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <Zap size={18} color="#fff" />
            <span style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Start 7-Day Free Trial</span>
          </button>

          <span style={{ fontSize: 12, color: DIM }}>Cancel anytime · No commitment</span>

          <button style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '6px 0',
          }}>
            <span style={{ fontSize: 13, color: MUTED, textDecoration: 'underline' }}>Restore purchases</span>
          </button>
        </div>

        {/* Features */}
        <div style={{
          background: SURFACE, borderRadius: 20,
          border: `1px solid ${BORDER}`,
          padding: 16, display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {FEATURES.map(({ Icon, title, desc }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, background: GDIM,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon size={16} color={G} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: WHITE }}>{title}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 1.45 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Legal footer */}
        <p style={{
          fontSize: 10, color: DIM, textAlign: 'center', lineHeight: 1.5, margin: 0,
        }}>
          Payment will be charged to your Apple ID account at confirmation of purchase. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. Manage or cancel in your App Store account settings.
        </p>

      </div>
    </div>
  );
}
