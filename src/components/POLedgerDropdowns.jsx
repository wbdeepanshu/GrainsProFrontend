import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const POLedgerDropdowns = () => {
  // State for PO Numbers
  const [poNumbers, setPoNumbers] = useState([]);
  const [selectedPO, setSelectedPO] = useState('');
  const [poLoading, setPoLoading] = useState(false);

  // State for Ledgers
  const [ledgers, setLedgers] = useState([]);
  const [selectedLedger, setSelectedLedger] = useState('');
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // State for API responses
  const [poData, setPoData] = useState(null);

  // Fetch PO Numbers on component mount
  useEffect(() => {
    fetchPONumbers();
  }, []);

  // Fetch PO Numbers from API
  const fetchPONumbers = async () => {
    try {
      setPoLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/report/purchase-orders/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setPoNumbers(data.results || []);
    } catch (error) {
      console.error('Error fetching PO numbers:', error);
    } finally {
      setPoLoading(false);
    }
  };

  // Handle PO Number selection
  const handlePOChange = async (poId) => {
    setSelectedPO(poId);
    setSelectedLedger(''); // Reset ledger selection
    setLedgers([]); // Clear previous ledgers

    if (!poId) return;

    try {
      setLedgerLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/report/purchase-orders/${poId}/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setPoData(data.data);

      // Extract ledgers from the API response
      if (data.data?.party?.ledgers) {
        setLedgers(data.data.party.ledgers);
      } else if (data.data?.party) {
        // If party exists but no ledgers array, create a single ledger entry
        setLedgers([{
          id: data.data.party.id || 0,
          name: data.data.party.name || data.data.party
        }]);
      } else {
        setLedgers([]);
      }
    } catch (error) {
      console.error('Error fetching PO details:', error);
      setLedgers([]);
    } finally {
      setLedgerLoading(false);
    }
  };

  // Handle Ledger selection
  const handleLedgerChange = (ledgerId) => {
    setSelectedLedger(ledgerId);
  };

  return (
    <div className="space-y-6 p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900">PO Number & Ledgers Selection</h2>
      
      {/* PO Number Dropdown */}
      <div className="space-y-2">
        <Label htmlFor="po-number">PO Number</Label>
        <Select
          value={selectedPO}
          onValueChange={handlePOChange}
          disabled={poLoading}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={poLoading ? "Loading PO numbers..." : "Select PO Number"} />
          </SelectTrigger>
          <SelectContent>
            {poLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span>Loading...</span>
              </div>
            ) : (
              poNumbers.map((po) => (
                <SelectItem key={po.id} value={po.id.toString()}>
                  {po.voucher_number || po.id}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Ledgers Dropdown */}
      <div className="space-y-2">
        <Label htmlFor="ledgers">Ledgers</Label>
        <Select
          value={selectedLedger}
          onValueChange={handleLedgerChange}
          disabled={ledgerLoading || !selectedPO}
        >
          <SelectTrigger className="w-full">
            <SelectValue 
              placeholder={
                !selectedPO 
                  ? "Select a PO Number first" 
                  : ledgerLoading 
                    ? "Loading ledgers..." 
                    : "Select Ledger"
              } 
            />
          </SelectTrigger>
          <SelectContent>
            {ledgerLoading ? (
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
            ) : null}
          </SelectContent>
        </Select>
      </div>

      {/* Display selected data */}
      {poData && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">Selected PO Details:</h3>
          <div className="space-y-1 text-sm text-gray-600">
            <p><strong>PO ID:</strong> {poData.id}</p>
            <p><strong>Voucher Number:</strong> {poData.voucher_number}</p>
            <p><strong>Party:</strong> {poData.party?.name || poData.party}</p>
            <p><strong>Reference:</strong> {poData.reference}</p>
            {ledgers.length > 0 && (
              <p><strong>Available Ledgers:</strong> {ledgers.length}</p>
            )}
          </div>
        </div>
      )}

      {/* Display current selections */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Current Selections:</h3>
        <div className="space-y-1 text-sm text-blue-800">
          <p><strong>Selected PO:</strong> {selectedPO || 'None'}</p>
          <p><strong>Selected Ledger:</strong> {selectedLedger || 'None'}</p>
        </div>
      </div>
    </div>
  );
};

export default POLedgerDropdowns;
