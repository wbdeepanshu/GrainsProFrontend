import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import InwardPDFButton from '@/components/InwardPDFButton';

/**
 * Example showing how to use the InwardPDFButton component
 * This demonstrates the complete PDF generation functionality
 */
const InwardPDFExample = () => {
  // Sample data structure (replace with your actual data)
  const sampleData = {
    sl_no: 'IW/2025/0017',
    date: '25-10-2025',
    supplier_name: 'Sample Supplier',
    vehicle_no: 'CHVHCHCHVH',
    bill_no: '111/DT/MI/24.6',
    status: 'not_unloaded',
    tested_by: 'Lab Tech',
    tested_date: '25-10-2025 10:43:03',
    approved_by: 'Mukesh Bafna',
    approved_date: '25-10-2025 10:44:37'
  };

  const sampleItems = [
    {
      id: 1,
      item_name: 'Raw Moong Harvest [GJ] [50kg]',
      brand: 'Asd',
      unit: 'pkt',
      godown_name: 'A Main Location',
      quality: 'Premium',
      number_of_bags: 700,
      supervisor_name: 'Shivanand',
      total_weight: 350.40,
      remarks: 'High quality harvest',
      images: [
        {
          id: 1,
          type: 'lab_samples',
          type_display: 'Lab Samples',
          image_url: 'https://picsum.photos/400/300?random=1',
          image_remarks: 'Lab test sample 1'
        },
        {
          id: 2,
          type: 'lab_samples',
          type_display: 'Lab Samples',
          image_url: 'https://picsum.photos/400/300?random=2',
          image_remarks: 'Lab test sample 2'
        },
        {
          id: 3,
          type: 'quality_check',
          type_display: 'Quality Check',
          image_url: 'https://picsum.photos/400/300?random=3',
          image_remarks: 'Quality inspection'
        }
      ]
    }
  ];

  const sampleLabTestParams = [
    {
      id: 1,
      item_id: 1,
      parameter_name: 'Moisture Content',
      pre_testing_value: '12.5',
      post_testing_value: '11.8',
      unit: '%'
    },
    {
      id: 2,
      item_id: 1,
      parameter_name: 'Protein Content',
      pre_testing_value: '24.2',
      post_testing_value: '24.5',
      unit: '%'
    },
    {
      id: 3,
      item_id: 1,
      parameter_name: 'Foreign Matter',
      pre_testing_value: '0.8',
      post_testing_value: '0.5',
      unit: '%'
    }
  ];

  const sampleImages = []; // This will be populated from items

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Inward Entry #{sampleData.sl_no}</span>
            <div className="flex items-center space-x-3">
              {/* Professional PDF Download Button */}
              <InwardPDFButton
                data={sampleData}
                items={sampleItems}
                labTestParams={sampleLabTestParams}
                images={sampleImages}
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
              <span className="text-sm px-2 py-1 rounded bg-yellow-100 text-yellow-700">
                {sampleData.status}
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
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

            {/* Items Section */}
            {sampleItems.map((item, index) => (
              <Card key={item.id} className="overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Item {index + 1}: {item.item_name}</span>
                    <span className="text-sm font-normal text-gray-500">
                      {item.images?.length || 0} images
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
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
                      <span className="font-medium">Quality:</span> {item.quality}
                    </div>
                    <div>
                      <span className="font-medium">Bags:</span> {item.number_of_bags}
                    </div>
                    <div>
                      <span className="font-medium">Supervisor:</span> {item.supervisor_name}
                    </div>
                  </div>

                  {/* Lab Test Results */}
                  {sampleLabTestParams.filter(param => param.item_id === item.id).length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2">Lab Test Results</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border border-gray-200 rounded-lg">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-2 py-1 text-left">Parameter</th>
                              <th className="px-2 py-1 text-left">Pre-Testing</th>
                              <th className="px-2 py-1 text-left">Post-Testing</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sampleLabTestParams
                              .filter(param => param.item_id === item.id)
                              .map((param, idx) => (
                                <tr key={idx} className="border-b hover:bg-gray-50">
                                  <td className="px-2 py-1.5 font-medium">{param.parameter_name}</td>
                                  <td className="px-2 py-1.5">{param.pre_testing_value} {param.unit}</td>
                                  <td className="px-2 py-1.5">{param.post_testing_value} {param.unit}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Images */}
                  {item.images && item.images.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Images & Samples</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {item.images.map((image, imgIdx) => (
                          <div key={imgIdx} className="relative group">
                            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                              <img
                                src={image.image_url}
                                alt={image.type_display || image.type}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                              <div 
                                className="w-full h-full flex items-center justify-center bg-red-50 text-red-500 text-sm"
                                style={{ display: 'none' }}
                              >
                                Failed to load
                              </div>
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

            {/* Testing Information */}
            {(sampleData.tested_by || sampleData.approved_by) && (
              <Card>
                <CardHeader>
                  <CardTitle>Testing Information</CardTitle>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InwardPDFExample;
