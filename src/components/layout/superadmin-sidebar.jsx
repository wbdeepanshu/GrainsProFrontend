import { useRef } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import logo from "@/assets/new_logo.png";
import {
  Gauge,
  Building2,
  LogOut,
  FileText,
  Users,
  BarChart3,
  Shield,
  Receipt,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";

const iconMap = {
  gauge: Gauge,
  "building-2": Building2,
  "log-out": LogOut,
  "file-text": FileText,
  users: Users,
  "bar-chart-3": BarChart3,
  shield: Shield,
  receipt: Receipt,
  info: Info,
  "sliders-horizontal": SlidersHorizontal,
};

const superadminMenuItems = [
  { name: "Dashboard", icon: "gauge", path: "/superadmin/dashboard" },
  { name: "Onboarding Flow", icon: "info", path: "/superadmin/onboarding-design" },
  { name: "Organizations", icon: "building-2", path: "/superadmin/organizations" },
  { name: "Branches", icon: "building-2", path: "/superadmin/branches" },
  { name: "All Users", icon: "users", path: "/superadmin/all-users" },
  { name: "Admin List", icon: "shield", path: "/superadmin/admin-list" },
  { name: "Admin Settings", icon: "sliders-horizontal", path: "/superadmin/admin-settings" },
  { name: "Voucher Types", icon: "receipt", path: "/superadmin/voucher-types" },
  { separator: true },
  { name: "Analysis Reports", icon: "bar-chart-3", path: "/superadmin/analysis-reports" },
  { name: "Stock Journals", icon: "bar-chart-3", path: "/superadmin/stock-journals" },
  { separator: true },
  { name: "Privacy Policy", icon: "file-text", path: "/privacy" },
  { name: "Contact Us", icon: "file-text", path: "/contact-us" },
  { separator: true },
  { name: "Log out", icon: "log-out", path: "/superadmin/login" },
];

export default function SuperAdminSidebar() {
  const [location, setLocation] = useLocation();
  const navRef = useRef(null);

  const handleNavigation = async (path, name) => {
    if (name === "Log out") {
      try {
        localStorage.removeItem("superadmin_token");
        localStorage.removeItem("superadmin_user");
        queryClient.clear();
        queryClient.invalidateQueries();
        queryClient.resetQueries();
        setLocation("/superadmin/login");
      } catch (error) {
        console.error("Logout error:", error);
        localStorage.removeItem("superadmin_token");
        localStorage.removeItem("superadmin_user");
        queryClient.clear();
        queryClient.invalidateQueries();
        queryClient.resetQueries();
        setLocation("/superadmin/login");
      }
    } else {
      setLocation(path);
    }
  };

  return (
    <div className="w-64 bg-[#141414] text-white flex-shrink-0 h-screen flex flex-col border-r border-[#c9a227]/40">
      <div className="p-3 border-b border-[#c9a227]/35 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="bg-white rounded-full p-0.5 flex-shrink-0 border border-[#c9a227]/50">
            <img src={logo} alt="GrainsPro ERP Logo" className="h-10 w-10 object-contain" />
          </div>
          <div className="flex flex-col min-w-0">
            <h1 className="text-sm font-bold text-white leading-tight truncate">GrainsPro ERP</h1>
            <p className="text-[#c9a227] text-[10px] font-semibold uppercase tracking-wide leading-tight mt-0.5">
              Super Admin
            </p>
          </div>
        </div>
      </div>

      <nav ref={navRef} className="flex-1 overflow-y-auto hide-scrollbar mt-1.5 pb-2">
        {superadminMenuItems.map((item, index) => {
          if (item.separator) {
            return (
              <div key={index} className="border-t border-[#c9a227]/25 mx-4 my-2" />
            );
          }

          const Icon = iconMap[item.icon];
          if (!Icon) return null;

          const isActive =
            location === item.path ||
            (item.name === "Dashboard" && location === "/superadmin/dashboard") ||
            (item.name === "Onboarding Design" && location === "/superadmin/onboarding-design") ||
            (item.name === "Organizations" && location === "/superadmin/organizations") ||
            (item.name === "Branches" && location === "/superadmin/branches") ||
            (item.name === "All Users" && location === "/superadmin/all-users") ||
            (item.name === "Admin List" && location === "/superadmin/admin-list") ||
            (item.name === "Admin Settings" && location === "/superadmin/admin-settings") ||
            (item.name === "Voucher Types" && location === "/superadmin/voucher-types") ||
            (item.name === "Analysis Reports" && location === "/superadmin/analysis-reports") ||
            (item.name === "Stock Journals" && location === "/superadmin/stock-journals") ||
            (item.name === "Privacy Policy" && location === "/privacy") ||
            (item.name === "Contact Us" && location === "/contact-us");

          return (
            <a
              key={index}
              href={item.path}
              onClick={(e) => {
                if (item.name === "Log out") {
                  e.preventDefault();
                  handleNavigation(item.path, item.name);
                }
              }}
              className={cn(
                "w-full flex items-center justify-between px-4 py-2 text-sm transition-all text-left block",
                item.name === "Log out"
                  ? "text-red-300 hover:bg-red-950/40 hover:text-red-200"
                  : "text-neutral-300 hover:bg-neutral-900 hover:text-white",
                isActive &&
                  "border-r-2 border-[#c9a227] bg-neutral-900 text-white"
              )}
            >
              <div className="flex items-center min-w-0">
                <Icon
                  className={cn(
                    "mr-2.5 h-4 w-4 shrink-0",
                    isActive ? "text-[#c9a227]" : "text-neutral-400"
                  )}
                />
                <span className="truncate">{item.name}</span>
              </div>
            </a>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[#c9a227]/35 flex-shrink-0">
        <p className="text-neutral-500 text-[10px] text-center leading-snug">
          © {new Date().getFullYear()} All rights reserved.
        </p>
        <p className="text-[#c9a227]/80 text-[10px] text-center font-medium mt-0.5">
          MWB Technologies India Pvt Ltd
        </p>
      </div>
    </div>
  );
}
