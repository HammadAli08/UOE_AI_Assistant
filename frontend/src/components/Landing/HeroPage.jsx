// ──────────────────────────────────────────
// HeroPage — multi-section landing page
// Below-fold sections are lazy-loaded to reduce initial JS parse time
// ──────────────────────────────────────────
import { memo, useEffect, lazy, Suspense } from 'react';

// Above-fold: eagerly loaded (needed for first paint / LCP)
import Navbar from './Navbar';
import HeroSection from './HeroSection';

// Below-fold: lazy loaded — shaves ~140KB from initial bundle
const TechMarquee    = lazy(() => import('./TechMarquee'));
const FeaturesGrid   = lazy(() => import('./FeaturesGrid'));
const HowItWorks     = lazy(() => import('./HowItWorks'));
const KnowledgeBases = lazy(() => import('./KnowledgeBases'));
const TeamSection    = lazy(() => import('./TeamSection'));
const CTABanner      = lazy(() => import('./CTABanner'));
const Footer         = lazy(() => import('./Footer'));

/* Thin placeholder shown while below-fold chunks stream in */
function SectionSkeleton() {
  return <div className="w-full py-24 bg-navy-950" aria-hidden="true" />;
}

function HeroPage() {
  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.overflowX = 'hidden';
    return () => { document.body.style.overflow = 'hidden'; };
  }, []);

  return (
    <div className="min-h-screen bg-navy-950">
      {/* Above fold — no Suspense needed */}
      <Navbar />
      <HeroSection />

      {/* Below fold — loaded lazily as user scrolls */}
      <Suspense fallback={<SectionSkeleton />}>
        <TechMarquee />
        <FeaturesGrid />
        <HowItWorks />
        <KnowledgeBases />
        <TeamSection />
        <CTABanner />
        <Footer />
      </Suspense>
    </div>
  );
}

export default memo(HeroPage);
