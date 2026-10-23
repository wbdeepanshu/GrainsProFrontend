import { useState, useEffect } from "react";
import { format, startOfDay } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useIsMobile } from "../hooks/use-mobile";
import Sidebar from "../components/layout/sidebar";
import MobileSidebar from "../components/layout/mobile-sidebar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Calendar as CalendarComponent } from "../components/ui/calendar";
import { cn } from "../lib/utils";
import {
  Menu,
  ArrowLeft,
  Receipt,
  Upload,
  X,
  Image as ImageIcon,
  Loader2,
  Plus,
  Save,
  Camera,
  IndianRupee,
  CalendarIcon,
} from "lucide-react";
import { AuthService } from "../lib/auth";
import { isAdminSettingEnabled } from "../lib/adminSettings";
import { apiRequest } from "../lib/queryClient";
import Loader from "../components/common/loader";
import { useToast } from "../hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const formatDateForDisplay = (date) => (date ? format(new Date(date), "dd-MM-yyyy") : "");
const fieldTriggerClass =
  "h-10 w-full border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

export default function AddExpense() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    expense_type: "",
    sub_type: "",
    expense_date: new Date().toISOString().split('T')[0],
    amount: "",
    remarks: "",
    attachments: []
  });

  const [expenseTypes, setExpenseTypes] = useState([]);
  const [subTypes, setSubTypes] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenseDate, setExpenseDate] = useState(() => startOfDay(new Date()));
  const [isExpenseDatePickerOpen, setIsExpenseDatePickerOpen] = useState(false);
  const allowMultiplePhotos = isAdminSettingEnabled("multiple_photo");
  const isSinglePhotoLimitReached =
    !allowMultiplePhotos && formData.attachments.length >= 1;

  // Fetch expense types
  const { data: expenseTypesData, isLoading: isLoadingTypes } = useQuery({
    queryKey: ['expense-types'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/accounts/expense-types/`);
      const data = await response.json();
      return data;
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (expenseTypesData?.data) {
      setExpenseTypes(expenseTypesData.data);
    }
  }, [expenseTypesData]);

  // Update sub types when expense type changes
  useEffect(() => {
    if (formData.expense_type && expenseTypes.length > 0) {
      const selectedType = expenseTypes.find(type => type.type === formData.expense_type);
      if (selectedType) {
        setSubTypes(selectedType.sub_types || []);
        // Reset sub_type if it's not valid for the new type
        if (formData.sub_type && !selectedType.sub_types.includes(formData.sub_type)) {
          setFormData(prev => ({ ...prev, sub_type: "" }));
        }
      }
    } else {
      setSubTypes([]);
    }
  }, [formData.expense_type, expenseTypes]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const processImageFile = (file) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select only image files.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target.result;
      const newAttachment = {
        file: base64Data,
        name: file.name,
        size: file.size,
      };

      setFormData((prev) => ({
        ...prev,
        attachments: allowMultiplePhotos
          ? [...prev.attachments, newAttachment]
          : [newAttachment],
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const filesToProcess = allowMultiplePhotos ? files : files.slice(0, 1);

    if (!allowMultiplePhotos && files.length > 1) {
      toast({
        title: "Single image only",
        description: "You can upload only one image at a time.",
        variant: "destructive",
      });
    }

    filesToProcess.forEach(processImageFile);
    event.target.value = "";
  };

  const handleCameraCapture = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    if (allowMultiplePhotos) {
      input.multiple = true;
    }
    input.onchange = handleFileUpload;
    input.click();
  };

  const removeAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const validateForm = () => {
    if (!formData.expense_type) {
      toast({
        title: "Validation Error",
        description: "Please select an expense type.",
        variant: "destructive"
      });
      return false;
    }

    if (!formData.expense_date) {
      toast({
        title: "Validation Error",
        description: "Please select an expense date.",
        variant: "destructive"
      });
      return false;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid amount.",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const createExpenseMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/accounts/expense/`, data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.status === 200) {
        toast({
          title: "Success",
          description: "Expense created successfully!",
        });
        queryClient.invalidateQueries(['expenses']);
        setLocation('/reports/expense-list');
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to create expense.",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      console.error('Create expense error:', error);
      toast({
        title: "Error",
        description: "Failed to create expense. Please try again.",
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
        expense_type: formData.expense_type,
        sub_type: formData.sub_type || "",
        expense_date: formData.expense_date,
        amount: parseFloat(formData.amount),
        remarks: formData.remarks || "",
        attachments: formData.attachments.map(att => ({ file: att.file }))
      };

      await createExpenseMutation.mutateAsync(submitData);
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingTypes) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/reports/expense-list')}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Add Expense</h1>
              <p className="text-gray-600">Create a new expense record</p>
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
                    <span>Expense Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="expense_type">Expense Type *</Label>
                      <Select value={formData.expense_type} onValueChange={(value) => handleInputChange('expense_type', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select expense type" />
                        </SelectTrigger>
                        <SelectContent>
                          {expenseTypes.map((type) => (
                            <SelectItem key={type.type} value={type.type}>
                              {type.type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="sub_type">Sub Type</Label>
                      <Select value={formData.sub_type} onValueChange={(value) => handleInputChange('sub_type', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sub type" />
                        </SelectTrigger>
                        <SelectContent>
                          {subTypes.map((subType) => (
                            <SelectItem key={subType} value={subType}>
                              {subType}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="expense_date">Expense Date *</Label>
                      <Popover open={isExpenseDatePickerOpen} onOpenChange={setIsExpenseDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            id="expense_date"
                            type="button"
                            variant="outline"
                            className={cn(fieldTriggerClass, "justify-start text-left font-normal")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                            <span className="truncate">
                              {expenseDate ? formatDateForDisplay(expenseDate) : "Select expense date"}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            key={`expense-date-${expenseDate?.getTime() || "null"}`}
                            mode="single"
                            selected={expenseDate}
                            onSelect={(date) => {
                              if (!date) return;
                              const normalized = startOfDay(date);
                              setExpenseDate(normalized);
                              handleInputChange("expense_date", format(normalized, "yyyy-MM-dd"));
                              setIsExpenseDatePickerOpen(false);
                            }}
                            disabled={{ after: new Date() }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div>
                      <Label htmlFor="amount">Amount *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.amount}
                        onChange={(e) => handleInputChange('amount', e.target.value)}
                        placeholder="0.00"
                        required
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
                </CardContent>
              </Card>

              {/* Attachments */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <ImageIcon className="h-5 w-5" />
                    <span>Attachments</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSinglePhotoLimitReached}
                      onClick={() => document.getElementById('file-upload').click()}
                      className="flex items-center space-x-2"
                    >
                      <Upload className="h-4 w-4" />
                      <span>Upload Images</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSinglePhotoLimitReached}
                      onClick={handleCameraCapture}
                      className="flex items-center space-x-2"
                    >
                      <Camera className="h-4 w-4" />
                      <span>Take Photo</span>
                    </Button>
                  </div>

                  <input
                    id="file-upload"
                    type="file"
                    multiple={allowMultiplePhotos}
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {formData.attachments.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {formData.attachments.map((attachment, index) => (
                        <div key={index} className="relative border rounded-lg p-2">
                          <img
                            src={attachment.file}
                            alt={`Attachment ${index + 1}`}
                            className="w-full h-32 object-cover rounded"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1 h-6 w-6 p-0"
                            onClick={() => removeAttachment(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            {attachment.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-sm text-gray-500">
                    Upload receipts, bills, or other supporting documents.
                    {allowMultiplePhotos
                      ? " You can add multiple images."
                      : " Only one image is allowed."}{" "}
                    Maximum file size: 10MB per image.
                  </p>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex items-center justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation('/reports/expense-list')}
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
                      Create Expense
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
