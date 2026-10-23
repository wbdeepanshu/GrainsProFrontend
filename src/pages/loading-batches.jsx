import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { 
  ChevronLeft, Package, Menu, Truck, User, ListOrdered, Plus, 
  Loader2, Eye, Edit, Search, Filter, Calendar, CheckCircle, XCircle, 
  ArrowUpDown, Save, FileText
} from "lucide-react" ;
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

export default function LoadingBatches() {
  const [location, setLocation] = useLocation();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedStatusBatch, setSelectedStatusBatch] = useState(null);
  const [isGatePassModalOpen, setIsGatePassModalOpen] = useState(false);
  const [gatePassData, setGatePassData] = useState(null);
  const [filters, setFilters] = useState({
    isActive: "true",
    status: "all"
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [assignForm, setAssignForm] = useState({
    vehicle: "",
    supervisor_id: "",
    batch_id: null,
    outward_entries: []
  });
  const [availableOutwards, setAvailableOutwards] = useState([]);
  const [selectedOutwards, setSelectedOutwards] = useState([]);
  const [outwardSearchTerm, setOutwardSearchTerm] = useState("");
  const [vehicleComboboxOpen, setVehicleComboboxOpen] = useState(false);
  const [vehicleSearchTerm, setVehicleSearchTerm] = useState("");
  const [vehicleInputMode, setVehicleInputMode] = useState("dropdown"); // "dropdown" or "manual"

  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // Get user permissions
  const { 
    hasReadPermission,
    hasCreatePermission,
    hasUpdatePermission,
    isLoading: permissionsLoading 
  } = useUserPermissions();

  // Build query parameters for batches
  const buildBatchQueryParams = () => {
    const params = new URLSearchParams();
    params.append('is_active', filters.isActive);
    return params.toString();
  };

  // Fetch loading batches
  const { data: batchesData, isLoading, error, refetch } = useQuery({
    queryKey: ['loading-batches', filters.isActive],
    queryFn: async () => {
      const queryParams = buildBatchQueryParams();
      const url = `${API_BASE_URL}/api/sales/loading-batches/?${queryParams}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${AuthService.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch loading batches');
      }

      const data = await response.json();
      
      if (data.status && data.status !== 200) {
        throw new Error(data.message || 'Failed to fetch loading batches');
      }
      
      return data;
    },
    enabled: true,
  });

  // Fetch available outward entries (not assigned to any active batch)
  const { data: outwardData } = useQuery({
    queryKey: ['available-outwards'],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/sales/outward-entries/`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${AuthService.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch outward entries');
      }

      const data = await response.json();
      return data.data || [];
    },
    enabled: isAssignModalOpen,
  });

  // Fetch supervisors
  const { data: supervisorsData } = useQuery({
    queryKey: ['supervisors'],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/get-users/`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${AuthService.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      // Return all active users (they can be selected as supervisors)
      return (data.data || []).filter(user => user.user_id);
    },
    enabled: isAssignModalOpen,
  });

  const allBatches = batchesData?.data || [];
  const allOutwards = outwardData || [];
  const supervisors = supervisorsData || [];

  // Client-side filtering for batches
  const batches = allBatches.filter(batch => {
    // Filter by status
    if (filters.status !== "all" && batch.status !== filters.status) {
      return false;
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const batchId = `#${batch.id}`.toLowerCase();
      const vehicle = batch.vehicle?.toLowerCase() || '';
      const supervisorName = batch.supervisor_name?.toLowerCase() || '';
      
      if (!batchId.includes(term) && 
          !vehicle.includes(term) && 
          !supervisorName.includes(term)) {
        return false;
      }
    }

    return true;
  });

  // Filter available outwards (not assigned to active batches)
  const filteredAvailableOutwards = allOutwards.filter(outward => {
    // Check if search term matches
    if (outwardSearchTerm) {
      const term = outwardSearchTerm.toLowerCase();
      const billNo = outward.bill_no?.toLowerCase() || '';
      const customerName = outward.customer_name?.toLowerCase() || '';
      const outwardId = `#${outward.id}`.toLowerCase();
      if (!billNo.includes(term) && !customerName.includes(term) && !outwardId.includes(term)) {
        return false;
      }
    }
    return true;
  });

  // Extract unique vehicle numbers from outward entries
  const uniqueVehicleNumbers = useMemo(() => {
    const vehicles = new Set();
    allOutwards.forEach(outward => {
      if (outward.vehicle_no && outward.vehicle_no.trim() !== '') {
        vehicles.add(outward.vehicle_no.trim());
      }
    });
    return Array.from(vehicles).sort();
  }, [allOutwards]);

  // Filter vehicle numbers based on search term
  const filteredVehicleNumbers = useMemo(() => {
    if (!vehicleSearchTerm) {
      return uniqueVehicleNumbers;
    }
    const term = vehicleSearchTerm.toLowerCase();
    return uniqueVehicleNumbers.filter(vehicle => 
      vehicle.toLowerCase().includes(term)
    );
  }, [uniqueVehicleNumbers, vehicleSearchTerm]);

  // Assign outward entries to batch mutation
  const assignMutation = useMutation({
    mutationFn: async (data) => {
      // Ensure supervisor_id is a string and not null/undefined
      if (!data.supervisor_id || data.supervisor_id === null || data.supervisor_id === undefined) {
        throw new Error('Supervisor ID is required and cannot be null or undefined');
      }
      
      // Validate it's a non-empty string (user_id is a CharField like "USR0016")
      const supervisorIdStr = typeof data.supervisor_id === 'string' 
        ? data.supervisor_id.trim() 
        : String(data.supervisor_id).trim();
      
      if (supervisorIdStr === "" || supervisorIdStr === "no-supervisors") {
        throw new Error('Invalid supervisor ID. Must be a valid user_id string.');
      }
      
      const payload = {
        ...data,
        supervisor_id: supervisorIdStr
      };
      
      const response = await fetch(`${API_BASE_URL}/api/sales/assign-outward-to-batch/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AuthService.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to assign outward entries');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "Outward entries assigned successfully",
        className: "bg-green-50 border-green-100 text-green-800",
      });
      setIsAssignModalOpen(false);
      resetAssignForm();
      queryClient.invalidateQueries(['loading-batches']);
      queryClient.invalidateQueries(['available-outwards']);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign outward entries",
        variant: "destructive",
      });
    },
  });

  const resetAssignForm = () => {
    setAssignForm({
      vehicle: "",
      supervisor_id: "",
      batch_id: null,
      outward_entries: []
    });
    setSelectedOutwards([]);
    setOutwardSearchTerm("");
    setVehicleSearchTerm("");
    setVehicleComboboxOpen(false);
    setVehicleInputMode("dropdown");
  };

  const handleOpenAssignModal = (batch = null) => {
    if (batch) {
      const supervisorId = batch.supervisor ? batch.supervisor.toString() : "";
      const vehicleValue = batch.vehicle || "";
      setAssignForm({
        vehicle: vehicleValue,
        supervisor_id: supervisorId,
        batch_id: batch.id,
        outward_entries: []
      });
      setVehicleSearchTerm(vehicleValue);
    } else {
      resetAssignForm();
    }
    setIsAssignModalOpen(true);
  };

  const handleAddOutward = (outward) => {
    // Check if already selected
    if (selectedOutwards.find(o => o.id === outward.id)) {
      return;
    }
    
    // Get next sequence number
    const nextSequence = selectedOutwards.length > 0 
      ? Math.max(...selectedOutwards.map(o => o.sequence_number)) + 1
      : 1;
    
    setSelectedOutwards([...selectedOutwards, {
      ...outward,
      sequence_number: nextSequence
    }]);
  };

  const handleRemoveOutward = (outwardId) => {
    setSelectedOutwards(selectedOutwards.filter(o => o.id !== outwardId));
  };

  const handleUpdateSequence = (outwardId, newSequence) => {
    setSelectedOutwards(selectedOutwards.map(o => 
      o.id === outwardId ? { ...o, sequence_number: parseInt(newSequence) || 1 } : o
    ));
  };

  const handleAssign = () => {
    if (!assignForm.vehicle || !assignForm.vehicle.trim()) {
      toast({
        title: "Validation Error",
        description: "Vehicle number is required",
        variant: "destructive",
      });
      return;
    }

    // Check supervisor_id - it's a string (user_id like "USR0016")
    const supervisorIdValue = assignForm.supervisor_id;
    
    if (!supervisorIdValue || supervisorIdValue === "" || supervisorIdValue === "no-supervisors" || supervisorIdValue === null || supervisorIdValue === undefined) {
      toast({
        title: "Validation Error",
        description: "Supervisor is required. Please select a supervisor from the dropdown.",
        variant: "destructive",
      });
      return;
    }

    // Validate it's a non-empty string
    if (typeof supervisorIdValue !== 'string' || supervisorIdValue.trim() === "") {
      toast({
        title: "Validation Error",
        description: "Invalid supervisor selected. Please select a valid supervisor.",
        variant: "destructive",
      });
      return;
    }

    if (selectedOutwards.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one outward entry",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      vehicle: assignForm.vehicle.trim(),
      supervisor_id: supervisorIdValue.trim(), // Send as string (user_id)
      outward_entries: selectedOutwards.map(o => ({
        outward_id: o.id,
        sequence_number: o.sequence_number
      }))
    };

    if (assignForm.batch_id) {
      payload.batch_id = assignForm.batch_id;
    }

    assignMutation.mutate(payload);
  };

  const handleViewDetails = (batch) => {
    setSelectedBatch(batch);
    setIsDetailModalOpen(true);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Update batch status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ batchId, status }) => {
      const response = await fetch(`${API_BASE_URL}/api/sales/loading-batches/${batchId}/update-status/`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${AuthService.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update batch status');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "Batch status updated successfully",
        className: "bg-green-50 border-green-100 text-green-800",
      });
      setIsStatusModalOpen(false);
      setSelectedStatusBatch(null);
      queryClient.invalidateQueries(['loading-batches']);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update batch status",
        variant: "destructive",
      });
    },
  });

  const handleOpenStatusModal = (batch) => {
    setSelectedStatusBatch(batch);
    setIsStatusModalOpen(true);
  };

  const handleUpdateStatus = (status) => {
    if (selectedStatusBatch) {
      updateStatusMutation.mutate({
        batchId: selectedStatusBatch.id,
        status: status
      });
    }
  };

  // Get status badge variant
  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'loaded':
        return 'default';
      case 'gate_pass_generated':
        return 'outline';
      case 'dispatched':
        return 'default';
      default:
        return 'secondary';
    }
  };

  // Get status display name
  const getStatusDisplay = (status) => {
    const statusMap = {
      'pending': 'Pending',
      'loaded': 'Loaded',
      'gate_pass_generated': 'Gate Pass Generated',
      'dispatched': 'Dispatched'
    };
    return statusMap[status] || status;
  };

  // Generate gate pass mutation
  const generateGatePassMutation = useMutation({
    mutationFn: async (batchId) => {
      const response = await fetch(`${API_BASE_URL}/api/sales/loading-batches/${batchId}/generate-gate-pass/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${AuthService.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate gate pass');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "Gate pass generated successfully",
        className: "bg-green-50 border-green-100 text-green-800",
      });
      setGatePassData(data.data);
      setIsGatePassModalOpen(true);
      queryClient.invalidateQueries(['loading-batches']);
      // Refresh the selected batch data
      if (selectedBatch) {
        const updatedBatch = { ...selectedBatch, status: data.data.status };
        setSelectedBatch(updatedBatch);
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate gate pass",
        variant: "destructive",
      });
    },
  });

  const handleGenerateGatePass = (batchId) => {
    generateGatePassMutation.mutate(batchId);
  };

  // Fetch existing gate pass data (for download when already generated)
  const fetchGatePassMutation = useMutation({
    mutationFn: async (batchId) => {
      const response = await fetch(`${API_BASE_URL}/api/sales/loading-batches/${batchId}/get-gate-pass/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${AuthService.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch gate pass data');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setGatePassData(data.data);
      setIsGatePassModalOpen(true);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch gate pass data",
        variant: "destructive",
      });
    },
  });

  const handleDownloadGatePass = (batchId) => {
    fetchGatePassMutation.mutate(batchId);
  };

  // Generate Gate Pass PDF
  const generateGatePassPDF = async () => {
    if (!gatePassData) {
      toast({
        title: "Error",
        description: "Gate pass data is not available",
        variant: "destructive",
      });
      return;
    }

    try {
      // Dynamically import jsPDF
      const { default: jsPDF } = await import('jspdf');

      // Fetch organization information
      let orgName = '';
      let branchName = '';
      try {
        const orgResponse = await fetch(`${API_BASE_URL}/api/dashboard/`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${AuthService.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
        });

        if (orgResponse.ok) {
          const orgData = await orgResponse.json();
          if (orgData.status === 200 && orgData.data?.user_info) {
            orgName = orgData.data.user_info.organization || '';
            branchName = orgData.data.user_info.branch || '';
          }
        }
      } catch (error) {
        console.error('Failed to fetch organization info:', error);
      }

      // Create PDF
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;

      // Colors
      const primaryColor = [31, 41, 55]; // Dark gray
      const secondaryColor = [107, 114, 128]; // Medium gray
      const borderColor = [229, 231, 235]; // Light gray

      // Header Section
      doc.setFontSize(20);
      doc.setTextColor(...primaryColor);
      doc.setFont('helvetica', 'bold');
      doc.text('GrainPro', pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;

      // Organization Name
      if (orgName) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(orgName, pageWidth / 2, yPos, { align: 'center' });
        yPos += 6;
      }

      // Branch Name
      if (branchName) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...secondaryColor);
        doc.text(branchName, pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;
      }

      // Separator line
      doc.setDrawColor(...borderColor);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 8;

      // Gate Pass Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.text('GATE PASS', pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;

      // Batch Information Section
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Batch Information', margin, yPos);
      yPos += 7;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...primaryColor);
      
      const batchInfo = [
        ['Batch ID', `#${gatePassData.batch_id}`],
        ['Vehicle Number', gatePassData.vehicle],
        ['Supervisor', gatePassData.supervisor_name || 'N/A'],
        ['Generated Date', new Date(gatePassData.created_at).toLocaleString()],
      ];

      batchInfo.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(value, margin + 50, yPos);
        yPos += 6;
      });

      yPos += 5;

      // Outward Entries Section
      if (gatePassData.outward_entries && gatePassData.outward_entries.length > 0) {
        gatePassData.outward_entries.forEach((entry, entryIndex) => {
          // Check if we need a new page
          if (yPos > pageHeight - 60) {
            doc.addPage();
            yPos = margin;
          }

          // Entry Header
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...primaryColor);
          doc.text(`Outward Entry ${entryIndex + 1}`, margin, yPos);
          yPos += 7;

          // Entry Details
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          
          const entryDetails = [
            ['Bill No', entry.bill_no],
            ['Date', new Date(entry.date).toLocaleDateString()],
            ['Party Name', entry.party_name || 'N/A'],
            ['Address', entry.address || 'N/A'],
          ];

          entryDetails.forEach(([label, value]) => {
            doc.setFont('helvetica', 'bold');
            doc.text(`${label}:`, margin, yPos);
            doc.setFont('helvetica', 'normal');
            // Handle long addresses
            const lines = doc.splitTextToSize(value, pageWidth - margin - 60);
            doc.text(lines, margin + 50, yPos);
            yPos += lines.length * 5;
          });

          yPos += 3;

          // Items Table
          if (entry.items && entry.items.length > 0) {
            // Table Header
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...primaryColor);
            
            const tableStartY = yPos;
            const colWidths = [70, 30, 40, 50];
            const colHeaders = ['Item Name', 'Bags', 'Weight (kg)', 'Batch Name'];
            let xPos = margin;

            // Draw header background
            doc.setFillColor(243, 244, 246);
            doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');

            // Draw header text
            colHeaders.forEach((header, i) => {
              doc.text(header, xPos, yPos);
              xPos += colWidths[i];
            });

            yPos += 8;

            // Table rows
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...primaryColor);
            
            entry.items.forEach((item) => {
              // Check if we need a new page
              if (yPos > pageHeight - 30) {
                doc.addPage();
                yPos = margin;
              }

              xPos = margin;
              // Format batches as comma-separated list
              const batchNames = item.batches && item.batches.length > 0
                ? item.batches.map(b => b.name).join(', ')
                : (item.batch?.name || item.batch_name || item.batch_number || 'N/A');
              
              const rowData = [
                item.item_name || 'N/A',
                item.number_of_bags?.toString() || 'N/A',
                item.total_weight ? `${item.total_weight}` : 'N/A',
                batchNames,
              ];

              rowData.forEach((data, i) => {
                const lines = doc.splitTextToSize(data, colWidths[i] - 2);
                doc.text(lines, xPos, yPos);
                xPos += colWidths[i];
              });

              yPos += Math.max(...rowData.map((d, i) => 
                doc.splitTextToSize(d, colWidths[i] - 2).length
              )) * 5 + 2;

              // Draw row separator
              doc.setDrawColor(...borderColor);
              doc.line(margin, yPos - 1, pageWidth - margin, yPos - 1);
            });

            // Draw table border
            doc.setDrawColor(...primaryColor);
            doc.rect(margin, tableStartY - 5, pageWidth - 2 * margin, yPos - tableStartY + 3);
          }

          yPos += 10;

          // Separator between entries
          if (entryIndex < gatePassData.outward_entries.length - 1) {
            doc.setDrawColor(...borderColor);
            doc.line(margin, yPos, pageWidth - margin, yPos);
            yPos += 5;
          }
        });
      }

      // Footer
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(...secondaryColor);
        doc.text(
          `Page ${i} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      // Save PDF
      const filename = `GatePass_Batch_${gatePassData.batch_id}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);

      toast({
        title: "Success",
        description: "Gate pass PDF downloaded successfully",
        className: "bg-green-50 border-green-100 text-green-800",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading || permissionsLoading) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <CommonLoader />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-4">Error loading loading batches: {error.message}</p>
            <Button onClick={() => refetch()}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasReadPermission("outward")) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                <Package className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
              <p className="text-red-600 mb-4">
                You don't have permission to view loading batches. Contact your administrator for access.
              </p>
              <Button onClick={() => setLocation('/dashboard')} variant="outline">
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0">
          <div className="flex items-center space-x-4">
            {isMobile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}
           
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Loading Batches</h1>
              <p className="text-gray-600">Manage loading sequences for outward entries</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              onClick={() => setLocation("/outward/outward-list")}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            {hasCreatePermission("outward") && (
              <Button 
                onClick={() => handleOpenAssignModal()}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Assign to Batch
              </Button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 sm:p-6 min-h-0">
          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <div>
                  <Label htmlFor="batchStatus">Batch Status</Label>
                  <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select batch status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="loaded">Loaded</SelectItem>
                      <SelectItem value="gate_pass_generated">Gate Pass Generated</SelectItem>
                      <SelectItem value="dispatched">Dispatched</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="search"
                      placeholder="Search by batch ID, vehicle, or supervisor"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ListOrdered className="h-5 w-5" />
                  Loading Batches ({batches.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {batches.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch ID</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Supervisor</TableHead>
                        <TableHead>Outward Entries</TableHead>
                        <TableHead>Status</TableHead>

                        <TableHead>Created At</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batches.map((batch) => (
                        <TableRow key={batch.id}>
                          <TableCell className="font-medium">#{batch.id}</TableCell>
                          <TableCell>{batch.vehicle}</TableCell>
                          <TableCell>{batch.supervisor_name || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{batch.total_outwards || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(batch.status)}>
                              {getStatusDisplay(batch.status)}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            {new Date(batch.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewDetails(batch)}
                                className="flex items-center gap-1"
                              >
                                <Eye className="h-4 w-4" />
                                View
                              </Button>
{/*                               {hasUpdatePermission("outward") && batch.is_active && ( */}
{/*                                 <Button */}
{/*                                   variant="outline" */}
{/*                                   size="sm" */}
{/*                                   onClick={() => handleOpenAssignModal(batch)} */}
{/*                                   className="flex items-center gap-1" */}
{/*                                 > */}
{/*                                   <Edit className="h-4 w-4" /> */}
{/*                                   Add */}
{/*                                 </Button> */}
{/*                               )} */}
                              {hasUpdatePermission("outward") && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenStatusModal(batch)}
                                  className="flex items-center gap-1"
                                >
                                  <ArrowUpDown className="h-4 w-4" />
                                  Status
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <ListOrdered className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No loading batches found</h3>
                  <p className="text-gray-500 mb-4">
                    Get started by assigning outward entries to a loading batch.
                  </p>
                  {hasCreatePermission("outward") && (
                    <Button onClick={() => handleOpenAssignModal()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Assign to Batch
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Batch Details Modal */}
      {isDetailModalOpen && selectedBatch && (
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ListOrdered className="h-5 w-5" />
                Loading Batch #{selectedBatch.id} - Details
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Batch ID</Label>
                    <p className="text-lg font-semibold">#{selectedBatch.id}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Vehicle</Label>
                    <p className="text-lg">{selectedBatch.vehicle}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Supervisor</Label>
                    <p className="text-lg">{selectedBatch.supervisor_name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Batch Status</Label>
                    <p>
                    <Badge variant={getStatusBadgeVariant(selectedBatch.status)}>
                      {getStatusDisplay(selectedBatch.status)}
                    </Badge></p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-600">Total Outward Entries</Label>
                    <p className="text-lg font-semibold">{selectedBatch.total_outwards || 0}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Created At</Label>
                    <p className="text-lg">{new Date(selectedBatch.created_at).toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                {(selectedBatch.status === 'pending' || selectedBatch.status === 'loaded') && (
                  <Button
                    onClick={() => handleGenerateGatePass(selectedBatch.id)}
                    disabled={generateGatePassMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    {generateGatePassMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        Generate Gate Pass
                      </>
                    )}
                  </Button>
                )}
                {(selectedBatch.status === 'gate_pass_generated' || selectedBatch.status === 'dispatched') && (
                  <Button
                    onClick={() => handleDownloadGatePass(selectedBatch.id)}
                    disabled={fetchGatePassMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    {fetchGatePassMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        View Gate Pass
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Sequences */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Loading Sequence ({selectedBatch.sequences?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedBatch.sequences && selectedBatch.sequences.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Sequence</TableHead>
                            <TableHead>Bill No</TableHead>
                            <TableHead>Party Name</TableHead>
                            <TableHead>Address</TableHead>

                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedBatch.sequences
                            .sort((a, b) => a.sequence_number - b.sequence_number)
                            .map((sequence) => (
                            <TableRow key={sequence.id}>
                              <TableCell className="font-medium">
                                <Badge variant="outline">#{sequence.sequence_number}</Badge>
                              </TableCell>
                              <TableCell>{sequence.outward_bill_no}</TableCell>
                              <TableCell>{sequence.customer_name || 'N/A'}</TableCell>
                              <TableCell className="max-w-xs truncate">
                                {sequence.customer_address || 'N/A'}
                              </TableCell>

                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">No sequences found</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Assign to Batch Modal */}
      {isAssignModalOpen && (
        <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                {assignForm.batch_id ? 'Add to Existing Batch' : 'Create New Loading Batch'}
              </DialogTitle>
              <DialogDescription>
                Assign outward entries to a loading batch with sequence numbers
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="vehicle">Vehicle Number *</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={vehicleInputMode === "dropdown" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setVehicleInputMode("dropdown")}
                        className="h-7 text-xs"
                      >
                        Select Vehicle Number
                      </Button>
                      <Button
                        type="button"
                        variant={vehicleInputMode === "manual" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setVehicleInputMode("manual")}
                        className="h-7 text-xs"
                      >
                        Type Vehicle Number
                      </Button>
                    </div>
                  </div>
                  {vehicleInputMode === "dropdown" ? (
                    <Popover open={vehicleComboboxOpen} onOpenChange={setVehicleComboboxOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={vehicleComboboxOpen}
                          className="w-full justify-between font-normal"
                        >
                          <span className={assignForm.vehicle ? "" : "text-muted-foreground"}>
                            {assignForm.vehicle || "Select vehicle number"}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Search or type vehicle number..."
                            value={vehicleSearchTerm}
                            onValueChange={(value) => {
                              setVehicleSearchTerm(value);
                              // Update form value as user types
                              setAssignForm(prev => ({ ...prev, vehicle: value }));
                            }}
                          />
                          <CommandList>
                            {filteredVehicleNumbers.length === 0 && !vehicleSearchTerm ? (
                              <CommandEmpty>No vehicle numbers found in outward entries</CommandEmpty>
                            ) : filteredVehicleNumbers.length === 0 && vehicleSearchTerm ? (
                              <CommandEmpty>
                                <div className="py-2">
                                  <p className="text-sm text-gray-500 mb-2">No matching vehicle found</p>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => {
                                      setAssignForm(prev => ({ ...prev, vehicle: vehicleSearchTerm }));
                                      setVehicleComboboxOpen(false);
                                      setVehicleSearchTerm("");
                                    }}
                                  >
                                    Use "{vehicleSearchTerm}"
                                  </Button>
                                </div>
                              </CommandEmpty>
                            ) : (
                              <CommandGroup>
                                {filteredVehicleNumbers.map((vehicle) => (
                                  <CommandItem
                                    key={vehicle}
                                    value={vehicle}
                                    onSelect={() => {
                                      setAssignForm(prev => ({ ...prev, vehicle }));
                                      setVehicleComboboxOpen(false);
                                      setVehicleSearchTerm("");
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        assignForm.vehicle === vehicle ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {vehicle}
                                  </CommandItem>
                                ))}
                                {vehicleSearchTerm && !filteredVehicleNumbers.includes(vehicleSearchTerm) && (
                                  <CommandItem
                                    value={vehicleSearchTerm}
                                    onSelect={() => {
                                      setAssignForm(prev => ({ ...prev, vehicle: vehicleSearchTerm }));
                                      setVehicleComboboxOpen(false);
                                      setVehicleSearchTerm("");
                                    }}
                                    className="text-blue-600"
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Use "{vehicleSearchTerm}"
                                  </CommandItem>
                                )}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Input
                      id="vehicle"
                      placeholder="Type vehicle number manually"
                      value={assignForm.vehicle}
                      onChange={(e) => {
                        setAssignForm(prev => ({ ...prev, vehicle: e.target.value }));
                        setVehicleSearchTerm(e.target.value);
                      }}
                      required
                    />
                  )}
                </div>
                <div>
                  <Label htmlFor="supervisor">Supervisor *</Label>
                  <Select 
                    value={assignForm.supervisor_id && assignForm.supervisor_id !== "" ? assignForm.supervisor_id.toString() : undefined} 
                    onValueChange={(value) => {
                      if (value && value !== "no-supervisors" && value !== "") {
                        setAssignForm(prev => ({ ...prev, supervisor_id: value }));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supervisor" />
                    </SelectTrigger>
                    <SelectContent>
                      {supervisors.length > 0 ? (
                        supervisors.map((supervisor) => {
                          const supervisorValue = supervisor.user_id ? supervisor.user_id.toString() : "";
                          return (
                            <SelectItem key={supervisor.user_id} value={supervisorValue}>
                              {supervisor.name} {supervisor.role_name ? `- ${supervisor.role_name}` : ''}
                            </SelectItem>
                          );
                        })
                      ) : (
                        <SelectItem value="no-supervisors" disabled>No supervisors available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {assignForm.supervisor_id && (
                    <p className="text-xs text-gray-500 mt-1">Selected: {assignForm.supervisor_id}</p>
                  )}
                </div>
              </div>

              {/* Selected Outwards */}
              {selectedOutwards.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Selected Outward Entries ({selectedOutwards.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedOutwards
                        .sort((a, b) => a.sequence_number - b.sequence_number)
                        .map((outward) => (
                        <div key={outward.id} className="flex items-center gap-2 p-2 border rounded-lg bg-gray-50">
                          <div className="w-16 flex-shrink-0">
                            <Label className="text-xs text-gray-600">Seq</Label>
                            <Input
                              type="number"
                              min="1"
                              value={outward.sequence_number}
                              onChange={(e) => handleUpdateSequence(outward.id, e.target.value)}
                              className="w-full h-8 text-sm"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{outward.bill_no || `#${outward.id}`}</p>
                            <p className="text-xs text-gray-600 truncate">{outward.customer_name || 'N/A'}</p>
                            <p className="text-xs text-gray-500">{outward.date}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveOutward(outward.id)}
                            className="flex-shrink-0 h-8 w-8 p-0"
                          >
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Available Outwards */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Available Outward Entries</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-3">
                    <Input
                      placeholder="Search by bill number or customer name"
                      value={outwardSearchTerm}
                      onChange={(e) => setOutwardSearchTerm(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <ScrollArea className="h-64">
                    {filteredAvailableOutwards.length > 0 ? (
                      <div className="space-y-1.5">
                        {filteredAvailableOutwards.map((outward) => {
                          const isSelected = selectedOutwards.find(o => o.id === outward.id);
                          return (
                            <div
                              key={outward.id}
                              className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors ${
                                isSelected 
                                  ? 'bg-green-50 border-green-300' 
                                  : 'bg-white hover:bg-gray-50'
                              }`}
                              onClick={() => !isSelected && handleAddOutward(outward)}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{outward.bill_no || `#${outward.id}`}</p>
                                <p className="text-xs text-gray-600 truncate">{outward.customer_name || 'N/A'} - {outward.vehicle_no || 'N/A'}</p>
                                <p className="text-xs text-gray-500">{outward.date}</p>
                              </div>
                              {isSelected ? (
                                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                              ) : (
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0">
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">No available outward entries found</p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setIsAssignModalOpen(false);
                  resetAssignForm();
                }}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAssign}
                  disabled={assignMutation.isPending || selectedOutwards.length === 0}
                >
                  {assignMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Assign to Batch
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Update Status Modal */}
      {isStatusModalOpen && selectedStatusBatch && (
        <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowUpDown className="h-5 w-5" />
                Update Batch Status
              </DialogTitle>
              <DialogDescription>
                Update the status for Batch #{selectedStatusBatch.id}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-600 mb-2 block">Current Status</Label>
                <Badge variant={getStatusBadgeVariant(selectedStatusBatch.status)} className="text-sm">
                  {getStatusDisplay(selectedStatusBatch.status)}
                </Badge>
              </div>

              <div>
                <Label htmlFor="status" className="text-sm font-medium text-gray-700 mb-2 block">
                  Select New Status
                </Label>
                <Select
                  defaultValue={selectedStatusBatch.status}
                  onValueChange={(value) => {
                    handleUpdateStatus(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="loaded">Loaded</SelectItem>
                    <SelectItem value="gate_pass_generated">Gate Pass Generated</SelectItem>
                    <SelectItem value="dispatched">Dispatched</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsStatusModalOpen(false);
                    setSelectedStatusBatch(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Gate Pass Modal */}
      {isGatePassModalOpen && gatePassData && (
        <Dialog open={isGatePassModalOpen} onOpenChange={setIsGatePassModalOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Gate Pass - Batch #{gatePassData.batch_id}
              </DialogTitle>
              <DialogDescription>
                Gate pass generated on {new Date(gatePassData.created_at).toLocaleString()}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Batch Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Batch Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Batch ID</Label>
                    <p className="text-lg font-semibold">#{gatePassData.batch_id}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Vehicle</Label>
                    <p className="text-lg">{gatePassData.vehicle}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Supervisor</Label>
                    <p className="text-lg">{gatePassData.supervisor_name || 'N/A'}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Outward Entries */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Outward Entries ({gatePassData.outward_entries?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {gatePassData.outward_entries && gatePassData.outward_entries.length > 0 ? (
                      gatePassData.outward_entries.map((entry, index) => (
                        <div key={entry.outward_id} className="border rounded-lg p-4 bg-gray-50">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Bill No</Label>
                              <p className="font-semibold">{entry.bill_no}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Date</Label>
                              <p>{new Date(entry.date).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Party Name</Label>
                              <p>{entry.party_name || 'N/A'}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Address</Label>
                              <p className="text-sm">{entry.address || 'N/A'}</p>
                            </div>
                          </div>
                          
                          {/* Items */}
                          {entry.items && entry.items.length > 0 && (
                            <div>
                              <Label className="text-sm font-medium text-gray-600 mb-2 block">Items</Label>
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Item Name</TableHead>
                                      <TableHead>Bags</TableHead>
                                      <TableHead>Weight</TableHead>
                                      <TableHead>Batch Number</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {entry.items.map((item, itemIndex) => (
                                      <TableRow key={itemIndex}>
                                        <TableCell>{item.item_name}</TableCell>
                                        <TableCell>{item.number_of_bags || 'N/A'}</TableCell>
                                        <TableCell>{item.total_weight ? `${item.total_weight} kg` : 'N/A'}</TableCell>
                                        <TableCell>
                                          {item.batches && item.batches.length > 0 ? (
                                            <div className="flex flex-col gap-1">
                                              {item.batches.map((batch, batchIdx) => (
                                                <Badge key={batch.id || batchIdx} variant="outline" className="text-xs w-fit">
                                                  {batch.name}
                                                </Badge>
                                              ))}
                                            </div>
                                          ) : (
                                            item.batch?.name || item.batch_name || item.batch_number || 'N/A'
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-4">No outward entries found</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsGatePassModalOpen(false);
                  setGatePassData(null);
                }}
              >
                Close
              </Button>
              <Button 
                onClick={generateGatePassPDF}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

