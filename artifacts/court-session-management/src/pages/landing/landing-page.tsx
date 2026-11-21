import React, { useState, useEffect } from "react";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { LandingNavbar } from "./components/landing-navbar";
import { HeroSection } from "./components/hero-section";
import { ComparisonSection } from "./components/comparison-section";
import { FeatureShowcase } from "./components/feature-showcase";
import { HowItWorksSection } from "./components/how-it-works-section";
import { PricingSection } from "./components/pricing-section";
import { FaqSection } from "./components/faq-section";
import { CtaSection } from "./components/cta-section";
import { LandingFooter } from "./components/landing-footer";
import { ConsultationModal } from "./components/consultation-modal";
import type { LandingData } from "./types";

export default function LandingPage() {
  const { data: currentUser } = useGetCurrentUser();
  const [landingData, setLandingData] = useState<LandingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [consultationModalOpen, setConsultationModalOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState("");

  useEffect(() => {
    let isMounted = true;
    const fetchLandingData = async () => {
      try {
        const res = await fetch("/api/landing/data");
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.success) {
            setLandingData(json);
          }
        }
      } catch (err) {
        console.error("Failed to load landing data:", err);
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
    setSelectedTopic(topic || "");
    setConsultationModalOpen(true);
  };

  return (
    <div
      className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-slate-900 selection:text-white"
      dir="rtl"
      style={{ fontFamily: "'Tajawal', sans-serif" }}
    >
      {/* 1. Sticky Minimal Navbar */}
      <LandingNavbar
        data={landingData}
        onOpenConsultation={() => handleOpenConsultation()}
        currentUser={currentUser}
      />

      {/* Main Content Sections */}
      <main className="flex-1">
        {/* 2. Hero Section + Coded UI Mockup */}
        <HeroSection
          data={landingData}
          onOpenConsultation={() => handleOpenConsultation("احجز تجربة مجانية لـ 14 يوم")}
        />

        {/* 3. The Old Way vs. Our Platform (Contrast Grid) */}
        <ComparisonSection data={landingData} />

        {/* 4. Core Features (Bento Grid Layout) */}
        <FeatureShowcase
          data={landingData}
          onOpenConsultation={() => handleOpenConsultation()}
        />

        {/* 5. How It Works (3-Step Horizontal Flow: 01, 02, 03) */}
        <HowItWorksSection data={landingData} />

        {/* 6. Pricing Section (Subscription Tiers + Monthly/Annual Toggle) */}
        <PricingSection
          data={landingData}
          onOpenConsultation={() => handleOpenConsultation("استفسار عن باقات الاشتراك")}
        />

        {/* 7. FAQ Accordion */}
        <FaqSection />

        {/* 8. Final CTA Banner */}
        <CtaSection
          data={landingData}
          onOpenConsultation={() => handleOpenConsultation("ابدأ تجربتك المجانية الآن")}
        />
      </main>

      {/* 9. Minimal Footer */}
      <LandingFooter data={landingData} />

      {/* 10. Booking / Trial Modal */}
      <ConsultationModal
        isOpen={consultationModalOpen}
        onClose={() => setConsultationModalOpen(false)}
        data={landingData}
        initialTopic={selectedTopic}
      />
    </div>
  );
}
