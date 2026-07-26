import { ArrowDownIcon } from "@phosphor-icons/react/dist/ssr/ArrowDown";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { ArrowUpIcon } from "@phosphor-icons/react/dist/ssr/ArrowUp";
import { DotsThreeIcon } from "@phosphor-icons/react/dist/ssr/DotsThree";
import { Button, IconLinkButton, LinkButton } from "./components/Button";
import { BrandMark } from "./components/BrandMark";

const opportunities = [
  {
    number: "01",
    emoji: "🎯",
    title: "Vertical identity",
    text: "Digital profiles and follow-up workflows designed around one profession—realtors, recruiters, or consultants.",
    verdict: "Strong with existing distribution",
  },
  {
    number: "02",
    emoji: "⚡",
    title: "Meeting → follow-up",
    text: "Capture a person, remember the context, suggest the next action, and keep the relationship warm.",
    verdict: "Recommended",
    featured: true,
  },
  {
    number: "03",
    emoji: "🎟️",
    title: "Event lead capture",
    text: "Scan, qualify, enrich, and route event leads into a CRM while measuring pipeline and event ROI.",
    verdict: "Best as a second product",
  },
];

const phases = [
  ["Phase 0", "Validate", "Interview 10–15 consultants, prototype the journey, and run a concierge pilot.", "1–2 weeks"],
  ["Phase 1", "Card + capture", "Profile editor, public card, QR, vCard, reciprocal details, and contact list.", "2–3 weeks"],
  ["Phase 2", "Context + action", "Meeting notes, voice capture, AI extraction, follow-up drafts, and reminders.", "2–3 weeks"],
  ["Phase 3", "Pilot hardening", "Analytics, imports, deduplication, privacy controls, accessibility, and reliability.", "2 weeks"],
];

export default function Home() {
  return (
    <main>
      <nav className="nav">
        <a className="brand" href="#top" aria-label="AfterMeet home">
          <BrandMark className="brand-mark" size={38} />
          <span>AfterMeet <small>product lab</small></span>
        </a>
        <div className="nav-links">
          <LinkButton size="small" variant="ghost" href="/auth">Login</LinkButton>
          <LinkButton className="nav-cta" size="small" href="/auth?next=/onboarding">Start for free <ArrowRightIcon size={15} weight="bold" /></LinkButton>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="eyebrow"><span /> Product opportunity · July 2026</div>
        <h1>Don’t build another<br /><em>digital business card.</em></h1>
        <div className="hero-bottom">
          <p>Build the product that makes sure something meaningful happens <strong>after the meeting.</strong></p>
          <IconLinkButton className="circle-link" size="normal" variant="secondary" href="#direction" aria-label="Explore the recommendation"><ArrowDownIcon size={21} weight="bold" /></IconLinkButton>
        </div>
      </section>

      <section className="study section" id="study">
        <div className="section-label">01 / What we learned</div>
        <div className="study-grid">
          <div>
            <h2>Blinq is no longer<br />just a card.</h2>
            <p className="lede">It is becoming a relationship-capture platform spanning identity, lead capture, memory, and workflow.</p>
          </div>
          <div className="system-list">
            <div className="system-head">
              <span>How the platform compounds</span>
              <p>Each capability makes the next one more valuable.</p>
            </div>
            <div className="system-grid">
            {[
              ["Share identity", "QR, NFC, Wallet and signatures"],
              ["Capture people", "Cards, badges, LinkedIn and forms"],
              ["Remember context", "AI notes connected to every contact"],
              ["Activate data", "CRM sync, campaigns and attribution"],
            ].map(([title, detail], index) => (
              <div className="system-row" key={title}>
                <div className="system-number">0{index + 1}</div>
                <div className="system-copy">
                  <h3>{title}</h3>
                  <p>{detail}</p>
                </div>
                <ArrowRightIcon className="system-arrow" size={18} weight="bold" aria-hidden="true" />
              </div>
            ))}
            </div>
          </div>
        </div>
        <div className="proof-strip">
          <div><strong>4M+</strong><span>users claimed worldwide</span></div>
          <div><strong>500K</strong><span>companies represented</span></div>
          <div><strong>$0</strong><span>entry point creates reach</span></div>
          <div><strong>4 loops</strong><span>share · capture · remember · act</span></div>
        </div>
      </section>

      <section className="direction section" id="direction">
        <div className="section-label light">02 / Where we can win</div>
        <div className="direction-head">
          <h2>Three credible<br />ways in.</h2>
          <p>Matching Blinq feature-for-feature would be expensive and strategically weak. A sharper job or audience gives us a reason to exist.</p>
        </div>
        <div className="opportunity-grid">
          {opportunities.map((item) => (
            <article className={`opportunity ${item.featured ? "featured" : ""}`} key={item.number}>
              <span className="op-number">{item.number}</span>
              <span className="op-emoji" aria-hidden="true">{item.emoji}</span>
              {item.featured && <span className="recommended">Our pick</span>}
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <div className="verdict">{item.verdict}<ArrowRightIcon size={17} weight="bold" /></div>
            </article>
          ))}
        </div>
      </section>

      <section className="mvp section" id="mvp">
        <div className="section-label">03 / Recommended concept</div>
        <div className="concept-intro">
          <div>
            <span className="concept-name">AfterMeet</span>
            <h2>Remember every person.<br /><em>Make the next move.</em></h2>
          </div>
          <p>A personal relationship workspace for consultants and small agencies who win business through conversations—but do not consistently maintain a CRM.</p>
        </div>

        <div className="loop" aria-label="Product loop">
          {[
            ["Share or scan", "Exchange details without requiring another app."],
            ["Capture context", "Record what mattered while the meeting is fresh."],
            ["Suggest follow-up", "Turn notes into a clear, editable next action."],
            ["Strengthen relationship", "Stay useful, timely, and genuinely personal."],
          ].map(([title, detail], index) => (
            <div className="loop-step" key={title}>
              <span>0{index + 1}</span>
              <div><strong>{title}</strong><p>{detail}</p></div>
              {index < 3 && <b aria-hidden="true"><ArrowRightIcon size={13} weight="bold" /></b>}
            </div>
          ))}
        </div>

        <div className="feature-layout">
          <div className="mock-phone">
            <div className="phone-top"><span>9:41</span><DotsThreeIcon size={18} weight="bold" aria-hidden="true" /></div>
            <div className="avatar">AM</div>
            <div className="contact-label">New encounter</div>
            <h3>Maya Chen</h3>
            <p>Founder at Fieldnote Studio</p>
            <div className="note">“Discussed her September launch. Send the research deck on Monday and introduce her to Alex.”</div>
            <div className="extracted">
              <span>Next move</span>
              <strong>Send research deck</strong>
              <small>Monday, 9:00 AM</small>
            </div>
            <Button fullWidth>Review follow-up <ArrowRightIcon size={17} weight="bold" /></Button>
          </div>
          <div className="feature-copy">
            <div className="feature"><span>01</span><div><h3>A card that starts a workflow</h3><p>Share a profile by link or QR. The recipient can save details or share theirs without creating an account.</p></div></div>
            <div className="feature"><span>02</span><div><h3>Context in under 30 seconds</h3><p>Type or dictate a post-meeting note. AI extracts topics, promises, next actions, and dates for your review.</p></div></div>
            <div className="feature"><span>03</span><div><h3>Follow-up without the admin</h3><p>Get an editable, personal message draft and a daily queue of the relationships that need attention.</p></div></div>
          </div>
        </div>
      </section>

      <section className="roadmap section" id="roadmap">
        <div className="section-label">04 / A practical route to pilot</div>
        <div className="roadmap-head">
          <h2>Useful in<br /><em>7–10 weeks.</em></h2>
          <p>Start with a responsive web app. Prove the habit before adding native apps, NFC manufacturing, ambient recording, or enterprise integrations.</p>
        </div>
        <div className="phases">
          {phases.map(([phase, title, text, time]) => (
            <article key={phase}>
              <div><span>{phase}</span><b>{time}</b></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <div className="metric">
          <div className="metric-window">
            <span>Success window</span>
            <strong>72h</strong>
          </div>
          <div className="metric-copy">
            <span>The metric that matters</span>
            <h3>Follow-up completed—not merely drafted.</h3>
            <p>Measure the share of captured contacts who receive a reviewed, completed follow-up within three days of the meeting.</p>
          </div>
        </div>
      </section>

      <footer>
        <div><BrandMark className="brand-mark" size={38} /><strong>AfterMeet</strong></div>
        <p>Working concept—not affiliated with Blinq.<br />Built from public product research.</p>
        <a href="#top">Back to top <ArrowUpIcon size={15} weight="bold" /></a>
      </footer>
    </main>
  );
}
