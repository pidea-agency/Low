import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Scale, ArrowLeft, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LandingData } from "../types";

interface NavbarUser {
  role?: "super_admin" | "admin" | "lawyer" | string;
}

interface LandingNavbarProps {
  data: LandingData | null;
  onOpenConsultation: () => void;
  currentUser?: NavbarUser | null;
}

const NAV_LINKS = [
  { label: "الرئيسية", href: "#hero" },
  { label: "استخراج الجلسات", href: "#features" },
  { label: "عن المنظومة", href: "#stats" },
  { label: "الأمان وعزل البيانات", href: "#security" },
  { label: "الأسئلة الشائعة", href: "#faq" },
  { label: "تواصل معنا", href: "#contact" },
];

export function LandingNavbar({
  data,
  onOpenConsultation,
  currentUser,
}: LandingNavbarProps) {
  const [, setLocation] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeHash, setActiveHash] = useState("#hero");

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);

      for (let i = NAV_LINKS.length - 1; i >= 0; i--) {
        const el = document.querySelector(NAV_LINKS[i].href);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 140) {
            setActiveHash(NAV_LINKS[i].href);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  const dashboardPath =
    currentUser?.role === "admin" || currentUser?.role === "super_admin"
      ? "/dashboard-admin"
      : "/dashboard";

  const scrollToSection = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    setActiveHash(href);
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header
      dir="rtl"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] shadow-xs py-3"
          : "bg-[#FBF9F5]/90 backdrop-blur-xs border-b border-[#EAE3D9]/70 py-4"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          {/* Brand Logo - Judicial Navy & Gold */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-9 h-9 rounded-xl bg-[#0B1B3D] text-white flex items-center justify-center shadow-xs border border-[#C99732]/30 group-hover:scale-105 transition-transform">
              <Scale className="w-5 h-5 text-[#C99732]" />
            </div>
            <div className="flex flex-col text-right">
              <span className="font-sans text-lg font-black tracking-tight text-[#0C1A30] group-hover:text-[#C99732] transition-colors leading-none">
                {data?.office?.name || "منصة ديوان القانونية"}
              </span>
              <span className="text-[10px] text-[#64748B] font-medium tracking-wide mt-0.5">
                منظومة العدالة الذكية
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav
            aria-label="التنقل الرئيسي"
            className="hidden md:flex items-center gap-1 lg:gap-1.5 px-3 py-1  text-[#475569] text-xs lg:text-sm font-medium  "
          >
            {NAV_LINKS.map((link) => {
              const isActive = activeHash === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => scrollToSection(e, link.href)}
                  className={`px-3 py-1.5 rounded-full transition-all duration-150 ${
                    isActive
                      ? "bg-[#0B1B3D] text-white font-semibold shadow-2xs"
                      : "text-[#475569] hover:text-[#0B1B3D] hover:bg-slate-100/70"
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          {/* Left CTA Actions */}
          <div className="hidden sm:flex items-center gap-2.5 shrink-0">
            {currentUser ? (
              <Button
                onClick={() => setLocation(dashboardPath)}
                className="h-9 px-4 rounded-xl bg-[#0B1B3D] hover:bg-[#071328] text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 border border-[#C99732]/25"
              >
                <span>لوحة التحكم</span>
                <ArrowLeft className="w-3.5 h-3.5 text-[#C99732]" />
              </Button>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-xs lg:text-sm font-medium text-[#475569] hover:text-[#0B1B3D] px-3 py-1.5 transition-colors"
                >
                  تسجيل الدخول
                </Link>
                <Button
                  onClick={onOpenConsultation}
                  className="h-9 px-4.5 rounded-xl bg-[#0B1B3D] hover:bg-[#071328] text-white text-xs lg:text-sm font-semibold shadow-xs flex items-center gap-1.5 transition-all hover:scale-102 border border-[#C99732]/30"
                >
                  <span>اطلب عرضاً تجريبياً</span>
                  <ArrowLeft className="w-3.5 h-3.5 text-[#C99732]" />
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-[#475569] hover:text-[#0B1B3D] hover:bg-slate-100 transition-colors"
            aria-label={mobileMenuOpen ? "إغلاق القائمة" : "فتح القائمة"}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-menu"
          className="md:hidden border-b border-[#E2E8F0] bg-white px-4 pt-3 pb-6 space-y-4 animate-in slide-in-from-top-3 duration-200"
        >
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => scrollToSection(e, link.href)}
                className="px-3 py-2 text-sm font-medium text-[#475569] hover:text-[#0B1B3D] hover:bg-slate-50 rounded-lg transition-colors text-right"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {currentUser ? (
              <Button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setLocation(dashboardPath);
                }}
                className="w-full h-10 rounded-xl bg-[#0B1B3D] text-white text-xs font-semibold"
              >
                الدخول للوحة التحكم
              </Button>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full h-10 rounded-xl border border-[#D6E0EC] text-[#0C1A30] font-semibold text-xs flex items-center justify-center hover:bg-slate-50 transition-colors"
                >
                  تسجيل الدخول
                </Link>
                <Button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenConsultation();
                  }}
                  className="w-full h-10 rounded-xl bg-[#0B1B3D] text-white text-xs font-semibold"
                >
                  اطلب عرضاً تجريبياً
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
