import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";
import { usePOLedgerDropdowns } from "@/hooks/usePOLedgerDropdowns";

const ExamplePOLedgerForm = () => {
  const {
    poNumbers,
    selectedPO,
    ledgers,
    selectedLedger,
    loading,
    poData,
    handlePOChange,
    handleLedgerChange,
    resetSelections,
    fetchPONumbers,
  } = usePOLedgerDropdowns();

  const handleSubmit = (e) => {
    e.preventDefault();    
  };
  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            PO Number & Ledgers Selection
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPONumbers}
              disabled={loading.po}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading.po ? 'animate-spin' : ''}`} />
              Refresh PO Numbers
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dropdowns Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PO Number Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="po-number">PO Number *</Label>
                <Select
                  value={selectedPO}
                  onValueChange={handlePOChange}
                  disabled={loading.po}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loading.po ? "Loading PO numbers..." : "Select PO Number"} />
                  </SelectTrigger>
                  <SelectContent>
                    {loading.po ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span>Loading...</span>
                      </div>
                    ) : poNumbers.length > 0 ? (
                      poNumbers.map((po) => (
                        <SelectItem key={po.id} value={po.id.toString()}>
                          {po.voucher_number || `PO-${po.id}`}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        No PO numbers found
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Ledgers Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="ledgers">Ledgers *</Label>
                <Select
                  value={selectedLedger}
                  onValueChange={handleLedgerChange}
                  disabled={loading.ledger || !selectedPO}
                  required
                >
                  <SelectTrigger>
                    <SelectValue 
                      placeholder={
                        !selectedPO 
                          ? "Select a PO Number first" 
                          : loading.ledger 
                            ? "Loading ledgers..." 
                            : "Select Ledger"
                      } 
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {loading.ledger ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span>Loading ledgers...</span>
                      </div>
                    ) : ledgers.length > 0 ? (
                      ledgers.map((ledger) => (
                        <SelectItem key={ledger.id} value={ledger.id.toString()}>
                          {ledger.name}
                        </SelectItem>
                      ))
                    ) : selectedPO ? (
                      <div className="p-4 text-center text-gray-500">
                        No ledgers found for this PO
                      </div>
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        Select a PO Number first
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* PO Details Display */}
            {poData && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-3">Selected PO Details:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><strong>PO ID:</strong> {poData.id}</p>
                    <p><strong>Voucher Number:</strong> {poData.voucher_number}</p>
                  </div>
                  <div>
                    <p><strong>Party:</strong> {poData.party?.name || poData.party}</p>
                    <p><strong>Reference:</strong> {poData.reference}</p>
                  </div>
                </div>
                {ledgers.length > 0 && (
                  <div className="mt-3">
                    <p><strong>Available Ledgers:</strong> {ledgers.length}</p>
                  </div>
                )}
              </div>
            )}

            {/* Current Selections Summary */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Current Selections:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
                <div>
                  <p><strong>Selected PO:</strong> {selectedPO || 'None'}</p>
                  <p><strong>Selected Ledger:</strong> {selectedLedger || 'None'}</p>
                </div>
                <div>
                  <p><strong>PO Numbers Available:</strong> {poNumbers.length}</p>
                  <p><strong>Ledgers Available:</strong> {ledgers.length}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button type="submit" disabled={!selectedPO || !selectedLedger}>
                Submit Form
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={resetSelections}
              >
                Reset Selections
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExamplePOLedgerForm;
