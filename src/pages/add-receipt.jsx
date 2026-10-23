import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useIsMobile } from "../hooks/use-mobile";
import { useDebounce } from "../hooks/use-debounce";
import Sidebar from "../components/layout/sidebar";
import MobileSidebar from "../components/layout/mobile-sidebar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../components/ui/command";
import { ScrollArea } from "../components/ui/scroll-area";
import { Badge } from "../components/ui/badge";
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
  User,
  Image,
  X,
  Plus,
  Check,
  ChevronDown
} from "lucide-react";
import { AuthService } from "../lib/auth";
import { apiRequest } from "../lib/queryClient";
import Loader from "../components/common/loader";
import { useToast } from "../hooks/use-toast";
import {
  formatMoneyForApi,
  formatMoneyDisplay,
  isValidMoneyAmount,
  normalizeMoneyFromApi,
  roundMoney,
  sanitizeMoneyInput,
} from "../utils/moneyUtils";

const normalizeBillNumberKey = (value) => String(value || "").trim().toLowerCase();

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

export default function AddReceipt() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
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

  const [signatureImage, setSignatureImage] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [customerImage, setCustomerImage] = useState(null);
  const [customerImagePreview, setCustomerImagePreview] = useState(null);
  
  // Customer search and pagination state
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [customerPage, setCustomerPage] = useState(1);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOutstanding, setIsLoadingOutstanding] = useState(false);
  const [outstandingBillLimits, setOutstandingBillLimits] = useState({});
  const billsManuallyEditedRef = useRef(false);

  // Payment type options
  const paymentTypes = [
    { value: 'CASH', label: 'Cash', icon: Banknote },
    { value: 'UPI', label: 'UPI', icon: Smartphone },
    { value: 'CHEQUE', label: 'Cheque', icon: FileText },
    { value: 'IMPS', label: 'IMPS Transfer', icon: CreditCard },
    { value: 'NEFT', label: 'NEFT Transfer', icon: CreditCard }
  ];

  // Debounce customer search term
  const debouncedCustomerSearch = useDebounce(customerSearchTerm, 500);

  // Reset customer page when search changes
  useEffect(() => {
    setCustomerPage(1);
  }, [debouncedCustomerSearch]);

  // Reset manual-edit flag and bill limits when customer changes
  useEffect(() => {
    billsManuallyEditedRef.current = false;
    setOutstandingBillLimits({});
  }, [formData.customer_id]);

  const getBillAmountLimit = (billNumber) => {
    const key = normalizeBillNumberKey(billNumber);
    if (!key) return null;
    const limit = outstandingBillLimits[key];
    return limit != null ? limit : null;
  };

  const getBillAmountError = (bill) => {
    const limit = getBillAmountLimit(bill.bill_number);
    const entered = roundMoney(bill.amount);
    if (limit == null || entered == null || bill.amount === "") return "";
    if (entered > limit) {
      return `Amount cannot exceed bill total of ${formatMoneyDisplay(limit)}`;
    }
    return "";
  };

  // When customer is selected, fetch outstanding bills and auto-fill bill number and amount
  useEffect(() => {
    const ledgerId = formData.customer_id?.trim();
    if (!ledgerId) return;

    let cancelled = false;
    setIsLoadingOutstanding(true);

    const params = new URLSearchParams();
    params.set('ledger_id', ledgerId);
    params.set('per_page', '100');

    apiRequest('GET', `${API_BASE_URL}/api/accounts/get-ledgers-outstanding/?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || billsManuallyEditedRef.current) return;
        const customers = data?.data?.customers;
        if (Array.isArray(customers) && customers.length > 0 && customers[0].bills?.length > 0) {
          const limits = {};
          const bills = customers[0].bills.map((b) => {
            const billNumber = b.bill_number ?? "";
            const totalAmount = roundMoney(b.total_amount ?? b.amount);
            const key = normalizeBillNumberKey(billNumber);
            if (key && totalAmount != null) {
              limits[key] = totalAmount;
            }
            return {
              bill_number: billNumber,
              amount: normalizeMoneyFromApi(b.amount),
            };
          });
          setOutstandingBillLimits(limits);
          setFormData((prev) => ({ ...prev, bills }));
        } else {
          setOutstandingBillLimits({});
        }
      })
      .catch(() => {
        if (!cancelled) {
          // No change on error or empty – keep current behavior
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingOutstanding(false);
      });

    return () => { cancelled = true; };
  }, [formData.customer_id]);

  // Fetch customers using get-ledgers API with search and pagination
  const fetchCustomers = async () => {
    const params = new URLSearchParams();
    params.append('page', customerPage.toString());
    params.append('per_page', '50');
    // Add search parameter if debounced search term exists
    if (debouncedCustomerSearch && debouncedCustomerSearch.trim()) {
      params.append('search', debouncedCustomerSearch.trim());
    }

    const response = await apiRequest('GET', `${API_BASE_URL}/api/report/get-ledgers/?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch customers');
    }

    const data = await response.json();
    return data;
  };

  const {
    data: customersData,
    isLoading: isLoadingCustomers,
  } = useQuery({
    queryKey: ['customers-ledgers', debouncedCustomerSearch, customerPage],
    queryFn: fetchCustomers,
    enabled: !!AuthService.getAccessToken() && customerDropdownOpen,
    refetchOnWindowFocus: false,
  });

  const customers = customersData?.data || [];
  const customerPagination = customersData?.pagination || {};


  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSignatureImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File Type",
          description: "Please select an image file.",
          variant: "destructive"
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 5MB.",
          variant: "destructive"
        });
        return;
      }

      setSignatureImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setSignaturePreview(e.target.result);
      };
      reader.readAsDataURL(file);

      // Convert to base64
      const base64Reader = new FileReader();
      base64Reader.onload = (e) => {
        const base64String = e.target.result.split(',')[1]; // Remove data:image/...;base64, prefix
        setFormData(prev => ({
          ...prev,
          signature: base64String
        }));
      };
      base64Reader.readAsDataURL(file);
    }
  };

  const removeSignatureImage = () => {
    setSignatureImage(null);
    setSignaturePreview(null);
    setFormData(prev => ({
      ...prev,
      signature: ""
    }));
  };

  const handleCustomerImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File Type",
          description: "Please select an image file.",
          variant: "destructive"
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 5MB.",
          variant: "destructive"
        });
        return;
      }

      setCustomerImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setCustomerImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);

      // Convert to base64
      const base64Reader = new FileReader();
      base64Reader.onload = (e) => {
        const base64String = e.target.result.split(',')[1]; // Remove data:image/...;base64, prefix
        setFormData(prev => ({
          ...prev,
          customer_image: base64String
        }));
      };
      base64Reader.readAsDataURL(file);
    }
  };

  const removeCustomerImage = () => {
    setCustomerImage(null);
    setCustomerImagePreview(null);
    setFormData(prev => ({
      ...prev,
      customer_image: ""
    }));
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
    billsManuallyEditedRef.current = true;
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
    if (!formData.customer_id) {
      toast({
        title: "Validation Error",
        description: "Please select a customer.",
        variant: "destructive"
      });
      return false;
    }

    if (!formData.payment_type) {
      toast({
        title: "Validation Error",
        description: "Please select a payment type.",
        variant: "destructive"
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
      const amountError = getBillAmountError(bill);
      if (amountError) {
        toast({
          title: "Validation Error",
          description: `Bill ${i + 1}: ${amountError}`,
          variant: "destructive"
        });
        return false;
      }
    }

    return true;
  };

  const createReceiptMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/accounts/create-receipt/`, data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.status === 200) {
        toast({
          title: "Success",
          description: "Receipt created successfully!",
          variant: "success",
        });
        queryClient.invalidateQueries(['receipts']);
        setLocation('/receipt-list');
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to create receipt.",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      console.error('Create receipt error:', error);
      toast({
        title: "Error",
        description: "Failed to create receipt. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    
    try {
      const submitData = {
        customer_id: parseInt(formData.customer_id),
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

      // Only include images if they are provided
      if (formData.signature && formData.signature.trim()) {
        submitData.signature = formData.signature;
      }
      if (formData.customer_image && formData.customer_image.trim()) {
        submitData.customer_image = formData.customer_image;
      }

      await createReceiptMutation.mutateAsync(submitData);
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };


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
              onClick={() => setLocation('/receipt-list')}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Add Receipt</h1>
              <p className="text-gray-600">Create a New Receipt Record</p>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="customer_id">Customer *</Label>
                      <Popover 
                        open={customerDropdownOpen} 
                        onOpenChange={(open) => {
                          setCustomerDropdownOpen(open);
                          if (!open) {
                            // Reset search and page when dropdown closes
                            setCustomerSearchTerm("");
                            setCustomerPage(1);
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                            disabled={isLoadingCustomers}
                          >
                            {formData.customer_id
                              ? customers.find((c) => c.id.toString() === formData.customer_id)?.name || "Select customer"
                              : "Select customer"}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[--radix-popover-trigger-width] p-0 z-50"
                          align="start"
                          side="bottom"
                          sideOffset={4}
                        >
                          <Command>
                            <CommandInput 
                              placeholder="Search customers..." 
                              value={customerSearchTerm}
                              onValueChange={(value) => {
                                setCustomerSearchTerm(value);
                              }}
                            />
                            <CommandList>
                              <CommandEmpty>
                                {isLoadingCustomers ? (
                                  <div className="flex items-center justify-center py-6">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Loading Customers...
                                  </div>
                                ) : (
                                  "No customers found."
                                )}
                              </CommandEmpty>
                              <CommandGroup>
                                <ScrollArea className="h-64">
                                  {customers && customers.length > 0 ? (
                                    <>
                                      {customers.map((customer) => (
                                        <CommandItem
                                          key={customer.id}
                                          value={customer.name}
                                          onSelect={() => {
                                            handleInputChange('customer_id', customer.id.toString());
                                            setCustomerDropdownOpen(false);
                                          }}
                                          className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                        >
                                          <div className="flex items-center gap-3">
                                            <Check
                                              className={`h-4 w-4 ${
                                                formData.customer_id === customer.id.toString() ? "opacity-100 text-blue-600" : "opacity-0"
                                              }`}
                                            />
                                            <div>
                                              <div className="font-medium text-gray-900">{customer.name}</div>
                                              {customer.parent && (
                                                <div className="text-sm text-gray-500">{customer.parent}</div>
                                              )}
                                            </div>
                                          </div>
                                          {customer.state && (
                                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                              {customer.state}
                                            </Badge>
                                          )}
                                        </CommandItem>
                                      ))}
                                      {/* Pagination Controls */}
                                      {customerPagination && customerPagination.total_pages > 1 && (
                                        <div className="flex items-center justify-between p-2 border-t">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCustomerPage(prev => Math.max(1, prev - 1))}
                                            disabled={!customerPagination.has_previous || isLoadingCustomers}
                                          >
                                            Previous
                                          </Button>
                                          <span className="text-sm text-gray-600">
                                            Page {customerPagination.current_page || customerPage} of {customerPagination.total_pages}
                                          </span>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCustomerPage(prev => prev + 1)}
                                            disabled={!customerPagination.has_next || isLoadingCustomers}
                                          >
                                            Next
                                          </Button>
                                        </div>
                                      )}
                                    </>
                                  ) : null}
                                </ScrollArea>
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

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

                  {/* Payment Details Section */}
                  {formData.payment_type && (
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <Label className="text-sm font-semibold mb-3 block">Payment Details</Label>
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
                      </div>
                    </div>
                  )}

                  {/* Bills Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Bills *</Label>
                      <div className="flex items-center gap-2">
                        {isLoadingOutstanding && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Loading outstanding bills...
                          </span>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addBill}
                          className="flex items-center space-x-1"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Add Bill</span>
                        </Button>
                      </div>
                    </div>
                    {formData.bills.map((bill, index) => {
                      const billLimit = getBillAmountLimit(bill.bill_number);
                      const amountError = getBillAmountError(bill);
                      return (
                      <div key={index} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="text-sm font-medium">Bill {index + 1}</Label>
                          {formData.bills.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeBill(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor={`bill_number_${index}`}>Bill Number *</Label>
                            <Input
                              id={`bill_number_${index}`}
                              value={bill.bill_number}
                              onChange={(e) => handleBillChange(index, 'bill_number', e.target.value)}
                              placeholder="Enter bill number"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor={`amount_${index}`}>Amount *</Label>
                            <Input
                              id={`amount_${index}`}
                              type="text"
                              inputMode="decimal"
                              value={bill.amount}
                              onChange={(e) => handleBillChange(index, 'amount', e.target.value)}
                              placeholder="0.00"
                              required
                              className={amountError ? "border-red-500 focus-visible:ring-red-500" : ""}
                              aria-invalid={!!amountError}
                            />
                            {billLimit != null ? (
                              <p className="text-xs text-muted-foreground mt-1">
                                Bill total: {formatMoneyDisplay(billLimit)}
                              </p>
                            ) : null}
                            {amountError ? (
                              <p className="text-xs text-red-600 mt-1">{amountError}</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                    })}
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
                        placeholder="Enter store incharge name"
                        maxLength={30}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (/^[A-Za-z\s]*$/.test(value)) {
                            handleInputChange('store_incharge', value);
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="remarks">Remarks</Label>
                    <Textarea
                      id="remarks"
                      value={formData.remarks}
                      onChange={(e) => handleInputChange('remarks', e.target.value)}
                      placeholder="Enter any additional remarks..."
                      rows={3}
                    />
                  </div>

                  {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="signature">Signature Image</Label>
                      <div className="space-y-4">
                        <div className="flex items-center space-x-4">
                          <Input
                            id="signature"
                            type="file"
                            accept="image/*"
                            onChange={handleSignatureImageChange}
                            className="
                            file:rounded-full file:border-0
                             file:text-sm file:font-semibold
                              file:bg-black file:text-white 
                              hover:file:bg-gray-800"
                          />
                          {signatureImage && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={removeSignatureImage}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {signaturePreview && (
                          <div className="mt-4">
                            <Label className="text-sm font-medium text-gray-500">Preview:</Label>
                            <div className="mt-2 border rounded-lg p-4 bg-gray-50">
                              <img
                                src={signaturePreview}
                                alt="Signature Preview"
                                className="max-w-full max-h-32 object-contain"
                              />
                            </div>
                          </div>
                        )}
                        <p className="text-sm text-gray-500">
                          Upload a signature image (JPG, PNG, GIF). Maximum size: 5MB.
                        </p>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="customer_image">Customer Image</Label>
                      <div className="space-y-4">
                        <div className="flex items-center space-x-4">
                          <Input
                            id="customer_image"
                            type="file"
                            accept="image/*"
                            onChange={handleCustomerImageChange}
                            className="
                            file:rounded-full file:border-0
                             file:text-sm file:font-semibold
                              file:bg-black file:text-white 
                              hover:file:bg-gray-800"
                          />
                          {customerImage && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={removeCustomerImage}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {customerImagePreview && (
                          <div className="mt-4">
                            <Label className="text-sm font-medium text-gray-500">Preview:</Label>
                            <div className="mt-2 border rounded-lg p-4 bg-gray-50">
                              <img
                                src={customerImagePreview}
                                alt="Customer Image Preview"
                                className="max-w-full max-h-32 object-contain"
                              />
                            </div>
                          </div>
                        )}
                        <p className="text-sm text-gray-500">
                          Upload a customer image (JPG, PNG, GIF). Maximum size: 5MB.
                        </p>
                      </div>
                    </div>
                  </div> */}
                </CardContent>
              </Card>


              {/* Submit Button */}
              <div className="flex items-center justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation('/receipt-list')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-black hover:bg-gray-800"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Create Receipt
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
