import React, { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2, IndianRupee, FileText, Percent, LayoutDashboard, Package, User, Download } from "lucide-react";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { fetchOrgInfo, getOrgInfoSync } from "@/lib/orgInfo";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

function formatCurrency(amount) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (num === null || num === undefined || isNaN(num)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export default function BrokerageReportBrokerDetail() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();

  // Route: /reports/brokerage-reports/broker/:brokerId
  const [, params] = useRoute("/reports/brokerage-reports/broker/:brokerId");
  const searchString = typeof window !== "undefined" ? window.location.search : "";
  const brokerId = params?.brokerId;

  const queryParams = useMemo(() => {
    const sp = new URLSearchParams(searchString || "");
    return {
      start_date: sp.get("start_date") || "",
      end_date: sp.get("end_date") || "",
      module: sp.get("module") || "sales_orders",
    };
  }, [searchString]);

  const getInitialModule = () => {
    const sp = new URLSearchParams(searchString || "");
    const m = sp.get("module");
    return m === "purchase_orders" || m === "sales_orders" ? m : "sales_orders";
  };

  const [selectedModule, setSelectedModule] = useState(getInitialModule);

  useEffect(() => {
    const m = queryParams.module;
    if (m === "purchase_orders" || m === "sales_orders") setSelectedModule(m);
  }, [queryParams.module]);

  const { data: detailData, isLoading, error } = useQuery({
    queryKey: [
      `${API_BASE_URL}/api/accounts/brokerage-report/broker-wise/`,
      brokerId,
      queryParams.start_date,
      queryParams.end_date,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        broker_id: brokerId,
        start_date: queryParams.start_date,
        end_date: queryParams.end_date,
      });
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/accounts/brokerage-report/broker-wise/?${params.toString()}`
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Failed to fetch broker report");
      }
      const data = await response.json();
      const d = data.data || {};
      return {
        broker_id: d.broker_id,
        broker_name: d.broker_name,
        start_date: d.start_date,
        end_date: d.end_date,
        purchase_orders: d.purchase_orders || { summary: {}, orders: [] },
        sales_orders: d.sales_orders || { summary: {}, orders: [] },
        outward_orders: d.outward_orders || { summary: {}, orders: [] },
      };
    },
    enabled:
      AuthService.isAuthenticated() &&
      hasPermission("brokerage", "read") &&
      !!brokerId &&
      !!queryParams.start_date &&
      !!queryParams.end_date,
  });

  const moduleConfig = {
    purchase_orders: { label: "Purchase Orders", key: "purchase_orders" },
    sales_orders: { label: "Sales Orders", key: "sales_orders" },
    // outward_orders: { label: "Outward Orders", key: "outward_orders" },
  };
  const currentModuleData = detailData?.[selectedModule] || { summary: {}, orders: [] };
  const summary = currentModuleData.summary || {};
  const orders = currentModuleData.orders || [];
  const brokerName = detailData?.broker_name || brokerId;
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleBack = () => {
    const q = queryParams.start_date && queryParams.end_date
      ? `?start_date=${queryParams.start_date}&end_date=${queryParams.end_date}`
      : "";
    setLocation(`/reports/brokerage-reports${q}`);
  };

  // PDF Generation (same format as inward-details)
  const generatePDF = async () => {
    if (!detailData) return;
    setIsGeneratingPDF(true);
    try {
      const { default: jsPDF } = await import("jspdf");

      let orgName = getOrgInfoSync()?.organization || "";
      let branchName = getOrgInfoSync()?.branch || "";
      if (!orgName || !branchName) {
        const token = AuthService.getAccessToken();
        const fetched = await fetchOrgInfo(API_BASE_URL, token);
        orgName = fetched?.organization || orgName;
        branchName = fetched?.branch || branchName;
      }

      let generatedBy = "";
      try {
        const userDataStr = localStorage.getItem("cp_manager_user_data");
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          generatedBy = userData?.name || "";
        }
      } catch (_) {}

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let currentY = margin;

      const checkPageBreak = (requiredHeight) => {
        if (currentY + requiredHeight > pageHeight - margin) {
          pdf.addPage();
          currentY = margin;
          return true;
        }
        return false;
      };

      const addText = (text, fontSize, isBold = false, color = [0, 0, 0], align = "left") => {
        if (!text) return currentY;
        pdf.setFontSize(fontSize);
        pdf.setFont("helvetica", isBold ? "bold" : "normal");
        pdf.setTextColor(color[0], color[1], color[2]);
        const lines = pdf.splitTextToSize(String(text), contentWidth);
        const lineHeight = fontSize * 0.4;
        checkPageBreak(lineHeight * lines.length);
        lines.forEach((line) => {
          if (currentY + lineHeight > pageHeight - margin) {
            pdf.addPage();
            currentY = margin;
          }
          const xPos = align === "center" ? pageWidth / 2 : margin;
          pdf.text(String(line), xPos, currentY, { align });
          currentY += lineHeight;
        });
        return currentY;
      };

      const addLine = () => {
        checkPageBreak(5);
        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 5;
      };

      // Header
      if (orgName || branchName) {
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(30, 64, 175);
        if (orgName) {
          checkPageBreak(8);
          pdf.text(orgName, pageWidth / 2, currentY, { align: "center" });
          currentY += 6;
        }
        if (branchName) {
          pdf.setFontSize(12);
          pdf.text(branchName, pageWidth / 2, currentY, { align: "center" });
          currentY += 8;
        }
      }

      // Title
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 64, 175);
      checkPageBreak(10);
      const moduleLabel = moduleConfig[selectedModule]?.label || selectedModule;
      pdf.text(`BROKER-WISE REPORT — ${moduleLabel.toUpperCase()}`, pageWidth / 2, currentY, { align: "center" });
      currentY += 8;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(107, 114, 128);
      const subInfo = `${brokerName} · ${moduleLabel} · ${detailData.start_date || ""} to ${detailData.end_date || ""} | Generated by: ${generatedBy || "N/A"} | ${new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;
      addText(subInfo, 10, false, [107, 114, 128], "center");
      currentY += 5;
      addLine();

      // Summary section — two columns with fixed label/value widths to avoid overlap
      checkPageBreak(40);
      const summaryColWidth = contentWidth / 2;
      const summaryLabelWidth = 52;
      const summaryValueWidth = summaryColWidth - summaryLabelWidth - 4;
      const summaryRows = [
        ["Total Order Amount:", summary.total_order_amount, "Approved Order Amount:", summary.total_approved_order_amount],
        ["Total Brokerage:", summary.total_brokerage_amount, "Orders:", String(summary.order_count ?? 0)],
      ];
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      summaryRows.forEach((row) => {
        const rowValueLines = [
          pdf.splitTextToSize(String(row[1] || ""), summaryValueWidth),
          pdf.splitTextToSize(String(row[3] || ""), summaryValueWidth),
        ];
        const maxRowHeight = Math.max(7, rowValueLines[0].length * 4 + 2, rowValueLines[1].length * 4 + 2);
        checkPageBreak(maxRowHeight);
        // Column 1: label then value
        pdf.setFont("helvetica", "bold");
        pdf.text(String(row[0]), margin, currentY, { align: "left", maxWidth: summaryLabelWidth });
        pdf.setFont("helvetica", "normal");
        rowValueLines[0].forEach((line, lineIndex) => {
          pdf.text(line, margin + summaryLabelWidth + 2, currentY + lineIndex * 4, { align: "left", maxWidth: summaryValueWidth });
        });
        // Column 2: label then value
        pdf.setFont("helvetica", "bold");
        pdf.text(String(row[2]), margin + summaryColWidth, currentY, { align: "left", maxWidth: summaryLabelWidth });
        pdf.setFont("helvetica", "normal");
        rowValueLines[1].forEach((line, lineIndex) => {
          pdf.text(line, margin + summaryColWidth + summaryLabelWidth + 2, currentY + lineIndex * 4, { align: "left", maxWidth: summaryValueWidth });
        });
        currentY += maxRowHeight;
      });
      currentY += 10;

      // Orders — table with proper column widths (sum = contentWidth 180mm), vertical separators
      if (orders.length > 0) {
        addLine();
        // Item, Qty, App Qty, Rate, Amount, App Amt, Brokerage, App Broker — total 180
        const colWidths = [50, 14, 14, 18, 22, 22, 20, 20];
        const headerCells = ["Item", "Qty", "App Qty", "Rate", "Amount", "App Amt", "Brokerage", "App Broker"];
        const rowHeight = 8;
        const tableFontSize = 8;

        orders.forEach((order, orderIndex) => {
          checkPageBreak(55);
          pdf.setFontSize(12);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(30, 64, 175);
          const orderTitle = `${order.order_id} · ${order.order_date || "—"} · ${order.customer_name || "—"}`;
          const orderTitleLines = pdf.splitTextToSize(orderTitle, contentWidth);
          orderTitleLines.forEach((line) => {
            checkPageBreak(5);
            pdf.text(line, margin, currentY);
            currentY += 5;
          });
          currentY += 4;

          const items = order.items || [];
          if (items.length > 0) {
            // Table header with borders and vertical lines
            checkPageBreak(rowHeight + 6);
            pdf.setFontSize(tableFontSize);
            pdf.setFillColor(249, 250, 251);
            pdf.rect(margin, currentY - 3, contentWidth, rowHeight, "F");
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(margin, currentY - 3, contentWidth, rowHeight, "S");
            let cellX = margin;
            for (let c = 0; c < colWidths.length; c++) {
              pdf.line(cellX, currentY - 3, cellX, currentY + rowHeight - 3);
              pdf.setFont("helvetica", "bold");
              pdf.text(headerCells[c], cellX + 2, currentY + 2, { align: "left", maxWidth: colWidths[c] - 4 });
              cellX += colWidths[c];
            }
            pdf.line(cellX, currentY - 3, cellX, currentY + rowHeight - 3);
            currentY += rowHeight;

            items.forEach((item) => {
              checkPageBreak(rowHeight);
              pdf.setFont("helvetica", "normal");
              pdf.setFillColor(255, 255, 255);
              pdf.rect(margin, currentY - 2, contentWidth, rowHeight, "F");
              pdf.setDrawColor(200, 200, 200);
              pdf.rect(margin, currentY - 2, contentWidth, rowHeight, "S");
              pdf.line(margin, currentY - 2, margin + contentWidth, currentY - 2);
              cellX = margin;
              const rowData = [
                item.stock_item_name || "—",
                String(item.quantity ?? ""),
                String(item.approved_quantity ?? ""),
                item.rate,
                item.amount,
                item.approved_amount,
                item.brokerage_amount,
                item.approved_brokerage_amount,
              ];
              for (let c = 0; c < rowData.length; c++) {
                pdf.line(cellX, currentY - 2, cellX, currentY + rowHeight - 2);
                const w = colWidths[c];
                const text = pdf.splitTextToSize(String(rowData[c]), w - 4);
                pdf.text(text[0] || "", cellX + 2, currentY + 2, { align: "left", maxWidth: w - 4 });
                cellX += w;
              }
              pdf.line(cellX, currentY - 2, cellX, currentY + rowHeight - 2);
              pdf.line(margin, currentY + rowHeight - 2, margin + contentWidth, currentY + rowHeight - 2);
              currentY += rowHeight;
            });

            // Order totals — two lines to avoid cut-off and overlap
            currentY += 4;
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(tableFontSize);
            pdf.text(`Order total: ${order.total_order_amount}  |  Approved total: ${order.total_approved_order_amount}`, margin, currentY);
            currentY += 5;
            pdf.text(`Brokerage: ${order.total_brokerage_amount}  |  Approved brokerage: ${order.total_approved_brokerage_amount}`, margin, currentY);
            currentY += 8;
          }
          if (orderIndex < orders.length - 1) currentY += 6;
        });
      }

      const moduleSlug = (moduleConfig[selectedModule]?.label || selectedModule).replace(/\s+/g, "-");
      pdf.save(`Broker-wise-Report-${moduleSlug}-${brokerName.replace(/\s+/g, "-")}-${detailData.start_date || ""}-to-${detailData.end_date || ""}.pdf`);
    } catch (err) {
      console.error("Error generating PDF:", err);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  React.useEffect(() => {
    if (permissionsLoading) return;
    if (!hasPermission("brokerage", "read")) {
      setLocation("/dashboard");
    }
  }, [hasPermission, permissionsLoading, setLocation]);

  if (permissionsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!hasPermission("brokerage", "read")) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      {!isMobile && <Sidebar />}
      {isMobile && <MobileSidebar />}

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Broker-wise Report</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {brokerName} · {detailData?.start_date || ""} to {detailData?.end_date || ""}
                </p>
              </div>
            </div>
            {detailData && (
              <Button
                onClick={generatePDF}
                disabled={isGeneratingPDF}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Download className="h-4 w-4" />
                <span>{isGeneratingPDF ? "Generating..." : "Download PDF"}</span>
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {error && (
              <Card className="border-destructive">
                <CardContent className="pt-6">
                  <p className="text-sm text-destructive">{error.message}</p>
                </CardContent>
              </Card>
            )}

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            ) : detailData ? (
              <>
                {/* Module selector */}
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Module</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(moduleConfig).map(([key, { label }]) => (
                        <Button
                          key={key}
                          variant={selectedModule === key ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedModule(key)}
                          className={selectedModule === key ? "bg-blue-600 hover:bg-blue-700" : ""}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Summary for selected module */}
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {moduleConfig[selectedModule]?.label || selectedModule} — Summary
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Order Amount */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <IndianRupee className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Total Order Amount
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatCurrency(summary.total_order_amount)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Approved Order Amount */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                        <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Approved Order Amount
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatCurrency(summary.total_approved_order_amount)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Total Brokerage */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                        <Percent className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Total Brokerage
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatCurrency(summary.total_brokerage_amount)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Orders */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                        <LayoutDashboard className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Orders
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {summary.order_count ?? 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Orders list for selected module */}
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {moduleConfig[selectedModule]?.label || selectedModule} — Orders
                </p>
                <div className="space-y-6">
                  {orders.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center text-muted-foreground">
                        No orders in the selected period.
                      </CardContent>
                    </Card>
                  ) : (
                    orders.map((order) => (
                      <Card key={order.order_id} className="overflow-hidden">
                        <CardHeader className="bg-gray-50/80 border-b py-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <Package className="h-5 w-5" />
                              {order.order_id}
                            </CardTitle>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>{order.order_date || "—"}</span>
                              {order.customer_name && (
                                <span className="flex items-center gap-1">
                                  <User className="h-4 w-4" />
                                  {order.customer_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50">
                                  <TableHead>Item</TableHead>
                                  <TableHead className="text-right">Qty</TableHead>
                                  <TableHead className="text-right">Approved Qty</TableHead>
                                  <TableHead className="text-right">Rate</TableHead>
                                  <TableHead className="text-right">Amount</TableHead>
                                  <TableHead className="text-right">Approved Amount</TableHead>
                                  <TableHead className="text-right">Brokerage</TableHead>
                                  <TableHead className="text-right">Approved Brokerage</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {order.items?.map((item, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="font-medium">{item.stock_item_name || "—"}</TableCell>
                                    <TableCell className="text-right">{item.quantity}</TableCell>
                                    <TableCell className="text-right">{item.approved_quantity}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.rate)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.approved_amount)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.brokerage_amount)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.approved_brokerage_amount)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          <div className="border-t bg-muted/30 px-4 py-3 flex flex-wrap gap-6 justify-end text-sm font-medium">
                            <span>Order total: {formatCurrency(order.total_order_amount)}</span>
                            <span>Approved total: {formatCurrency(order.total_approved_order_amount)}</span>
                            <span>Brokerage: {formatCurrency(order.total_brokerage_amount)}</span>
                            <span>Approved brokerage: {formatCurrency(order.total_approved_brokerage_amount)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
