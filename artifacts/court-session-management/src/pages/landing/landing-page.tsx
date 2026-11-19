import React, { useState, useEffect } from 'react';
import { useGetCurrentUser } from '@workspace/api-client-react';
import { LandingNavbar } from './components/landing-navbar';
import { HeroSection } from './components/hero-section';
import { FeatureShowcase } from './components/feature-showcase';
import { StatsBanner } from './components/stats-banner';
import { SecurityComplianceCard } from './components/security-compliance-card';
import { FaqSection } from './components/faq-section';
import { CtaSection } from './components/cta-section';
import { LandingFooter } from './components/landing-footer';
import { ConsultationModal } from './components/consultation-modal';
import type { LandingData } from './types';

export default function LandingPage() {
  const { data: currentUser } = useGetCurrentUser();
  const [landingData, setLandingData] = useState<LandingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [consultationModalOpen, setConsultationModalOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchLandingData = async () => {
      try {
        const res = await fetch('/api/landing/data');
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.success) {
            setLandingData(json);
          }
        }
      } catch (err) {
        console.error('Failed to load landing data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchLandingData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenConsultation = (topic?: string) => {
    setSelectedTopic(topic || '');
    setConsultationModalOpen(true);
  };

  return (
    <div
      className="min-h-screen bg-[#FBF9F5] text-[#0C1A30] flex flex-col font-sans selection:bg-[#0B1B3D] selection:text-white"
      dir="rtl"
      style={{ fontFamily: "'Tajawal', sans-serif" }}
    >
      {/* 1. Navigation Bar with Judicial Navy & Warm Cream Touches */}
      <LandingNavbar
        data={landingData}
        onOpenConsultation={() => handleOpenConsultation()}
        currentUser={currentUser}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {/* 2. Hero Section */}
        <HeroSection
          data={landingData}
          onOpenConsultation={() => handleOpenConsultation()}
        />

        {/* 3. Core Feature Showcases */}
        <FeatureShowcase
          data={landingData}
          onOpenConsultation={() => handleOpenConsultation()}
        />

        {/* 4. Stats Banner */}
        <StatsBanner data={landingData} />

        {/* 5. Security & Isolation Card (Luxury Dark Navy + Gold Accent) */}
        <SecurityComplianceCard
          onOpenConsultation={() => handleOpenConsultation()}
        />

        {/* 6. Legal & Technical FAQs */}
        <FaqSection />

        {/* 7. Call To Action */}
        <CtaSection
          data={landingData}
          onOpenConsultation={() => handleOpenConsultation()}
        />
      </main>

      {/* 8. Modern Judicial Footer */}
      <LandingFooter data={landingData} />

      {/* 9. Interactive Booking Modal */}
      <ConsultationModal
        isOpen={consultationModalOpen}
        onClose={() => setConsultationModalOpen(false)}
        data={landingData}
        initialTopic={selectedTopic}
      />
    </div>
  );
}
