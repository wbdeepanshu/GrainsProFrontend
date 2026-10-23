import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import InwardPDFButton from '@/components/InwardPDFButton';

/**
 * Example showing the updated PDF generation with Lab Testing Results and Testing Information
 */
const UpdatedPDFExample = () => {
  // Sample data with lab_tests structure
  const sampleData = {
    sl_no: 'IW/2025/0017',
    date: '25-10-2025',
    supplier_name: 'Test Supplier',
    vehicle_no: 'TEST123',
    bill_no: 'BILL001',
    status: 'pending',
    tested_by: 'Lab Tech',
    tested_date: '25-10-2025 10:43:03',
    approved_by: 'Mukesh Bafna',
    approved_date: '25-10-2025 10:44:37'
  };

  const sampleItems = [
    {
      id: 1,
      item_name: 'Raw Moong Harvest [GJ] [50kg]',
      brand: 'Premium Brand',
      unit: 'pkt',
      godown_name: 'Main Location',
      quality: 'Premium',
      number_of_bags: 700,
      supervisor_name: 'Shivanand',
      total_weight: 350.40,
      remarks: 'High quality harvest',
      tested_by: 'Lab Technician 1',
      tested_date: '25-10-2025 11:00:00',
      approved_by: 'Quality Manager',
      approved_date: '25-10-2025 11:30:00',
      // Lab tests structure as used in inward-details.jsx
      lab_tests: [
        {
          id: 1,
          parameter_name: 'Moisture Content',
          unit: '%',
          test_type: 'pre_testing',
          value: '12.5',
          remarks: 'Within acceptable range'
        },
        {
          id: 2,
          parameter_name: 'Moisture Content',
          unit: '%',
          test_type: 'post_testing',
          value: '11.8',
          remarks: 'Improved after processing'
        },
        {
          id: 3,
          parameter_name: 'Protein Content',
          unit: '%',
          test_type: 'pre_testing',
          value: '24.2',
          remarks: 'Good protein level'
        },
        {
          id: 4,
          parameter_name: 'Protein Content',
          unit: '%',
          test_type: 'post_testing',
          value: '24.5',
          remarks: 'Maintained protein level'
        },
        {
          id: 5,
          parameter_name: 'Foreign Matter',
          unit: '%',
          test_type: 'pre_testing',
          value: '0.8',
          remarks: 'Some foreign matter detected'
        },
        {
          id: 6,
          parameter_name: 'Foreign Matter',
          unit: '%',
          test_type: 'post_testing',
          value: '0.5',
          remarks: 'Reduced after cleaning'
        }
      ],
      images: [
        {
          id: 1,
          type: 'lab_samples',
          type_display: 'Lab Samples',
          image_url: 'https://picsum.photos/400/300?random=1'
        },
        {
          id: 2,
          type: 'quality_check',
          type_display: 'Quality Check',
          image_url: 'https://picsum.photos/400/300?random=2'
        }
      ]
    },
    {
      id: 2,
      item_name: 'Raw Gram Bags Rayapur',
      brand: 'Standard Brand',
      unit: 'kg',
      godown_name: 'Secondary Location',
      quality: 'Standard',
      number_of_bags: 500,
      supervisor_name: 'Supervisor 2',
      total_weight: 250.0,
      remarks: 'Standard quality',
      tested_by: 'Lab Technician 2',
      tested_date: '25-10-2025 12:00:00',
      approved_by: 'Quality Manager',
      approved_date: '25-10-2025 12:30:00',
      lab_tests: [
        {
          id: 7,
          parameter_name: 'Moisture Content',
          unit: '%',
          test_type: 'pre_testing',
          value: '13.2',
          remarks: 'Higher moisture content'
        },
        {
          id: 8,
          parameter_name: 'Moisture Content',
          unit: '%',
          test_type: 'post_testing',
          value: '12.1',
          remarks: 'Reduced after drying'
        }
      ],
      images: []
    }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Inward Entry #{sampleData.sl_no}</span>
            <div className="flex items-center space-x-3">
              {/* Updated PDF Download Button */}
              <InwardPDFButton
                data={sampleData}
                items={sampleItems}
                labTestParams={[]} // Not needed anymore as lab_tests are in items
                images={[]} // Not needed anymore as images are in items
                filename={`Inward_Entry_${sampleData.sl_no}.pdf`}
                variant="default"
                size="lg"
                onSuccess={(filename) => {
                  // console.log(`✅ PDF ${filename} downloaded successfully!`);
                }}
                onError={(error) => {
                  console.error('❌ PDF generation failed:', error);
                }}
              />
              <Badge variant="outline" className="bg-yellow-100 text-yellow-700">
                {sampleData.status}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <span className="font-medium">Date:</span>
              <span>{sampleData.date}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-medium">Supplier:</span>
              <span>{sampleData.supplier_name}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-medium">Vehicle No:</span>
              <span>{sampleData.vehicle_no}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-medium">Bill No:</span>
              <span>{sampleData.bill_no}</span>
            </div>
          </div>

          {/* Items with Lab Testing Results */}
          {sampleItems.map((item, index) => (
            <Card key={item.id} className="overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Item {index + 1}: {item.item_name}</span>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{item.quality}</Badge>
                    <span className="text-sm text-gray-500">
                      {item.lab_tests?.length || 0} lab tests
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Item Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Brand:</span> {item.brand}
                  </div>
                  <div>
                    <span className="font-medium">Unit:</span> {item.unit}
                  </div>
                  <div>
                    <span className="font-medium">Godown:</span> {item.godown_name}
                  </div>
                  <div>
                    <span className="font-medium">Bags:</span> {item.number_of_bags}
                  </div>
                  <div>
                    <span className="font-medium">Supervisor:</span> {item.supervisor_name}
                  </div>
                  <div>
                    <span className="font-medium">Weight:</span> {item.total_weight} Qtl
                  </div>
                </div>

                {/* Lab Testing Results - Tabular Format */}
                {item.lab_tests && item.lab_tests.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center space-x-2">
                      <span>🧪</span>
                      <span>Lab Testing Results</span>
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border border-gray-200 rounded-lg">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">Parameter</th>
                            <th className="px-3 py-2 text-left font-semibold">Pre-Testing</th>
                            <th className="px-3 py-2 text-left font-semibold">Post-Testing</th>
                            <th className="px-3 py-2 text-left font-semibold">Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // Group tests by parameter name (same logic as PDF generator)
                            const testGroups = {};
                            item.lab_tests.forEach(test => {
                              const paramName = test.parameter_name || 'Unknown Parameter';
                              if (!testGroups[paramName]) {
                                testGroups[paramName] = {
                                  parameter_name: paramName,
                                  unit: test.unit || '',
                                  pre_testing: null,
                                  post_testing: null
                                };
                              }
                              
                              if (test.test_type === 'post_testing') {
                                testGroups[paramName].post_testing = {
                                  value: test.value || 'N/A',
                                  remarks: test.remarks || ''
                                };
                              } else {
                                testGroups[paramName].pre_testing = {
                                  value: test.value || 'N/A',
                                  remarks: test.remarks || ''
                                };
                              }
                            });

                            return Object.values(testGroups).map((group, idx) => (
                              <tr key={idx} className="border-b hover:bg-gray-50">
                                <td className="px-3 py-2 font-medium">{group.parameter_name}</td>
                                <td className="px-3 py-2">
                                  {group.pre_testing ? `${group.pre_testing.value} ${group.unit}`.trim() : 'N/A'}
                                </td>
                                <td className="px-3 py-2">
                                  {group.post_testing ? `${group.post_testing.value} ${group.unit}`.trim() : 'N/A'}
                                </td>
                                <td className="px-3 py-2 text-xs text-gray-600">
                                  {group.pre_testing?.remarks || group.post_testing?.remarks || '-'}
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Testing Information */}
                {(item.tested_by || item.tested_date || item.approved_by || item.approved_date) && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center space-x-2">
                      <span>📋</span>
                      <span>Testing Information</span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {item.tested_by && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-gray-500 text-xs">Tested By</p>
                          <p className="font-medium">{item.tested_by}</p>
                        </div>
                      )}
                      {item.tested_date && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-gray-500 text-xs">Tested Date</p>
                          <p className="font-medium">{item.tested_date}</p>
                        </div>
                      )}
                      {item.approved_by && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-gray-500 text-xs">Approved By</p>
                          <p className="font-medium">{item.approved_by}</p>
                        </div>
                      )}
                      {item.approved_date && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-gray-500 text-xs">Approved Date</p>
                          <p className="font-medium">{item.approved_date}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Images */}
                {item.images && item.images.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center space-x-2">
                      <span>📸</span>
                      <span>Images & Samples</span>
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {item.images.map((image, imgIdx) => (
                        <div key={imgIdx} className="relative group">
                          <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                            <img
                              src={image.image_url}
                              alt={image.type_display || image.type}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="mt-1 text-xs text-gray-600">
                            {image.type_display || image.type}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Global Testing Information */}
          {(sampleData.tested_by || sampleData.approved_by) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <span>📋</span>
                  <span>Global Testing Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {sampleData.tested_by && (
                    <div>
                      <span className="font-medium">Tested By:</span> {sampleData.tested_by}
                    </div>
                  )}
                  {sampleData.tested_date && (
                    <div>
                      <span className="font-medium">Tested Date:</span> {sampleData.tested_date}
                    </div>
                  )}
                  {sampleData.approved_by && (
                    <div>
                      <span className="font-medium">Approved By:</span> {sampleData.approved_by}
                    </div>
                  )}
                  {sampleData.approved_date && (
                    <div>
                      <span className="font-medium">Approved Date:</span> {sampleData.approved_date}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UpdatedPDFExample;
