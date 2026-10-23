import { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * GrainPro app chrome (desktop sidebar + mobile drawer) for pages ported
 * from MWB that only render page content.
 */
export default function AppPageShell({ children, className = "" }) {
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {!isMobile && <Sidebar />}
      <MobileSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {isMobile ? (
          <div className="flex flex-shrink-0 items-center gap-2 border-b bg-white px-3 py-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        ) : null}

        <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${className}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
