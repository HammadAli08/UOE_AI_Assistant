// ──────────────────────────────────────────
// HeroPage — Aden-inspired multi-section landing page
// ──────────────────────────────────────────
import { memo, useEffect } from 'react';
import Navbar from './Navbar';
import HeroSection from './HeroSection';
import TechMarquee from './TechMarquee';
import FeaturesGrid from './FeaturesGrid';
import HowItWorks from './HowItWorks';
import KnowledgeBases from './KnowledgeBases';
import TeamSection from './TeamSection';
import CTABanner from './CTABanner';
import Footer from './Footer';

function HeroPage() {
  // Allow scrolling on the landing page, disable when leaving
  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.overflowX = 'hidden';
    return () => {
      document.body.style.overflow = 'hidden';
    };
  }, []);

  return (
    <div className="min-h-screen bg-navy-950">
      <Navbar />
      <HeroSection />
      <TechMarquee />
      <FeaturesGrid />
      <HowItWorks />
      <KnowledgeBases />
      <TeamSection />
      <CTABanner />
      <Footer />
    </div>
  );
}

export default memo(HeroPage);
