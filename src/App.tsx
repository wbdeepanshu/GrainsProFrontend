import { useEffect, useState, type ReactNode } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthService } from "@/lib/auth";
import { fetchAndStoreAdminSettings } from "@/lib/adminSettings";
import { useNotificationTitle } from "@/hooks/use-notification-title";
import { useLiveTrackingSession } from "@/hooks/useLiveTrackingSession";
// import { VoiceAssistantProvider } from "@/components/voice-assistant/SimpleVoiceAssistantProvider";
import Login from "@/pages/login.jsx";
import Signup from "@/pages/signup.jsx";
import ForgotPassword from "@/pages/forgot-password.tsx";
import Dashboard from "@/pages/dashboard.tsx";
import ImportData from "@/pages/import-data.jsx";
import UserList from "@/pages/user-list.jsx";
import GodownMasters from "@/pages/godown-masters.jsx";
import AreaListing from "@/pages/area-listing.jsx";
import StockMasters from "@/pages/stock-masters.jsx";
import BrokerMasters from "@/pages/broker-masters.jsx";
import ItemMasters from "@/pages/item-masters.jsx";
import LedgerMasters from "@/pages/ledger-masters.jsx";
import LedgersGroup from "@/pages/ledgers-group.jsx";
import AdditionalLedgers from "@/pages/additional-ledgers.jsx";
import LedgerCreditSettings from "@/pages/ledger-credit-settings.jsx";
import LabTestParams from "@/pages/lab-test-params.jsx";
import ItemsMapping from "@/pages/items-mapping.jsx";
import AllItemMapping from "@/pages/all-item-mapping.jsx";
import VoucherSettings from "@/pages/voucher-settings.jsx";
import AddInward from "@/pages/add-inward.jsx";
import AddUser from "@/pages/add-user.jsx"
import InwardList from "@/pages/inward-list.jsx";
import PurchaseInvoices from "@/pages/purchase-invoices.jsx";
import InwardReports from "@/pages/inward-reports.jsx";
import OutwardList from "@/pages/outward-list.jsx";
import OutwardDetails from "@/pages/outward-details.jsx";
import AddOutward from "@/pages/add-outward.jsx";
import LoadingBatches from "@/pages/loading-batches.jsx";
import DeliveryNotes from "@/pages/delivery-notes.jsx";
import Invoices from "@/pages/invoices.jsx";
import GatePassPDFView from "@/pages/gate-pass-pdf-view.jsx";
import DeliveryNotePDFView from "@/pages/delivery-note-pdf-view.jsx";
import StockJournal from "@/pages/stock-journal.jsx";
import AddStockJournal from "@/pages/add-stock-journal.jsx";
import ProcessStockFlowReport from "@/pages/process-stock-flow-report.jsx";
import HamaliReports from "@/pages/hamali-reports.jsx";
import HamaliDetails from "@/pages/hamali-details.jsx";
import AddHamali from "@/pages/add-hamali.jsx";
import NotFound from "@/pages/not-found.tsx";
import purchaseorders from "@/pages/purchaseorders-reports.jsx";
import PurchaseRegister from "@/pages/purchase-register.jsx";
import SalesRegister from "@/pages/sales-register.jsx";
import SalesMasterReport from "@/pages/sales-master-report.jsx";
import ApmcPermitReport from "@/pages/apmc-permit-report.jsx";
import SoDeviationReport from "@/pages/so-deviation-report.jsx";
import PoDeviationReport from "@/pages/po-deviation-report.jsx";
import SoQuotations from "@/pages/so-quotations.jsx";
import CreateSoQuotation from "@/pages/create-so-quotation.jsx";
import POReports from "@/pages/po-reports.jsx";
import LabTestReport from "@/pages/lab-test-report.jsx";
import UnloadingReport from "@/pages/unloading-report.jsx";
import LoadingReport from "@/pages/loading-report.jsx";
import SalesOrderDispatchReport from "@/pages/sales-order-dispatch-report.jsx";
import ProductionReport from "@/pages/production-report.jsx";
import InwardDetails from "@/pages/inward-details.jsx";
import AddPurchaseOrder from "@/pages/add-purchase-order.jsx";
import PurchaseReturnReports from "@/pages/purchase-return-reports.jsx";
import AddPurchaseReturn from "@/pages/add-purchase-return.jsx";
import SalesReturnReports from "@/pages/sales-return-reports.jsx";
import AddSalesReturn from "@/pages/add-sales-return.jsx";
import ExpenseList from "@/pages/expense-list.jsx";
import SalesOrderList from "@/pages/sales-order-list.jsx";
import RouteAssignment from "@/pages/route-assignment.jsx";
import RouteManagement from "@/pages/route-management.jsx";
import LogisticsProvidersPage from "@/pages/logistics-providers.jsx";
import LogisticsDriversPage from "@/pages/logistics-drivers.jsx";
import LogisticsVehiclesPage from "@/pages/logistics-vehicles.jsx";
import LogisticsServiceableRoutesPage from "@/pages/logistics-serviceable-routes.jsx";
import RouteActivity from "@/pages/route-activity.jsx";
import RouteActivities from "@/pages/route-activities.jsx";
import LiveTracking from "@/pages/live-tracking.jsx";
import CreateSalesOrder from "@/pages/create-sales-order.jsx";
import PromotionalActivity from "@/pages/promotional-activity.jsx";
import PromotionalTemplates from "@/pages/promotional_templates.jsx";
import PromotionalSendMessages from "@/pages/promotional_send_messages.jsx";
import PromotionalSendHistory from "@/pages/promotional_send_history.jsx";
import AddExpense from "@/pages/add-expense.jsx";
import ReceiptList from "@/pages/receipt-list.jsx";
import AddReceipt from "@/pages/add-receipt.jsx";
import UpdateReceipt from "@/pages/update-receipt.jsx";
import HamaliTypeMasters from "@/pages/hamali-type-masters.jsx";
import ExpenseTypeMasters from "@/pages/expense-type-masters.jsx";
import KycDocumentTypeMasters from "@/pages/kyc-document-type-masters.jsx";
import RetailersInfo from "@/pages/retailers-info.jsx";
import GstMasters from "@/pages/gst-masters.jsx";
import BranchSettings from "@/pages/branch-settings.jsx";
import ItemPriceMargin from "@/pages/item-price-margin.jsx";
import PriceMaster from "@/pages/price-master.jsx";
import BrokerageConfiguration from "@/pages/brokerage-configuration.jsx";
import BrokerageReports from "@/pages/brokerage-reports.jsx";
import BrokerageReportBrokerDetail from "@/pages/brokerage-report-broker-detail.jsx";
import RouteActivityReport from "@/pages/route-activity-report.jsx";
import ItemListing from "@/pages/item-listing.jsx";
import RecentActivity from "@/pages/recent-activity.jsx";
import MachineReports from "@/pages/machine-reports.jsx";
import MachineParams from "@/pages/machine-params.jsx";
import ErrorBoundary from "@/components/common/error-boundary.jsx";
import Banners from "@/pages/banners.jsx";
import LiveStocks from "@/pages/live-stocks.jsx";
import CustomerAnalysis from "@/pages/customer-analysis.jsx";
import SalesmanAnalysis from "@/pages/salesman-analysis.jsx";
import SalesTargetList from "@/pages/sales-target-list.jsx";
import UserSalesOrderReport from "@/pages/user-sales-order-report.jsx";
import ItemAnalysis from "@/pages/item-analysis.jsx";
import StockGroupAnalysis from "@/pages/stock-group-analysis.jsx";
import VoucherAnalysis from "@/pages/voucher-analysis.jsx";
import OutstandingReports from "@/pages/outstanding-reports.jsx";
import StockSummaryReport from "@/pages/stock-summary-report.jsx";
import AdminSettings from "@/pages/admin-settings.jsx";
import NotificationSettings from "@/pages/notification-settings.jsx";
import StockAuditing from "@/pages/stock-auditing.jsx";
import ItemTestingList from "@/pages/item-testing-list.jsx";
import AddItemTesting from "@/pages/add-item-testing.jsx";
import VehicleInfoList from "@/pages/vehicle-info-list.jsx";
import AddVehicleInfo from "@/pages/add-vehicle-info.jsx";
import LabourManagement from "@/pages/labour-management.jsx";
import StockTransfer from "@/pages/stock-transfer.jsx";
import StockTransferVoucherPDFView from "@/pages/stock-transfer-voucher-pdf-view.jsx";
import SuperAdminLogin from "@/pages/superadmin/login.jsx";
import SuperAdminDashboard from "@/pages/superadmin/dashboard.jsx";
import SuperAdminOrganizations from "@/pages/superadmin/organizations.jsx";
import SuperAdminBranches from "@/pages/superadmin/branches.jsx";
import SuperAdminAllUsers from "@/pages/superadmin/all-users.jsx";
import SuperAdminAdminList from "@/pages/superadmin/admin-list.jsx";
import SuperAdminEditAdmin from "@/pages/superadmin/edit-admin.jsx";
import SuperAdminAddAdmin from "@/pages/superadmin/add-admin.jsx";
import SuperAdminTallyConfig from "@/pages/superadmin/tally-config.jsx";
import SuperAdminAnalysisReports from "@/pages/superadmin/analysis-reports.jsx";
import SuperAdminVoucherTypes from "@/pages/superadmin/voucher-types.jsx";
import SuperAdminStockJournalReports from "@/pages/superadmin/stock-journal-reports.jsx";
import SuperAdminOnboardingDesign from "@/pages/superadmin/onboarding-design.jsx";
import SuperAdminAdminSettings from "@/pages/superadmin/admin-settings.jsx";
import Sidebar, { SidebarShellContext } from "@/components/layout/sidebar";
import AppNavigationShortcuts from "@/components/layout/AppNavigationShortcuts";
import { PageLoaderHost } from "@/components/common/loader";
import KeyboardShortcuts from "@/pages/keyboard-shortcuts.jsx";

// import ComprehensivePricingAnalysis from "@/pages/comprehensive-pricing-analysis.jsx";

import Addprivacy from "@/pages/privacy.jsx";
import ContactUs from "@/pages/contact-us.jsx";
import HelpVideos from "@/pages/help-videos.jsx";
// Protected route wrapper
function ProtectedRoute({ component: Component, ...props }: any) {
  const isAuthenticated = AuthService.isAuthenticated();

  if (!isAuthenticated) {
    return <Login />;
  }

  return <Component {...props} />;
}

function ShellGate({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [showSidebar, setShowSidebar] = useState(
    () => window.innerWidth >= 768
  );

  useEffect(() => {
    const onResize = () => setShowSidebar(window.innerWidth >= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const bare =
    location === "/" ||
    location === "/login" ||
    location.startsWith("/signup") ||
    location.startsWith("/forgot-password") ||
    location.startsWith("/superadmin");

  if (bare || !AuthService.isAuthenticated()) return children;

  return (
    <SidebarShellContext.Provider value={true}>
      <AppNavigationShortcuts />
      <div className="flex h-screen w-full overflow-hidden">
        {showSidebar && <Sidebar owner="shell" />}
        <PageLoaderHost>
          {children}
        </PageLoaderHost>
      </div>
    </SidebarShellContext.Provider>
  );
}

function Router() {
  return (
    // <WouterRouter base="/apps/GrainPro">
    // <WouterRouter base="/">
    <WouterRouter base="/">
      <ShellGate>
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/dashboard">
          <ProtectedRoute component={Dashboard} />
        </Route>
        <Route path="/keyboard-shortcuts">
          <ProtectedRoute component={KeyboardShortcuts} />
        </Route>

        <Route path="/import">
          <ProtectedRoute component={ImportData} />
        </Route>
        <Route path="/users">
          <ProtectedRoute component={UserList} />
        </Route>
        <Route path="/add-user">
          <ProtectedRoute component={AddUser} />
        </Route>
        <Route path="/godown-masters">
          <ProtectedRoute component={GodownMasters} />
        </Route>
        <Route path="/area-listing">
          <ProtectedRoute component={AreaListing} />
        </Route>
        <Route path="/stock-masters">
          <ProtectedRoute component={StockMasters} />
        </Route>
        <Route path="/broker-masters">
          <ProtectedRoute component={BrokerMasters} />
        </Route>
        <Route path="/item-masters">
          <ProtectedRoute component={ItemMasters} />
        </Route>
        <Route path="/lab-test-params">
          <ProtectedRoute component={LabTestParams} />
        </Route>
        <Route path="/machine-params">
          <ProtectedRoute component={MachineParams} />
        </Route>
        <Route path="/ledger-masters">
          <ProtectedRoute component={LedgerMasters} />
        </Route>
        <Route path="/ledgers-group">
          <ProtectedRoute component={LedgersGroup} />
        </Route>
        <Route path="/additional-ledgers">
          <ProtectedRoute component={AdditionalLedgers} />
        </Route>
        <Route path="/ledger-credit-settings">
          <ProtectedRoute component={LedgerCreditSettings} />
        </Route>
        <Route path="/hamali-type-masters">
          <ProtectedRoute component={HamaliTypeMasters} />
        </Route>
        <Route path="/expense-type-masters">
          <ProtectedRoute component={ExpenseTypeMasters} />
        </Route>
        <Route path="/kyc-document-type-masters">
          <ProtectedRoute component={KycDocumentTypeMasters} />
        </Route>
        <Route path="/retailers-info">
          <ProtectedRoute component={RetailersInfo} />
        </Route>
        <Route path="/gst-masters">
          <ProtectedRoute component={GstMasters} />
        </Route>
        <Route path="/items-mapping">
          <ProtectedRoute component={ItemsMapping} />
        </Route>
        <Route path="/all-item-mapping">
          <ProtectedRoute component={AllItemMapping} />
        </Route>
        <Route path="/voucher-settings">
          <ProtectedRoute component={VoucherSettings} />
        </Route>
        <Route path="/banners">
          <ProtectedRoute component={Banners} />
        </Route>
        <Route path="/add-inward">
          <ProtectedRoute component={AddInward} />
        </Route>
        <Route path="/reports/inward-list">
          <ProtectedRoute component={InwardList} />
        </Route>
        <Route path="/reports/purchase-invoices">
          <ProtectedRoute component={PurchaseInvoices} />
        </Route>

        {/* Outward Routes */}
        <Route path="/outward/outward-list">
          <ProtectedRoute component={OutwardList} />
        </Route>
        <Route path="/outward/add-outward">
          <ProtectedRoute component={AddOutward} />
        </Route>
        <Route path="/outward/loading-batches">
          <ProtectedRoute component={LoadingBatches} />
        </Route>
        <Route path="/outward/delivery-notes">
          <ProtectedRoute component={DeliveryNotes} />
        </Route>
        <Route path="/outward/invoices">
          <ProtectedRoute component={Invoices} />
        </Route>
        <Route path="/outward/gate-pass-pdf">
          <ProtectedRoute component={GatePassPDFView} />
        </Route>
        <Route path="/outward/delivery-note-pdf">
          <ProtectedRoute component={DeliveryNotePDFView} />
        </Route>
        <Route path="/outward-details/:id">
          <ProtectedRoute component={OutwardDetails} />
        </Route>

        <Route path="/stock-journal">
          <ProtectedRoute component={StockJournal} />
        </Route>
        <Route path="/stock-journal/add">
          <ProtectedRoute component={AddStockJournal} />
        </Route>
        <Route path="/reports/stock-journal">
          <ProtectedRoute component={StockJournal} />
        </Route>
        <Route path="/reports/process-stock-flow">
          <ProtectedRoute component={ProcessStockFlowReport} />
        </Route>
        <Route path="/reports/hamali">
          <ProtectedRoute component={HamaliReports} />
        </Route>
        <Route path="/reports/hamali/:id">
          <ProtectedRoute component={HamaliDetails} />
        </Route>
        <Route path="/reports/machine-reports">
          <ErrorBoundary>
            <ProtectedRoute component={MachineReports} />
          </ErrorBoundary>
        </Route>
        <Route path="/reports/brokerage-reports/broker/:brokerId">
          <ProtectedRoute component={BrokerageReportBrokerDetail} />
        </Route>
        <Route path="/reports/brokerage-reports">
          <ProtectedRoute component={BrokerageReports} />
        </Route>
        <Route path="/reports/route-activity-report">
          <ProtectedRoute component={RouteActivityReport} />
        </Route>
        <Route path="/add-hamali">
          <ProtectedRoute component={AddHamali} />
        </Route>

        <Route path="/reports/purchaseorders-reports">
          <ProtectedRoute component={purchaseorders} />
        </Route>
        <Route path="/reports/purchase-register">
          <ProtectedRoute component={PurchaseRegister} />
        </Route>
        <Route path="/reports/sales-register">
          <ProtectedRoute component={SalesRegister} />
        </Route>
        <Route path="/reports/sales-master-report">
          <ProtectedRoute component={SalesMasterReport} />
        </Route>
        <Route path="/reports/apmc-permit-report">
          <ProtectedRoute component={ApmcPermitReport} />
        </Route>
        <Route path="/reports/so-deviation-report">
          <ProtectedRoute component={SoDeviationReport} />
        </Route>
        <Route path="/reports/po-deviation-report">
          <ProtectedRoute component={PoDeviationReport} />
        </Route>
        <Route path="/sales/so-quotations">
          <ProtectedRoute component={SoQuotations} />
        </Route>
        <Route path="/sales/create-so-quotation">
          <ProtectedRoute component={CreateSoQuotation} />
        </Route>
        <Route path="/reports/po-reports">
          <ProtectedRoute component={POReports} />
        </Route>
        <Route path="/reports/lab-test-report">
          <ProtectedRoute component={LabTestReport} />
        </Route>
        <Route path="/reports/unloading-report">
          <ProtectedRoute component={UnloadingReport} />
        </Route>
        <Route path="/reports/loading-report">
          <ProtectedRoute component={LoadingReport} />
        </Route>
        <Route path="/reports/sales-order-dispatch-report">
          <ProtectedRoute component={SalesOrderDispatchReport} />
        </Route>
        <Route path="/reports/production-report">
          <ProtectedRoute component={ProductionReport} />
        </Route>

        <Route path="/add-purchase-order">
          <ProtectedRoute component={AddPurchaseOrder} />
        </Route>
        <Route path="/reports/purchase-return-reports">
          <ProtectedRoute component={PurchaseReturnReports} />
        </Route>
        <Route path="/add-purchase-return">
          <ProtectedRoute component={AddPurchaseReturn} />
        </Route>
        <Route path="/reports/sales-return-reports">
          <ProtectedRoute component={SalesReturnReports} />
        </Route>
        <Route path="/add-sales-return">
          <ProtectedRoute component={AddSalesReturn} />
        </Route>

        <Route path="/inward-details/:id">
          <ProtectedRoute component={InwardDetails} />
        </Route>
        <Route path="/privacy" component={Addprivacy} />
        <Route path="/help-videos">
          <ProtectedRoute component={HelpVideos} />
        </Route>
        <Route path="/contact-us" component={ContactUs} />
        <Route path="/admin-settings">
          <ProtectedRoute component={AdminSettings} />
        </Route>
        <Route path="/reports/expense-list">
          <ProtectedRoute component={ExpenseList} />
        </Route>

        <Route path="/reports/sales-order-list">
          <ProtectedRoute component={SalesOrderList} />
        </Route>
        <Route path="/sales/sales-targets">
          <ProtectedRoute component={SalesTargetList} />
        </Route>
        <Route path="/reports/user-sales-order-report">
          <ProtectedRoute component={UserSalesOrderReport} />
        </Route>
        <Route path="/reports/customer-analysis">
          <ProtectedRoute component={CustomerAnalysis} />
        </Route>
        <Route path="/reports/salesman-analysis">
          <ProtectedRoute component={SalesmanAnalysis} />
        </Route>
        <Route path="/reports/item-analysis">
          <ProtectedRoute component={ItemAnalysis} />
        </Route>
        <Route path="/reports/stock-group-analysis">
          <ProtectedRoute component={StockGroupAnalysis} />
        </Route>
        <Route path="/reports/voucher-analysis">
          <ProtectedRoute component={VoucherAnalysis} />
        </Route>
        <Route path="/reports/outstanding-reports">
          <ProtectedRoute component={OutstandingReports} />
        </Route>
        <Route path="/reports/stock-summary">
          <ProtectedRoute component={StockSummaryReport} />
        </Route>

        <Route path="/route-management">
          <ProtectedRoute component={RouteManagement} />
        </Route>

        <Route path="/logistics-management">
          <ProtectedRoute component={LogisticsProvidersPage} />
        </Route>

        <Route path="/logistics/providers">
          <ProtectedRoute component={LogisticsProvidersPage} />
        </Route>

        <Route path="/logistics/drivers">
          <ProtectedRoute component={LogisticsDriversPage} />
        </Route>

        <Route path="/logistics/vehicles">
          <ProtectedRoute component={LogisticsVehiclesPage} />
        </Route>

        <Route path="/logistics/serviceable-routes">
          <ProtectedRoute component={LogisticsServiceableRoutesPage} />
        </Route>

        <Route path="/route-assignment">
          <ProtectedRoute component={RouteAssignment} />
        </Route>

        <Route path="/route-activities">
          <ProtectedRoute component={RouteActivities} />
        </Route>

        <Route path="/route-activity">
          <ProtectedRoute component={RouteActivity} />
        </Route>

        <Route path="/live-tracking">
          <ProtectedRoute component={LiveTracking} />
        </Route>

        <Route path="/create-sales-order/:orderId?">
          <ProtectedRoute component={CreateSalesOrder} />
        </Route>
        <Route path="/promotional-activity">
          <ProtectedRoute component={PromotionalActivity} />
        </Route>
        <Route path="/promotional/templates">
          <ProtectedRoute component={PromotionalTemplates} />
        </Route>
        <Route path="/promotional/send-messages">
          <ProtectedRoute component={PromotionalSendMessages} />
        </Route>
        <Route path="/promotional/send-history">
          <ProtectedRoute component={PromotionalSendHistory} />
        </Route>
        {/* legacy aliases */}
        <Route path="/promotional-templates">
          <ProtectedRoute component={PromotionalTemplates} />
        </Route>

        <Route path="/add-expense">
          <ProtectedRoute component={AddExpense} />
        </Route>
        <Route path="/receipt-list">
          <ProtectedRoute component={ReceiptList} />
        </Route>
        <Route path="/add-receipt">
          <ProtectedRoute component={AddReceipt} />
        </Route>
        <Route path="/update-receipt/:receiptId">
          <ProtectedRoute component={UpdateReceipt} />
        </Route>

        {/* Branch + Margin Settings Routes */}
        <Route path="/branches">
          <ProtectedRoute component={BranchSettings} />
        </Route>
        <Route path="/margin-settings/item-price-margin">
          <ProtectedRoute component={ItemPriceMargin} />
        </Route>
        <Route path="/price-master">
          <ProtectedRoute component={PriceMaster} />
        </Route>
        <Route path="/margin-settings/brokerage-configuration">
          <ProtectedRoute component={BrokerageConfiguration} />
        </Route>
        <Route path="/item-listing">
          <ProtectedRoute component={ItemListing} />
        </Route>
        <Route path="/live-stocks">
          <ProtectedRoute component={LiveStocks} />
        </Route>
        {/* Recent Activity Route */}
        <Route path="/recent-activity">
          <ProtectedRoute component={RecentActivity} />
        </Route>
        <Route path="/notification-settings">
          <ProtectedRoute component={NotificationSettings} />
        </Route>
        <Route path="/stock-auditing">
          <ProtectedRoute component={StockAuditing} />
        </Route>
        <Route path="/item-testing">
          <ProtectedRoute component={ItemTestingList} />
        </Route>
        <Route path="/item-testing/add">
          <ProtectedRoute component={AddItemTesting} />
        </Route>
        <Route path="/vehicle-info">
          <ProtectedRoute component={VehicleInfoList} />
        </Route>
        <Route path="/vehicle-info/add">
          <ProtectedRoute component={AddVehicleInfo} />
        </Route>
        <Route path="/labour-management">
          <ProtectedRoute component={LabourManagement} />
        </Route>
        <Route path="/stock-transfer">
          <ProtectedRoute component={StockTransfer} />
        </Route>
        <Route path="/stock-transfer/voucher-pdf">
          <ProtectedRoute component={StockTransferVoucherPDFView} />
        </Route>

        {/* Super Admin Routes */}
        <Route path="/superadmin/login" component={SuperAdminLogin} />
        <Route path="/superadmin/dashboard" component={SuperAdminDashboard} />
        <Route path="/superadmin/organizations" component={SuperAdminOrganizations} />
        <Route path="/superadmin/branches" component={SuperAdminBranches} />
        <Route path="/superadmin/all-users" component={SuperAdminAllUsers} />
        <Route path="/superadmin/admin-list" component={SuperAdminAdminList} />
        <Route path="/superadmin/edit-admin" component={SuperAdminEditAdmin} />
        <Route path="/superadmin/add-admin" component={SuperAdminAddAdmin} />
        <Route path="/superadmin/tally-config" component={SuperAdminTallyConfig} />
        <Route path="/superadmin/analysis-reports" component={SuperAdminAnalysisReports} />
        <Route path="/superadmin/voucher-types" component={SuperAdminVoucherTypes} />
        <Route path="/superadmin/stock-journals" component={SuperAdminStockJournalReports} />
        <Route path="/superadmin/onboarding-design" component={SuperAdminOnboardingDesign} />
        <Route path="/superadmin/admin-settings" component={SuperAdminAdminSettings} />

        <Route component={NotFound} />
      </Switch>
      </ShellGate>
    </WouterRouter>
  );
}

// Component that uses the notification title hook (must be inside QueryClientProvider)
function AppContent() {
  // Update page title with unread notification count
  useNotificationTitle();
  useLiveTrackingSession();

  useEffect(() => {
    if (AuthService.isAuthenticated()) {
      fetchAndStoreAdminSettings().catch(() => {});
    }
  }, []);

  return (
    <TooltipProvider>
      {/* <VoiceAssistantProvider> */}
        <Toaster />
        <Router />
      {/* </VoiceAssistantProvider> */}
    </TooltipProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
