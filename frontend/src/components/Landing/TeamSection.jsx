// ──────────────────────────────────────────
// TeamSection — "Ivory Archive" editorial team cards
// Tonal layering, clean hierarchy, institutional warmth
// Inspired by Stitch "Digital Archivist" design system
// ──────────────────────────────────────────
import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Server, Code2, GraduationCap } from 'lucide-react';
import ScrollReveal from './ScrollReveal';

const supervisor = {
  name: 'Usman Rafi',
  role: 'Project Supervisor',
  badge: 'Supervisor',
  icon: GraduationCap,
  desc: 'Lecturer at the University of Education Lahore, Faisalabad Campus. Providing invaluable guidance and oversight for the project\'s development.',
  accentColor: '#C8B94A',
};

const team = [
  {
    name: 'Hammad Ali Tahir',
    role: 'RAG Engineer',
    badge: 'Group Leader',
    icon: Crown,
    desc: 'Architected the self-correcting RAG pipeline, Agentic retrieval logic, and LangSmith observability layer powering every answer.',
    accentColor: '#C8B94A',
  },
  {
    name: 'Muhammad Muzaib',
    role: 'API Engineer',
    badge: null,
    icon: Server,
    desc: 'Built the FastAPI backend, streaming endpoints, Redis memory integration, and Pinecone vector store connectivity.',
    accentColor: '#7B9EC9',
  },
  {
    name: 'Ahmad Nawaz',
    role: 'Frontend Developer',
    badge: null,
    icon: Code2,
    desc: 'Crafted the dark cinematic UI, responsive chat interface, landing page animations, and real-time streaming experience.',
    accentColor: '#9CA356',
  },
];

function PersonCard({ member, index, isSupervisor = false }) {
  const Icon = member.icon;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <ScrollReveal index={index}>
      <motion.div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        animate={{ y: isHovered ? -3 : 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative h-full"
      >
        <div
          className="relative h-full rounded-xl overflow-hidden transition-all duration-300"
          style={{
            background: isHovered ? '#131B2E' : '#0F1623',
            border: `1px solid ${
              isSupervisor
                ? isHovered ? 'rgba(200,185,74,0.25)' : 'rgba(200,185,74,0.12)'
                : isHovered ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'
            }`,
          }}
        >
          <div className="p-8 sm:p-9">
            {/* Badge — top right */}
            {member.badge && (
              <div className="absolute top-7 right-7">
                <span
                  className="text-[0.625rem] font-medium tracking-[0.15em] uppercase px-2.5 py-1 rounded"
                  style={{
                    background: isSupervisor ? 'rgba(200,185,74,0.08)' : 'rgba(255,255,255,0.03)',
                    color: isSupervisor ? 'rgba(200,185,74,0.7)' : 'rgba(232,228,220,0.5)',
                    border: `1px solid ${isSupervisor ? 'rgba(200,185,74,0.15)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  {member.badge}
                </span>
              </div>
            )}

            {/* Icon */}
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center mb-6"
              style={{
                background: `${member.accentColor}12`,
                border: `1px solid ${member.accentColor}1A`,
              }}
            >
              <Icon
                className="w-5.5 h-5.5"
                style={{ color: member.accentColor }}
                strokeWidth={1.5}
              />
            </div>

            {/* Name */}
            <h3
              className="font-display text-xl font-bold tracking-tight mb-2"
              style={{ color: '#E8E4DC' }}
            >
              {member.name}
            </h3>

            {/* Role — accent colored */}
            <p
              className="text-sm font-medium mb-1.5"
              style={{ color: member.accentColor }}
            >
              {member.role}
            </p>

            {/* Subtle divider */}
            <div
              className="w-10 h-px mb-5 transition-all duration-300"
              style={{
                background: member.accentColor,
                opacity: isHovered ? 0.4 : 0.15,
                width: isHovered ? '3.5rem' : '2.5rem',
              }}
            />

            {/* Description */}
            <p
              className="text-sm leading-[1.7]"
              style={{ color: '#8A95A8' }}
            >
              {member.desc}
            </p>
          </div>

          {/* Bottom accent */}
          <div
            className="h-px w-full transition-opacity duration-300"
            style={{
              background: member.accentColor,
              opacity: isHovered ? 0.25 : 0.06,
            }}
          />
        </div>
      </motion.div>
    </ScrollReveal>
  );
}

function TeamSection() {
  return (
    <section id="team" className="relative py-28 sm:py-36 overflow-hidden">
      {/* Background — clean solid */}
      <div className="absolute inset-0" style={{ background: '#0B1120' }} />

      {/* Tonal gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(21,27,43,0.3) 0%, transparent 20%, transparent 80%, rgba(21,27,43,0.3) 100%)',
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8">
        {/* Header */}
        <ScrollReveal className="text-center mb-20">
          <span
            className="text-[0.6875rem] font-medium tracking-[0.25em] uppercase block mb-4"
            style={{ color: 'rgba(200,185,74,0.5)' }}
          >
            The Builders
          </span>
          <h2
            className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight mb-5"
            style={{ color: '#E8E4DC' }}
          >
            Meet Our Team
          </h2>
          <p
            className="text-base max-w-xl mx-auto leading-relaxed"
            style={{ color: '#8A95A8' }}
          >
            Developed by students under the supervision of university faculty to assist in academic navigation.
          </p>
          {/* Subtle divider */}
          <div
            className="mt-8 mx-auto w-16 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(200,185,74,0.3), transparent)' }}
          />
        </ScrollReveal>

        {/* Supervisor — centered */}
        <div className="max-w-2xl mx-auto mb-12">
          <PersonCard member={supervisor} index={0} isSupervisor={true} />
        </div>

        {/* Team grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
          {team.map((member, i) => (
            <PersonCard key={member.name} member={member} index={i + 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default memo(TeamSection);
