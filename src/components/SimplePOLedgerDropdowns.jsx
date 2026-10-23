import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const SimplePOLedgerDropdowns = () => {
  // State management
  const [poNumbers, setPoNumbers] = useState([]);
  const [selectedPO, setSelectedPO] = useState('');
  const [ledgers, setLedgers] = useState([]);
  const [selectedLedger, setSelectedLedger] = useState('');
  const [loading, setLoading] = useState({ po: false, ledger: false });

  // Fetch PO Numbers on component mount
  useEffect(() => {
    fetchPONumbers();
  }, []);

  // Fetch PO Numbers
  const fetchPONumbers = async () => {
    setLoading(prev => ({ ...prev, po: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/api/report/purchase-orders/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      setPoNumbers(data.results || []);
    } catch (error) {
      console.error('Error fetching PO numbers:', error);
    } finally {
      setLoading(prev => ({ ...prev, po: false }));
    }
  };

  // Handle PO selection and fetch ledgers
  const handlePOChange = async (poId) => {
    setSelectedPO(poId);
    setSelectedLedger('');
    setLedgers([]);

    if (!poId) return;

    setLoading(prev => ({ ...prev, ledger: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/api/report/purchase-orders/${poId}/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      
      // Extract ledgers from json?.data?.party?.ledgers
      if (data.data?.party?.ledgers) {
        setLedgers(data.data.party.ledgers);
      } else if (data.data?.party) {
        // Fallback: create ledger from party data
        setLedgers([{
          id: data.data.party.id || 0,
          name: data.data.party.name || data.data.party
        }]);
      }
    } catch (error) {
      console.error('Error fetching PO details:', error);
    } finally {
      setLoading(prev => ({ ...prev, ledger: false }));
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* PO Number Dropdown */}
      <div>
        <Label htmlFor="po-number">PO Number</Label>
        <Select
          value={selectedPO}
          onValueChange={handlePOChange}
          disabled={loading.po}
        >
          <SelectTrigger>
            <SelectValue placeholder={loading.po ? "Loading..." : "Select PO Number"} />
          </SelectTrigger>
          <SelectContent>
            {poNumbers.map((po) => (
              <SelectItem key={po.id} value={po.id.toString()}>
                {po.voucher_number || po.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Ledgers Dropdown */}
      <div>
        <Label htmlFor="ledgers">Ledgers</Label>
        <Select
          value={selectedLedger}
          onValueChange={setSelectedLedger}
          disabled={loading.ledger || !selectedPO}
        >
          <SelectTrigger>
            <SelectValue 
              placeholder={
                !selectedPO 
                  ? "Select PO first" 
                  : loading.ledger 
                    ? "Loading..." 
                    : "Select Ledger"
              } 
            />
          </SelectTrigger>
          <SelectContent>
            {ledgers.map((ledger) => (
              <SelectItem key={ledger.id} value={ledger.id.toString()}>
                {ledger.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default SimplePOLedgerDropdowns;
