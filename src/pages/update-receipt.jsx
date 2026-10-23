import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { useIsMobile } from "../hooks/use-mobile";
import Sidebar from "../components/layout/sidebar";
import MobileSidebar from "../components/layout/mobile-sidebar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../components/ui/command";
import { Textarea } from "../components/ui/textarea";
import {
  Menu,
  ArrowLeft,
  Receipt,
  Save,
  Loader2,
  CreditCard,
  Smartphone,
  Banknote,
  FileText,
  IndianRupee,
  ChevronsUpDown,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
import { AuthService } from "../lib/auth";
import { apiRequest } from "../lib/queryClient";
import Loader from "../components/common/loader";
import { useToast } from "../hooks/use-toast";
import { useUserPermissions } from "../hooks/useUserPermissions";
import {
  formatMoneyForApi,
  isValidMoneyAmount,
  normalizeMoneyFromApi,
  sanitizeMoneyInput,
} from "../utils/moneyUtils";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

export default function UpdateReceipt() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const [, params] = useRoute("/update-receipt/:receiptId");
  const receiptId = params?.receiptId;
  const receiptListTarget = `/receipt-list${window.location.search || ""}`;
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get user permissions
  const { 
    hasUpdatePermission,
    isLoading: permissionsLoading 
  } = useUserPermissions();

  // Form state
  const [formData, setFormData] = useState({
    receipt_id: "",
    customer_id: "",
    payment_type: "",
    payment_details: {
      utr: null,
      city: null,
      date: null,
      branch: null,
      upi_id: null,
      bank_name: null,
      cheque_no: null,
      transaction_id: null
    },
    reference_number: "",
    remarks: "",
    signature: "",
    customer_image: "",
    store_incharge: "",
    bills: [{ bill_number: "", amount: "" }] // Array of bills
  });

  const [partyOpen, setPartyOpen] = useState(false);
  const [partySearch, setPartySearch] = useState("");
  const [debouncedPartySearch, setDebouncedPartySearch] = useState("");

  const [signaturePreview, setSignaturePreview] = useState(null);
  const [customerImagePreview, setCustomerImagePreview] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(true);

  // Payment type options
  const paymentTypes = [
    { value: 'CASH', label: 'Cash', icon: Banknote },
    { value: 'UPI', label: 'UPI', icon: Smartphone },
    { value: 'CHEQUE', label: 'Cheque', icon: FileText },
    { value: 'IMPS', label: 'IMPS Transfer', icon: CreditCard },
    { value: 'NEFT', label: 'NEFT Transfer', icon: CreditCard }
  ];

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPartySearch(partySearch), 300);
    return () => clearTimeout(t);
  }, [partySearch]);

  // Fetch receipt details
  const { data: receiptData, isLoading: isLoadingReceiptData } = useQuery({
    queryKey: ['receipt-detail', receiptId],
    queryFn: async () => {
      if (!receiptId) return null;
      const response = await apiRequest('GET', `${API_BASE_URL}/api/accounts/receipts/${receiptId}/`);
      const data = await response.json();
      return data.data || null;
    },
    enabled: !!receiptId && !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  const { data: partiesRaw = [], isLoading: partiesLoading } = useQuery({
    queryKey: ["receipt-update-ledgers", debouncedPartySearch],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", per_page: "250" });
      if (debouncedPartySearch.trim()) {
        params.set("search", debouncedPartySearch.trim());
      }
      const res = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/report/get-ledgers/?${params.toString()}`
      );
      const json = await res.json();
      return Array.isArray(json.data) ? json.data : [];
    },
    enabled: !!AuthService.getAccessToken(),
    staleTime: 60 * 1000,
  });

  const partyOptions = (() => {
    const cid = receiptData?.customer_id;
    const cname = receiptData?.customer_name;
    if (cid != null && !partiesRaw.some((p) => String(p.id) === String(cid))) {
      return [{ id: cid, name: cname || `Party #${cid}` }, ...partiesRaw];
    }
    return partiesRaw;
  })();

  // Update receipt mutation - MUST be called before any conditional returns
  const updateReceiptMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/accounts/create-receipt/`, data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.status === 200) {
        toast({
          title: "Success",
          description: "Receipt updated successfully!",
          variant: "success",
        });
        queryClient.invalidateQueries({ queryKey: ["receipts"] });
        queryClient.invalidateQueries({ queryKey: ["receipt-detail", receiptId] });
        setLocation(receiptListTarget);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to update receipt.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update receipt.",
        variant: "destructive",
      });
    },
  });

  // Update form data when receipt data is loaded
  useEffect(() => {
    if (receiptData) {
      const paymentDetail = receiptData.payment_details?.[0] || {};
      const bills = receiptData.bill_details || [];
      
      setFormData({
        receipt_id: receiptData.receipt_id || "",
        customer_id: receiptData.customer_id?.toString() || receiptData.customer?.id?.toString() || "",
        payment_type: paymentDetail.payment_type || "",
        payment_details: paymentDetail.payment_details || {
          utr: null,
          city: null,
          date: null,
          branch: null,
          upi_id: null,
          bank_name: null,
          cheque_no: null,
          transaction_id: null
        },
        reference_number: receiptData.reference_number || "",
        remarks: receiptData.remarks || "",
        signature: receiptData.signature || "",
        customer_image: receiptData.customer_image || "",
        store_incharge: receiptData.store_incharge || "",
        bills: bills.length > 0 ? bills.map(bill => ({
          bill_number: bill.bill_number || "",
          amount: normalizeMoneyFromApi(bill.amount),
        })) : [{ bill_number: "", amount: "" }]
      });
      
      // Set image previews if URLs exist
      if (receiptData.signature) {
        setSignaturePreview(receiptData.signature);
      }
      if (receiptData.customer_image) {
        setCustomerImagePreview(receiptData.customer_image);
      }
      setIsLoadingReceipt(false);
    }
  }, [receiptData]);

  // Check permissions - AFTER all hooks
  if (permissionsLoading || isLoadingReceiptData) {
    return <Loader />;
  }

  if (!hasUpdatePermission("receipt_management")) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                <Receipt className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
              <p className="text-red-600 mb-4">
                You don't have permission to update receipts. Contact your administrator for access.
              </p>
              <Button onClick={() => setLocation(receiptListTarget)} variant="outline">
                Go Back
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSignatureImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File Type",
          description: "Please select an image file.",
          variant: "destructive"
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 5MB.",
          variant: "destructive"
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setSignaturePreview(e.target.result);
      };
      reader.readAsDataURL(file);

      const base64Reader = new FileReader();
      base64Reader.onload = (e) => {
        const base64String = e.target.result.split(',')[1];
        setFormData(prev => ({
          ...prev,
          signature: base64String
        }));
      };
      base64Reader.readAsDataURL(file);
    }
  };

  const handleCustomerImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File Type",
          description: "Please select an image file.",
          variant: "destructive"
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 5MB.",
          variant: "destructive"
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setCustomerImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);

      const base64Reader = new FileReader();
      base64Reader.onload = (e) => {
        const base64String = e.target.result.split(',')[1];
        setFormData(prev => ({
          ...prev,
          customer_image: base64String
        }));
      };
      base64Reader.readAsDataURL(file);
    }
  };

  const addBill = () => {
    setFormData(prev => ({
      ...prev,
      bills: [...prev.bills, { bill_number: "", amount: "" }]
    }));
  };

  const removeBill = (index) => {
    if (formData.bills.length > 1) {
      setFormData(prev => ({
        ...prev,
        bills: prev.bills.filter((_, i) => i !== index)
      }));
    } else {
      toast({
        title: "Validation Error",
        description: "At least one bill is required.",
        variant: "destructive"
      });
    }
  };

  const handleBillChange = (index, field, value) => {
    const nextValue = field === "amount" ? sanitizeMoneyInput(value) : value;
    setFormData(prev => ({
      ...prev,
      bills: prev.bills.map((bill, i) => 
        i === index ? { ...bill, [field]: nextValue } : bill
      )
    }));
  };

  const handlePaymentDetailsChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      payment_details: {
        ...prev.payment_details,
        [field]: value || null
      }
    }));
  };

  const validateForm = () => {
    if (!formData.payment_type) {
      toast({
        title: "Validation Error",
        description: "Please select a payment type.",
        variant: "destructive"
      });
      return false;
    }

    if (!formData.customer_id || String(formData.customer_id).trim() === "") {
      toast({
        title: "Validation Error",
        description: "Please select a party for this receipt.",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.bills || formData.bills.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one bill is required.",
        variant: "destructive"
      });
      return false;
    }

    // Validate each bill
    for (let i = 0; i < formData.bills.length; i++) {
      const bill = formData.bills[i];
      if (!bill.bill_number || bill.bill_number.trim() === "") {
        toast({
          title: "Validation Error",
          description: `Please enter bill number for bill ${i + 1}.`,
          variant: "destructive"
        });
        return false;
      }
      if (!isValidMoneyAmount(bill.amount)) {
        toast({
          title: "Validation Error",
          description: `Please enter a valid amount for bill ${i + 1}.`,
          variant: "destructive"
        });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    
    try {
      const submitData = {
        receipt_id: formData.receipt_id,
        customer_id: parseInt(formData.customer_id, 10),
        payment_type: formData.payment_type,
        payment_details: formData.payment_details,
        reference_number: formData.reference_number || "",
        remarks: formData.remarks || "",
        store_incharge: formData.store_incharge || "",
        bills: formData.bills.map(bill => ({
          bill_number: bill.bill_number.trim(),
          amount: formatMoneyForApi(bill.amount),
        }))
      };

      // Only include images if they are new uploads (base64 strings)
      // If they're URLs (existing images), don't send them
      if (formData.signature && formData.signature.trim() && !formData.signature.startsWith('http')) {
        submitData.signature = formData.signature;
      }
      if (formData.customer_image && formData.customer_image.trim() && !formData.customer_image.startsWith('http')) {
        submitData.customer_image = formData.customer_image;
      }

      await updateReceiptMutation.mutateAsync(submitData);
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedParty = partyOptions.find(
    (p) => String(p.id) === String(formData.customer_id)
  );
  const selectedPartyLabel = selectedParty
    ? selectedParty.name
    : formData.customer_id && receiptData?.customer_name
      ? receiptData.customer_name
      : formData.customer_id
        ? `Party #${formData.customer_id}`
        : "";

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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation(receiptListTarget)}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Update Receipt</h1>
              <p className="text-gray-600">Update receipt details</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 min-h-0">
          <div className=" mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <IndianRupee className="h-5 w-5" />
                    <span>Receipt Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Party *</Label>
                    <Popover open={partyOpen} onOpenChange={setPartyOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={partyOpen}
                          className="w-full justify-between font-normal"
                          disabled={partiesLoading && partyOptions.length === 0}
                        >
                          <span className="truncate text-left">
                            {selectedPartyLabel || "Select party..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Search party name..."
                            value={partySearch}
                            onValueChange={setPartySearch}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {partiesLoading ? "Loading parties..." : "No party found."}
                            </CommandEmpty>
                            <CommandGroup>
                              {partyOptions.map((p) => {
                                const isSelected = String(p.id) === String(formData.customer_id);
                                return (
                                  <CommandItem
                                    key={p.id}
                                    value={`${p.id} ${p.name}`}
                                    onSelect={() => {
                                      handleInputChange("customer_id", String(p.id));
                                      setPartyOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 shrink-0 ${isSelected ? "opacity-100" : "opacity-0"}`}
                                    />
                                    <span className="truncate">{p.name}</span>
                                    <span className="ml-auto text-xs text-muted-foreground shrink-0">ID {p.id}</span>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-gray-500">
                      Choose a different party to reassign this receipt. Party master records are not edited here.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="payment_type">Payment Type *</Label>
                      <Select value={formData.payment_type} onValueChange={(value) => handleInputChange('payment_type', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment type" />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentTypes.map((type) => {
                            const Icon = type.icon;
                            return (
                              <SelectItem key={type.value} value={type.value}>
                                <div className="flex items-center space-x-2">
                                  <Icon className="h-4 w-4" />
                                  <span>{type.label}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Payment Details Section - Conditional based on payment type */}
                  {formData.payment_type && (
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <Label className="text-sm font-medium mb-3 block">Payment Details</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {formData.payment_type === 'UPI' && (
                          <>
                            <div>
                              <Label htmlFor="upi_id">UPI ID</Label>
                              <Input
                                id="upi_id"
                                value={formData.payment_details.upi_id || ""}
                                onChange={(e) => handlePaymentDetailsChange('upi_id', e.target.value)}
                                placeholder="Enter UPI ID"
                              />
                            </div>
                            <div>
                              <Label htmlFor="transaction_id">Transaction ID</Label>
                              <Input
                                id="transaction_id"
                                value={formData.payment_details.transaction_id || ""}
                                onChange={(e) => handlePaymentDetailsChange('transaction_id', e.target.value)}
                                placeholder="Enter transaction ID"
                              />
                            </div>
                          </>
                        )}
                        {formData.payment_type === 'CHEQUE' && (
                          <>
                            <div>
                              <Label htmlFor="cheque_no">Cheque Number</Label>
                              <Input
                                id="cheque_no"
                                value={formData.payment_details.cheque_no || ""}
                                onChange={(e) => handlePaymentDetailsChange('cheque_no', e.target.value)}
                                placeholder="Enter cheque number"
                              />
                            </div>
                            <div>
                              <Label htmlFor="bank_name">Bank Name</Label>
                              <Input
                                id="bank_name"
                                value={formData.payment_details.bank_name || ""}
                                onChange={(e) => handlePaymentDetailsChange('bank_name', e.target.value)}
                                placeholder="Enter bank name"
                              />
                            </div>
                            <div>
                              <Label htmlFor="cheque_date">Date</Label>
                              <Input
                                id="cheque_date"
                                type="date"
                                value={formData.payment_details.date || ""}
                                onChange={(e) => handlePaymentDetailsChange('date', e.target.value)}
                              />
                            </div>
                          </>
                        )}
                        {(formData.payment_type === 'IMPS' || formData.payment_type === 'NEFT') && (
                          <>
                            <div>
                              <Label htmlFor="utr">UTR Number</Label>
                              <Input
                                id="utr"
                                value={formData.payment_details.utr || ""}
                                onChange={(e) => handlePaymentDetailsChange('utr', e.target.value)}
                                placeholder="Enter UTR number"
                              />
                            </div>
                            <div>
                              <Label htmlFor="bank_name">Bank Name</Label>
                              <Input
                                id="bank_name"
                                value={formData.payment_details.bank_name || ""}
                                onChange={(e) => handlePaymentDetailsChange('bank_name', e.target.value)}
                                placeholder="Enter bank name"
                              />
                            </div>
                            <div>
                              <Label htmlFor="transfer_date">Date</Label>
                              <Input
                                id="transfer_date"
                                type="date"
                                value={formData.payment_details.date || ""}
                                onChange={(e) => handlePaymentDetailsChange('date', e.target.value)}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bills Section */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <Label className="text-sm font-medium">Bills</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addBill}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Bill
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {formData.bills.map((bill, index) => (
                        <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <Input
                              placeholder="Bill Number"
                              value={bill.bill_number}
                              onChange={(e) => handleBillChange(index, 'bill_number', e.target.value)}
                            />
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="Amount"
                              value={bill.amount}
                              onChange={(e) => handleBillChange(index, 'amount', e.target.value)}
                            />
                          </div>
                          {formData.bills.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeBill(index)}
                               className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="reference_number">Reference Number</Label>
                      <Input
                        id="reference_number"
                        value={formData.reference_number}
                        onChange={(e) => handleInputChange('reference_number', e.target.value)}
                        placeholder="Enter reference number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="store_incharge">Store Incharge</Label>
                      <Input
                        id="store_incharge"
                        value={formData.store_incharge}
                        onChange={(e) => handleInputChange('store_incharge', e.target.value)}
                        placeholder="Enter store incharge name"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="remarks">Remarks</Label>
                    <Textarea
                      id="remarks"
                      value={formData.remarks}
                      onChange={(e) => handleInputChange('remarks', e.target.value)}
                      placeholder="Enter remarks"
                      rows={3}
                    />
                  </div>

                  {/* Signature: existing URL is kept on save unless you upload a replacement */}
                  <div>
                    <Label>Signature</Label>
                    {signaturePreview ? (
                      <div className="mt-2">
                        <img src={signaturePreview} alt="Signature on file" className="h-32 w-auto border rounded" />
                        <p className="text-xs text-gray-500 mt-1">
                          Current image is kept when you update. Use the field below only to replace it with a new
                          file.
                        </p>
                      </div>
                    ) : null}
                    <div className="mt-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleSignatureImageChange}
                      />
                    </div>
                  </div>

                  {/* Customer image: same behavior as signature */}
                  <div>
                    <Label>Customer Image</Label>
                    {customerImagePreview ? (
                      <div className="mt-2">
                        <img src={customerImagePreview} alt="Customer on file" className="h-32 w-auto border rounded" />
                        <p className="text-xs text-gray-500 mt-1">
                          Current image is kept when you update. Use the field below only to replace it with a new
                          file.
                        </p>
                      </div>
                    ) : null}
                    <div className="mt-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleCustomerImageChange}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation(receiptListTarget)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || updateReceiptMutation.isPending}
                  className="bg-black hover:bg-gray-800"
                >
                  {isSubmitting || updateReceiptMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Update Receipt
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
