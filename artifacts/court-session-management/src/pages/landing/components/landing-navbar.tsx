import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Menu, X } from "lucide-react";
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
  { label: "المميزات", href: "#features" },
  { label: "آلية العمل", href: "#how-it-works" },
  { label: "الباقات", href: "#pricing" },
  { label: "الأسئلة الشائعة", href: "#faq" },
];

export function LandingNavbar({
  data,
  onOpenConsultation,
  currentUser,
}: LandingNavbarProps) {
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeHash, setActiveHash] = useState("#hero");

  useEffect(() => {
    const handleScroll = () => {
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

  const brandName = data?.office?.name || "ديوان";

  return (
    <header
      dir="rtl"
      className="sticky top-0 left-0 right-0 z-50 h-16 bg-[#0B1120]/90 backdrop-blur-md border-b border-slate-800/80 text-white transition-colors"
    >
      <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-full gap-4">
          {/* Right: Brand Logo + Name */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center border border-slate-700 transition-transform group-hover:scale-105">
              <span className="font-bold text-sm tracking-tighter text-emerald-400">د</span>
            </div>
            <div className="flex items-baseline gap-1.5 text-right">
              <span className="font-sans text-lg font-extrabold tracking-tight text-white leading-none">
                {brandName}
              </span>
              <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
                للحلول القانونية
              </span>
            </div>
          </Link>

          {/* Center: 4 Concise Navigation Links */}
          <nav
            aria-label="التنقل الرئيسي"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300"
          >
            {NAV_LINKS.map((link) => {
              const isActive = activeHash === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => scrollToSection(e, link.href)}
                  className={`transition-colors duration-150 relative py-1 ${
                    isActive
                      ? "text-white font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
                  )}
                </a>
              );
            })}
          </nav>

          {/* Left: Two Actions */}
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            {currentUser ? (
              <button
                onClick={() => setLocation(dashboardPath)}
                className="h-9 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
              >
                <span>لوحة التحكم</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  className="h-9 px-3.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors inline-flex items-center"
                >
                  تسجيل الدخول
                </Link>
                <button
                  onClick={onOpenConsultation}
                  className="h-9 px-4 rounded-lg bg-white text-slate-950 hover:bg-slate-100 text-sm font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  ابدأ تجربتك المجانية
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            aria-label={mobileMenuOpen ? "إغلاق القائمة" : "فتح القائمة"}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-white" />
            ) : (
              <Menu className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-menu"
          className="md:hidden border-b border-slate-800 bg-[#0B1120] text-white px-4 pt-3 pb-6 space-y-4 animate-in slide-in-from-top-2 duration-150"
        >
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => scrollToSection(e, link.href)}
                className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors text-right"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
            {currentUser ? (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setLocation(dashboardPath);
                }}
                className="w-full h-10 rounded-lg bg-slate-800 text-white text-sm font-medium flex items-center justify-center gap-2 border border-slate-700"
              >
                <span>لوحة التحكم</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full h-10 rounded-lg border border-slate-700 text-slate-200 font-medium text-sm flex items-center justify-center hover:bg-slate-800/60 transition-colors"
                >
                  تسجيل الدخول
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenConsultation();
                  }}
                  className="w-full h-10 rounded-lg bg-white text-slate-950 font-semibold text-sm hover:bg-slate-100 transition-colors"
                >
                  ابدأ تجربتك المجانية
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
