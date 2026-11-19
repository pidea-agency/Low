export interface LandingStats {
  totalJudgments: number;
  totalCases: number;
  totalSessions: number;
  totalClients: number;
  totalPoas: number;
  satisfactionRate: number;
  platformUptime: string;
  yearsOfExcellence: number;
}

export interface FeaturedSession {
  id: number;
  caseNumber: string;
  court: string;
  circuit: string;
  subject: string;
  date: string;
  time: string;
  status: string;
  plaintiff: string;
  defendant: string;
  notes: string;
}

export interface LandingPreview {
  todaySessionsCount: number;
  activeCasesCount: number;
  urgentTasksCount: number;
  featuredSessions: FeaturedSession[];
}

export interface LandingOffice {
  name: string;
  brandTitle: string;
  whatsappNumber: string;
  whatsappFormatted: string;
  whatsappUrl: string;
  address: string;
  email: string;
  emergencyPhone: string;
}

export interface LandingData {
  success: boolean;
  stats: LandingStats;
  preview: LandingPreview;
  office: LandingOffice;
}
