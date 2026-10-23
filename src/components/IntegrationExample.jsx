// Integration Example for add-inward.jsx
// This shows how to integrate the PO-Ledger functionality into your existing form

import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

// This is the exact code you can copy into your add-inward.jsx file
const POLedgerIntegration = ({ form, setValue, watch }) => {
  // State for PO Numbers
  const [poNumbers, setPoNumbers] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState({ po: false, ledger: false });

  // Watch the PO field from your form
  const selectedPO = watch('po_voucher_number');

  // Fetch PO Numbers (call this in useEffect on component mount)
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
    setValue('po_voucher_number', parseInt(poId));
    setValue('party_id', ''); // Reset ledger selection
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
        // Auto-select first ledger if available
        if (data.data.party.ledgers.length > 0) {
          setValue('party_id', data.data.party.ledgers[0].id);
        }
      } else if (data.data?.party) {
        // Fallback: create ledger from party data
        const partyLedger = {
          id: data.data.party.id || 0,
          name: data.data.party.name || data.data.party
        };
        setLedgers([partyLedger]);
        setValue('party_id', partyLedger.id);
      }
    } catch (error) {
      console.error('Error fetching PO details:', error);
    } finally {
      setLoading(prev => ({ ...prev, ledger: false }));
    }
  };

  // Load PO numbers on mount
  useEffect(() => {
    fetchPONumbers();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* PO Number Dropdown */}
      <div>
        <Label htmlFor="po_voucher_number">PO Number</Label>
        <Select
          value={selectedPO?.toString() || ''}
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
        <Label htmlFor="party_id">Ledgers</Label>
        <Select
          value={watch('party_id')?.toString() || ''}
          onValueChange={(value) => setValue('party_id', parseInt(value))}
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

export default POLedgerIntegration;
