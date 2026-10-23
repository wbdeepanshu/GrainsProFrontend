import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import logo from "@/assets/gp_logo1.png";
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
import { AuthService } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";

const iconMap = {
  gauge: Gauge,
  "building-2": Building2,
  "log-out": LogOut,
  "file-text": FileText,
  "users": Users,
  "bar-chart-3": BarChart3,
  "shield": Shield,
  "receipt": Receipt,
  "info": Info,
  "sliders-horizontal": SlidersHorizontal,
};

// Superadmin menu items - simplified without Masters
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
        // Clear superadmin tokens
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
    <div className="w-64 sidebar-gradient text-white flex-shrink-0 h-screen flex flex-col">
      <div className="p-4 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start space-x-3 flex-1">
            <div className="bg-white rounded-full flex-shrink-0">
              <img src={logo} alt="GrainsPro ERP Logo" className="h-12 w-auto" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-white leading-tight">GrainsPro ERP</h1>
              <p className="text-gray-300 text-xs leading-tight mt-1">Enterprise Resource Planning</p>
            </div>
          </div>
        </div>
      </div>
      
      <nav ref={navRef} className="flex-1 overflow-y-auto hide-scrollbar mt-2">
        {superadminMenuItems.map((item, index) => {
          // Handle separator items - they don't have icon or name
          if (item.separator) {
            return <div key={index} className="border-t border-gray-700 mt-4" />;
          }

          // Get icon for menu items
          const Icon = iconMap[item.icon];
          if (!Icon) {
            console.error(`Icon not found for: ${item.icon}`, item);
            return null;
          }

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
                "w-full flex items-center justify-between px-6 py-3 transition-all text-left block",
                item.name === "Log out" ? "text-white hover:bg-gray-700 hover:text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white",
                isActive && "border-r-4 border-white bg-gray-700 text-white"
              )}
            >
              <div className="flex items-center">
                <Icon className="mr-3 h-5 w-5" />
                <span>{item.name}</span>
              </div>
            </a>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-700 flex-shrink-0">
        <p className="text-gray-400 text-xs text-center">
          © 2026 All rights reserved. • MWB Technologies India Pvt Ltd
        </p>
      </div>
    </div>
  );
}
