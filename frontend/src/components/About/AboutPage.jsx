import { memo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle, FileText, MessageSquare, Users, Shield } from 'lucide-react';
import Navbar from '@/components/Landing/Navbar';
import Footer from '@/components/Landing/Footer';
import ScrollReveal from '@/components/Landing/ScrollReveal';

// ────────────────────────────────────────────────────────────────────────
// Helper Components — Feature Card with custom hover logic
// ────────────────────────────────────────────────────────────────────────

const FeatureCard = ({ icon: Icon, title, desc, index }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <ScrollReveal index={index}>
      <motion.div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        animate={{ y: isHovered ? -4 : 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="h-full"
      >
        <div 
          className="h-full rounded-xl p-5 transition-colors duration-300 flex flex-col relative overflow-hidden group"
          style={{
            background: isHovered ? '#131B2E' : '#0F1623',
            border: `1px solid ${isHovered ? 'rgba(200,185,74,0.15)' : 'rgba(255,255,255,0.05)'}`
          }}
        >
          {/* Icon Box */}
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 flex-shrink-0"
            style={{
              background: 'rgba(200,185,74,0.07)',
              border: '1px solid rgba(200,185,74,0.1)'
            }}
          >
            <Icon className="w-5 h-5" style={{ color: '#C8B94A' }} strokeWidth={1.5} />
          </div>
          
          <h3 className="font-display text-sm font-bold text-[#E8E4DC] mb-2 leading-tight">
            {title}
          </h3>
          <p className="text-xs leading-relaxed text-[#8A95A8]">
            {desc}
          </p>
          
          {/* Bottom highlight line */}
          <div className="mt-auto pt-4">
            <div 
              className="h-px w-full transition-opacity duration-300"
              style={{ background: '#C8B94A', opacity: isHovered ? 0.25 : 0.06 }} 
            />
          </div>
        </div>
      </motion.div>
    </ScrollReveal>
  );
};

const HelpingCard = ({ title, desc, index }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <ScrollReveal index={index}>
      <motion.div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        animate={{ y: isHovered ? -4 : 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <div 
          className="rounded-xl p-8 sm:p-9 transition-colors duration-300"
          style={{
            background: isHovered ? '#131B2E' : '#0F1623',
            border: `1px solid ${isHovered ? 'rgba(200,185,74,0.15)' : 'rgba(255,255,255,0.05)'}`
          }}
        >
          <div 
            className="text-5xl font-serif mb-4 leading-none select-none"
            style={{ color: 'rgba(200,185,74,0.2)' }}
          >
            “
          </div>
          <h3 className="font-display text-lg font-semibold text-[#E8E4DC] mb-3">
            {title}
          </h3>
          <p className="text-sm leading-[1.75] text-[#8A95A8]">
            {desc}
          </p>
          
          <div className="mt-8">
            <div 
              className="h-px w-full transition-opacity duration-300"
              style={{ background: '#C8B94A', opacity: isHovered ? 0.25 : 0.06 }} 
            />
          </div>
        </div>
      </motion.div>
    </ScrollReveal>
  );
};

// ────────────────────────────────────────────────────────────────────────
// Main Page Component
// ────────────────────────────────────────────────────────────────────────

function AboutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.overflowX = 'hidden';
    window.scrollTo(0, 0);
    return () => { 
      document.body.style.overflow = 'hidden'; 
    };
  }, []);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen selection:bg-mustard-500/30" style={{ background: '#0B1120' }}>
      <Navbar />

      {/* SECTION 1 — HERO */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image & Overlays */}
        <div 
          className="absolute inset-0 z-0"
          style={{ 
            backgroundImage: "url('/about_us_background.png')", 
            backgroundSize: 'cover', 
            backgroundPosition: 'center' 
          }}
        />
        <div className="absolute inset-0 bg-black/65 z-[1]" />
        
        {/* Radial Glow */}
        <div 
          className="absolute inset-0 z-[2]" 
          style={{ background: 'radial-gradient(ellipse at center, rgba(200,185,74,0.06) 0%, transparent 70%)' }} 
        />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0, ease: [0.19, 1, 0.22, 1] }}
          >
            <span className="inline-block text-[0.6875rem] font-medium tracking-[0.3em] uppercase mb-5" style={{ color: 'rgba(200,185,74,0.6)' }}>
              ABOUT THE PLATFORM
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.19, 1, 0.22, 1] }}
            className="mb-6"
          >
            <span style={{ color: '#E8E4DC' }} className="font-display text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight">ABOUT </span>
            <span style={{ color: 'rgba(232,228,220,0.45)' }} className="font-display text-5xl sm:text-6xl lg:text-7xl font-light tracking-tight">US</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.19, 1, 0.22, 1] }}
            className="text-lg text-ash font-light tracking-wide mb-10 max-w-2xl mx-auto"
          >
            Making life easier with AI
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.19, 1, 0.22, 1] }}
          >
            <button 
              onClick={() => scrollToSection('what-we-built')}
              className="btn-primary group"
            >
              <span>See How It Works</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* SECTION 2 — WHAT WE BUILT */}
      <section id="what-we-built" className="relative py-28 sm:py-36 overflow-hidden" style={{ background: '#0B1120' }}>
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            
            {/* LEFT COLUMN */}
            <div className="lg:sticky lg:top-32">
              <ScrollReveal>
                <span className="inline-block text-[0.6875rem] font-medium tracking-[0.3em] uppercase mb-5" style={{ color: 'rgba(200,185,74,0.6)' }}>
                  WHAT WE BUILT FOR UOE
                </span>
                <h2 className="font-display text-3xl sm:text-4xl font-bold mb-6 text-[#E8E4DC] leading-tight">
                  Solving Real Problems for Real Students
                </h2>
                <p className="text-sm leading-[1.75] text-[#8A95A8] max-w-lg mb-8">
                  It can answer anything a student of University of Education Lahore wants to know 
                  about their university or specific department — instantly, accurately, and in their 
                  own language.
                </p>
                
                <div className="w-16 h-px bg-mustard-500/30 my-8" />
                
                <div className="flex gap-12">
                  <div>
                    <div className="text-3xl font-bold mb-1" style={{ color: '#C8B94A' }}>4</div>
                    <div className="text-xs uppercase tracking-wider text-ash/60">Knowledge Bases</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold mb-1" style={{ color: '#C8B94A' }}>160+</div>
                    <div className="text-xs uppercase tracking-wider text-ash/60">PDF Documents</div>
                  </div>
                </div>
              </ScrollReveal>
            </div>

            {/* RIGHT COLUMN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-fit">
              <FeatureCard 
                index={0}
                icon={CheckCircle} 
                title="Instant Access to Information" 
                desc="Students no longer need to manually search through dozens of PDFs"
              />
              <FeatureCard 
                index={1}
                icon={FileText} 
                title="Grounded in Official Documents" 
                desc="Only uses the university's own official PDFs — schemes, handbooks, regulations"
              />
              <FeatureCard 
                index={2}
                icon={MessageSquare} 
                title="Support for Roman Urdu" 
                desc="Students can ask questions in Roman Urdu rather than formal English"
              />
              <FeatureCard 
                index={3}
                icon={Users} 
                title="Reduces Staff Workload" 
                desc="Routine policy questions are answered instantly without burdening faculty"
              />
              <div className="sm:col-span-2">
                <FeatureCard 
                  index={4}
                  icon={Shield} 
                  title="Hallucination Guard" 
                  desc="Every answer is verified against retrieved documents before reaching the student"
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SECTION 3 — OUR STORY */}
      <section id="our-story" className="relative py-28 sm:py-36 overflow-hidden" style={{ background: '#0B1120' }}>
        {/* Subtle tonal gradient overlay */}
        <div 
          className="absolute inset-0 pointer-events-none" 
          style={{ background: 'linear-gradient(180deg, rgba(21,27,43,0.5) 0%, transparent 30%, transparent 70%, rgba(21,27,43,0.5) 100%)' }} 
        />
        
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <ScrollReveal>
            <span className="inline-block text-[0.6875rem] font-medium tracking-[0.3em] uppercase mb-1" style={{ color: 'rgba(200,185,74,0.6)' }}>
              OUR STORY
            </span>
            <div className="w-16 h-px mx-auto my-6 bg-gradient-to-r from-transparent via-mustard-500/40 to-transparent" />
          </ScrollReveal>

          <ScrollReveal index={0}>
            <p className="text-base leading-[1.9] text-[#8A95A8] mb-8 font-light">
              We started with a lot of ideas — projects involving AI, RAG pipelines, and chatbots — 
              but we wanted to build something that truly solved a problem for our own university. 
              It was Ahmad Nawaz who first sparked the idea of a platform around university admissions 
              and policies.
            </p>
          </ScrollReveal>

          <ScrollReveal index={1}>
            <p className="text-base leading-[1.9] text-[#8A95A8] mb-8 font-light">
              That spark led Hammad Ali Tahir to sharpen the vision: instead of trying to serve all 
              universities in Pakistan, why not go deep on just one? The University of Education website 
              had dozens of schemes of studies, rules, regulations, and program details — all buried in 
              PDFs that students rarely opened. So we asked ourselves: what if a student could just ask 
              a simple question in plain English — or even Roman Urdu — and get the answer instantly?
            </p>
          </ScrollReveal>

          <ScrollReveal index={2}>
            <p className="text-base leading-[1.9] text-[#8A95A8] mb-8 font-light">
              What courses are in my semester? What topics will I study in a subject? What is the 
              policy for migrating from one campus to another? This information existed — it was just 
              inaccessible. We built UOE AI to change that. This is our contribution to our university, 
              our department, and our generation.
            </p>
          </ScrollReveal>

          <ScrollReveal index={3}>
            <div className="rounded-xl p-8 mt-12 relative overflow-hidden" style={{ background: 'rgba(200,185,74,0.04)', border: '1px solid rgba(200,185,74,0.1)' }}>
              <div 
                className="absolute -top-2 left-6 text-7xl font-serif leading-none select-none"
                style={{ color: 'rgba(200,185,74,0.1)' }}
              >
                “
              </div>
              <p className="relative z-10 text-[#E8E4DC] text-lg font-medium mb-6 italic leading-relaxed">
                Build something meaningful for your university. Make information accessible. That was always the goal.
              </p>
              <div className="w-8 h-px bg-mustard-500/40 mx-auto mb-4" />
              <span className="text-[0.625rem] uppercase tracking-[0.2em] font-semibold" style={{ color: 'rgba(232,228,220,0.6)' }}>
                Mission Statement
              </span>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* SECTION 4 — HOW WE ARE HELPING */}
      <section id="how-we-help" className="relative py-28 sm:py-36 overflow-hidden" style={{ background: '#0B1120' }}>
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="text-center mb-16">
            <ScrollReveal>
              <span className="inline-block text-[0.6875rem] font-medium tracking-[0.3em] uppercase mb-5" style={{ color: 'rgba(200,185,74,0.6)' }}>
                HAPPY STUDENTS
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-light text-[#E8E4DC]">
                How We Are <strong className="font-extrabold" style={{ color: '#E8E4DC' }}>Helping</strong>
              </h2>
            </ScrollReveal>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
            <HelpingCard 
              index={0}
              title="Document Access Made Simple"
              desc="Ask questions in plain English or Roman Urdu and instantly receive answers pulled directly from official university PDFs — no manual searching required."
            />
            <HelpingCard 
              index={1}
              title="Instant University Knowledge"
              desc="From course outlines to fee structures, campus facilities to faculty contacts — all university knowledge is now one question away, available 24/7."
            />
            <HelpingCard 
              index={2}
              title="Voice-Powered Queries"
              desc="Students can speak their questions in Urdu through voice chat, making the platform accessible regardless of typing proficiency or language preference."
            />
          </div>
        </div>
      </section>

      {/* SECTION 5 — CLOSING CTA */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        {/* Mirroring CTABanner.jsx exactly */}
        <div className="absolute inset-0 bg-navy-950" />
        <div 
          className="absolute inset-0 opacity-60 ambient-gradient" 
          style={{ 
            background: 'linear-gradient(135deg, rgba(200,185,74,0.04) 0%, rgba(100,120,200,0.03) 25%, rgba(140,147,64,0.04) 50%, rgba(200,185,74,0.03) 75%, rgba(100,120,200,0.04) 100%)', 
            backgroundSize: '300% 300%' 
          }} 
        />
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full blur-[180px] opacity-70"
          style={{ background: 'radial-gradient(circle, rgba(200,185,74,0.06) 0%, transparent 70%)' }} 
        />
        
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <motion.div 
            initial={{ opacity:0, y:30 }} 
            whileInView={{ opacity:1, y:0 }} 
            viewport={{ once:true }} 
            transition={{ duration:0.7, ease: [0.19, 1, 0.22, 1] }}
          >
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold uppercase text-cream tracking-tight mb-5">
              Ready to Get{' '}
              <span className="bg-gradient-to-r from-mustard-400 via-mustard-500 to-olive-400 bg-clip-text text-transparent">
                Answers?
              </span>
            </h2>
            <p className="text-base text-ash max-w-lg mx-auto leading-relaxed mb-10">
              Ask anything about University of Education programs, admissions, and regulations 
              — our AI finds the most accurate answer for you.
            </p>
            <button onClick={() => navigate('/chat')} className="btn-primary group">
              <span>Start a Conversation</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default memo(AboutPage);
