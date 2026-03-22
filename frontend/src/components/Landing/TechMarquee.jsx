// ──────────────────────────────────────────
// TechMarquee — smooth infinite scrolling tech badges
// Pure CSS animation for buttery-smooth 60fps
// ──────────────────────────────────────────
import { memo, useState } from 'react';
import ScrollReveal from './ScrollReveal';

const techBadges = [
  { name: 'OpenAI', desc: 'GPT-4o Mini' },
  { name: 'Pinecone', desc: 'Vector Database' },
  { name: 'LangChain', desc: 'LLM Framework' },
  { name: 'Redis', desc: 'Memory Store' },
  { name: 'LangSmith', desc: 'Tracing' },
  { name: 'FastAPI', desc: 'Backend API' },
  { name: 'React', desc: 'Frontend UI' },
  { name: 'Tailwind', desc: 'Styling' },
];

function Badge({ name, desc }) {
  return (
    <div
      className="flex items-center gap-3 px-5 py-2.5 rounded-full shrink-0
                 border border-white/[0.06] bg-white/[0.02]
                 hover:border-mustard-500/20 hover:bg-white/[0.05]
                 transition-all duration-500 ease-out whitespace-nowrap select-none"
    >
      <span className="text-sm font-semibold text-cream tracking-wide">{name}</span>
      <span className="text-2xs text-mist">{desc}</span>
    </div>
  );
}

// Smooth CSS-only marquee row
function MarqueeRow({ reverse = false, duration = 40 }) {
  const [paused, setPaused] = useState(false);

  return (
    <div
      className="relative overflow-hidden
                 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex gap-4 w-max"
        style={{
          animation: `marquee ${duration}s linear infinite${reverse ? ' reverse' : ''}`,
          animationPlayState: paused ? 'paused' : 'running',
        }}
      >
        {/* Triple set for seamless wrap at all widths */}
        {[0, 1, 2].map((set) =>
          techBadges.map((b) => (
            <Badge key={`${set}-${b.name}`} name={b.name} desc={b.desc} />
          ))
        )}
      </div>
    </div>
  );
}

function TechMarquee() {
  return (
    <section id="tech-bar" className="relative py-20 overflow-hidden">
      {/* Section background */}
      <div className="absolute inset-0 bg-navy-950" />
      <div className="absolute inset-0 bg-gradient-to-b from-navy-950 via-navy-900/30 to-navy-950" />

      <div className="relative z-10">
        <ScrollReveal className="text-center mb-10">
          <span className="text-2xs font-medium text-mustard-600 tracking-[0.25em] uppercase">
            Technology Stack
          </span>
          <p className="text-sm text-ash mt-2">
            Built on industry-leading AI infrastructure
          </p>
        </ScrollReveal>

        <div className="space-y-4">
          <MarqueeRow duration={45} />
          <MarqueeRow reverse duration={50} />
        </div>
      </div>
    </section>
  );
}

export default memo(TechMarquee);
