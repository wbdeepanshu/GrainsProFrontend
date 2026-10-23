import { apiRequest } from "@/lib/queryClient";
import { apiUrl, parseJsonResponse } from "@/lib/api";

export async function fetchOrganizationLogo() {
  return null;
}

export async function fetchSalesOrderDetail(orderId) {
  const res = await apiRequest(
    "GET",
    apiUrl(`/api/sales/get-sales-order-details/${encodeURIComponent(orderId)}/`),
  );
  return parseJsonResponse(res);
}

export async function fetchPurchaseOrderDetail(orderId) {
  const res = await apiRequest(
    "GET",
    apiUrl(`/api/report/get-purchase-order-details/${encodeURIComponent(orderId)}/`),
  );
  return parseJsonResponse(res);
}
