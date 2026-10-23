import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Example component showing how PO party binding works
const POPartyBindingExample = () => {
  const [selectedPO, setSelectedPO] = useState('');
  const [selectedParty, setSelectedParty] = useState('');
  const [availableParties, setAvailableParties] = useState([]);

  // Mock PO data based on your API response
  const mockPOData = [
    {
      "id": 1540,
      "voucher_type": "Purchase Order",
      "party_id": null,
      "party": "Mabusab M Bairakdar [CEYPB7804P]",
      "voucher_number": "1234WBTEST/18-08/DP",
      "effective_date": "2025-08-19",
      "amount": "4568.00",
      "created_by": "Mukesh Bafna",
      "created_at": "2025-08-19T11:14:51.482049",
      "items_count": 1
    },
    {
      "id": 1541,
      "voucher_type": "Purchase Order",
      "party_id": 123,
      "party": "ABC Trading Company",
      "voucher_number": "1235WBTEST/19-08/DP",
      "effective_date": "2025-08-20",
      "amount": "2500.00",
      "created_by": "Mukesh Bafna",
      "created_at": "2025-08-20T10:30:00",
      "items_count": 2
    }
  ];

  // Mock parties data (your ledgers)
  const mockParties = [
    { id: 1, name: "Mabusab M Bairakdar" },
    { id: 2, name: "ABC Trading Company" },
    { id: 3, name: "XYZ Suppliers" },
    { id: 4, name: "DEF Enterprises" }
  ];

  // Handle PO selection
  const handlePOChange = (poId) => {
    setSelectedPO(poId);
    setSelectedParty(''); // Reset party selection

    if (!poId) {
      setAvailableParties([]);
      return;
    }

    // Find the selected PO
    const selectedPOData = mockPOData.find(po => po.id.toString() === poId);
    
    if (selectedPOData && selectedPOData.party) {
      // Find matching party in ledgers with improved matching
      const foundParty = mockParties.find(p => {
        // Try exact match first
        if (p.name === selectedPOData.party) return true;
        // Try partial match (in case party name has additional info like GST number)
        if (p.name.includes(selectedPOData.party) || selectedPOData.party.includes(p.name)) return true;
        return false;
      });

      if (foundParty) {
        // Party found in ledgers, set it as selected
        setSelectedParty(foundParty.id.toString());
        setAvailableParties([foundParty]);
      } else {
        // Party not found, add it to available parties with temporary ID
        const tempParty = {
          id: 0,
          name: selectedPOData.party
        };
        setAvailableParties([tempParty]);
        setSelectedParty('0');
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>PO Party Binding Example</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* PO Number Dropdown */}
          <div>
            <Label htmlFor="po-number">PO Number</Label>
            <Select value={selectedPO} onValueChange={handlePOChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select PO Number" />
              </SelectTrigger>
              <SelectContent>
                {mockPOData.map((po) => (
                  <SelectItem key={po.id} value={po.id.toString()}>
                    {po.voucher_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ledgers Dropdown */}
          <div>
            <Label htmlFor="ledgers">Ledgers</Label>
            <Select 
              value={selectedParty} 
              onValueChange={setSelectedParty}
              disabled={!selectedPO}
            >
              <SelectTrigger>
                <SelectValue 
                  placeholder={!selectedPO ? "Select PO first" : "Select Ledger"} 
                />
              </SelectTrigger>
              <SelectContent>
                {availableParties.map((party) => (
                  <SelectItem key={party.id} value={party.id.toString()}>
                    {party.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Display selected data */}
          {selectedPO && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-2">Selected PO Details:</h3>
              <div className="text-sm space-y-1">
                {(() => {
                  const poData = mockPOData.find(po => po.id.toString() === selectedPO);
                  return poData ? (
                    <>
                      <p><strong>PO ID:</strong> {poData.id}</p>
                      <p><strong>Voucher Number:</strong> {poData.voucher_number}</p>
                      <p><strong>Party from PO:</strong> {poData.party}</p>
                      <p><strong>Party ID in PO:</strong> {poData.party_id || 'null'}</p>
                      <p><strong>Selected Ledger:</strong> {selectedParty}</p>
                    </>
                  ) : null;
                })()}
              </div>
            </div>
          )}

          {/* Explanation */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• When you select a PO, it extracts the <code>party</code> field from the API response</li>
              <li>• It tries to find a matching party in the ledgers list using exact or partial matching</li>
              <li>• If found, it auto-selects the matching ledger</li>
              <li>• If not found, it adds the party from PO to the ledgers dropdown with a temporary ID</li>
              <li>• This handles cases where <code>party_id</code> is null in the PO response</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default POPartyBindingExample;
