import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

export const usePOLedgerDropdowns = () => {
  // State management
  const [poNumbers, setPoNumbers] = useState([]);
  const [selectedPO, setSelectedPO] = useState('');
  const [ledgers, setLedgers] = useState([]);
  const [selectedLedger, setSelectedLedger] = useState('');
  const [loading, setLoading] = useState({ po: false, ledger: false });
  const [poData, setPoData] = useState(null);

  // Fetch PO Numbers
  const fetchPONumbers = useCallback(async () => {
    setLoading(prev => ({ ...prev, po: true }));
    try {
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
      setPoNumbers([]);
    } finally {
      setLoading(prev => ({ ...prev, po: false }));
    }
  }, []);

  // Handle PO selection and fetch ledgers
  const handlePOChange = useCallback(async (poId) => {
    setSelectedPO(poId);
    setSelectedLedger('');
    setLedgers([]);
    setPoData(null);

    if (!poId) return;

    setLoading(prev => ({ ...prev, ledger: true }));
    try {
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
      
      // Extract ledgers from json?.data?.party?.ledgers
      if (data.data?.party?.ledgers) {
        setLedgers(data.data.party.ledgers);
      } else if (data.data?.party) {
        // Fallback: create ledger from party data
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
      setLoading(prev => ({ ...prev, ledger: false }));
    }
  }, []);

  // Handle Ledger selection
  const handleLedgerChange = useCallback((ledgerId) => {
    setSelectedLedger(ledgerId);
  }, []);

  // Reset all selections
  const resetSelections = useCallback(() => {
    setSelectedPO('');
    setSelectedLedger('');
    setLedgers([]);
    setPoData(null);
  }, []);

  // Load PO numbers on mount
  useEffect(() => {
    fetchPONumbers();
  }, [fetchPONumbers]);

  return {
    // State
    poNumbers,
    selectedPO,
    ledgers,
    selectedLedger,
    loading,
    poData,
    
    // Actions
    handlePOChange,
    handleLedgerChange,
    resetSelections,
    fetchPONumbers,
  };
};
