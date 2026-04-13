// ──────────────────────────────────────────
// TeamSection
// ──────────────────────────────────────────
import { memo } from 'react';
import { Crown, Server, Code2, GraduationCap } from 'lucide-react';
import ScrollReveal from './ScrollReveal';

const supervisor = {
  name: 'Usman Rafi',
  role: 'Project Supervisor',
  badge: 'Supervisor',
  icon: GraduationCap,
  desc: 'Lecturer at the University of Education Lahore, Faisalabad Campus. Providing invaluable guidance and oversight for the project\'s development.',
  accent: 'from-mustard-500 to-mustard-400',
  glow: 'rgba(200,185,74,0.12)',
};

const team = [
  {
    name: 'Hammad Ali Tahir',
    role: 'RAG Engineer',
    badge: 'Group Leader',
    icon: Crown,
    desc: 'Architected the self-correcting RAG pipeline, Agentic retrieval logic, and LangSmith observability layer powering every answer.',
    accent: 'from-mustard-500 to-mustard-400',
    glow: 'rgba(200,185,74,0.12)',
  },
  {
    name: 'Muhammad Muzaib',
    role: 'API Engineer',
    badge: null,
    icon: Server,
    desc: 'Built the FastAPI backend, streaming endpoints, Redis memory integration, and Pinecone vector store connectivity.',
    accent: 'from-blue-400 to-blue-500',
    glow: 'rgba(96,165,250,0.12)',
  },
  {
    name: 'Ahmad Nawaz',
    role: 'Frontend Developer',
    badge: null,
    icon: Code2,
    desc: 'Crafted the dark cinematic UI, responsive chat interface, landing page animations, and real-time streaming experience.',
    accent: 'from-olive-400 to-olive-500',
    glow: 'rgba(156,163,86,0.12)',
  },
];

function PersonCard({ member, index, isSupervisor = false }) {
  const Icon = member.icon;

  return (
    <ScrollReveal index={index}>
      <div
        className={`group relative h-full p-8 rounded-2xl border bg-white/[0.015] backdrop-blur-sm overflow-hidden transition-[border,box-shadow,transform] duration-500 hover:-translate-y-1 ${
          isSupervisor ? 'border-mustard-500/30 shadow-[0_0_30px_rgba(200,185,74,0.06)] hover:border-mustard-500/50 hover:shadow-[0_0_40px_rgba(200,185,74,0.12)]' : 'border-white/[0.06] hover:border-white/[0.12] hover:shadow-2xl'
        }`}
      >
        {/* Glow reveal on hover */}
        <div
          className="absolute inset-0 -z-10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"
          style={{ background: `radial-gradient(circle at 50% 30%, ${member.glow}, transparent 70%)` }}
        />

        {member.badge && (
          <div className="absolute top-6 right-6 z-20">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-semibold uppercase tracking-[0.15em] border backdrop-blur-md ${
              isSupervisor ? 'bg-mustard-500/15 border-mustard-500/25 text-mustard-400' : 'bg-white/5 border-white/10 text-cream/70'
            }`}>
              {member.badge}
            </span>
          </div>
        )}

        <div className="relative z-10 mb-6">
          <div
            className={`w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br ${member.accent} bg-opacity-15 border border-white/[0.08] backdrop-blur-md mb-5`}
            style={{ background: `linear-gradient(135deg, ${member.glow}, transparent)` }}
          >
            <Icon className="w-6 h-6 text-cream" />
          </div>
          <h3 className="font-display text-xl font-bold uppercase text-cream tracking-wide mb-2 group-hover:text-mustard-400 transition-colors duration-500">
            {member.name}
          </h3>
          
          <div className="mb-4">
            <span className={`text-sm font-medium bg-gradient-to-r ${member.accent} bg-clip-text text-transparent`}>
              {member.role}
            </span>
            <div className={`mt-2 h-px w-12 bg-gradient-to-r ${member.accent} opacity-40 group-hover:w-20 group-hover:opacity-70 transition-all duration-500`} />
          </div>
        </div>

        <p className="relative z-10 text-sm text-ash leading-relaxed">
          {member.desc}
        </p>
      </div>
    </ScrollReveal>
  );
}

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
            Developed by students under the supervision of university faculty to assist in academic navigation.
          </p>
          <div className="mt-6 mx-auto w-24 h-px bg-gradient-to-r from-transparent via-mustard-500/50 to-transparent" />
        </ScrollReveal>

        {/* ── Supervisor Section ── */}
        <div className="max-w-2xl mx-auto mb-12">
          <PersonCard member={supervisor} index={0} isSupervisor={true} />
        </div>

        {/* ── Team grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {team.map((member, i) => (
            <PersonCard key={member.name} member={member} index={i + 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default memo(TeamSection);
