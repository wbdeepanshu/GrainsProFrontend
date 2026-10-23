import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Menu, Mail, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const EFFECTIVE_DATE = "July 01, 2026";
const LAST_UPDATED = "July 01, 2026";
const CONTACT_EMAIL = "reachus@wbtechindia.com";
const CONTACT_ADDRESS =
  "1st Floor, WB Plaza, New Cotton Market, Deshpande Nagar, Hubballi, Karnataka, 580029";

const INTRO_TEXT =
  'GrainsPro ERP ("we," "our," "us") respects your privacy and is committed to protecting the personal information you share with us. This Privacy Policy describes how we collect, use, disclose, and safeguard information when you use the MWB ERP mobile application ("App").';

function TriangleList({ items }) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm sm:text-base text-gray-300 leading-relaxed">
          <span className="text-white shrink-0 text-[10px] mt-1.5" aria-hidden>
            ▶
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SectionHeading({ title }) {
  return (
    <div className="flex items-stretch gap-3 mb-4">
      <div className="w-1 shrink-0 rounded-full bg-white self-stretch min-h-[1.5rem]" />
      <h2 className="text-base sm:text-lg font-bold text-white leading-snug">{title}</h2>
    </div>
  );
}

function SubHeading({ children }) {
  return <p className="font-semibold text-white text-sm sm:text-base mb-2">{children}</p>;
}

function PolicyAccordionItem({ id, title, isOpen, onToggle, children }) {
  return (
    <div
      id={id}
      className={cn(
        "rounded-2xl border border-white/10 bg-[#2c2c2e] overflow-hidden transition-colors scroll-mt-24",
        isOpen && "ring-1 ring-white/15"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-4 sm:py-5 flex items-center relative text-left hover:bg-white/5 transition-colors"
        aria-expanded={isOpen}
      >
        <span
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-xs sm:text-sm"
          aria-hidden
        >
          {isOpen ? "▼" : "▶"}
        </span>
        <span className="flex-1 text-left text-white text-sm sm:text-base font-medium pl-8 pr-4">
          {title}
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-white/10 bg-[#1c1c1e] px-4 sm:px-6 py-5 sm:py-6 rounded-b-2xl">
          {children}
        </div>
      )}
    </div>
  );
}

const POLICY_SECTIONS = [
  {
    id: "information-we-collect",
    title: "1. Information We Collect",
    content: (
      <>
        <SectionHeading title="1. Information We Collect" />
        <SubHeading>a) Information You Provide</SubHeading>
        <TriangleList
          items={[
            "Account details (name, email address, phone number, password).",
            "Factory/farm details (location, unit names, materials, products).",
            "Operational data you enter in the App (consumption notes, production notes, stock transfers, journal entries, attachments, comments).",
          ]}
        />
        <SubHeading>b) Information Collected Automatically</SubHeading>
        <TriangleList
          items={[
            "Device information (hardware model, OS version, app version).",
            "Log and diagnostic data (IP address, timestamps, in-app events, crash reports, performance metrics).",
            "Approximate location, if enabled for features like site tagging.",
          ]}
        />
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "2. How We Use Your Information",
    content: (
      <>
        <SectionHeading title="2. How We Use Your Information" />
        <TriangleList
          items={[
            "Provide, operate, and maintain App features.",
            "Record and reconcile consumption, production, and inventory movement.",
            "Enable user authentication, roles, and access control.",
            "Send service communications (e.g., security, feature or policy updates).",
            "Monitor usage, troubleshoot issues, and improve performance and UX.",
            "Comply with legal obligations and enforce our terms.",
          ]}
        />
      </>
    ),
  },
  {
    id: "sharing",
    title: "3. Sharing Your Information",
    content: (
      <>
        <SectionHeading title="3. Sharing Your Information" />
        <p className="text-sm sm:text-base text-gray-300 leading-relaxed mb-4">
          We do not sell or rent your personal information. We may share information only:
        </p>
        <TriangleList
          items={[
            "With your consent or at your direction.",
            "With service providers that process data on our behalf (e.g., hosting, analytics, error reporting) under appropriate confidentiality and data-processing terms.",
            "To comply with law, legal process, or to protect rights, property, and safety.",
            "In connection with a business transfer (e.g., merger or acquisition) where the receiving party assumes privacy commitments substantially similar to this Policy.",
          ]}
        />
      </>
    ),
  },
  {
    id: "data-retention",
    title: "4. Data Retention",
    content: (
      <>
        <SectionHeading title="4. Data Retention" />
        <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
          We retain personal information for as long as your account is active or as needed to provide
          the App, comply with legal obligations, resolve disputes, and enforce agreements. You may
          request deletion of your data or account by contacting us (see Contact Us).
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "5. Security",
    content: (
      <>
        <SectionHeading title="5. Security" />
        <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
          We implement reasonable technical and organizational safeguards to protect information from
          unauthorized access, alteration, disclosure, or destruction. However, no method of
          transmission or storage is completely secure.
        </p>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "6. Your Rights",
    content: (
      <>
        <SectionHeading title="6. Your Rights" />
        <TriangleList
          items={[
            "Access, correct, or delete personal data we hold about you.",
            "Withdraw consent where processing is based on consent (this may affect certain features).",
            "Object to or restrict certain processing, where applicable by law.",
          ]}
        />
        <p className="text-sm sm:text-base text-gray-300 leading-relaxed mt-4">
          To exercise these rights, contact us using the details below. We may request verification to
          protect your account.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "7. Children's Privacy",
    content: (
      <>
        <SectionHeading title="7. Children's Privacy" />
        <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
          The App is not intended for children under 13, and we do not knowingly collect personal
          data from children. If you believe a child has provided personal data, contact us and we
          will take appropriate action.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "8. Changes to This Policy",
    content: (
      <>
        <SectionHeading title="8. Changes to This Policy" />
        <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
          We may update this Policy from time to time. When we do, we will revise the &quot;Effective
          Date&quot; above. Continued use of the App after changes means you accept the updated Policy.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "9. Contact Us",
    content: (
      <>
        <SectionHeading title="9. Contact Us" />
        <p className="text-sm sm:text-base text-gray-300 leading-relaxed mb-4">
          If you have questions or requests regarding this Policy, please contact:
        </p>
        <div className="rounded-xl border border-white/10 bg-[#2c2c2e] p-4 space-y-4">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="flex items-start gap-3 text-gray-200 hover:text-white transition-colors group"
          >
            <Mail className="h-5 w-5 text-gray-400 shrink-0 mt-0.5 group-hover:text-white" />
            <span>
              <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                Email
              </span>
              <span className="text-sm sm:text-base text-blue-400 group-hover:underline">
                {CONTACT_EMAIL}
              </span>
            </span>
          </a>
          <div className="flex items-start gap-3 text-gray-200">
            <MapPin className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
            <span>
              <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                Address
              </span>
              <span className="text-sm sm:text-base">{CONTACT_ADDRESS}</span>
            </span>
          </div>
        </div>
      </>
    ),
  },
];

export default function Privacy() {
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [openSectionId, setOpenSectionId] = useState(null);

  const toggleSection = (id) => {
    setOpenSectionId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="app-layout bg-black">
      {!isMobile && <Sidebar />}
      {isMobile && (
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <div className="app-main-content bg-black flex flex-col min-w-0 flex-1">
        <header className="app-header bg-[#1c1c1e] shadow-sm border-b border-white/10 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3 min-h-[2rem] w-full">
            {isMobile && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md text-gray-300 hover:text-white hover:bg-white/10 shrink-0"
              >
                <Menu className="h-6 w-6" />
              </Button>
            )}
            <h1 className="text-lg sm:text-xl font-semibold text-white">
              Privacy Policy
            </h1>
          </div>
        </header>

        <main className="app-main-scrollable w-full p-4 sm:p-6 lg:p-8 bg-black">
          <div className="w-full max-w-none space-y-6 pb-8">
            {/* Hero card */}
            <div className="w-full rounded-2xl border border-white/10 bg-[#1c1c1e] px-5 sm:px-8 py-8 sm:py-10 text-left shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
              <h2 className="text-2xl sm:text-3xl font-bold text-white">Privacy Policy</h2>
              <p className="text-white mt-1 text-base sm:text-lg">
                for <span className="font-bold">GrainsPro ERP</span>
              </p>
              <div className="inline-flex mt-5 rounded-xl bg-[#2c2c2e] border border-white/10 px-4 py-2.5">
                <span className="text-sm sm:text-base font-semibold text-white">
                  Effective Date: {EFFECTIVE_DATE}
                </span>
              </div>
              <p className="text-sm sm:text-base text-gray-300 leading-relaxed mt-6 max-w-none">
                {INTRO_TEXT}
              </p>
            </div>

            <div className="h-px bg-white/10" />

            {/* Contents */}
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 sm:h-9 rounded-full bg-white shrink-0" />
              <h3 className="text-xl sm:text-2xl font-bold text-white">Contents</h3>
            </div>

            {/* Accordion sections */}
            <div className="w-full space-y-3">
              {POLICY_SECTIONS.map((section) => (
                <PolicyAccordionItem
                  key={section.id}
                  id={section.id}
                  title={section.title}
                  isOpen={openSectionId === section.id}
                  onToggle={() => toggleSection(section.id)}
                >
                  {section.content}
                </PolicyAccordionItem>
              ))}
            </div>

            <footer className="w-full text-left text-sm text-gray-500 space-y-1 pt-4 border-t border-white/10">
              <p>Last updated: {LAST_UPDATED}</p>
              <p className="font-medium text-gray-400">
                © 2026 MWB Technologies India Pvt. Ltd. All rights reserved.
              </p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
