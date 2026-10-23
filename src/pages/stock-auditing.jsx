import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Camera, ClipboardList, Eye, Menu, Plus, X } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import CommonLoader from "@/components/common/loader";
import { AuthService } from "@/lib/auth";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const getCurrentDateTimeLocal = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

const auditDialogContentClass = "[&>button:last-child]:hidden";

function AuditDialogCloseButton() {
  return (
    <DialogClose asChild>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-4 top-4 z-50 h-8 w-8 rounded-md"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </Button>
    </DialogClose>
  );
}

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });

const filesToBase64Images = async (files) => {
  const list = Array.from(files || []).filter((f) => f && f.type?.startsWith("image/"));
  return Promise.all(list.map((file) => readFileAsDataUrl(file)));
};

const getAuditItemImages = (item) => {
  if (!item) return [];
  if (Array.isArray(item.images) && item.images.length) return item.images;
  return [];
};

function AuditItemImagesStrip({ images, size = "md", className = "" }) {
  const list = images || [];
  if (!list.length) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  const dim = size === "sm" ? "h-8 w-8" : "h-12 w-12";
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {list.map((img) => {
        const src = img.url || img.file_url;
        if (!src) return null;
        return (
          <a
            key={img.id ?? src}
            href={src}
            target="_blank"
            rel="noreferrer"
            title={img.caption || "View photo"}
            className={`block ${dim} rounded border overflow-hidden shrink-0 hover:opacity-90`}
          >
            <img src={src} alt={img.caption || "audit"} className="h-full w-full object-cover" />
          </a>
        );
      })}
    </div>
  );
}

function AuditPhotoPickerButton({ onChange, title = "Attach photos", size = "icon", children }) {
  const inputRef = useRef(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          onChange(e);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size={size}
        title={title}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          inputRef.current?.click();
        }}
      >
        {children ?? <Camera className="h-4 w-4" />}
      </Button>
    </>
  );
}

export default function StockAuditing() {
  const user = AuthService.getUserData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [isGodownDetailsOpen, setIsGodownDetailsOpen] = useState(false);
  const [isDiscussionOpen, setIsDiscussionOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedGodownIds, setSelectedGodownIds] = useState([]);
  const [notes, setNotes] = useState("");
  const [startedAt, setStartedAt] = useState(getCurrentDateTimeLocal());
  const [completedAt, setCompletedAt] = useState("");
  const [selectedSession, setSelectedSession] = useState(null);
  const [loadingGodownItemsId, setLoadingGodownItemsId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [manageAddGodownIds, setManageAddGodownIds] = useState([]);
  const [manageRemoveGodownIds, setManageRemoveGodownIds] = useState([]);
  const [manageNotes, setManageNotes] = useState("");
  const [bulkUpdateGodown, setBulkUpdateGodown] = useState(null);
  const [selectedGodown, setSelectedGodown] = useState(null);
  const [bulkUpdateRows, setBulkUpdateRows] = useState([]);
  const [discussionMessage, setDiscussionMessage] = useState("");
  const [discussionDetailsLoading, setDiscussionDetailsLoading] = useState(false);
  const [itemDetails, setItemDetails] = useState(null);
  const [selectedLogItem, setSelectedLogItem] = useState(null);
  const [editingLogId, setEditingLogId] = useState(null);
  const [editingLogQty, setEditingLogQty] = useState("");
  const [isUpdateCountOpen, setIsUpdateCountOpen] = useState(false);
  const [updateCountItem, setUpdateCountItem] = useState(null);
  const [updateCountQty, setUpdateCountQty] = useState("");
  const [updateCountRemark, setUpdateCountRemark] = useState("");
  const [updateCountImagePreviews, setUpdateCountImagePreviews] = useState([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const { hasPermission, isLoading: permissionsLoading, userInfo } = useUserPermissions();

  const canRead = hasPermission("stock_audit", "read");
  const canCreate = hasPermission("stock_audit", "create");
  const canUpdate = hasPermission("stock_audit", "update");
  const canDelete = hasPermission("stock_audit", "delete");
  const isAdminUser = Number(userInfo?.role_id) === 1;
  const canPostDiscussion = canUpdate || canCreate || isAdminUser;

  const isSessionInProgress = (session) => {
    if (!session) return false;
    const derived = String(session.status || "").toUpperCase();
    const dbStatus = String(session.db_status || "").toUpperCase();
    return derived === "IN_PROGRESS" || dbStatus === "IN_PROGRESS";
  };

  const canAddRemark = canPostDiscussion && isSessionInProgress(selectedSession);

  const authHeaders = {
    "Content-Type": "application/json",
    ...AuthService.getAuthHeaders(),
  };

  const fetchBranches = async () => {
    const res = await fetch(`${API_BASE_URL}/api/get-branches/`, { headers: authHeaders });
    const data = await res.json();
    return data?.data || [];
  };

  const fetchGodowns = async () => {
    const query = selectedBranchId ? `?branch_id=${encodeURIComponent(selectedBranchId)}` : "";
    const res = await fetch(`${API_BASE_URL}/api/get-godowns/${query}`, { headers: authHeaders });
    const data = await res.json();
    return data?.data || [];
  };

  const fetchSessions = async () => {
    const res = await fetch(`${API_BASE_URL}/api/process/stock-audit-sessions/`, { headers: authHeaders });
    const data = await res.json();
    if (!res.ok || data?.status !== 200) {
      throw new Error(data?.message || "Failed to load stock audits");
    }
    return data?.data || [];
  };

  const fetchSessionDetails = async (sessionId, godownId = null) => {
    const query = godownId ? `?id=${sessionId}&godown_id=${godownId}` : `?id=${sessionId}`;
    const res = await fetch(`${API_BASE_URL}/api/process/stock-audit-sessions/${query}`, { headers: authHeaders });
    const data = await res.json();
    if (!res.ok || data?.status !== 200) {
      throw new Error(data?.message || "Failed to load stock audit details");
    }
    return data?.data || null;
  };

  const fetchItemDetails = async (itemId) => {
    const res = await fetch(`${API_BASE_URL}/api/process/audit-difference-details/${itemId}/`, {
      headers: authHeaders,
    });
    const data = await res.json();
    if (!res.ok || data?.status !== 200) {
      throw new Error(data?.message || "Failed to fetch item details");
    }
    return data?.data;
  };

  const postAuditItemDiscussion = async (itemId, message, parentMessageId = null) => {
    const payload = { message: message.trim() };
    if (parentMessageId != null && parentMessageId !== "") {
      payload.parent_message_id = parentMessageId;
    }
    const res = await fetch(`${API_BASE_URL}/api/process/audit-discussions/${itemId}/`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || data?.status !== 200) {
      throw new Error(data?.message || "Failed to add discussion remark");
    }
    return data;
  };

  const uploadAuditItemImages = async (imagesPayload) => {
    const res = await fetch(`${API_BASE_URL}/api/process/stock-audit-item-images/`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ images: imagesPayload }),
    });
    const data = await res.json();
    if (!res.ok || data?.status !== 200) {
      throw new Error(data?.message || "Failed to upload item images");
    }
    return data;
  };

  const mergeItemImagesFromUploadResponse = (uploadResponse) => {
    const itemsMap = Object.fromEntries(
      (uploadResponse?.data?.items || []).map((it) => [it.item_id, it])
    );
    if (!Object.keys(itemsMap).length) return;

    const applyPatch = (it) => {
      const patch = itemsMap[it.item_id];
      if (!patch) return it;
      return {
        ...it,
        images: patch.images ?? it.images,
        attachment_count: patch.attachment_count ?? it.attachment_count,
      };
    };

    setSelectedGodown((prev) => {
      if (!prev) return prev;
      return { ...prev, items: (prev.items || []).map(applyPatch) };
    });
    setSelectedSession((prev) => {
      if (!prev || !selectedGodown?.godown_id) return prev;
      return {
        ...prev,
        godowns: (prev.godowns || []).map((g) =>
          g.godown_id === selectedGodown.godown_id
            ? { ...g, items: (g.items || []).map(applyPatch) }
            : g
        ),
      };
    });
    setSelectedLogItem((prev) => (prev ? applyPatch(prev) : prev));
    setUpdateCountItem((prev) => (prev ? applyPatch(prev) : prev));
    if (selectedItem?.item_id && itemsMap[selectedItem.item_id]) {
      fetchItemDetails(selectedItem.item_id).then(setItemDetails).catch(() => {});
    }
  };

  const refreshGodownItems = async () => {
    if (!selectedSession?.id || !selectedGodown?.godown_id) return null;
    const refreshed = await fetchSessionDetails(selectedSession.id, selectedGodown.godown_id);
    const refreshedGodown = (refreshed?.godowns || [])[0];
    if (refreshedGodown) {
      setSelectedGodown(refreshedGodown);
      setSelectedSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          godowns: (prev.godowns || []).map((g) =>
            g.godown_id === selectedGodown.godown_id ? { ...g, ...refreshedGodown } : g
          ),
        };
      });
    }
    return refreshedGodown;
  };

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["stock-audit-branches"],
    queryFn: fetchBranches,
    enabled: !!user?.user_id && (canCreate || canUpdate || canDelete),
  });

  const { data: godowns = [], isLoading: godownsLoading } = useQuery({
    queryKey: ["stock-audit-godowns", selectedBranchId],
    queryFn: fetchGodowns,
    enabled: !!user?.user_id && !!selectedBranchId && (canCreate || canUpdate || canDelete),
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["stock-audit-sessions"],
    queryFn: fetchSessions,
    enabled: !!user?.user_id && canRead,
  });

  const initiateMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch(`${API_BASE_URL}/api/process/stock-audit-sessions/initiate/`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data?.status !== 200) {
        throw new Error(data?.message || "Failed to initiate stock audit");
      }
      return data;
    },
    onSuccess: (resp) => {
      toast({ title: "Success", variant: "success", description: resp?.message || "Stock audit initiated successfully" });
      setSelectedGodownIds([]);
      setNotes("");
      setStartedAt(getCurrentDateTimeLocal());
      setCompletedAt("");
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["stock-audit-sessions"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredSessions = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter((row) =>
      `${row.audit_no || ""} ${row.status || ""} ${row.branch || ""} ${row.initiated_by || ""} ${row.started_at || ""} ${row.completed_at || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [sessions, search]);

  const getSessionStatusBadgeClass = (status) => {
    if (status === "COMPLETED") return "bg-green-100 text-green-800 border-green-200";
    if (status === "SCHEDULED") return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-blue-100 text-blue-800 border-blue-200";
  };

  const toggleGodown = (id, checked) => {
    setSelectedGodownIds((prev) =>
      checked ? [...prev, id] : prev.filter((gid) => gid !== id)
    );
  };

  const toggleManageAddGodown = (id, checked) => {
    setManageAddGodownIds((prev) => (checked ? [...prev, id] : prev.filter((gid) => gid !== id)));
    if (checked) {
      setManageRemoveGodownIds((prev) => prev.filter((gid) => gid !== id));
    }
  };

  const toggleManageRemoveGodown = (id, checked) => {
    setManageRemoveGodownIds((prev) => (checked ? [...prev, id] : prev.filter((gid) => gid !== id)));
    if (checked) {
      setManageAddGodownIds((prev) => prev.filter((gid) => gid !== id));
    }
  };

  const handleInitiate = () => {
    if (!selectedBranchId) {
      toast({ title: "Validation Error", description: "Select a branch first", variant: "destructive" });
      return;
    }
    if (!selectedGodownIds.length) {
      toast({ title: "Validation Error", description: "Select at least one godown", variant: "destructive" });
      return;
    }
    if (!startedAt) {
      toast({ title: "Validation Error", description: "Select started at date/time", variant: "destructive" });
      return;
    }
    if (!completedAt) {
      toast({ title: "Validation Error", description: "Select end at date/time", variant: "destructive" });
      return;
    }
    if (new Date(completedAt) < new Date(startedAt)) {
      toast({ title: "Validation Error", description: "End at cannot be earlier than starting from", variant: "destructive" });
      return;
    }
    initiateMutation.mutate({
      branch_id: selectedBranchId,
      godown_ids: selectedGodownIds,
      started_at: startedAt,
      completed_at: completedAt,
      notes: notes?.trim() || "",
    });
  };

  const manageMutation = useMutation({
    mutationFn: async ({ sessionId, payload }) => {
      const res = await fetch(`${API_BASE_URL}/api/process/manage-audit-godowns/${sessionId}/`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data?.status !== 200) {
        throw new Error(data?.message || "Failed to update stock audit session");
      }
      return data;
    },
    onSuccess: async (resp) => {
      toast({ title: "Success", variant: "success", description: resp?.message || "Stock audit session updated" });
      await queryClient.refetchQueries({ queryKey: ["stock-audit-sessions"] });
      if (selectedSession?.id) {
        const refreshed = await fetchSessionDetails(selectedSession.id);
        if (refreshed) {
          setSelectedSession(refreshed);
        }
      }
      setManageAddGodownIds([]);
      setManageRemoveGodownIds([]);
      setIsManageOpen(false);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ sessionId, godownId, payload }) => {
      const res = await fetch(`${API_BASE_URL}/api/process/update-physical-stock-godown/${godownId}/`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          session_id: sessionId,
          items: payload,
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.status !== 200) {
        throw new Error(data?.message || "Failed to update godown stock items");
      }
      return data;
    },
    onSuccess: (resp) => {
      toast({ title: "Success", variant: "success", description: resp?.message || "Godown stock updated" });

      // Optimistic local patch so UI updates without waiting on refetch
      if (resp?.data?.items?.length && selectedGodown) {
        const byId = Object.fromEntries(resp.data.items.map((it) => [it.item_id, it]));
        setSelectedGodown((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: (prev.items || []).map((it) => {
              const patch = byId[it.item_id];
              if (!patch) return it;
              return {
                ...it,
                physical_qty: patch.physical_qty ?? it.physical_qty,
                entry_count: patch.entry_count ?? it.entry_count,
                logs: patch.logs ?? it.logs,
                status: patch.status ?? it.status,
              };
            }),
          };
        });
        setSelectedSession((prev) => {
          if (!prev || !selectedGodown?.godown_id) return prev;
          return {
            ...prev,
            godowns: (prev.godowns || []).map((g) => {
              if (g.godown_id !== selectedGodown.godown_id) return g;
              return {
                ...g,
                items: (g.items || []).map((it) => {
                  const patch = byId[it.item_id];
                  if (!patch) return it;
                  return {
                    ...it,
                    physical_qty: patch.physical_qty ?? it.physical_qty,
                    entry_count: patch.entry_count ?? it.entry_count,
                    logs: patch.logs ?? it.logs,
                    status: patch.status ?? it.status,
                  };
                }),
              };
            }),
          };
        });
      }

      // Refresh session list in background (do not block Save All close)
      void queryClient.invalidateQueries({ queryKey: ["stock-audit-sessions"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const mergeAuditItemIntoGodownState = (itemId, patch) => {
    const applyPatch = (it) => (it.item_id !== itemId ? it : { ...it, ...patch });
    setSelectedGodown((prev) => {
      if (!prev) return prev;
      return { ...prev, items: (prev.items || []).map(applyPatch) };
    });
    setSelectedSession((prev) => {
      if (!prev || !selectedGodown?.godown_id) return prev;
      return {
        ...prev,
        godowns: (prev.godowns || []).map((g) =>
          g.godown_id === selectedGodown.godown_id
            ? { ...g, items: (g.items || []).map(applyPatch) }
            : g
        ),
      };
    });
  };

  const updateItemPhysicalMutation = useMutation({
    mutationFn: async ({ itemId, payload }) => {
      const res = await fetch(`${API_BASE_URL}/api/process/update-physical-stock/${itemId}/`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data?.status !== 200) {
        throw new Error(data?.message || "Failed to update stock count");
      }
      return data?.data;
    },
    onSuccess: async (data) => {
      toast({ title: "Success", variant: "success", description: "Stock count updated" });
      mergeAuditItemIntoGodownState(data.item_id, {
        physical_qty: data.physical_qty,
        count_status: data.count_status,
        physical_unit: data.physical_unit,
        entry_count: data.entry_count,
        last_updated_by: data.last_updated_by,
        last_updated_at: data.last_updated_at,
        difference_qty: data.difference_qty,
        has_difference: data.has_difference,
        logs: data.logs,
      });
      queryClient.invalidateQueries({ queryKey: ["stock-audit-sessions"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const appendDiscussionToItemDetails = (newDiscussion) => {
    if (!newDiscussion?.id) return;
    setItemDetails((prev) => {
      if (!prev) return prev;
      const existing = Array.isArray(prev.discussions) ? prev.discussions : [];
      if (existing.some((d) => d.id === newDiscussion.id)) return prev;
      return {
        ...prev,
        discussions: [...existing, newDiscussion],
      };
    });
  };

  const addDiscussionMutation = useMutation({
    mutationFn: async ({ itemId, message, parentMessageId }) =>
      postAuditItemDiscussion(itemId, message, parentMessageId),
    onSuccess: async (resp) => {
      toast({ title: "Success", variant: "success", description: resp?.message || "Remark added" });
      setDiscussionMessage("");
      if (resp?.data) {
        appendDiscussionToItemDetails(resp.data);
      }
      if (selectedItem?.item_id) {
        try {
          const details = await fetchItemDetails(selectedItem.item_id);
          setItemDetails(details);
        } catch {
          // Local append already applied when response includes discussion row.
        }
      }
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateLogItemState = ({ itemId, logId, mode, payload }) => {
    setSelectedGodown((prev) => {
      if (!prev || !Array.isArray(prev.items)) return prev;
      const nextItems = prev.items.map((it) => {
        if (it.item_id !== itemId) return it;
        const currentLogs = Array.isArray(it.logs) ? it.logs : [];
        let updatedLogs = currentLogs;

        if (mode === "update") {
          const updatedLog = {
            id: payload.log_id,
            qty: payload.qty,
            entry_count: payload.entry_count,
            time: payload.time,
          };
          updatedLogs = currentLogs.map((l) => (l.id === logId ? { ...l, ...updatedLog } : l));
        } else if (mode === "delete") {
          updatedLogs = currentLogs.filter((l) => l.id !== logId);
        }

        return {
          ...it,
          logs: updatedLogs,
          entry_count: payload.parent_entry_count ?? it.entry_count,
          physical_qty: payload.parent_physical_qty ?? it.physical_qty,
          count_status: payload.parent_count_status ?? it.count_status,
          physical_unit: payload.parent_physical_unit ?? it.physical_unit,
        };
      });
      return { ...prev, items: nextItems };
    });

    setSelectedLogItem((prev) => {
      if (!prev || prev.item_id !== itemId) return prev;
      const currentLogs = Array.isArray(prev.logs) ? prev.logs : [];
      let updatedLogs = currentLogs;
      if (mode === "update") {
        const updatedLog = {
          id: payload.log_id,
          qty: payload.qty,
          entry_count: payload.entry_count,
          time: payload.time,
        };
        updatedLogs = currentLogs.map((l) => (l.id === logId ? { ...l, ...updatedLog } : l));
      } else if (mode === "delete") {
        updatedLogs = currentLogs.filter((l) => l.id !== logId);
      }
      return {
        ...prev,
        logs: updatedLogs,
        entry_count: payload.parent_entry_count ?? prev.entry_count,
        physical_qty: payload.parent_physical_qty ?? prev.physical_qty,
        count_status: payload.parent_count_status ?? prev.count_status,
        physical_unit: payload.parent_physical_unit ?? prev.physical_unit,
      };
    });
  };

  const getEnteredByNames = (item) => {
    const logs = Array.isArray(item?.logs) ? item.logs : [];
    const names = logs
      .map((log) =>
        String(
          log?.created_by ??
          log?.created_by_name ??
          log?.entered_by ??
          ""
        ).trim()
      )
      .filter(Boolean);

    if (names.length > 0) {
      return [...new Set(names)].join(", ");
    }

    return String(item?.last_updated_by || "").trim() || "-";
  };

  const updateLogMutation = useMutation({
    mutationFn: async ({ logId, qty }) => {
      const res = await fetch(`${API_BASE_URL}/api/process/stock-item-entry-log/${logId}/`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ qty }),
      });
      const data = await res.json();
      if (!res.ok || data?.status !== 200) {
        throw new Error(data?.message || "Failed to update log entry");
      }
      return data?.data;
    },
    onSuccess: (data, vars) => {
      updateLogItemState({
        itemId: vars.itemId,
        logId: vars.logId,
        mode: "update",
        payload: data,
      });
      setEditingLogId(null);
      setEditingLogQty("");
      toast({ title: "Success", variant: "success", description: "Log updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteLogMutation = useMutation({
    mutationFn: async ({ logId }) => {
      const res = await fetch(`${API_BASE_URL}/api/process/stock-item-entry-log/${logId}/`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok || data?.status !== 200) {
        throw new Error(data?.message || "Failed to delete log entry");
      }
      return data?.data;
    },
    onSuccess: (data, vars) => {
      updateLogItemState({
        itemId: vars.itemId,
        logId: vars.logId,
        mode: "delete",
        payload: data,
      });
      toast({ title: "Success", variant: "success", description: "Log deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const openManageDialog = () => {
    if (!selectedSession) return;
    setManageAddGodownIds([]);
    setManageRemoveGodownIds([]);
    setManageNotes(selectedSession.notes || "");
    setIsManageOpen(true);
  };

  const handleLoadGodownItems = async (godownId) => {
    if (!selectedSession?.id) return;
    try {
      setLoadingGodownItemsId(godownId);
      const details = await fetchSessionDetails(selectedSession.id, godownId);
      if (!details) return;
      const godownWithItems = (details.godowns || []).find((g) => g.godown_id === godownId);
      if (!godownWithItems) return;
      setSelectedSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          godowns: (prev.godowns || []).map((g) =>
            g.godown_id === godownId ? { ...g, items: godownWithItems.items || [] } : g
          ),
        };
      });
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoadingGodownItemsId(null);
    }
  };

  const openGodownDetailsDialog = async (godown) => {
    try {
      let targetGodown = godown;
      if (!Array.isArray(godown.items) && selectedSession?.id) {
        setLoadingGodownItemsId(godown.godown_id);
        const details = await fetchSessionDetails(selectedSession.id, godown.godown_id);
        const godownWithItems = (details?.godowns || []).find((g) => g.godown_id === godown.godown_id);
        if (godownWithItems) {
          targetGodown = godownWithItems;
          setSelectedSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              godowns: (prev.godowns || []).map((g) =>
                g.godown_id === godown.godown_id ? { ...g, ...godownWithItems } : g
              ),
            };
          });
        }
      }
      setSelectedGodown(targetGodown);
      setIsGodownDetailsOpen(true);
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoadingGodownItemsId(null);
    }
  };

  const openBulkUpdateDialog = async (godown) => {
    let rows = Array.isArray(godown.items) ? godown.items : null;
    if (!rows && selectedSession?.id) {
      const details = await fetchSessionDetails(selectedSession.id, godown.godown_id);
      const godownWithItems = (details?.godowns || []).find((g) => g.godown_id === godown.godown_id);
      rows = godownWithItems?.items || [];
      if (godownWithItems) {
        setSelectedSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            godowns: (prev.godowns || []).map((g) =>
              g.godown_id === godown.godown_id ? { ...g, ...godownWithItems } : g
            ),
          };
        });
      }
    }
    if (!Array.isArray(rows)) {
      toast({ title: "Error", description: "Load godown items first", variant: "destructive" });
      return;
    }
    setBulkUpdateGodown(godown);
    setBulkUpdateRows(
      rows.map((item) => ({
        item_id: item.item_id,
        stock_item_name: item.stock_item_name || "-",
        system_qty: item.system_qty,
        system_unit: item.system_unit || "",
        physical_qty: item.physical_qty ?? "",
        remarks: "",
        images: getAuditItemImages(item),
        imagePreviews: [],
        imageDataUrls: [],
      }))
    );
    setIsBulkUpdateOpen(true);
  };

  const openUpdateCountDialog = (item) => {
    setUpdateCountItem(item);
    setUpdateCountQty(
      item.physical_qty !== null && item.physical_qty !== undefined ? String(item.physical_qty) : ""
    );
    setUpdateCountRemark("");
    setUpdateCountImagePreviews([]);
    setIsUpdateCountOpen(true);
  };

  const handleUpdateCountImages = async (event) => {
    const files = event.target.files;
    if (!files?.length) return;
    try {
      const dataUrls = await filesToBase64Images(files);
      setUpdateCountImagePreviews((prev) => [
        ...prev,
        ...dataUrls.map((url, idx) => ({
          id: `${Date.now()}-${idx}`,
          preview: url,
        })),
      ]);
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const removeUpdateCountImage = (id) => {
    setUpdateCountImagePreviews((prev) => prev.filter((img) => img.id !== id));
  };

  const handleUpdateCountSave = async () => {
    if (!updateCountItem?.item_id) return;
    if (updateCountQty === "" || updateCountQty === null) {
      toast({ title: "Validation Error", description: "Physical quantity is required", variant: "destructive" });
      return;
    }
    try {
      await updateItemPhysicalMutation.mutateAsync({
        itemId: updateCountItem.item_id,
        payload: {
          physical_qty: updateCountQty,
        },
      });
      const remarkText = updateCountRemark.trim();
      if (remarkText) {
        await postAuditItemDiscussion(updateCountItem.item_id, remarkText);
      }
      if (updateCountImagePreviews.length > 0) {
        setIsUploadingImages(true);
        const uploadResp = await uploadAuditItemImages(
          updateCountImagePreviews.map((img) => ({
            item_id: updateCountItem.item_id,
            url: img.preview,
          }))
        );
        mergeItemImagesFromUploadResponse(uploadResp);
        toast({ title: "Success", variant: "success", description: "Photos uploaded successfully" });
      }
      await refreshGodownItems();
      setIsUpdateCountOpen(false);
      setUpdateCountItem(null);
      setUpdateCountQty("");
      setUpdateCountRemark("");
      setUpdateCountImagePreviews([]);
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsUploadingImages(false);
    }
  };

  const handleBulkRowImages = async (itemId, event) => {
    const files = event.target.files;
    if (!files?.length) return;
    try {
      const dataUrls = await filesToBase64Images(files);
      setBulkUpdateRows((prev) =>
        prev.map((row) =>
          row.item_id !== itemId
            ? row
            : {
                ...row,
                imageDataUrls: [...(row.imageDataUrls || []), ...dataUrls],
                imagePreviews: [
                  ...(row.imagePreviews || []),
                  ...dataUrls.map((url, idx) => ({ id: `${Date.now()}-${idx}`, preview: url })),
                ],
              }
        )
      );
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const removeBulkRowImage = (itemId, imageId) => {
    setBulkUpdateRows((prev) =>
      prev.map((row) => {
        if (row.item_id !== itemId) return row;
        const nextPreviews = (row.imagePreviews || []).filter((img) => img.id !== imageId);
        return {
          ...row,
          imagePreviews: nextPreviews,
          imageDataUrls: nextPreviews.map((img) => img.preview),
        };
      })
    );
  };

  const updateBulkRow = (itemId, key, value) => {
    setBulkUpdateRows((prev) =>
      prev.map((row) => (row.item_id !== itemId ? row : { ...row, [key]: value }))
    );
  };

  const getAutoStatusFromQty = (qty) => {
    if (qty === "" || qty === null || qty === undefined) return "PENDING";
    const parsed = Number(qty);
    if (Number.isNaN(parsed)) return "PENDING";
    return parsed === 0 ? "NOT_FOUND" : "COUNTED";
  };

  const handleBulkUpdateSave = async () => {
    if (!selectedSession?.id || !bulkUpdateGodown?.godown_id) return;
    for (const row of bulkUpdateRows) {
      if (row.physical_qty === "" || row.physical_qty === null) {
        toast({
          title: "Validation Error",
          description: `Physical quantity is required (${row.stock_item_name})`,
          variant: "destructive",
        });
        return;
      }
    }

    const rowsSnapshot = bulkUpdateRows;
    const remarkRows = rowsSnapshot.filter((row) => (row.remarks || "").trim());
    const imagePayload = rowsSnapshot.flatMap((row) =>
      (row.imageDataUrls || []).map((url) => ({
        item_id: row.item_id,
        url,
      }))
    );

    try {
      await bulkUpdateMutation.mutateAsync({
        sessionId: selectedSession.id,
        godownId: bulkUpdateGodown.godown_id,
        payload: rowsSnapshot.map((row) => ({
          item_id: row.item_id,
          physical_qty: row.physical_qty,
        })),
      });

      // Close dialog immediately after stock save — secondary work continues in background
      setIsBulkUpdateOpen(false);
      setBulkUpdateRows([]);
      setBulkUpdateGodown(null);

      void (async () => {
        try {
          if (remarkRows.length > 0) {
            await Promise.all(
              remarkRows.map((row) => postAuditItemDiscussion(row.item_id, row.remarks.trim()))
            );
          }

          if (imagePayload.length > 0) {
            setIsUploadingImages(true);
            const uploadResp = await uploadAuditItemImages(imagePayload);
            mergeItemImagesFromUploadResponse(uploadResp);
          }

          // Fresh sync after remarks/images (onSuccess already patched qty optimistically)
          await refreshGodownItems();
        } catch (error) {
          toast({
            title: "Warning",
            description: error?.message || "Stock saved, but remarks/photos sync had an issue",
            variant: "destructive",
          });
        } finally {
          setIsUploadingImages(false);
        }
      })();
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsUploadingImages(false);
    }
  };

  const handleManageSave = () => {
    if (!selectedSession?.id) return;
    const hasChanges =
      manageAddGodownIds.length > 0 ||
      manageRemoveGodownIds.length > 0 ||
      (manageNotes || "") !== (selectedSession.notes || "");

    if (!hasChanges) {
      toast({ title: "No Changes", description: "No changes to save", variant: "destructive" });
      return;
    }

    manageMutation.mutate({
      sessionId: selectedSession.id,
      payload: {
        add_godown_ids: manageAddGodownIds,
        remove_godown_ids: manageRemoveGodownIds,
        notes: manageNotes,
      },
    });
  };

  const openDiscussionDialog = async (item) => {
    try {
      setSelectedItem(item);
      setDiscussionMessage("");
      setItemDetails(null);
      setIsDiscussionOpen(true);
      setDiscussionDetailsLoading(true);
      const details = await fetchItemDetails(item.item_id);
      setItemDetails(details);
    } catch (error) {
      setIsDiscussionOpen(false);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDiscussionDetailsLoading(false);
    }
  };

  const openLogsDialog = (item) => {
    setSelectedLogItem(item);
    setEditingLogId(null);
    setEditingLogQty("");
    setIsLogsOpen(true);
  };

  const startEditLog = (log) => {
    setEditingLogId(log.id);
    setEditingLogQty(log.qty ?? "");
  };

  const saveLogEdit = (log) => {
    if (!selectedLogItem?.item_id) return;
    if (editingLogQty === "" || editingLogQty === null) {
      toast({ title: "Validation Error", description: "Quantity is required", variant: "destructive" });
      return;
    }
    updateLogMutation.mutate({
      logId: log.id,
      qty: editingLogQty,
      itemId: selectedLogItem.item_id,
    });
  };

  const handleDeleteLog = (log) => {
    if (!selectedLogItem?.item_id) return;
    deleteLogMutation.mutate({
      logId: log.id,
      itemId: selectedLogItem.item_id,
    });
  };

  const handleAddDiscussion = () => {
    if (!selectedItem?.item_id) return;
    if (!discussionMessage.trim()) {
      toast({ title: "Validation Error", description: "Enter a discussion remark", variant: "destructive" });
      return;
    }
    addDiscussionMutation.mutate({
      itemId: selectedItem.item_id,
      message: discussionMessage.trim(),
    });
  };

  if (permissionsLoading) {
    return <CommonLoader />;
  }

  if (!canRead) {
    return (
      <div className="p-8 text-center text-gray-600">
        You do not have read permission for Stock Audit.
      </div>
    );
  }

  const loading = sessionsLoading || ((canCreate || canUpdate || canDelete) && godownsLoading);
  const selectedSessionGodownIds = (selectedSession?.godowns || []).map((g) => g.godown_id);
  const availableGodownsToAdd = godowns.filter((g) => !selectedSessionGodownIds.includes(g.id));

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isMobile && (
                <Button variant="ghost" size="icon" onClick={() => setIsMobileSidebarOpen(true)}>
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <ClipboardList className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Stock Auditing</h1>
            </div>
            {canCreate && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Initiate
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
                  <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
                    <DialogTitle>Initiate Stock Audit Session</DialogTitle>
                    <DialogDescription>
                      Select branch, schedule, and godowns to start a new stock audit session.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="audit-branch">Branch *</Label>
                      <select
                        id="audit-branch"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={selectedBranchId}
                        onChange={(e) => {
                          setSelectedBranchId(e.target.value);
                          setSelectedGodownIds([]);
                        }}
                        disabled={branchesLoading}
                      >
                        <option value="">{branchesLoading ? "Loading branches..." : "Select branch"}</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.branch_id || branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="audit-started-at">Starting From *</Label>
                        <Input
                          id="audit-started-at"
                          type="datetime-local"
                          value={startedAt}
                          onChange={(e) => setStartedAt(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="audit-end-at">End At *</Label>
                        <Input
                          id="audit-end-at"
                          type="datetime-local"
                          value={completedAt}
                          onChange={(e) => setCompletedAt(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Godowns *</Label>
                      <div className="max-h-48 overflow-y-auto border rounded-md p-3 space-y-1">
                        {!selectedBranchId ? (
                          <p className="text-sm text-gray-500">Select a branch to load godowns.</p>
                        ) : godownsLoading ? (
                          <p className="text-sm text-gray-500">Loading godowns...</p>
                        ) : godowns.length === 0 ? (
                          <p className="text-sm text-gray-500">No godowns found for selected branch.</p>
                        ) : (
                          godowns.map((g) => (
                            <div key={g.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-gray-50">
                              <div className="flex items-center gap-3 min-w-0">
                                <Checkbox
                                  checked={selectedGodownIds.includes(g.id)}
                                  onCheckedChange={(checked) => toggleGodown(g.id, !!checked)}
                                />
                                <span className="text-sm truncate">{g.name}</span>
                              </div>
                              <span className="text-xs text-gray-500 whitespace-nowrap">
                                Items: {g.stock_item_count ?? 0}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="audit-notes">Notes</Label>
                      <Input
                        id="audit-notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Optional session notes"
                      />
                    </div>
                  </div>
                  <DialogFooter className="shrink-0 border-t px-6 py-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleInitiate} disabled={initiateMutation.isPending}>
                      {initiateMutation.isPending ? "Initiating..." : "Initiate"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4">
          {loading ? (
            <CommonLoader />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Stock Audit Sessions</span>
                    <Input
                    className="max-w-xs"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by audit no / status / user / started / completed"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Audit No</TableHead>
                      <TableHead style={{ width: "105px" }}>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead style={{ width: "120px" }}>Started At</TableHead>
                      <TableHead>Completed At</TableHead>
                      <TableHead>Godowns</TableHead>
                      <TableHead>Total Items</TableHead>
                      <TableHead style={{ width: "120px" }}>Initiated By</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-gray-500">
                          No stock audit sessions found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSessions.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.audit_no}</TableCell>
                          <TableCell>{row.audit_date || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getSessionStatusBadgeClass(row.status)}>
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{row.started_at || "-"}</TableCell>
                          <TableCell>{row.completed_at || "-"}</TableCell>
                          <TableCell>{row.godown_count || 0}</TableCell>
                          <TableCell>{row.total_item_count || 0}</TableCell>
                          <TableCell>{row.initiated_by || "-"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const details = await fetchSessionDetails(row.id);
                                  setSelectedSession(details);
                                  setIsDetailsOpen(true);
                                } catch (error) {
                                  toast({ title: "Error", description: error.message, variant: "destructive" });
                                }
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className={`max-w-6xl ${auditDialogContentClass}`}>
          <AuditDialogCloseButton />
          <DialogHeader className="pr-10">
            <DialogTitle>
              Audit Session Details {selectedSession ? `- ${selectedSession.audit_no}` : ""}
            </DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4 max-h-[75vh] overflow-auto">
              {(canUpdate || canDelete) && selectedSession.status === "IN_PROGRESS" && (selectedSession?.item_summary?.total_pending || 0) > 0 && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={openManageDialog}>
                    Edit Godowns
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Status</p><p className="font-semibold">{selectedSession.status}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Audit Date</p><p className="font-semibold">{selectedSession.audit_date || "-"}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Godowns</p><p className="font-semibold">{selectedSession.godown_count || 0}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Total Items</p><p className="font-semibold">{selectedSession.total_item_count || 0}</p></CardContent></Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Badge variant="secondary">Total Pending: {selectedSession?.item_summary?.total_pending || 0}</Badge>
                <Badge variant="outline">Total Entered: {selectedSession?.item_summary?.total_entered || 0}</Badge>
                <Badge variant="destructive">Total Mismatch: {selectedSession?.item_summary?.total_mismatch_entries || 0}</Badge>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Godown List</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Godown</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Items</TableHead>
                          <TableHead>Total Pending</TableHead>
                          <TableHead>Total Entered</TableHead>
                          <TableHead>Total Mismatch</TableHead>
                          <TableHead>Uploaded Images</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(selectedSession.godowns || []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-gray-500">
                              No godowns found in this session.
                            </TableCell>
                          </TableRow>
                        ) : (
                          (selectedSession.godowns || []).map((godown) => (
                            <TableRow
                              key={godown.godown_audit_id}
                              className="cursor-pointer"
                              onClick={() => openGodownDetailsDialog(godown)}
                            >
                              <TableCell className="font-medium">{godown.godown_name || "-"}</TableCell>
                              <TableCell><Badge variant="secondary">{godown.status}</Badge></TableCell>
                              <TableCell>{godown.item_count || 0}</TableCell>
                              <TableCell>{godown?.item_summary?.total_pending || 0}</TableCell>
                              <TableCell>{godown?.item_summary?.total_entered || 0}</TableCell>
                              <TableCell>{godown?.item_summary?.total_mismatch_entries || 0}</TableCell>
                              <TableCell className="min-w-[140px]">
                                <AuditItemImagesStrip images={godown.images || []} size="sm" />
                              </TableCell>
                              <TableCell className="text-right text-xs text-gray-500">Click to view</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isGodownDetailsOpen} onOpenChange={setIsGodownDetailsOpen}>
        <DialogContent className={`max-w-6xl ${auditDialogContentClass}`}>
          <AuditDialogCloseButton />
          <DialogHeader className="pr-10">
            <DialogTitle>
              Godown Details {selectedGodown ? `- ${selectedGodown.godown_name || ""}` : ""}
            </DialogTitle>
          </DialogHeader>
          {selectedGodown && (
            <div className="space-y-4 max-h-[75vh] overflow-auto">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                <Card className="border-sky-200 bg-sky-50 shadow-sm">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium text-sky-700">Status</p>
                    <p className="mt-1 font-semibold text-sky-950">{selectedGodown.status || "-"}</p>
                  </CardContent>
                </Card>
                <Card className="border-emerald-200 bg-emerald-50 shadow-sm">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium text-emerald-700">Items</p>
                    <p className="mt-1 font-semibold text-emerald-950">{selectedGodown.item_count || 0}</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-200 bg-amber-50 shadow-sm">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium text-amber-700">Total Pending</p>
                    <p className="mt-1 font-semibold text-amber-950">{selectedGodown?.item_summary?.total_pending || 0}</p>
                  </CardContent>
                </Card>
                <Card className="border-rose-200 bg-rose-50 shadow-sm">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium text-rose-700">Total Mismatch</p>
                    <p className="mt-1 font-semibold text-rose-950">{selectedGodown?.item_summary?.total_mismatch_entries || 0}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openGodownDetailsDialog(selectedGodown)}
                  disabled={loadingGodownItemsId === selectedGodown.godown_id}
                >
                  {loadingGodownItemsId === selectedGodown.godown_id ? "Loading..." : "Refresh Items"}
                </Button>
                {canUpdate && selectedSession?.status === "IN_PROGRESS" && (
                  <Button
                    size="sm"
                    onClick={() => openBulkUpdateDialog(selectedGodown)}
                    disabled={loadingGodownItemsId === selectedGodown.godown_id}
                  >
                    Update Godown Stock
                  </Button>
                )}
              </div>

              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>System Qty</TableHead>
                      <TableHead>Physical Qty</TableHead>
                      <TableHead>Difference</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Entered By</TableHead>
                      <TableHead>Photos</TableHead>
                      {canRead && <TableHead className="text-right">Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!Array.isArray(selectedGodown.items) ? (
                      <TableRow>
                        <TableCell colSpan={canRead ? 8 : 7} className="text-center text-gray-500">
                          Click "Refresh Items" to load this godown's stock lines.
                        </TableCell>
                      </TableRow>
                    ) : (selectedGodown.items || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canRead ? 8 : 7} className="text-center text-gray-500">No items found.</TableCell>
                      </TableRow>
                    ) : (
                      (selectedGodown.items || []).map((item) => (
                        <TableRow key={item.item_id}>
                          <TableCell>{item.stock_item_name || "-"}</TableCell>
                          <TableCell>{item.system_qty} {item.system_unit || ""}</TableCell>
                          <TableCell>{item.physical_qty ?? "-"} {item.physical_unit || ""}</TableCell>
                          <TableCell>
                            {item.physical_qty !== null && item.physical_qty !== undefined
                              ? Number((Number(item.physical_qty) - Number(item.system_qty || 0)).toFixed(3))
                              : "-"}
                          </TableCell>
                          <TableCell><Badge variant="outline">{item.count_status}</Badge></TableCell>
                          <TableCell>{getEnteredByNames(item)}</TableCell>
                          <TableCell className="min-w-[100px]">
                            <AuditItemImagesStrip images={getAuditItemImages(item)} size="sm" />
                          </TableCell>
                          {canRead && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2 items-center">
                                {canUpdate && selectedSession?.status === "IN_PROGRESS" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openUpdateCountDialog(item)}
                                  >
                                    Update
                                  </Button>
                                )}
                                <Button size="sm" variant="outline" onClick={() => openLogsDialog(item)}>
                                  Logs
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => openDiscussionDialog(item)}>
                                  Remarks
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isUpdateCountOpen} onOpenChange={setIsUpdateCountOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Update Count {updateCountItem ? `- ${updateCountItem.stock_item_name || ""}` : ""}
            </DialogTitle>
          </DialogHeader>
          {updateCountItem && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                System: {updateCountItem.system_qty} {updateCountItem.system_unit || ""}
              </p>
              <div>
                <Label>Physical quantity (total)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={updateCountQty}
                  onChange={(e) => setUpdateCountQty(e.target.value)}
                  placeholder="Enter counted quantity"
                />
              </div>
              <div>
                <Label>Remark (optional)</Label>
                <Input
                  value={updateCountRemark}
                  onChange={(e) => setUpdateCountRemark(e.target.value)}
                  placeholder="Optional remark"
                />
              </div>
              <div>
                <Label>Photos (optional)</Label>
                {getAuditItemImages(updateCountItem).length > 0 && (
                  <div className="mt-2 mb-2">
                    <p className="text-xs text-gray-500 mb-1">Already uploaded</p>
                    <AuditItemImagesStrip images={getAuditItemImages(updateCountItem)} size="sm" />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <AuditPhotoPickerButton onChange={handleUpdateCountImages} title="Add photos" size="sm">
                    <Camera className="h-4 w-4" />
                    Add photos
                  </AuditPhotoPickerButton>
                  {updateCountImagePreviews.map((img) => (
                    <div key={img.id} className="relative h-14 w-14 rounded border overflow-hidden">
                      <img src={img.preview} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        className="absolute top-0 right-0 bg-black/60 text-white p-0.5"
                        onClick={() => removeUpdateCountImage(img.id)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsUpdateCountOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateCountSave}
                  disabled={updateItemPhysicalMutation.isPending || isUploadingImages}
                >
                  {updateItemPhysicalMutation.isPending || isUploadingImages ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Audit Session Godowns</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {canUpdate && (
              <div>
                <Label>Add Godowns</Label>
                <div className="max-h-44 overflow-auto border rounded-md p-3 space-y-2 mt-2">
                  {availableGodownsToAdd.length === 0 ? (
                    <p className="text-sm text-gray-500">No additional godowns available to add.</p>
                  ) : (
                    availableGodownsToAdd.map((g) => (
                      <div key={`add-${g.id}`} className="flex items-center gap-3">
                        <Checkbox
                          checked={manageAddGodownIds.includes(g.id)}
                          onCheckedChange={(checked) => toggleManageAddGodown(g.id, !!checked)}
                        />
                        <span className="text-sm">{g.name} ({g.stock_item_count ?? 0})</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {canDelete && (
              <div>
                <Label>Delete Godowns</Label>
                <div className="max-h-44 overflow-auto border rounded-md p-3 space-y-2 mt-2">
                  {(selectedSession?.godowns || []).length === 0 ? (
                    <p className="text-sm text-gray-500">No godowns found in this audit session.</p>
                  ) : (
                    (selectedSession?.godowns || []).map((g) => (
                      <div key={`remove-${g.godown_id}`} className="flex items-center gap-3">
                        <Checkbox
                          checked={manageRemoveGodownIds.includes(g.godown_id)}
                          onCheckedChange={(checked) => toggleManageRemoveGodown(g.godown_id, !!checked)}
                        />
                        <span className="text-sm">{g.godown_name || "-"} (Items: {g.item_count || 0})</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {(canUpdate || canDelete) && (
              <div>
                <Label>Notes</Label>
                <Input
                  value={manageNotes}
                  onChange={(e) => setManageNotes(e.target.value)}
                  placeholder="Optional session notes"
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsManageOpen(false)}>Cancel</Button>
              <Button onClick={handleManageSave} disabled={manageMutation.isPending}>
                {manageMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkUpdateOpen} onOpenChange={setIsBulkUpdateOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              Update Godown Stock {bulkUpdateGodown ? `- ${bulkUpdateGodown.godown_name || ""}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[75vh] overflow-auto">
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>System Qty</TableHead>
                    <TableHead>Physical Qty</TableHead>
                    <TableHead>Auto Status</TableHead>
                    <TableHead>Remark</TableHead>
                    <TableHead>Photos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bulkUpdateRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500">
                        No items available for update.
                      </TableCell>
                    </TableRow>
                  ) : (
                    bulkUpdateRows.map((row) => (
                      <TableRow key={row.item_id}>
                        <TableCell className="font-medium">{row.stock_item_name}</TableCell>
                        <TableCell>{row.system_qty} {row.system_unit || ""}</TableCell>
                        <TableCell>
                          <Input
                            value={row.physical_qty}
                            onChange={(e) => updateBulkRow(row.item_id, "physical_qty", e.target.value)}
                            type="number"
                            step="0.001"
                            placeholder="Qty to add"
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getAutoStatusFromQty(row.physical_qty)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.remarks}
                            onChange={(e) => updateBulkRow(row.item_id, "remarks", e.target.value)}
                            placeholder="Optional remark"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-2">
                            {(row.images || []).length > 0 && (
                              <AuditItemImagesStrip images={row.images} size="sm" />
                            )}
                            <div className="flex flex-wrap items-center gap-1">
                              <AuditPhotoPickerButton
                                onChange={(e) => handleBulkRowImages(row.item_id, e)}
                                title="Attach photos"
                              />
                              {(row.imagePreviews || []).map((img) => (
                                <div key={img.id} className="relative h-10 w-10 rounded border overflow-hidden">
                                  <img src={img.preview} alt="" className="h-full w-full object-cover" />
                                  <button
                                    type="button"
                                    className="absolute top-0 right-0 bg-black/60 text-white p-0.5"
                                    onClick={() => removeBulkRowImage(row.item_id, img.id)}
                                  >
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsBulkUpdateOpen(false);
                  setBulkUpdateRows([]);
                  setBulkUpdateGodown(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkUpdateSave}
                disabled={bulkUpdateMutation.isPending || isUploadingImages || bulkUpdateRows.length === 0}
              >
                {bulkUpdateMutation.isPending || isUploadingImages ? "Saving..." : "Save All"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDiscussionOpen} onOpenChange={setIsDiscussionOpen}>
        <DialogContent className={`max-w-3xl ${auditDialogContentClass}`}>
          <AuditDialogCloseButton />
          <DialogHeader className="pr-10">
            <DialogTitle>Item Remarks & Conversion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[75vh] overflow-auto">
            {discussionDetailsLoading ? (
              <div className="py-10 flex justify-center">
                <CommonLoader />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Item</p><p className="font-semibold">{itemDetails?.stock_item_name || "-"}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">System Qty</p><p className="font-semibold">{itemDetails?.system_qty ?? "-"} {itemDetails?.system_unit || ""}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Physical Qty</p><p className="font-semibold">{itemDetails?.physical_qty ?? "-"} {itemDetails?.physical_unit || ""}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Difference</p><p className="font-semibold">{itemDetails?.difference_qty ?? "-"} {itemDetails?.has_difference ? "(Mismatch)" : "(Match)"}</p></CardContent></Card>
                </div>

                <Card>
                  <CardHeader><CardTitle className="text-base">Stock Update Conversion</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>
                      System stock: <span className="font-medium">{itemDetails?.system_qty ?? "-"} {itemDetails?.system_unit || ""}</span>
                    </p>
                    <p>
                      Physical stock entered: <span className="font-medium">{itemDetails?.physical_qty ?? "-"} {itemDetails?.physical_unit || ""}</span>
                    </p>
                    <p>
                      Conversion/Delta: <span className="font-medium">
                        {(itemDetails?.physical_qty ?? 0)} - {(itemDetails?.system_qty ?? 0)} = {itemDetails?.difference_qty ?? "-"} {itemDetails?.physical_unit || itemDetails?.system_unit || ""}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">
                      Physical unit is auto-captured from stock item base unit during update.
                    </p>
                  </CardContent>
                </Card>

                {getAuditItemImages(itemDetails).length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Attached Photos</CardTitle></CardHeader>
                    <CardContent>
                      <AuditItemImagesStrip images={getAuditItemImages(itemDetails)} />
                    </CardContent>
                  </Card>
                )}

                <Card>
                  {/* <CardHeader><CardTitle className="text-base">Discussion Trail</CardTitle></CardHeader> */}
                  <CardContent className="space-y-3">
                    {(itemDetails?.discussions || []).length === 0 ? (
                      <p className="text-sm text-gray-500">No remarks yet.</p>
                    ) : (
                      (itemDetails?.discussions || []).map((d) => (
                        <div key={d.id} className="border rounded-md p-3">
                          <p className="text-sm">{d.message}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {d.created_by || "-"} - {d.created_at || "-"}
                          </p>
                        </div>
                      ))
                    )}

                    {canAddRemark ? (
                      <div className="border-t pt-3 space-y-3">
                        <Label htmlFor="audit-discussion-message">Add Remark</Label>
                        <textarea
                          id="audit-discussion-message"
                          className="w-full border rounded-md p-3 min-h-24 text-sm"
                          value={discussionMessage}
                          onChange={(e) => setDiscussionMessage(e.target.value)}
                          placeholder="Write supervisor/admin remark for this stock audit item"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                              e.preventDefault();
                              handleAddDiscussion();
                            }
                          }}
                        />
                        <p className="text-xs text-gray-500">Ctrl+Enter to post</p>
                        <div className="flex justify-end">
                          <Button
                            onClick={handleAddDiscussion}
                            disabled={addDiscussionMutation.isPending || !discussionMessage.trim()}
                          >
                            {addDiscussionMutation.isPending ? "Posting..." : "Post Remark"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 border-t pt-3">
                        {!canPostDiscussion
                          ? "You need create or update permission on Stock Audit to add remarks."
                          : !isSessionInProgress(selectedSession)
                            ? "Remarks can only be added while the audit session is in progress."
                            : "Unable to add remarks for this item."}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isLogsOpen} onOpenChange={setIsLogsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Item Logs {selectedLogItem ? `- ${selectedLogItem.stock_item_name || "-"}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[75vh] overflow-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Item</p><p className="font-semibold">{selectedLogItem?.stock_item_name || "-"}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">System Qty</p><p className="font-semibold">{selectedLogItem?.system_qty ?? "-"} {selectedLogItem?.system_unit || ""}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Physical Qty</p><p className="font-semibold">{selectedLogItem?.physical_qty ?? "-"} {selectedLogItem?.physical_unit || ""}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Entry Count</p><p className="font-semibold">{selectedLogItem?.entry_count ?? 0}</p></CardContent></Card>
            </div>

            {getAuditItemImages(selectedLogItem).length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Attached Photos</CardTitle></CardHeader>
                <CardContent>
                  <AuditItemImagesStrip images={getAuditItemImages(selectedLogItem)} />
                </CardContent>
              </Card>
            )}

            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Created By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selectedLogItem?.logs || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-500">
                        No logs found for this item.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (selectedLogItem?.logs || []).map((log, index) => (
                      <TableRow key={log.id}>
                        <TableCell>{log.entry_count || index + 1}</TableCell>
                        <TableCell>{log.qty ?? "-"}</TableCell>
                        <TableCell>{log.time || "-"}</TableCell>
                        <TableCell>{log.created_by || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

