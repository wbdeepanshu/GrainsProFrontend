import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export default function NewInvoiceDesign() {
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();

  return (
    <div className="flex h-screen bg-gray-50">
      {!isMobile && <Sidebar />}
      {isMobile && <MobileSidebar />}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setLocation("/")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto bg-white p-6">
            <style>{`
              .invoice-content {
                font-family: Arial, sans-serif;
              }
              .invoice-content table {
                table-layout: fixed;
                width: 100%;
                height: 100%;
                margin-bottom: 0;
                border-collapse: collapse;
                border: 1px solid black;
              }
              .invoice-content table td,
              .invoice-content table th {
                border: 1px solid black;
                word-wrap: break-word;
                max-width: 200px;
                vertical-align: top;
                padding: 4px !important;
              }
              .invoice-content .table-left td,
              .invoice-content .table-left th {
                border-right-width: 0 !important;
              }
              .invoice-content .table-right td,
              .invoice-content .table-right th {
                border-left-width: 0 !important;
              }
              .invoice-content .table-container {
                display: flex;
                width: 100%;
              }
              .invoice-content .center {
                text-align: center !important;
              }
              .invoice-content .alignright {
                text-align: right;
              }
              .invoice-content .column {
                float: left;
                width: 50%;
              }
            `}</style>
            <div className="invoice-content">
              <h5 style={{ textAlign: 'center' }}>Invoice</h5>

              <div className="column">
                <table className="table table-bordered">
                  <tbody>
                    <tr>
                      <td>
                        <strong>TechCorp Solutions Pvt Ltd</strong><br />
                        123, Industrial Area, Sector 18<br />
                        Bangalore - 560001<br />
                        GSTIN/UIN: 29ABCDE1234F1Z5<br />
                        Contact: +91 9876543210<br />
                        State Name: Karnataka<br />
                        E-Mail: info@techcorp.com
                      </td>
                    </tr>
                    <tr>
                      <td>
                        Buyer(Ship to)<br />
                        <strong>Global Enterprises Ltd</strong><br />
                        456 Business Park, MG Road, Pune 411001<br />
                        GSTIN/UIN: 27XYZAB5678G2H9<br />
                        Phone: +91 9988776655<br />
                        State Name: Maharashtra<br />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="column">
                <table className="table table-bordered">
                  <tbody>
                    <tr>
                      <td style={{ width: '33%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            Invoice No:<br />
                            <strong>INV-2024-0523</strong>
                          </div>
                        </div>
                      </td>
                      <td style={{ width: '33%' }}>
                        <div>
                          e-Way Bill No<br />
                          <strong></strong>
                        </div>
                      </td>
                      <td style={{ width: '33%' }}>Dated:<br /><strong>09/12/2025</strong></td>
                    </tr>
                    <tr>
                      <td colSpan="2">Delivery Note</td>
                      <td colSpan="1"></td>
                    </tr>
                    <tr>
                      <td colSpan="2">Reference No & Date<br /><strong></strong></td>
                      <td colSpan="1">Other Reference <br /><strong></strong></td>
                    </tr>
                    <tr>
                      <td colSpan="2">Buyer's Order No.<br /><strong></strong></td>
                      <td colSpan="1">Dated:<br /><strong>09/12/2025</strong></td>
                    </tr>
                    <tr>
                      <td>Dispatch Doc No.<br /><strong></strong></td>
                      <td colSpan="2">Delivery Note Date: <strong>15/12/2025</strong></td>
                    </tr>
                    <tr>
                      <td>Dispatched through<br /><strong>KA-01-AB-1234</strong></td>
                      <td colSpan="2">Destination<br /><strong></strong></td>
                    </tr>
                    <tr>
                      <td>Bill of Landing/LR-RR NO<br /><strong>dt, 09/12/2025</strong></td>
                      <td colSpan="2">Motor Vehicle No<br /><strong>KA-01-AB-1234</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <table className="table table-bordered" style={{ fontSize: '14px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '3%' }}>Sl<br />No</th>
                      <th style={{ width: '30%' }}>Description of Goods</th>
                      <th style={{ width: '10%' }}>HSN/SAC</th>
                      <th style={{ width: '5%' }}>GST Rate</th>
                      <th style={{ width: '8%' }}>Alt Qty</th>
                      <th style={{ width: '8%' }}>Qty</th>
                      <th style={{ width: '9%' }}>Rate<br />(Incl. of Tax)</th>
                      <th style={{ width: '8%' }}>Rate</th>
                      <th style={{ width: '5%' }}>Per</th>
                      <th style={{ width: '12%' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>1</td>
                      <td>Premium Quality Rice</td>
                      <td>100630</td>
                      <td>5%</td>
                      <td>100.00 KG</td>
                      <td>10 QTL</td>
                      <td>5250.00</td>
                      <td>5000.00</td>
                      <td>QTL</td>
                      <td className="alignright">50000.00</td>
                    </tr>
                    <tr>
                      <td>2</td>
                      <td>Wheat Flour Premium</td>
                      <td>110100</td>
                      <td>5%</td>
                      <td>50.00 KG</td>
                      <td>5 QTL</td>
                      <td>4200.00</td>
                      <td>4000.00</td>
                      <td>QTL</td>
                      <td className="alignright">20000.00</td>
                    </tr>
                    <tr>
                      <td>3</td>
                      <td>Organic Sugar</td>
                      <td>170199</td>
                      <td>12%</td>
                      <td>75.00 KG</td>
                      <td>7.5 QTL</td>
                      <td>5600.00</td>
                      <td>5000.00</td>
                      <td>QTL</td>
                      <td className="alignright">37500.00</td>
                    </tr>
                    <tr>
                      <td>4</td>
                      <td>Cooking Oil - Refined</td>
                      <td>151190</td>
                      <td>18%</td>
                      <td>200.00 LTR</td>
                      <td>200 LTR</td>
                      <td>177.00</td>
                      <td>150.00</td>
                      <td>LTR</td>
                      <td className="alignright">30000.00</td>
                    </tr>
                    <tr>
                      <td colSpan="9"></td>
                      <td colSpan="1" className="alignright"><strong>137500.00</strong></td>
                    </tr>

                    <tr>
                      <td></td>
                      <td style={{ textAlign: 'right' }}><strong>OUTPUT CGST @2.5%<br />OUTPUT SGST @2.5%</strong></td>
                      <td></td>
                      <td></td>
                      <td><strong></strong></td>
                      <td><strong></strong></td>
                      <td></td>
                      <td className="center">5% <br /> 5%</td>
                      <td></td>
                      <td className="alignright"><strong>1750.00<br /> 1750.00</strong></td>
                    </tr>

                    <tr>
                      <td></td>
                      <td style={{ textAlign: 'right' }}><strong>OUTPUT CGST @6%<br />OUTPUT SGST @6%</strong></td>
                      <td></td>
                      <td></td>
                      <td><strong></strong></td>
                      <td><strong></strong></td>
                      <td></td>
                      <td className="center">6% <br /> 6%</td>
                      <td></td>
                      <td className="alignright"><strong>2250.00<br /> 2250.00</strong></td>
                    </tr>

                    <tr>
                      <td></td>
                      <td style={{ textAlign: 'right' }}><strong>OUTPUT CGST @9%<br />OUTPUT SGST @9%</strong></td>
                      <td></td>
                      <td></td>
                      <td><strong></strong></td>
                      <td><strong></strong></td>
                      <td></td>
                      <td className="center">9% <br /> 9%</td>
                      <td></td>
                      <td className="alignright"><strong>2700.00<br /> 2700.00</strong></td>
                    </tr>

                    <tr>
                      <td colSpan="2">Total</td>
                      <td></td>
                      <td></td>
                      <td><strong>425.00</strong></td>
                      <td><strong>22.5</strong></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td className="alignright">
                        <strong> ₹ 148900.00</strong>
                      </td>
                    </tr>

                    <tr>
                      <td colSpan="10">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            Amount Chargeable (in words):<br />
                            <strong>One Lakh Forty Eight Thousand Nine Hundred Only</strong>
                            <span style={{ float: 'right' }}> E & O.E</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan="4" rowSpan="2" style={{ textAlign: 'right' }}>
                        Taxable <br />Value
                      </td>
                      <td colSpan="2" className="center">
                        CGST
                      </td>
                      <td colSpan="3" className="center">
                        SGST/UTGST
                      </td>
                      <td colSpan="1" className="center">
                        Amount
                      </td>
                    </tr>
                    <tr>
                      <td className="center">Rate</td>
                      <td className="center">Amount</td>
                      <td className="center">Rate</td>
                      <td className="center" colSpan="2">Amount</td>
                      <td></td>
                    </tr>

                    <tr>
                      <td colSpan="4" style={{ textAlign: 'right' }}><strong>70000.00</strong></td>
                      <td className="center">2.50% </td>
                      <td className="center">1750.00</td>
                      <td className="center">2.50% </td>
                      <td className="center" colSpan="2">1750.00</td>
                      <td colSpan="1" className="alignright">3500.00</td>
                    </tr>

                    <tr>
                      <td colSpan="4" style={{ textAlign: 'right' }}><strong>37500.00</strong></td>
                      <td className="center">6% </td>
                      <td className="center">2250.00</td>
                      <td className="center">6% </td>
                      <td className="center" colSpan="2">2250.00</td>
                      <td colSpan="1" className="alignright">4500.00</td>
                    </tr>

                    <tr>
                      <td colSpan="4" style={{ textAlign: 'right' }}><strong>30000.00</strong></td>
                      <td className="center">9% </td>
                      <td className="center">2700.00</td>
                      <td className="center">9% </td>
                      <td className="center" colSpan="2">2700.00</td>
                      <td colSpan="1" className="alignright">5400.00</td>
                    </tr>

                    <tr>
                      <td colSpan="4" className="alignright"><strong>Total:&nbsp;&nbsp;137500.00</strong> </td>
                      <td></td>
                      <td className="center"><strong>6700.00</strong></td>
                      <td></td>
                      <td colSpan="2" className="center"><strong>6700.00</strong></td>
                      <td className="alignright"><strong>13400.00</strong></td>
                    </tr>
                  </tbody>
                </table>

                <div className="column" style={{ flex: 1 }}>
                  <table className="table table-bordered table-left" style={{ width: '100%' }}>
                    <tbody>
                      <tr>
                        <td>
                          Tax Amount (in words) : <strong>INR Thirteen Thousand Four Hundred Only </strong><br />
                          <span>
                            Remarks:
                            <br />
                            BEING MATERIAL DISPATCH THROUGH VEHICLE NO : KA-01-AB-1234
                          </span>
                          <br />
                          <span style={{ fontSize: '12px' }}>
                            Declaration:
                            <br />
                            We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct. Payment terms: Net 30 days from invoice date. Interest @18% per annum will be charged on overdue payments.
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="column" style={{ flex: 1 }}>
                  <table className="table table-bordered table-right" style={{ width: '100%' }}>
                    <tbody>
                      <tr>
                        <td>
                          Company's Bank Details:<br />
                          A/c Holder's Name: TechCorp Solutions Pvt Ltd<br />
                          Bank Name: <strong>HDFC BANK</strong><br />
                          A/c No: 50100123456789<br />
                          Branch & IFSC Code: <strong>Koramangala & HDFC0001234</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ textAlign: 'right' }}>
                          for TechCorp Solutions Pvt Ltd<br /><br />
                          Authorised Signature
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <table>
                  <tbody>
                    <tr>
                      <td>
                        <p className="center" style={{ fontSize: '12px' }}>SUBJECT TO BANGALORE JURISDICTION<br />This is a Computer Generated Invoice </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
