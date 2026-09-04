import React from 'react';
import { ArrowRight, ChevronDown, MapPin, Mountain, Route, ShieldCheck, Smartphone, Target, TrendingUp } from 'lucide-react';
import './_group.css';

const appStore = 'https://testflight.apple.com/join/PbT6NbZn';
const playStore = 'https://play.google.com/store/apps/details?id=uk.summitready.app';

function StoreButtons() {
  return (
    <div className="sr-actions">
      <a className="sr-button sr-button-primary" href={appStore} target="_blank" rel="noreferrer"><Smartphone size={14} />&nbsp; Download for iOS</a>
      <a className="sr-button sr-button-ghost" href={playStore} target="_blank" rel="noreferrer">Google Play&nbsp; <ArrowRight size={14} /></a>
    </div>
  );
}

export function Redesign() {
  return (
    <main className="sr-redesign">
      <section className="sr-hero" id="top">
        <nav className="sr-nav" aria-label="Primary navigation">
          <div className="sr-nav-inner">
            <a href="#top" className="sr-logo"><span className="sr-mark" aria-hidden="true">⌃</span> SummitReady</a>
            <div className="sr-nav-links" style={{display:'flex',gap:24,alignItems:'center'}}>
              <a href="#approach">Our approach</a><a href="#features">Features</a><a href="#guides">Guides</a><a href="#start" className="sr-button sr-button-primary">Get started</a>
            </div>
          </div>
        </nav>
        <div className="sr-hero-copy">
          <div className="sr-eyebrow">Train local · summit anywhere</div>
          <h1>Train for any<br /><em>mountain.</em><br />on local hills.</h1>
          <p>SummitReady turns the hills near your home into a personalised training ground for the mountain you are dreaming about.</p>
          <StoreButtons />
        </div>
        <div className="sr-scroll"><ChevronDown size={14} /> Scroll to explore</div>
      </section>

      <div className="sr-band"><div className="sr-band-inner"><span><MapPin size={13} /> Hills near you</span><span><Target size={13} /> Plans for your peak</span><span><TrendingUp size={13} /> Readiness that moves</span><span><ShieldCheck size={13} /> Built for real goals</span></div></div>

      <section className="sr-section" id="approach">
        <div className="sr-intro">
          <div><div className="sr-eyebrow" style={{color:'var(--green-deep)'}}>Built for real adventures</div><h2>Everything you need to reach the summit.</h2></div>
          <div><p>Most of us do not live beside the Alps. That should not decide what we are capable of. SummitReady translates your target mountain into steady, useful work you can do close to home.</p><p className="sr-note">No generic plans. No heroic guesswork. Just a clearer way to prepare.</p></div>
        </div>
      </section>

      <section className="sr-section" id="features">
        <div className="sr-feature">
          <div className="sr-photo sr-photo-map"><span className="sr-caption">Your terrain · mapped to your goal</span></div>
          <div><div className="sr-eyebrow" style={{color:'var(--green-deep)'}}>01 / Local terrain</div><h2>Your hills.<br />Your mountain's demands.</h2><p>Tell us where you are and SummitReady finds the hills within reach. Their elevation, distance and steepness become meaningful sessions in your week.</p><div className="sr-list"><div className="sr-list-item"><b className="sr-list-num">01</b><div><strong>Find your training ground</strong><span>Local hills, mapped by elevation and matched to your fitness.</span></div></div><div className="sr-list-item"><b className="sr-list-num">02</b><div><strong>Build useful strength</strong><span>Hill climbs, rucks and time on feet that mirror the real thing.</span></div></div></div></div>
        </div>
      </section>

      <section className="sr-dark">
        <div className="sr-section">
          <div className="sr-feature reverse">
            <div className="sr-phone-wrap">
              <div className="sr-phone" aria-label="SummitReady app preview"><div className="sr-phone-top" /><div className="sr-phone-image" /><div className="sr-phone-content"><small>Your goal</small><h3>Mont Blanc</h3><small>Readiness</small><div className="sr-meter"><i /></div><span className="sr-score">72</span><small> &nbsp; / 100 · building</small></div></div>
              <div className="sr-float-card"><b>2,340 m</b><span>vertical trained this week</span></div>
            </div>
            <div><div className="sr-eyebrow">02 / Your training plan</div><h2>Turn big goals into real progress.</h2><p>Choose your mountain, tell us your goal and we will create a personalised training plan around your life. See sessions, rest days and your progress in one calm place.</p><div className="sr-actions"><a className="sr-button sr-button-primary" href="#start">See how it works <ArrowRight size={14} /></a></div></div>
          </div>
          <div className="sr-steps"><div className="sr-step"><b>01</b><h3>Pick your peak</h3><p>From Ben Nevis to Kilimanjaro, start with the mountain that matters to you.</p></div><div className="sr-step"><b>02</b><h3>Set your rhythm</h3><p>Tell us your timeline, your starting point and where you can train.</p></div><div className="sr-step"><b>03</b><h3>Keep moving</h3><p>Log sessions, adapt your week and watch your readiness climb.</p></div></div>
        </div>
      </section>

      <section className="sr-section">
        <div className="sr-feature">
          <div><div className="sr-eyebrow" style={{color:'var(--green-deep)'}}>03 / Readiness tracking</div><h2>Know when you are ready.</h2><p>Your Readiness Score brings your training together — aerobic capacity, muscular endurance and the consistency that makes a summit day feel possible.</p><div className="sr-list"><div className="sr-list-item"><Mountain className="sr-list-num" size={18} /><div><strong>Progress you can understand</strong><span>See what is improving and where your next useful effort lies.</span></div></div><div className="sr-list-item"><Route className="sr-list-num" size={18} /><div><strong>A plan that flexes with life</strong><span>Miss a session? Your upcoming week adjusts without losing the thread.</span></div></div></div></div>
          <div className="sr-photo sr-photo-climb"><span className="sr-caption">The honest number · before summit day</span></div>
        </div>
      </section>

      <section className="sr-resource" id="guides"><div className="sr-section"><div className="sr-intro"><div><div className="sr-eyebrow" style={{color:'var(--green-deep)'}}>Free mountain resources</div><h2>Start with the mountain. Build from there.</h2></div><p>Explore practical guides for the routes people ask us about most. Honest preparation for ordinary people with extraordinary plans.</p></div><div className="sr-resource-grid"><article className="sr-resource-card"><div className="sr-eyebrow">Training guide · 4,808m</div><h3>Mont Blanc</h3><p>A complete 12–16 week plan for endurance, strength, altitude preparation and the common mistakes worth avoiding.</p><a href="/training-guides/mont-blanc-training-plan" className="sr-button sr-button-primary">Read the guide <ArrowRight size={14} /></a></article><article className="sr-resource-card"><div className="sr-eyebrow">Training guide · 5,895m</div><h3>Kilimanjaro</h3><p>Build the cardiovascular base and back-to-back endurance for Africa's highest peak.</p><a href="/training-guides/kilimanjaro-training-plan" className="sr-button sr-button-ghost">Read the guide <ArrowRight size={14} /></a></article></div></div></section>

      <section className="sr-cta" id="start"><div className="sr-cta-inner"><div className="sr-eyebrow" style={{color:'var(--green)'}}>Your next summit starts here</div><h2>Make the hills count.</h2><p>Download SummitReady, complete the short questionnaire and get a personalised plan built around your mountain, your terrain and your life.</p><StoreButtons /></div></section>
      <footer><div className="sr-footer-inner"><div><div className="sr-logo"><span className="sr-mark" aria-hidden="true">⌃</span> SummitReady</div><p>Train where you live. Summit anywhere.</p></div><div className="sr-footer-links"><div><div className="sr-eyebrow">Product</div><p><a href="#features">Features</a><br /><a href="#guides">Training guides</a><br /><a href="/mountains">Mountains</a></p></div><div><div className="sr-eyebrow">Support</div><p><a href="/can-i-climb">Am I ready?</a><br /><a href="mailto:hello@summitready.uk">Contact</a><br /><a href="/privacy">Privacy</a></p></div></div></div><div style={{maxWidth:1200,margin:'42px auto 0',borderTop:'1px solid rgba(255,255,255,.12)',paddingTop:18}}><p>© {new Date().getFullYear()} SummitReady. All rights reserved.</p></div></footer>
    </main>
  );
}