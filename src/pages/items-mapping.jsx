import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import { Separator } from "@/components/ui/separator";

import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { 
  Menu, 
  Link, 
  Users, 
  Package, 
  FileText, 
  Plus, 
  Trash2, 
  Save,
  CheckCircle,
  AlertCircle,
  Info
} from "lucide-react";
import Loader from "@/components/common/loader";

// Dynamic user data will be loaded from API

const mappingTypes = ["SOURCE", "DESTINATION", "BARDAN"];

export default function ItemsMapping() {
  const [selectedUser, setSelectedUser] = useState("");
  const [mappings, setMappings] = useState([
    {
      item_id: "",
      voucher_mappings: [
        {
          voucher_id: "",
          types: []
        }
      ]
    }
  ]);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  // Fetch items from API
  const fetchItems = async () => {
    const token = AuthService.getAccessToken();
    if (!token) {
      throw new Error("No authentication token found");
    }
    const API_BASE_URL = import.meta.env.VITE_BASE_URL;
    const response = await fetch(API_BASE_URL + "/api/get-stock-items/", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        search: "",
        type: "",
        stock_group: "",
        godown: ""
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  };

  // Fetch vouchers from API
  const fetchVouchers = async () => {
    const token = AuthService.getAccessToken();
    if (!token) {
      throw new Error("No authentication token found");
    }
    // const API_BASE_URL = import.meta.env.VITE_BASE_URL;
    const response = await fetch( API_BASE_URL + "/api/get-voucher-types/?is_active=true", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  };

  // Fetch users from API
  const fetchUsers = async () => {
    const token = AuthService.getAccessToken();
    if (!token) {
      throw new Error("No authentication token found");
    }
    //const API_BASE_URL = import.meta.env.VITE_BASE_URL;
    const response = await fetch( API_BASE_URL + "/api/get-users/", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  };

  // React Query for items
  const { data: items = [], isLoading: itemsLoading, error: itemsError } = useQuery({
    queryKey: ['/api/get-stock-items-mapping'],
    queryFn: fetchItems,
    enabled: !!AuthService.getAccessToken(),
  });

  // React Query for vouchers
  const { data: vouchers = [], isLoading: vouchersLoading, error: vouchersError } = useQuery({
    queryKey: ['/api/get-voucher-types-mapping'],
    queryFn: fetchVouchers,
    enabled: !!AuthService.getAccessToken(),
  });

  // React Query for users
  const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ['/api/get-users-mapping'],
    queryFn: fetchUsers,
    enabled: !!AuthService.getAccessToken(),
  });

  // Handle API errors
  useEffect(() => {
    if (itemsError) {
      toast({
        title: "Error loading items",
        description: itemsError.message,
        variant: "destructive",
      });
    }
    if (vouchersError) {
      toast({
        title: "Error loading vouchers",
        description: vouchersError.message,
        variant: "destructive",
      });
    }
    if (usersError) {
      toast({
        title: "Error loading users",
        description: usersError.message,
        variant: "destructive",
      });
    }
  }, [itemsError, vouchersError, usersError, toast]);

  // Add new item mapping
  const addItemMapping = () => {
    // console.log("Add item mapping clicked, selectedUser:", selectedUser);
    // console.log("Current mappings:", mappings);
    
    const newMapping = {
      item_id: "",
      voucher_mappings: [
        {
          voucher_id: "",
          types: []
        }
      ]
    };
    // console.log("Adding new mapping:", newMapping);
    setMappings([...mappings, newMapping]);
    
    toast({
      title: "Item mapping added",
      description: "A new item mapping block has been added.",
    });
  };

  // Remove item mapping
  const removeItemMapping = (index) => {
    const newMappings = mappings.filter((_, i) => i !== index);
    setMappings(newMappings);
  };

  // Update item selection
  const updateItemSelection = (mappingIndex, itemId) => {
    const newMappings = [...mappings];
    newMappings[mappingIndex].item_id = parseInt(itemId);
    setMappings(newMappings);
  };

  // Add voucher mapping to an item
  const addVoucherMapping = (mappingIndex) => {
    const newMappings = [...mappings];
    if (!newMappings[mappingIndex].voucher_mappings) {
      newMappings[mappingIndex].voucher_mappings = [];
    }
    newMappings[mappingIndex].voucher_mappings.push({
      voucher_id: "",
      types: []
    });
    setMappings(newMappings);
  };

  // Remove voucher mapping
  const removeVoucherMapping = (mappingIndex, voucherIndex) => {
    const newMappings = [...mappings];
    newMappings[mappingIndex].voucher_mappings.splice(voucherIndex, 1);
    setMappings(newMappings);
  };

  // Update voucher selection
  const updateVoucherSelection = (mappingIndex, voucherIndex, voucherId) => {
    const newMappings = [...mappings];
    newMappings[mappingIndex].voucher_mappings[voucherIndex].voucher_id = parseInt(voucherId);
    setMappings(newMappings);
  };

  // Update type selection
  const updateTypeSelection = (mappingIndex, voucherIndex, type, checked) => {
    const newMappings = [...mappings];
    const currentTypes = newMappings[mappingIndex].voucher_mappings[voucherIndex].types;
    
    if (checked) {
      if (!currentTypes.includes(type)) {
        currentTypes.push(type);
      }
    } else {
      const typeIndex = currentTypes.indexOf(type);
      if (typeIndex > -1) {
        currentTypes.splice(typeIndex, 1);
      }
    }
    setMappings(newMappings);
  };

  // Save mappings mutation
     // const API_BASE_URL = import.meta.env.VITE_BASE_URL;
  const saveMappingsMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch( API_BASE_URL + "/api/item-mapping/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...AuthService.getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save mappings: ${response.statusText}`);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Items mapping saved successfully",
      });
      // Reset form
      setMappings([]);
      setSelectedUser("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save mappings",
        variant: "destructive",
      });
    }
  });

  // Handle form submission
  const handleSubmit = () => {
    if (!selectedUser) {
      toast({
        title: "Validation Error",
        description: "Please select a user",
        variant: "destructive",
      });
      return;
    }

    if (mappings.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one item mapping",
        variant: "destructive",
      });
      return;
    }

    // Validate mappings
    for (let i = 0; i < mappings.length; i++) {
      const mapping = mappings[i];
      if (!mapping.item_id) {
        toast({
          title: "Validation Error",
          description: `Please select an item for mapping ${i + 1}`,
          variant: "destructive",
        });
        return;
      }

      if (!mapping.voucher_mappings || mapping.voucher_mappings.length === 0) {
        toast({
          title: "Validation Error",
          description: `Please add at least one voucher mapping for item ${mapping.item_id}`,
          variant: "destructive",
        });
        return;
      }

      for (let j = 0; j < mapping.voucher_mappings.length; j++) {
        const voucherMapping = mapping.voucher_mappings[j];
        if (!voucherMapping.voucher_id) {
          toast({
            title: "Validation Error",
            description: `Please select a voucher for item ${mapping.item_id}, voucher mapping ${j + 1}`,
            variant: "destructive",
          });
          return;
        }

        if (voucherMapping.types.length === 0) {
          toast({
            title: "Validation Error",
            description: `Please select at least one type for item ${mapping.item_id}, voucher ${voucherMapping.voucher_id}`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    const submitData = {
      user_id: selectedUser,
      item_mappings: mappings
    };

    saveMappingsMutation.mutate(submitData);
  };

  // Show loading state for API calls
  if (itemsLoading || vouchersLoading || usersLoading) {
    return <Loader text="Loading data for mapping..." />;
  }

  return (
    <>
      <div className="h-screen bg-gray-50 flex overflow-hidden">
        {/* Sidebar for desktop - Fixed */}
        {!isMobile && (
          <div className="flex-shrink-0">
            <Sidebar />
          </div>
        )}

        {/* Main content */}
        <div className="app-main-content">
        {/* Header - Fixed */}
        <header className="flex-shrink-0 bg-white shadow-sm border-b border-gray-200 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <div className="flex items-center space-x-3">
                <Link className="h-8 w-8 text-gray-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Items Mapping</h1>
                  <p className="text-sm text-gray-600">Map stock items with users based on vouchers and types</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content - Scrollable */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
              {/* Instructions Card */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-3">
                    <Info className="h-6 w-6 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">How to use Items Mapping</h3>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Select a user to create mappings for</li>
                        <li>• Add items and configure their voucher mappings</li>
                        <li>• For each voucher, select the mapping types: SOURCE, DESTINATION, or BARDAN</li>
                        <li>• Save the configuration to apply the mappings</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* User Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="h-5 w-5" />
                    <span>Select User</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">User</label>
                      <Select value={selectedUser} onValueChange={setSelectedUser}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a user" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((user) => (
                            <SelectItem key={user.user_id} value={user.user_id}>
                              {user.name} ({user.role_name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedUser && (
                      <div className="md:col-span-2 flex items-end">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 w-full">
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-800">
                              Selected: {users.find(u => u.user_id === selectedUser)?.name}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Items Mapping */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <Package className="h-5 w-5" />
                      <span>Items Mapping</span>
                    </CardTitle>
                    <Button onClick={addItemMapping} disabled={itemsLoading || vouchersLoading || usersLoading}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {mappings.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No items mapped yet</h3>
                      <p className="text-gray-600 mb-4">Start by selecting a user and adding item mappings</p>
                      <Button onClick={addItemMapping} disabled={itemsLoading || vouchersLoading || usersLoading}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Item
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                        {mappings.map((mapping, mappingIndex) => (
                          <div key={mappingIndex} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            {/* Item Selection */}
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-lg font-semibold text-gray-900">
                                Item Mapping #{mappingIndex + 1}
                              </h4>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeItemMapping(mappingIndex)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Select Item</label>
                                <Select 
                                  value={mapping.item_id?.toString() || ""} 
                                  onValueChange={(value) => updateItemSelection(mappingIndex, value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Choose an item" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[200px]">
                                    {items.map((item) => (
                                      <SelectItem key={item.id} value={item.id.toString()}>
                                        {item.name} ({item.parent || 'N/A'})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {mapping.item_id && (
                                <div className="flex items-end">
                                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 w-full">
                                    <div className="text-sm">
                                      <div className="flex items-center space-x-2 mb-1">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <span className="font-medium text-green-800">Selected Item</span>
                                      </div>
                                      <div className="text-gray-700">
                                        <strong>{items.find(i => i.id === mapping.item_id)?.name}</strong>
                                        <br />
                                        <span className="text-xs">Unit: {items.find(i => i.id === mapping.item_id)?.base_unit || 'N/A'}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Voucher Mappings */}
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h5 className="text-md font-medium text-gray-900">Voucher Mappings</h5>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addVoucherMapping(mappingIndex)}
                                  disabled={!mapping.item_id}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Voucher
                                </Button>
                              </div>

                              {mapping.voucher_mappings?.map((voucherMapping, voucherIndex) => (
                                <div key={voucherIndex} className="bg-white border border-gray-300 rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <h6 className="text-sm font-medium text-gray-800">
                                      Voucher Mapping #{voucherIndex + 1}
                                    </h6>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeVoucherMapping(mappingIndex, voucherIndex)}
                                      className="text-red-600 hover:text-red-800"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium text-gray-700">Voucher</label>
                                      <Select 
                                        value={voucherMapping.voucher_id?.toString() || ""} 
                                        onValueChange={(value) => updateVoucherSelection(mappingIndex, voucherIndex, value)}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Choose a voucher" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {vouchers.map((voucher) => (
                                            <SelectItem key={voucher.id} value={voucher.id.toString()}>
                                              {voucher.voucher_type_name || voucher.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="space-y-2">
                                      <label className="text-sm font-medium text-gray-700">Mapping Types</label>
                                      <div className="flex flex-wrap gap-3">
                                        {mappingTypes.map((type) => (
                                          <div key={type} className="flex items-center space-x-2">
                                            <Checkbox
                                              id={`${mappingIndex}-${voucherIndex}-${type}`}
                                              checked={voucherMapping.types?.includes(type) || false}
                                              onCheckedChange={(checked) => 
                                                updateTypeSelection(mappingIndex, voucherIndex, type, checked)
                                              }
                                            />
                                            <label 
                                              htmlFor={`${mappingIndex}-${voucherIndex}-${type}`}
                                              className="text-sm font-medium text-gray-700 cursor-pointer"
                                            >
                                              {type}
                                            </label>
                                          </div>
                                        ))}
                                      </div>
                                      {voucherMapping.types?.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          {voucherMapping.types.map((type) => (
                                            <Badge key={type} variant="secondary" className="text-xs">
                                              {type}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}

                              {(!mapping.voucher_mappings || mapping.voucher_mappings.length === 0) && (
                                <div className="text-center py-8 bg-white border border-gray-200 rounded-lg">
                                  <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                  <p className="text-sm text-gray-600">No voucher mappings added yet</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                  )}
                </CardContent>
              </Card>

              {/* Submit Button */}
              {mappings.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                        <span className="text-sm text-gray-700">
                          Review your mappings before saving. This will apply the configuration to the selected user.
                        </span>
                      </div>
                      <Button 
                        onClick={handleSubmit}
                        disabled={saveMappingsMutation.isPending}
                        className="bg-black hover:bg-gray-800"
                      >
                        {saveMappingsMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Mappings
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </main>
        </div>
      </div>
      
      {/* Mobile sidebar */}
      <MobileSidebar 
        isOpen={isMobileSidebarOpen} 
        onClose={() => setIsMobileSidebarOpen(false)} 
      />
    </>
  );
}