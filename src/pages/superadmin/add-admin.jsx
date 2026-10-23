import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import SuperAdminSidebar from "@/components/layout/superadmin-sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, User, CheckCircle, Building2, Settings, Loader2, Menu, Plus, X } from "lucide-react";
import CommonLoader from "@/components/common/loader";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const USER_API = `${API_BASE_URL}/api`;
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/** Base URL for Easy Pagar grainpro APIs (no trailing slash). Env must be VITE_* and requires dev server restart after .env changes. */
const EASY_PAGAR_URL =
  String(import.meta.env.VITE_EASY_PAGAR_URL || "")
    .trim()
    .replace(/\/+$/, "") || "https://easypagar.com/portalv1apis/api/grainpro";
const EASY_PAGAR_GET_ADMIN_PROFILE = `${EASY_PAGAR_URL}/GetAdminProfile`;
const EASY_PAGAR_GET_ORG_DETAILS = `${EASY_PAGAR_URL}/GetOrgDetails`;
const EASY_PAGAR_GET_BRANCH_LIST = `${EASY_PAGAR_URL}/GetBranchList`;

const getAddressComponent = (components, type) => {
  const component = (components || []).find((item) => item.types?.includes(type));
  return component?.long_name || "";
};

const STEPS = [
  { id: 1, title: "Register User", icon: User },
  { id: 2, title: "Verify OTP", icon: CheckCircle },
  { id: 3, title: "Create Organization", icon: Building2 },
  { id: 4, title: "Add Branches", icon: Building2 },
  { id: 5, title: "Tally Config", icon: Settings },
];

function getSuperAdminToken() {
  return localStorage.getItem("superadmin_token");
}

export default function AddAdmin() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingCompany, setIsFetchingCompany] = useState(false);
  const [companyListForSelection, setCompanyListForSelection] = useState(null);
  const { toast } = useToast();

  const [isEasyPagarUser, setIsEasyPagarUser] = useState(false);
  const [easyPagarProfileLoading, setEasyPagarProfileLoading] = useState(false);
  /** OrgID from GetAdminProfile (Easy Pagar); used on Step 3 for GetOrgDetails */
  const [easyPagarOrgId, setEasyPagarOrgId] = useState(null);
  /** Admin id from GetAdminProfile; sent with register when Is easy pagar user is checked */
  const [easyPagarAdminId, setEasyPagarAdminId] = useState(null);
  const [easyPagarOrgLoading, setEasyPagarOrgLoading] = useState(false);
  const [easyPagarOrgDetailsFetchedForId, setEasyPagarOrgDetailsFetchedForId] = useState(null);
  const easyPagarOrgAbortRef = useRef(null);

  const [easyPagarBranchListLoading, setEasyPagarBranchListLoading] = useState(false);
  const [easyPagarBranchListFetchedForOrgId, setEasyPagarBranchListFetchedForOrgId] = useState(null);
  const [easyPagarBranchPickerOpen, setEasyPagarBranchPickerOpen] = useState(false);
  const [easyPagarBranchPickerItems, setEasyPagarBranchPickerItems] = useState([]);
  const [easyPagarBranchPickerSelected, setEasyPagarBranchPickerSelected] = useState(() => new Set());
  /** Draft rows from Easy Pagar (branch name only until user fills address and saves). */
  const [easyPagarBranchRows, setEasyPagarBranchRows] = useState([]);

  const [registerData, setRegisterData] = useState({
    name: "",
    mobile: "",
    password: "",
    email: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [otp, setOtp] = useState("");
  const [accessToken, setAccessToken] = useState(null);
  const [createdUserId, setCreatedUserId] = useState("");
  const [orgData, setOrgData] = useState({
    name: "",
    gst_number: "",
    organization_type: "Company",
    address: "",
    city: "",
    state: "",
    pincode: "",
    lat: "",
    long: "",
    is_tally_enabled: true,
  });
  const [tallyData, setTallyData] = useState({
    name: "",
    tally_host: "",
    tally_port: "",
  });
  const [shouldConfigureTally, setShouldConfigureTally] = useState(true);
  const [branchData, setBranchData] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    lat: "",
    long: "",
    is_active: true,
  });
  const [createdBranches, setCreatedBranches] = useState([]);
  const [branchAddressSuggestions, setBranchAddressSuggestions] = useState([]);
  const [showBranchAddressSuggestions, setShowBranchAddressSuggestions] = useState(false);
  const [branchAddressLoading, setBranchAddressLoading] = useState(false);
  const [branchAddressError, setBranchAddressError] = useState("");
  const [registerAddressSuggestions, setRegisterAddressSuggestions] = useState([]);
  const [showRegisterAddressSuggestions, setShowRegisterAddressSuggestions] = useState(false);
  const [registerAddressLoading, setRegisterAddressLoading] = useState(false);
  const [registerAddressError, setRegisterAddressError] = useState("");
  const [orgAddressSuggestions, setOrgAddressSuggestions] = useState([]);
  const [showOrgAddressSuggestions, setShowOrgAddressSuggestions] = useState(false);
  const [orgAddressLoading, setOrgAddressLoading] = useState(false);
  const [orgAddressError, setOrgAddressError] = useState("");
  const defaultBranchCoordsLookupRef = useRef("");

  useEffect(() => {
    if (!getSuperAdminToken()) {
      setLocation("/superadmin/login");
    }
  }, [setLocation]);

  // When "Is easy pagar user" is checked and mobile is 10 digits, fetch profile and fill form fields
  useEffect(() => {
    if (!isEasyPagarUser) {
      setEasyPagarProfileLoading(false);
      setEasyPagarAdminId(null);
      return;
    }
    const mobile = (registerData.mobile || "").replace(/\D/g, "");
    if (mobile.length !== 10) {
      setEasyPagarProfileLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setEasyPagarProfileLoading(true);
      try {
        const url = `${EASY_PAGAR_GET_ADMIN_PROFILE}?Username=${encodeURIComponent(mobile)}`;
        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json().catch(() => ({}));
        if (controller.signal.aborted) return;

        if (!data?.Status || !Array.isArray(data.List) || data.List.length === 0) {
          setEasyPagarOrgId(null);
          setEasyPagarAdminId(null);
          toast({
            title: "Easy Pagar ",
             description: "User not found.",
            variant: "destructive",
          });
          return;
        }

        const row = data.List[0];
        const rawOrgId = row.OrgID ?? row.OrgId ?? row.org_id;
        const parsedOrgId =
          rawOrgId != null && rawOrgId !== "" && !Number.isNaN(Number(rawOrgId))
            ? Number(rawOrgId)
            : null;
        setEasyPagarOrgId(parsedOrgId);

        const rawAdminId = row.AdminID ?? row.AdminId ?? row.admin_id ?? row.ID ?? row.Id;
        const parsedAdminId =
          rawAdminId != null && String(rawAdminId).trim() !== "" && !Number.isNaN(Number(rawAdminId))
            ? Number(rawAdminId)
            : null;
        setEasyPagarAdminId(parsedAdminId);

        const fullName = [row.FirstName, row.LastName].filter(Boolean).join(" ").trim();
        const addr = (row.Address || row.Location || "").trim();
        const pc = row.Postalcode != null && String(row.Postalcode).trim() !== "" ? String(row.Postalcode).trim() : "";

        setRegisterData((prev) => ({
          ...prev,
          mobile,
          name: fullName || prev.name,
          email: row.Email != null && String(row.Email).trim() !== "" ? String(row.Email).trim() : prev.email,
          address: addr || prev.address,
          city: row.City != null && String(row.City).trim() !== "" ? String(row.City).trim() : prev.city,
          state: row.State != null && String(row.State).trim() !== "" ? String(row.State).trim() : prev.state,
          pincode: pc || prev.pincode,
        }));
      } catch (err) {
        if (err?.name === "AbortError") return;
        setEasyPagarOrgId(null);
        setEasyPagarAdminId(null);
        toast({
          title: "Easy Pagar",
          description:
            err?.message ||
            "Could not load profile. If this persists, the request may be blocked by browser CORS when calling Easy Pagar from this origin.",
          variant: "destructive",
        });
      } finally {
        if (!controller.signal.aborted) {
          setEasyPagarProfileLoading(false);
        }
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isEasyPagarUser, registerData.mobile]);

  // New OrgID from profile → allow fetching org details again on Step 3 / branch list on Step 4
  useEffect(() => {
    setEasyPagarOrgDetailsFetchedForId(null);
    setEasyPagarBranchListFetchedForOrgId(null);
  }, [easyPagarOrgId]);

  // Step 3: Easy Pagar — fetch organization by OrgID and fill org form (name, address, etc.)
  useEffect(() => {
    if (step !== 3 || !isEasyPagarUser || easyPagarOrgId == null) {
      setEasyPagarOrgLoading(false);
      return;
    }
    if (easyPagarOrgDetailsFetchedForId === easyPagarOrgId) return;

    if (easyPagarOrgAbortRef.current) {
      easyPagarOrgAbortRef.current.abort();
    }
    const controller = new AbortController();
    easyPagarOrgAbortRef.current = controller;

    setEasyPagarOrgLoading(true);
    (async () => {
      try {
        const url = `${EASY_PAGAR_GET_ORG_DETAILS}?OrgID=${encodeURIComponent(easyPagarOrgId)}`;
        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json().catch(() => ({}));
        if (controller.signal.aborted) return;

        if (!data?.Status || !Array.isArray(data.List) || data.List.length === 0) {
          toast({
            title: "Easy Pagar",
            description: data?.Message || "Could not load organization details.",
            variant: "destructive",
          });
          return;
        }

        const o = data.List[0];
        const orgName = (o.Name || "").trim();
        const loc = (o.Location || "").trim();
        const pc =
          o.Postalcode != null && String(o.Postalcode).trim() !== ""
            ? String(o.Postalcode).trim()
            : "";

        setOrgData((prev) => ({
          ...prev,
          name: orgName || prev.name,
          address: loc || prev.address,
          city:
            o.City != null && String(o.City).trim() !== ""
              ? String(o.City).trim()
              : prev.city,
          state:
            o.State != null && String(o.State).trim() !== ""
              ? String(o.State).trim()
              : prev.state,
          pincode: pc || prev.pincode,
        }));
        setEasyPagarOrgDetailsFetchedForId(easyPagarOrgId);
      } catch (err) {
        if (err?.name === "AbortError") return;
        toast({
          title: "Easy Pagar",
          description:
            err?.message ||
            "Could not load organization. The request may be blocked by CORS from this origin.",
          variant: "destructive",
        });
      } finally {
        if (!controller.signal.aborted) {
          setEasyPagarOrgLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [step, isEasyPagarUser, easyPagarOrgId, easyPagarOrgDetailsFetchedForId]);

  // Step 4: Easy Pagar — fetch branches by OrgID; multiple → checkbox dialog; name-only drafts
  useEffect(() => {
    if (step !== 4 || !isEasyPagarUser || easyPagarOrgId == null) {
      setEasyPagarBranchListLoading(false);
      return;
    }
    if (easyPagarBranchListFetchedForOrgId === easyPagarOrgId) return;

    const controller = new AbortController();
    setEasyPagarBranchListLoading(true);

    (async () => {
      try {
        const url = `${EASY_PAGAR_GET_BRANCH_LIST}?OrgID=${encodeURIComponent(easyPagarOrgId)}`;
        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json().catch(() => ({}));
        if (controller.signal.aborted) return;

        if (!data?.Status || !Array.isArray(data.List) || data.List.length === 0) {
          toast({
            title: "Easy Pagar",
            description: data?.Message || "No branches found for this organization.",
          });
          setEasyPagarBranchListFetchedForOrgId(easyPagarOrgId);
          return;
        }

        const normalized = data.List.map((item) => ({
          value: Number(item.Value ?? item.value),
          text: String(item.Text ?? item.text ?? "").trim(),
        })).filter((x) => x.text && !Number.isNaN(x.value));

        if (normalized.length === 0) {
          toast({
            title: "Easy Pagar",
            description: "Branch list was empty.",
            variant: "destructive",
          });
          setEasyPagarBranchListFetchedForOrgId(easyPagarOrgId);
          return;
        }

        if (normalized.length === 1) {
          setEasyPagarBranchRows((prev) => {
            const id = `ep-${normalized[0].value}`;
            if (prev.some((r) => r.id === id)) return prev;
            return [
              ...prev,
              {
                id,
                branch_id: normalized[0].value,
                name: normalized[0].text,
                address: "",
                city: "",
                state: "",
                pincode: "",
                lat: "",
                long: "",
                is_active: true,
              },
            ];
          });
        } else {
          setEasyPagarBranchPickerItems(normalized);
          setEasyPagarBranchPickerSelected(new Set(normalized.map((x) => x.value)));
          setEasyPagarBranchPickerOpen(true);
        }
        setEasyPagarBranchListFetchedForOrgId(easyPagarOrgId);
      } catch (err) {
        if (err?.name === "AbortError") return;
        toast({
          title: "Easy Pagar",
          description:
            err?.message ||
            "Could not load branch list. The request may be blocked by browser CORS when calling Easy Pagar from this origin.",
          variant: "destructive",
        });
      } finally {
        if (!controller.signal.aborted) {
          setEasyPagarBranchListLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [step, isEasyPagarUser, easyPagarOrgId, easyPagarBranchListFetchedForOrgId]);

  useEffect(() => {
    // Auto-fill organization address fields from registration details when reaching org step.
    if (step === 3) {
      setOrgData((prev) => ({
        ...prev,
        address: prev.address || registerData.address || "",
        city: prev.city || registerData.city || "",
        state: prev.state || registerData.state || "",
        pincode: prev.pincode || registerData.pincode || "",
      }));
    }
  }, [step, registerData.address, registerData.city, registerData.state, registerData.pincode]);

  useEffect(() => {
    // Keep tally config name prefilled from organization name unless user already typed one.
    if (step === 5) {
      setTallyData((prev) => ({
        ...prev,
        name: prev.name || orgData.name || "",
      }));
    }
  }, [step, orgData.name]);

  useEffect(() => {
    if (step !== 4 || !isEasyPagarUser) return;
    setBranchData({
      name: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      lat: "",
      long: "",
      is_active: true,
    });
  }, [step, isEasyPagarUser]);

  useEffect(() => {
    if (step !== 4 || isEasyPagarUser) return;
    setBranchData((prev) => ({
      ...prev,
      address: prev.address || orgData.address || "",
      city: prev.city || orgData.city || "",
      state: prev.state || orgData.state || "",
      pincode: prev.pincode || orgData.pincode || "",
      lat: prev.lat || orgData.lat || "",
      long: prev.long || orgData.long || "",
    }));
  }, [step, isEasyPagarUser, orgData.address, orgData.city, orgData.state, orgData.pincode, orgData.lat, orgData.long]);

  useEffect(() => {
    if (step !== 4 || isEasyPagarUser) return;
    if (!branchData.address?.trim()) return;
    if (branchData.lat?.trim() && branchData.long?.trim()) return;
    if (!GOOGLE_MAPS_API_KEY) return;

    const lookupKey = branchData.address.trim().toLowerCase();
    if (defaultBranchCoordsLookupRef.current === lookupKey) return;
    defaultBranchCoordsLookupRef.current = lookupKey;
    void hydrateDefaultBranchCoordsFromAddress(branchData.address);
  }, [step, isEasyPagarUser, branchData.address, branchData.lat, branchData.long]);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (isEasyPagarUser) {
      if (easyPagarAdminId == null) {
        toast({
          title: "Easy Pagar",
          description: "Wait for the profile to load with a valid 10-digit mobile, or try again.",
          variant: "destructive",
        });
        return;
      }
    }
    setIsLoading(true);
    try {
      const payload = {
        name: registerData.name.trim(),
        mobile: registerData.mobile.trim(),
        password: registerData.password,
        email: registerData.email?.trim() || undefined,
        address: registerData.address?.trim() || undefined,
        city: registerData.city?.trim() || undefined,
        state: registerData.state?.trim() || undefined,
        pincode: registerData.pincode?.trim() || undefined,
        is_ep_user: isEasyPagarUser,
      };
      if (isEasyPagarUser) {
        payload.admin_id = easyPagarAdminId;
      }
      console.log("Register User payload:", payload);
      // userApp register_user API
      const res = await fetch(`${USER_API}/auth/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.errors ? JSON.stringify(data.errors) : "Registration failed");
      }
      if (data?.data?.verification_code != null) {
        setOtp(String(data.data.verification_code).replace(/\D/g, "").slice(0, 4));
      }
      toast({ title: "Success", description: data.message || "User registered. OTP sent." });
      setStep(2);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!registerData.mobile?.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${USER_API}/auth/resend-code/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: registerData.mobile.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Resend failed");
      toast({ title: "Success", description: data.message || "OTP resent." });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 4) {
      toast({ title: "Error", description: "Enter 4-digit OTP", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${USER_API}/auth/verify/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile: registerData.mobile.trim(),
          otp: otp.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Verification failed");
      }
      const token = data.access_token;
      if (!token) throw new Error("No token received");
      setAccessToken(token);
      setCreatedUserId(data?.data?.user_id || "");
      toast({ title: "Success", description: data.message || "User verified." });
      setStep(3);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const redirectToEditAdmin = () => {
    if (createdUserId) {
      setLocation(`/superadmin/edit-admin?user_id=${createdUserId}`);
      return;
    }
    toast({ title: "Notice", description: "Admin created. Could not find user id for direct edit, redirected to Admin List." });
    setLocation("/superadmin/admin-list");
  };

  const handleAddOrganization = async (e) => {
    e.preventDefault();
    if (!accessToken) {
      toast({ title: "Error", description: "Session expired. Start again.", variant: "destructive" });
      return;
    }
    const required = ["name", "gst_number", "organization_type", "address", "city", "state", "pincode"];
    const missing = required.filter((f) => !orgData[f]?.trim());
    if (missing.length) {
      toast({ title: "Error", description: `Missing: ${missing.join(", ")}`, variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const orgPayload = {
        name: orgData.name.trim(),
        gst_number: orgData.gst_number.trim().toUpperCase(),
        organization_type: orgData.organization_type.trim(),
        address: orgData.address.trim(),
        city: orgData.city.trim(),
        state: orgData.state.trim(),
        pincode: orgData.pincode.trim(),
        lat: orgData.lat != null ? String(orgData.lat).trim() : "",
        long: orgData.long != null ? String(orgData.long).trim() : "",
        contact_person: registerData.name?.trim() || "N/A",
        is_tally_enabled: orgData.is_tally_enabled,
      };
      if (isEasyPagarUser && easyPagarOrgId != null) {
        orgPayload.orgid = easyPagarOrgId;
      }

      const res = await fetch(`${USER_API}/add-organization/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(orgPayload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Organization creation failed");
      }
      toast({ title: "Success", description: data.message || "Organization created." });
      const tallyEnabled = data?.data?.organization?.is_tally_enabled !== false;
      setShouldConfigureTally(tallyEnabled);
      setStep(4);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const postAddBranch = async ({ name, address, city, state, pincode, is_active, branch_id, lat, long }) => {
    const payload = {
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      lat: lat != null ? String(lat).trim() : "",
      long: long != null ? String(long).trim() : "",
      contact_person: registerData.name?.trim() || "",
      contact_designation: "Branch Contact",
      is_active,
    };
    if (branch_id != null) {
      payload.branch_id = branch_id;
    }

    const res = await fetch(`${USER_API}/add-branch/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Branch creation failed");
    return data;
  };

  const handleAddBranch = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!accessToken) {
      toast({ title: "Error", description: "Session expired. Start again.", variant: "destructive" });
      return;
    }

    const required = ["name", "address", "city", "state", "pincode"];
    const missing = required.filter((f) => !branchData[f]?.trim());
    if (missing.length) {
      toast({ title: "Error", description: `Missing: ${missing.join(", ")}`, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const data = await postAddBranch({
        name: branchData.name,
        address: branchData.address,
        city: branchData.city,
        state: branchData.state,
        pincode: branchData.pincode,
        lat: branchData.lat,
        long: branchData.long,
        is_active: branchData.is_active,
      });

      setCreatedBranches((prev) => [...prev, data?.data || { name: branchData.name.trim() }]);
      toast({ title: "Success", description: data.message || "Branch created successfully." });
      setBranchData((prev) => ({
        ...prev,
        name: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
        lat: "",
        long: "",
      }));
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEasyPagarBranchPickerOk = () => {
    const selected = easyPagarBranchPickerItems.filter((item) => easyPagarBranchPickerSelected.has(item.value));
    if (selected.length === 0) {
      toast({ title: "Easy Pagar", description: "Select at least one branch.", variant: "destructive" });
      return;
    }
    setEasyPagarBranchRows((prev) => {
      const existingIds = new Set(prev.map((r) => r.id));
      const additions = selected
        .filter((item) => !existingIds.has(`ep-${item.value}`))
        .map((item) => ({
          id: `ep-${item.value}`,
          branch_id: item.value,
          name: item.text,
          address: "",
          city: "",
          state: "",
          pincode: "",
          lat: "",
          long: "",
          is_active: true,
        }));
      return [...prev, ...additions];
    });
    setEasyPagarBranchPickerOpen(false);
  };

  const updateEasyPagarBranchRow = (id, patch) => {
    setEasyPagarBranchRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeEasyPagarBranchDraft = (id) => {
    setEasyPagarBranchRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSubmitEasyPagarBranchRow = async (id) => {
    if (!accessToken) {
      toast({ title: "Error", description: "Session expired. Start again.", variant: "destructive" });
      return;
    }
    const row = easyPagarBranchRows.find((r) => r.id === id);
    if (!row) return;

    const required = ["name", "address", "city", "state", "pincode"];
    const missing = required.filter((f) => !row[f]?.trim());
    if (missing.length) {
      toast({
        title: "Error",
        description: `Fill all fields for this branch. Missing: ${missing.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const data = await postAddBranch({
        name: row.name,
        address: row.address,
        city: row.city,
        state: row.state,
        pincode: row.pincode,
        lat: row.lat,
        long: row.long,
        is_active: row.is_active,
        branch_id: row.branch_id,
      });
      setCreatedBranches((prev) => [...prev, data?.data || { name: row.name.trim() }]);
      setEasyPagarBranchRows((prev) => prev.filter((r) => r.id !== id));
      toast({ title: "Success", description: data.message || "Branch created successfully." });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueAfterBranches = () => {
    if (isEasyPagarUser && createdBranches.length === 0) {
      toast({
        title: "Easy Pagar",
        description: "At least one branch selection is required.",
        variant: "destructive",
      });
      return;
    }
    if (shouldConfigureTally) {
      setStep(5);
      return;
    }
    toast({ title: "Success", description: "Branch step completed. Tally config skipped." });
    redirectToEditAdmin();
  };

  const normalizeGoogleAddressComponent = (component) => ({
    types: component?.types || [],
    long_name: component?.longText || component?.long_name || "",
    short_name: component?.shortText || component?.short_name || "",
  });

  const extractAddressParts = (placeData) => {
    const rawComponents = placeData?.addressComponents || placeData?.address_components || [];
    const components = rawComponents.map(normalizeGoogleAddressComponent);
    const city =
      getAddressComponent(components, "locality") ||
      getAddressComponent(components, "administrative_area_level_2") ||
      getAddressComponent(components, "sublocality") ||
      getAddressComponent(components, "postal_town");
    const state = getAddressComponent(components, "administrative_area_level_1");
    const pincode = getAddressComponent(components, "postal_code");
    return {
      address: placeData?.formattedAddress || placeData?.formatted_address || "",
      city,
      state,
      pincode,
      lat:
        placeData?.location?.latitude ??
        placeData?.location?.lat ??
        placeData?.geometry?.location?.lat ??
        "",
      long:
        placeData?.location?.longitude ??
        placeData?.location?.lng ??
        placeData?.geometry?.location?.lng ??
        "",
    };
  };

  const fetchGoogleAddressSuggestions = async (query) => {
    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error("Google Maps API key missing. Please configure VITE_GOOGLE_MAPS_API_KEY.");
    }
    if (!query || query.trim().length < 3) return [];
    const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
      },
      body: JSON.stringify({ input: query.trim() }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Autocomplete failed (${response.status})`);
    }
    const data = await response.json();
    return (data?.suggestions || [])
      .map((item) => item?.placePrediction)
      .filter(Boolean)
      .map((prediction) => ({
        placeId: prediction.placeId,
        label: prediction?.text?.text || "",
      }));
  };

  const fetchGooglePlaceDetails = async (placeId) => {
    if (!placeId || !GOOGLE_MAPS_API_KEY) return null;
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=formattedAddress,addressComponents,location`,
      { headers: { "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY } }
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Place details failed (${response.status})`);
    }
    return response.json();
  };

  const applyPlaceToManualBranch = (placeData) => {
    const parts = extractAddressParts(placeData);

    setBranchData((prev) => ({
      ...prev,
      address: parts.address || prev.address,
      city: parts.city || prev.city,
      state: parts.state || prev.state,
      pincode: parts.pincode || prev.pincode,
      lat: parts.lat !== "" ? String(parts.lat) : prev.lat,
      long: parts.long !== "" ? String(parts.long) : prev.long,
    }));
  };

  const fetchBranchAddressSuggestions = async (query) => {
    if (!query || query.trim().length < 3) {
      setBranchAddressSuggestions([]);
      setShowBranchAddressSuggestions(false);
      return;
    }
    setBranchAddressLoading(true);
    setBranchAddressError("");
    try {
      const suggestions = await fetchGoogleAddressSuggestions(query);
      setBranchAddressSuggestions(suggestions);
      setShowBranchAddressSuggestions(suggestions.length > 0);
    } catch (error) {
      console.error("Branch autocomplete failed:", error);
      setBranchAddressSuggestions([]);
      setShowBranchAddressSuggestions(false);
      setBranchAddressError(error?.message || "Failed to fetch address suggestions");
    } finally {
      setBranchAddressLoading(false);
    }
  };

  const fetchAndApplyManualBranchPlaceDetails = async (placeId) => {
    if (!placeId || !GOOGLE_MAPS_API_KEY) return;
    try {
      const placeData = await fetchGooglePlaceDetails(placeId);
      applyPlaceToManualBranch(placeData);
    } catch (error) {
      console.error("Branch place details failed:", error);
      setBranchAddressError(error?.message || "Failed to fetch selected address details");
    }
  };

  const hydrateDefaultBranchCoordsFromAddress = async (addressText) => {
    const address = String(addressText || "").trim();
    if (!address || !GOOGLE_MAPS_API_KEY) return;
    try {
      const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask": "suggestions.placePrediction.placeId",
        },
        body: JSON.stringify({ input: address }),
      });
      if (!response.ok) return;
      const data = await response.json();
      const placeId = data?.suggestions?.[0]?.placePrediction?.placeId;
      if (!placeId) return;
      await fetchAndApplyManualBranchPlaceDetails(placeId);
    } catch (error) {
      console.error("Default branch coordinates lookup failed:", error);
    }
  };

  const fetchRegisterAddressSuggestions = async (query) => {
    if (!query || query.trim().length < 3) {
      setRegisterAddressSuggestions([]);
      setShowRegisterAddressSuggestions(false);
      return;
    }
    setRegisterAddressLoading(true);
    setRegisterAddressError("");
    try {
      const suggestions = await fetchGoogleAddressSuggestions(query);
      setRegisterAddressSuggestions(suggestions);
      setShowRegisterAddressSuggestions(suggestions.length > 0);
    } catch (error) {
      setRegisterAddressSuggestions([]);
      setShowRegisterAddressSuggestions(false);
      setRegisterAddressError(error?.message || "Failed to fetch address suggestions");
    } finally {
      setRegisterAddressLoading(false);
    }
  };

  const fetchAndApplyRegisterPlaceDetails = async (placeId) => {
    if (!placeId) return;
    try {
      const placeData = await fetchGooglePlaceDetails(placeId);
      const parts = extractAddressParts(placeData || {});
      setRegisterData((prev) => ({
        ...prev,
        address: parts.address || prev.address,
        city: parts.city || prev.city,
        state: parts.state || prev.state,
        pincode: parts.pincode || prev.pincode,
      }));
    } catch (error) {
      setRegisterAddressError(error?.message || "Failed to fetch selected address details");
    }
  };

  const fetchOrgAddressSuggestions = async (query) => {
    if (!query || query.trim().length < 3) {
      setOrgAddressSuggestions([]);
      setShowOrgAddressSuggestions(false);
      return;
    }
    setOrgAddressLoading(true);
    setOrgAddressError("");
    try {
      const suggestions = await fetchGoogleAddressSuggestions(query);
      setOrgAddressSuggestions(suggestions);
      setShowOrgAddressSuggestions(suggestions.length > 0);
    } catch (error) {
      setOrgAddressSuggestions([]);
      setShowOrgAddressSuggestions(false);
      setOrgAddressError(error?.message || "Failed to fetch address suggestions");
    } finally {
      setOrgAddressLoading(false);
    }
  };

  const fetchAndApplyOrgPlaceDetails = async (placeId) => {
    if (!placeId) return;
    try {
      const placeData = await fetchGooglePlaceDetails(placeId);
      const parts = extractAddressParts(placeData || {});
      setOrgData((prev) => ({
        ...prev,
        address: parts.address || prev.address,
        city: parts.city || prev.city,
        state: parts.state || prev.state,
        pincode: parts.pincode || prev.pincode,
        lat: parts.lat !== "" ? String(parts.lat) : prev.lat,
        long: parts.long !== "" ? String(parts.long) : prev.long,
      }));
    } catch (error) {
      setOrgAddressError(error?.message || "Failed to fetch selected address details");
    }
  };

  const fetchCompanyName = async () => {
    const host = (tallyData.tally_host || "").trim();
    const port = (tallyData.tally_port || "").trim();
    if (!host || !port) {
      toast({ title: "Error", description: "Enter Tally host and port first", variant: "destructive" });
      return;
    }
    const tallyUrl = host.startsWith("http") ? `${host.replace(/\/+$/, "")}:${port}` : `http://${host}:${port}`;
    setIsFetchingCompany(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/superadmin/super-admin/tally/company-name/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tally_url: tallyUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to fetch company name");
      }
      const companyNames = data?.data?.company_names ?? [];
      if (companyNames.length === 0) {
        toast({ title: "Notice", description: data.message || "No company name in Tally response" });
      } else if (companyNames.length === 1) {
        setTallyData((p) => ({ ...p, name: companyNames[0] }));
        toast({ title: "Success", description: "Company name fetched from Tally" });
      } else {
        setCompanyListForSelection(companyNames);
      }
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsFetchingCompany(false);
    }
  };

  const handleAddTallyConfig = async (e) => {
    e.preventDefault();
    if (!accessToken) {
      toast({ title: "Error", description: "Session expired. Start again.", variant: "destructive" });
      return;
    }
    if (!tallyData.name?.trim() || !tallyData.tally_host?.trim() || !tallyData.tally_port?.trim()) {
      toast({ title: "Error", description: "Name, Tally host and port are required", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${USER_API}/add-tally-config/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: tallyData.name.trim(),
          tally_host: tallyData.tally_host.trim(),
          tally_port: tallyData.tally_port.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Tally config creation failed");
      }
      toast({ title: "Success", description: data.message || "Admin created with Tally config." });
      redirectToEditAdmin();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (!getSuperAdminToken()) return <CommonLoader />;

  return (
    <div className="flex h-screen bg-gray-50">
      {!isMobile && <SuperAdminSidebar />}
      {isMobile && (
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setIsMobileSidebarOpen(true)} className="mr-2">
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (step === 1 ? setLocation("/superadmin/admin-list") : setStep((s) => s - 1))}
              className="p-2 rounded-md text-gray-400 hover:text-gray-600"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Create Admin</h1>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className={step === 5 ? "max-w-5xl mx-auto w-full" : "max-w-2xl mx-auto"}>
            <div className="flex items-center justify-between mb-8">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const active = step === s.id;
                const done = step > s.id;
                return (
                  <div key={s.id} className="flex items-center">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${active ? "border-black bg-black text-white" : done ? "border-green-500 bg-green-500 text-white" : "border-gray-300 bg-white"
                        }`}
                    >
                      {done ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`w-12 h-0.5 mx-1 ${done ? "bg-green-500" : "bg-gray-200"}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {step === 1 && (
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
                  <div className="space-y-1.5 min-w-0">
                    <CardTitle>Step 1: Register User</CardTitle>
                    <p className="text-sm text-gray-500">Enter admin details. OTP will be sent to mobile.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <Checkbox
                      id="easy-pagar-user"
                      checked={isEasyPagarUser}
                      onCheckedChange={(checked) => {
                        const on = checked === true;
                        setIsEasyPagarUser(on);
                        if (!on) {
                          setEasyPagarOrgId(null);
                          setEasyPagarAdminId(null);
                          setEasyPagarOrgDetailsFetchedForId(null);
                          setEasyPagarOrgLoading(false);
                          setEasyPagarBranchListFetchedForOrgId(null);
                          setEasyPagarBranchRows([]);
                          setEasyPagarBranchPickerOpen(false);
                          setEasyPagarBranchPickerItems([]);
                          setEasyPagarBranchPickerSelected(new Set());
                        }
                      }}
                    />
                    <Label htmlFor="easy-pagar-user" className="text-sm font-normal cursor-pointer leading-none">
                      Easy Pagar User
                    </Label>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Name *</Label>
                        <Input
                          value={registerData.name}
                          onChange={(e) => setRegisterData((p) => ({ ...p, name: e.target.value }))}
                          placeholder="Full name"
                          required
                          disabled={isEasyPagarUser}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Mobile *</Label>
                        <div className="relative">
                          <Input
                            value={registerData.mobile}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "");
                              setRegisterData((p) => ({ ...p, mobile: value }));
                            }}
                            placeholder="10-digit mobile"
                            required
                            maxLength={10}
                            inputMode="numeric"
                          />
                          {isEasyPagarUser && easyPagarProfileLoading && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-600" />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Password *</Label>
                      <Input
                        type="password"
                        value={registerData.password}
                        onChange={(e) => setRegisterData((p) => ({ ...p, password: e.target.value }))}
                        placeholder="Password"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={registerData.email}
                        onChange={(e) => setRegisterData((p) => ({ ...p, email: e.target.value }))}
                        placeholder="Email (optional)"
                        disabled={isEasyPagarUser}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Address</Label>
                      <div className="relative">
                        <Input
                          value={registerData.address}
                          onChange={(e) => {
                            setRegisterData((p) => ({ ...p, address: e.target.value }));
                            if (!isEasyPagarUser) {
                              void fetchRegisterAddressSuggestions(e.target.value);
                            }
                          }}
                          onFocus={() => {
                            if (!isEasyPagarUser && registerAddressSuggestions.length > 0) {
                              setShowRegisterAddressSuggestions(true);
                            }
                          }}
                          onBlur={() => {
                            setTimeout(() => setShowRegisterAddressSuggestions(false), 150);
                          }}
                          placeholder="Address (optional)"
                          autoComplete="off"
                          disabled={isEasyPagarUser}
                        />
                        {showRegisterAddressSuggestions && !isEasyPagarUser && (
                          <div className="absolute z-[200] mt-1 w-full rounded-md border bg-white shadow-lg max-h-56 overflow-auto">
                            {registerAddressSuggestions.map((suggestion) => (
                              <button
                                key={suggestion.placeId}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                                onClick={() => {
                                  setRegisterData((p) => ({ ...p, address: suggestion.label }));
                                  setShowRegisterAddressSuggestions(false);
                                  void fetchAndApplyRegisterPlaceDetails(suggestion.placeId);
                                }}
                              >
                                {suggestion.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {registerAddressLoading && !isEasyPagarUser && (
                        <p className="text-xs text-blue-600">Fetching address suggestions...</p>
                      )}
                      {registerAddressError && !isEasyPagarUser && (
                        <p className="text-xs text-red-600">{registerAddressError}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input
                          value={registerData.city}
                          onChange={(e) => setRegisterData((p) => ({ ...p, city: e.target.value }))}
                          placeholder="City"
                          disabled={isEasyPagarUser}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>State</Label>
                        <Input
                          value={registerData.state}
                          onChange={(e) => setRegisterData((p) => ({ ...p, state: e.target.value }))}
                          placeholder="State"
                          disabled={isEasyPagarUser}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Pincode</Label>
                        <Input
                          maxLength={6}
                          value={registerData.pincode}
                          onChange={(e) => setRegisterData((p) => ({ ...p, pincode: e.target.value }))}
                          placeholder="Pincode"
                        />
                      </div>
                    </div>
                    <Button type="submit" disabled={isLoading} className="w-full gap-2">
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Register & Send OTP
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Step 2: Verify OTP</CardTitle>
                  <p className="text-sm text-gray-500">
                    Enter OTP sent to {registerData.mobile}. You can resend if needed.
                  </p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleVerify} className="space-y-4">
                    <div className="space-y-2">
                      <Label>OTP (4 digits) *</Label>
                      <Input
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="0000"
                        maxLength={4}
                        required
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={handleResendOtp} disabled={isLoading}>
                        Resend OTP
                      </Button>
                      <Button type="submit" disabled={isLoading || otp.length !== 4} className="flex-1 gap-2">
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Verify & Continue
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>Step 3: Create Organization</CardTitle>
                  <p className="text-sm text-gray-500">Create organization for this admin. Branches can be added in next optional step.</p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddOrganization} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Organization Name *</Label>
                        <div className="relative">
                          <Input
                            value={orgData.name}
                            onChange={(e) => setOrgData((p) => ({ ...p, name: e.target.value }))}
                            placeholder="Organization name"
                            required
                          />
                          {isEasyPagarUser && easyPagarOrgLoading && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-600" />
                          )}
                        </div>
                        {isEasyPagarUser && easyPagarOrgLoading && (
                          <div
                            className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800"
                            role="status"
                            aria-live="polite"
                          >
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" />
                            <span>Fetching Easy Pagar organization…</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>GST Number *</Label>
                        <Input
                          value={orgData.gst_number}
                          onChange={(e) => setOrgData((p) => ({ ...p, gst_number: e.target.value.toUpperCase() }))}
                          placeholder="GST number"
                          required
                          maxLength={15}
                          style={{ textTransform: "uppercase" }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Organization Type *</Label>
                      <select
                        value={orgData.organization_type}
                        onChange={(e) => setOrgData((p) => ({ ...p, organization_type: e.target.value }))}
                        className="w-full h-10 px-3 border border-gray-300 rounded-md bg-white"
                      >
                        <option value="Company">Company</option>
                        <option value="Partnership">Partnership</option>
                        <option value="Proprietorship">Proprietorship</option>
                        <option value="LLP">LLP</option>
                        <option value="Trust">Trust</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Address *</Label>
                      <div className="relative">
                        <Input
                          value={orgData.address}
                          onChange={(e) => {
                            setOrgData((p) => ({ ...p, address: e.target.value }));
                            void fetchOrgAddressSuggestions(e.target.value);
                          }}
                          onFocus={() => {
                            if (orgAddressSuggestions.length > 0) setShowOrgAddressSuggestions(true);
                          }}
                          onBlur={() => {
                            setTimeout(() => setShowOrgAddressSuggestions(false), 150);
                          }}
                          placeholder="Address"
                          autoComplete="off"
                          required
                        />
                        {showOrgAddressSuggestions && (
                          <div className="absolute z-[200] mt-1 w-full rounded-md border bg-white shadow-lg max-h-56 overflow-auto">
                            {orgAddressSuggestions.map((suggestion) => (
                              <button
                                key={suggestion.placeId}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                                onClick={() => {
                                  setOrgData((p) => ({ ...p, address: suggestion.label }));
                                  setShowOrgAddressSuggestions(false);
                                  void fetchAndApplyOrgPlaceDetails(suggestion.placeId);
                                }}
                              >
                                {suggestion.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {orgAddressLoading && <p className="text-xs text-blue-600">Fetching address suggestions...</p>}
                      {orgAddressError && <p className="text-xs text-red-600">{orgAddressError}</p>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>City *</Label>
                        <Input
                          value={orgData.city}
                          onChange={(e) => setOrgData((p) => ({ ...p, city: e.target.value }))}
                          placeholder="City"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>State *</Label>
                        <Input
                          value={orgData.state}
                          onChange={(e) => setOrgData((p) => ({ ...p, state: e.target.value }))}
                          placeholder="State"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Pincode *</Label>
                        <Input
                          value={orgData.pincode}
                          onChange={(e) => setOrgData((p) => ({ ...p, pincode: e.target.value }))}
                          placeholder="Pincode"
                          required
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-gray-200 p-3">
                      <div>
                        <Label className="text-sm font-medium">Enable Tally Integration</Label>
                        <p className="text-xs text-gray-500">If disabled, Tally config step will be skipped.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={orgData.is_tally_enabled}
                        onChange={(e) => setOrgData((p) => ({ ...p, is_tally_enabled: e.target.checked }))}
                        className="h-4 w-4"
                      />
                    </div>
                    <Button type="submit" disabled={isLoading} className="w-full gap-2">
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Create Organization & Continue
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {step === 4 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Step 4: Add Branches (Optional)</CardTitle>
                    <Button
                      type="button"
                      size="icon"
                      onClick={handleAddBranch}
                      disabled={isLoading}
                      title="Add Branch"
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-sm text-gray-500">
                    Add one or more branches for this organization, or skip this step.
                    {isEasyPagarUser && (
                      <span className="block mt-1">
                        Easy Pagar: branches load from your org; only names are prefilled—enter address details before saving each branch.
                      </span>
                    )}
                  </p>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4">
                    {isEasyPagarUser && easyPagarBranchListLoading && (
                      <div
                        className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800"
                        role="status"
                        aria-live="polite"
                      >
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" />
                        <span>Fetching Easy Pagar branches…</span>
                      </div>
                    )}
                    {isEasyPagarUser &&
                      easyPagarBranchRows.map((row) => (
                        <div key={row.id} className="rounded-lg border border-gray-200 p-4 space-y-4 relative pt-10">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-2 h-8 w-8 text-gray-500"
                            onClick={() => removeEasyPagarBranchDraft(row.id)}
                            title="Remove draft"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <p className="text-sm font-medium text-gray-800">Easy Pagar branch</p>
                          <div className="space-y-2">
                            <Label>Branch Name *</Label>
                            <Input
                              value={row.name}
                              onChange={(e) => updateEasyPagarBranchRow(row.id, { name: e.target.value })}
                              placeholder="Branch name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Address *</Label>
                            <Input
                              value={row.address}
                              onChange={(e) => updateEasyPagarBranchRow(row.id, { address: e.target.value })}
                              placeholder="Address"
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>City *</Label>
                              <Input
                                value={row.city}
                                onChange={(e) => updateEasyPagarBranchRow(row.id, { city: e.target.value })}
                                placeholder="City"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>State *</Label>
                              <Input
                                value={row.state}
                                onChange={(e) => updateEasyPagarBranchRow(row.id, { state: e.target.value })}
                                placeholder="State"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Pincode *</Label>
                              <Input
                                value={row.pincode}
                                onChange={(e) => updateEasyPagarBranchRow(row.id, { pincode: e.target.value })}
                                placeholder="Pincode"
                              />
                            </div>
                          </div>
                          <Button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleSubmitEasyPagarBranchRow(row.id)}
                            className="w-full sm:w-auto gap-2"
                          >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Save branch
                          </Button>
                        </div>
                      ))}
                    {isEasyPagarUser && easyPagarBranchRows.length > 0 && (
                      <p className="text-sm text-gray-600">Add another branch manually below, or use the + button after filling the form.</p>
                    )}
                    <div className="space-y-2">
                      <Label>Branch Name *</Label>
                      <Input
                        value={branchData.name}
                        onChange={(e) => setBranchData((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Branch name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Address *</Label>
                      <div className="relative">
                        <Input
                          value={branchData.address}
                          onChange={(e) => {
                            setBranchData((p) => ({ ...p, address: e.target.value }));
                            void fetchBranchAddressSuggestions(e.target.value);
                          }}
                          onFocus={() => {
                            if (branchAddressSuggestions.length > 0) setShowBranchAddressSuggestions(true);
                          }}
                          onBlur={() => {
                            setTimeout(() => setShowBranchAddressSuggestions(false), 150);
                          }}
                          placeholder="Address"
                          autoComplete="off"
                          required
                        />
                        {showBranchAddressSuggestions && (
                          <div className="absolute z-[200] mt-1 w-full rounded-md border bg-white shadow-lg max-h-56 overflow-auto">
                            {branchAddressSuggestions.map((suggestion) => (
                              <button
                                key={suggestion.placeId}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                                onClick={() => {
                                  setBranchData((p) => ({ ...p, address: suggestion.label }));
                                  setShowBranchAddressSuggestions(false);
                                  void fetchAndApplyManualBranchPlaceDetails(suggestion.placeId);
                                }}
                              >
                                {suggestion.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">Coordinates: {branchData.lat || "-"}, {branchData.long || "-"}</p>
                      {branchAddressLoading && <p className="text-xs text-blue-600">Fetching address suggestions...</p>}
                      {branchAddressError && <p className="text-xs text-red-600">{branchAddressError}</p>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>City *</Label>
                        <Input
                          value={branchData.city}
                          onChange={(e) => setBranchData((p) => ({ ...p, city: e.target.value }))}
                          placeholder="City"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>State *</Label>
                        <Input
                          value={branchData.state}
                          onChange={(e) => setBranchData((p) => ({ ...p, state: e.target.value }))}
                          placeholder="State"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Pincode *</Label>
                        <Input
                          value={branchData.pincode}
                          onChange={(e) => setBranchData((p) => ({ ...p, pincode: e.target.value }))}
                          placeholder="Pincode"
                          required
                        />
                      </div>
                    </div>
                    {createdBranches.length > 0 && (
                      <div className="rounded-md border border-gray-200 p-3">
                        <p className="text-sm font-medium text-gray-800 mb-2">Created Branches ({createdBranches.length})</p>
                        <div className="space-y-1">
                          {createdBranches.map((b, idx) => (
                            <p key={`${b.id || b.name}-${idx}`} className="text-sm text-gray-600">
                              {idx + 1}. {b.name || "-"}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button type="button" variant="outline" onClick={handleContinueAfterBranches} className="flex-1">
                        Next
                      </Button>
                      <Button type="button" variant="ghost" onClick={handleContinueAfterBranches} className="flex-1">
                        Skip
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {step === 5 && (
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_min(100%,20rem)] gap-6 items-start">
                <Card className="min-w-0">
                  <CardHeader>
                    <CardTitle>Step 5: Tally Config</CardTitle>
                    <p className="text-sm text-gray-500">Add Tally connection for this admin.</p>
                    <p className="text-sm font-medium text-gray-800">
                      Organization: <span className="font-semibold">{orgData.name || "-"}</span>
                    </p>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleAddTallyConfig} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Tally Host *</Label>
                          <Input
                            value={tallyData.tally_host}
                            onChange={(e) => setTallyData((p) => ({ ...p, tally_host: e.target.value }))}
                            placeholder="e.g. localhost or IP"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Tally Port *</Label>
                          <div className="flex h-10 rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                            <Input
                              value={tallyData.tally_port}
                              onChange={(e) => setTallyData((p) => ({ ...p, tally_port: e.target.value.replace(/\D/g, "") }))}
                              placeholder="e.g. 9000"
                              className="h-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
                              required
                            />
                            <Button
                              type="button"
                              onClick={fetchCompanyName}
                              disabled={isFetchingCompany}
                              className="h-full rounded-none bg-black hover:bg-gray-800 text-white shrink-0 px-4 font-medium"
                            >
                              {isFetchingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch company name"}
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Company / Config Name *</Label>
                        <Input
                          value={tallyData.name}
                          onChange={(e) => setTallyData((p) => ({ ...p, name: e.target.value }))}
                          placeholder="Company or config name (use Fetch to get from Tally)"
                          required
                        />
                      </div>
                      <Button type="submit" disabled={isLoading} className="w-full gap-2">
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Save Tally Config & Finish
                      </Button>
                    </form>
                  </CardContent>
                </Card>
                <div
                  className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm lg:sticky lg:top-6"
                  aria-labelledby="tally-important-info-heading"
                >
                  <h3 id="tally-important-info-heading" className="text-sm font-semibold text-gray-900 mb-3">
                    Important Info
                  </h3>
                  <ul className="list-disc pl-4 space-y-2.5 text-sm text-gray-600 leading-relaxed">
                    <li>Access via the Public IP must be done through the public network.</li>
                    <li>Ensure that Tally is running on the server.</li>
                    <li>Verify that the required port number is correctly configured.</li>
                    <li>Allow the configured port in the firewall settings.</li>
                    <li>Confirm that Tally is enabled to accept remote connections in its configuration.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Select company popup (when Tally returns multiple companies) */}
      <Dialog open={!!companyListForSelection?.length} onOpenChange={(open) => !open && setCompanyListForSelection(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Select company name
            </DialogTitle>
            <DialogDescription>
              Tally returned multiple companies. Choose one to use as Company / Config name.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto space-y-2 pr-2">
            {companyListForSelection?.map((name) => (
              <Button
                key={name}
                type="button"
                variant="outline"
                className="w-full justify-start h-auto py-3 text-left font-normal"
                onClick={() => {
                  setTallyData((p) => ({ ...p, name }));
                  setCompanyListForSelection(null);
                  toast({ title: "Success", description: "Company name selected" });
                }}
              >
                {name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={easyPagarBranchPickerOpen}
        onOpenChange={(open) => {
          if (!open) setEasyPagarBranchPickerOpen(false);
        }}
      >
        <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Select branches
            </DialogTitle>
            <DialogDescription>
              Choose one or more Easy Pagar branches. Only branch names are loaded; fill address, city, state, and pincode on each card, then save.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto space-y-3 pr-2 flex-1 min-h-0 max-h-[50vh]">
            {easyPagarBranchPickerItems.map((item) => (
              <label
                key={item.value}
                className="flex items-start gap-3 rounded-md border border-gray-200 p-3 cursor-pointer hover:bg-gray-50"
              >
                <Checkbox
                  checked={easyPagarBranchPickerSelected.has(item.value)}
                  onCheckedChange={(checked) => {
                    setEasyPagarBranchPickerSelected((prev) => {
                      const next = new Set(prev);
                      if (checked === true) next.add(item.value);
                      else next.delete(item.value);
                      return next;
                    });
                  }}
                  className="mt-0.5"
                />
                <span className="text-sm font-medium leading-snug">{item.text}</span>
              </label>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEasyPagarBranchPickerOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleEasyPagarBranchPickerOk}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
