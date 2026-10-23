import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import SuperAdminSidebar from "@/components/layout/superadmin-sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Menu, ArrowLeft, UserPlus, Building2, GitBranch, Settings, CheckCircle2, UploadCloud } from "lucide-react";

const ADMIN_CREATION_STEPS = [
  { id: 1, title: "Register admin", icon: UserPlus, color: "from-violet-500 to-indigo-500" },
  { id: 2, title: "Create Organization", icon: Building2, color: "from-sky-500 to-cyan-500" },
  { id: 3, title: "Create Branch", icon: GitBranch, color: "from-emerald-500 to-teal-500" },
  { id: 4, title: "Create tally configuration", icon: Settings, color: "from-amber-500 to-orange-500" },
  { id: 5, title: "Admin is created and Navigate to Admin login screen", icon: CheckCircle2, color: "from-rose-500 to-pink-500" },
];

const ADMIN_POST_LOGIN_STEPS = [
  "Import Godown Master",
  "Import Item Master",
  "Import Voucher Type Master",
  "Import Ledger Master",
];

export default function SuperAdminOnboardingDesign() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [activePostStep, setActivePostStep] = useState(1);

  useEffect(() => {
    const token = localStorage.getItem("superadmin_token");
    if (!token) {
      setLocation("/superadmin/login");
    }
  }, [setLocation]);

  useEffect(() => {
    const t = setInterval(() => {
      setActiveStep((prev) => (prev >= ADMIN_CREATION_STEPS.length ? 1 : prev + 1));
    }, 1800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setActivePostStep((prev) => (prev >= ADMIN_POST_LOGIN_STEPS.length ? 1 : prev + 1));
    }, 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="app-layout relative overflow-hidden bg-gray-50">
      <div className="pointer-events-none absolute -top-20 -left-20 h-72 w-72 rounded-full bg-indigo-200/50 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute top-40 right-20 h-64 w-64 rounded-full bg-blue-200/40 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute bottom-10 left-1/3 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl animate-pulse" />

      {!isMobile && <SuperAdminSidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <div className="app-main-content">
        <div className="bg-white border-b border-gray-200 px-4 py-3 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button variant="ghost" size="icon" className="text-gray-700 hover:bg-gray-100" onClick={() => setIsMobileSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="text-gray-700 hover:bg-gray-100" onClick={() => setLocation("/superadmin/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Super Admin Wizard</h1>
              <p className="text-sm text-gray-600">Visual onboarding blueprint with animated step flow.</p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => setLocation("/superadmin/dashboard")}
            className="bg-black text-white hover:bg-gray-800"
          >
            Dashboard
          </Button>
        </div>

        <div className="p-4 sm:p-6 space-y-6 overflow-auto">
          <Card className="border border-gray-200 shadow-md bg-white">
            <CardHeader>
              <CardTitle className="text-gray-900">Phase 1: Admin Creation Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="hidden lg:flex items-center gap-3 mb-6">
                {ADMIN_CREATION_STEPS.map((step) => {
                  const done = step.id <= activeStep;
                  return (
                    <div key={`rail-${step.id}`} className="flex items-center gap-3 flex-1">
                      <div
                        className={`h-3 w-3 rounded-full transition-all duration-500 ${done ? "bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.5)]" : "bg-gray-300"}`}
                      />
                      <div
                        className={`h-1 flex-1 rounded-full transition-all duration-500 ${done ? "bg-gradient-to-r from-emerald-500 to-cyan-500" : "bg-gray-200"}`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {ADMIN_CREATION_STEPS.map((step) => {
                  const Icon = step.icon;
                  const done = step.id <= activeStep;
                  const active = step.id === activeStep;
                  return (
                    <div
                      key={step.id}
                      className={`rounded-2xl transition-all duration-500 border p-4 ${done ? "border-emerald-300 bg-white shadow-lg" : "border-gray-200 bg-gray-50"} ${active ? "scale-[1.03]" : "scale-100"}`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className={`h-11 w-11 rounded-xl bg-gradient-to-r ${step.color} text-white flex items-center justify-center ${active ? "animate-bounce" : ""}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className={`text-xs font-semibold ${done ? "text-emerald-700" : "text-gray-500"}`}>Step {step.id}</span>
                      </div>
                      <p className={`text-sm font-medium leading-relaxed ${done ? "text-slate-800" : "text-gray-700"}`}>{step.title}</p>
                      {active && (
                        <div className="mt-3 h-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 via-indigo-500 to-cyan-500 animate-pulse" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-md bg-white">
            <CardHeader>
              <CardTitle className="text-gray-900">Phase 2: Initial Steps After Admin Login</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="hidden lg:flex items-center gap-3 mb-6">
                {ADMIN_POST_LOGIN_STEPS.map((_, idx) => {
                  const done = idx + 1 <= activePostStep;
                  return (
                    <div key={`post-rail-${idx}`} className="flex items-center gap-3 flex-1">
                      <div
                        className={`h-3 w-3 rounded-full transition-all duration-500 ${done ? "bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.5)]" : "bg-gray-300"}`}
                      />
                      <div
                        className={`h-1 flex-1 rounded-full transition-all duration-500 ${done ? "bg-gradient-to-r from-emerald-500 to-cyan-500" : "bg-gray-200"}`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ADMIN_POST_LOGIN_STEPS.map((label, index) => {
                  const stepNo = index + 1;
                  const done = stepNo <= activePostStep;
                  const active = stepNo === activePostStep;
                  return (
                    <div
                      key={label}
                      className={`rounded-2xl transition-all duration-500 border p-4 flex items-start gap-3 ${done ? "border-emerald-300 bg-white shadow-lg" : "border-gray-200 bg-gray-50"} ${active ? "scale-[1.02]" : "scale-100"}`}
                    >
                      <div className={`relative h-10 w-10 rounded-lg text-white flex items-center justify-center shrink-0 ${done ? "bg-indigo-600" : "bg-gray-400"}`}>
                        <UploadCloud className="h-5 w-5" />
                        {active && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 animate-ping" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs uppercase tracking-wide font-semibold ${done ? "text-indigo-700" : "text-gray-500"}`}>
                          Task {stepNo}
                        </p>
                        <p className={`text-sm font-medium ${done ? "text-slate-800" : "text-gray-700"}`}>{label}</p>
                        {active && (
                          <div className="mt-3 h-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 via-indigo-500 to-cyan-500 animate-pulse" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

