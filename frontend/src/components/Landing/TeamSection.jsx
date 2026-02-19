// ──────────────────────────────────────────
// TeamSection — cinematic team showcase cards
// ──────────────────────────────────────────
import { memo } from 'react';
import { motion } from 'framer-motion';
import { Crown, Server, Code2 } from 'lucide-react';
import ScrollReveal from './ScrollReveal';

const team = [
  {
    name: 'Hammad Ali Tahir',
    role: 'RAG Engineer',
    badge: 'Group Leader',
    photo: '/Hammad Ali.png',
    icon: Crown,
    desc: 'Architected the self-correcting RAG pipeline, Smart retrieval logic, and LangSmith observability layer powering every answer.',
    accent: 'from-mustard-500 to-mustard-400',
    glow: 'rgba(200,185,74,0.12)',
  },
  {
    name: 'Muhammad Muzaib',
    role: 'API Engineer',
    badge: null,
    photo: '/Muhammad Muzaib.png',
    icon: Server,
    desc: 'Built the FastAPI backend, streaming endpoints, Redis memory integration, and Pinecone vector store connectivity.',
    accent: 'from-blue-400 to-blue-500',
    glow: 'rgba(96,165,250,0.12)',
  },
  {
    name: 'Ahmad Nawaz',
    role: 'Frontend Developer',
    badge: null,
    photo: '/Ahmad Nawaz.png',
    icon: Code2,
    desc: 'Crafted the dark cinematic UI, responsive chat interface, landing page animations, and real-time streaming experience.',
    accent: 'from-olive-400 to-olive-500',
    glow: 'rgba(156,163,86,0.12)',
  },
];

/* ── Hover-aware card with stagger ── */
function TeamCard({ member, index }) {
  const Icon = member.icon;

  return (
    <ScrollReveal index={index}>
      <motion.div
        whileHover={{ y: -8, transition: { duration: 0.35, ease: 'easeOut' } }}
        className="group relative h-full rounded-2xl border border-white/[0.06] bg-white/[0.015]
                   backdrop-blur-sm overflow-hidden
                   hover:border-mustard-500/25 hover:shadow-glow
                   transition-[border,box-shadow] duration-700"
      >
        {/* ── Photo area ── */}
        <div className="relative h-72 sm:h-80 overflow-hidden">
          {/* Gradient overlay on photo */}
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/40 to-transparent z-10" />

          <motion.img
            src={member.photo}
            alt={member.name}
            className="w-full h-full object-cover object-top
                       transition-transform duration-700 ease-out
                       group-hover:scale-105"
            loading="lazy"
          />

          {/* Badge — Group Leader */}
          {member.badge && (
            <div className="absolute top-4 right-4 z-20">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                             bg-mustard-500/15 border border-mustard-500/25 backdrop-blur-md
                             text-2xs font-semibold text-mustard-400 uppercase tracking-[0.15em]">
                <Crown className="w-3 h-3" />
                {member.badge}
              </span>
            </div>
          )}

          {/* Floating role icon */}
          <div className="absolute bottom-4 left-5 z-20">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center
                         bg-gradient-to-br ${member.accent} bg-opacity-15
                         border border-white/[0.08] backdrop-blur-md
                         group-hover:scale-110 transition-transform duration-500`}
              style={{ background: `linear-gradient(135deg, ${member.glow}, transparent)` }}
            >
              <Icon className="w-5 h-5 text-cream" />
            </div>
          </div>
        </div>

        {/* ── Info area ── */}
        <div className="relative p-6 pt-5">
          {/* Name */}
          <h3 className="font-display text-lg font-bold uppercase text-cream tracking-wide mb-1
                         group-hover:text-mustard-400 transition-colors duration-500">
            {member.name}
          </h3>

          {/* Role with gradient underline */}
          <div className="mb-4">
            <span className={`text-sm font-medium bg-gradient-to-r ${member.accent} bg-clip-text text-transparent`}>
              {member.role}
            </span>
            <div className={`mt-2 h-px w-12 bg-gradient-to-r ${member.accent} opacity-40
                            group-hover:w-20 group-hover:opacity-70
                            transition-all duration-500`} />
          </div>

          {/* Description */}
          <p className="text-sm text-ash leading-relaxed">
            {member.desc}
          </p>
        </div>

        {/* ── Hover glow background ── */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 -z-10 blur-2xl"
          style={{ background: `radial-gradient(circle at 50% 30%, ${member.glow}, transparent 70%)` }}
        />
      </motion.div>
    </ScrollReveal>
  );
}

/* ── Section ── */
function TeamSection() {
  return (
    <section id="team" className="relative py-28 sm:py-36 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-navy-950" />
      <div className="absolute inset-0 bg-gradient-to-b from-navy-900/20 via-transparent to-navy-900/20" />

      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />

      {/* Ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                   w-[900px] h-[600px] rounded-full blur-[180px] opacity-30 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(200,185,74,0.06) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8">
        {/* ── Header ── */}
        <ScrollReveal className="text-center mb-20">
          <span className="text-2xs font-medium text-mustard-600 tracking-[0.25em] uppercase block mb-3">
            The Builders
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold uppercase text-cream tracking-tight mb-4">
            Meet Our Team
          </h2>
          <p className="text-base text-ash max-w-xl mx-auto leading-relaxed">
            The minds behind UOE AI Assistant — turning university documents
            into intelligent, instant answers.
          </p>
          <div className="mt-6 mx-auto w-24 h-px bg-gradient-to-r from-transparent via-mustard-500/50 to-transparent" />
        </ScrollReveal>

        {/* ── Cards grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {team.map((member, i) => (
            <TeamCard key={member.name} member={member} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default memo(TeamSection);
