import { apiClient } from "@/api/client";
import type {
  Address,
  LiveOrder,
  Merchant,
  Order,
  Product,
  ShipperProfile,
  SummaryReport,
  TokenResponse,
  UserRole,
} from "@/types/api";

// --- auth --------------------------------------------------------------

export async function register(payload: {
  email: string;
  password: string;
  role: UserRole;
  name: string;
  phone?: string;
}): Promise<TokenResponse> {
  const { data } = await apiClient.post("/auth/register", payload);
  return data;
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const { data } = await apiClient.post("/auth/login", { email, password });
  return data;
}

// --- catalog -------------------------------------------------------------

export async function listMerchants(): Promise<Merchant[]> {
  const { data } = await apiClient.get("/catalog/merchants");
  return data;
}

export async function listPublicProducts(merchantId: string): Promise<Product[]> {
  const { data } = await apiClient.get(`/catalog/merchants/${merchantId}/products`);
  return data;
}

export async function listMyProducts(): Promise<Product[]> {
  const { data } = await apiClient.get("/catalog/products/mine");
  return data;
}

export async function createProduct(payload: {
  name: string;
  price: number;
  stock_qty: number;
  image_url?: string;
}): Promise<Product> {
  const { data } = await apiClient.post("/catalog/products", payload);
  return data;
}

export async function updateProduct(
  productId: string,
  payload: Partial<{ name: string; price: number; stock_qty: number; status: string }>
): Promise<Product> {
  const { data } = await apiClient.patch(`/catalog/products/${productId}`, payload);
  return data;
}

// --- orders ----------------------------------------------------------------

export async function createOrder(payload: {
  merchant_id: string;
  items: { product_id: string; qty: number }[];
  pickup_addr: Address;
  dropoff_addr: Address;
  payment_method: string;
}): Promise<Order> {
  const { data } = await apiClient.post("/orders", payload);
  return data;
}

export async function getOrder(orderId: string): Promise<Order> {
  const { data } = await apiClient.get(`/orders/${orderId}`);
  return data;
}

export async function listMyCustomerOrders(): Promise<Order[]> {
  const { data } = await apiClient.get("/orders/customer/mine");
  return data;
}

export async function listMyMerchantOrders(): Promise<Order[]> {
  const { data } = await apiClient.get("/orders/merchant/mine");
  return data;
}

export async function listMyShipperOrders(): Promise<Order[]> {
  const { data } = await apiClient.get("/orders/shipper/mine");
  return data;
}

export async function confirmOrder(orderId: string): Promise<Order> {
  const { data } = await apiClient.post(`/orders/${orderId}/confirm`);
  return data;
}

export async function rejectOrder(orderId: string, reason?: string): Promise<Order> {
  const { data } = await apiClient.post(`/orders/${orderId}/reject`, { reason });
  return data;
}

export async function cancelOrder(orderId: string): Promise<Order> {
  const { data } = await apiClient.post(`/orders/${orderId}/cancel`);
  return data;
}

export async function pickupOrder(orderId: string): Promise<Order> {
  const { data } = await apiClient.post(`/orders/${orderId}/pickup`);
  return data;
}

export async function startDelivery(orderId: string): Promise<Order> {
  const { data } = await apiClient.post(`/orders/${orderId}/start-delivery`);
  return data;
}

export async function completeOrder(orderId: string): Promise<Order> {
  const { data } = await apiClient.post(`/orders/${orderId}/complete`);
  return data;
}

export async function failOrder(orderId: string, reason?: string): Promise<Order> {
  const { data } = await apiClient.post(`/orders/${orderId}/fail`, { reason });
  return data;
}

// --- shippers ----------------------------------------------------------------

export async function getMyShipperProfile(): Promise<ShipperProfile> {
  const { data } = await apiClient.get("/shippers/me");
  return data;
}

export async function setShipperStatus(status: "offline" | "available"): Promise<ShipperProfile> {
  const { data } = await apiClient.post("/shippers/me/status", { status });
  return data;
}

export async function pingShipperLocation(lat: number, lng: number): Promise<ShipperProfile> {
  const { data } = await apiClient.post("/shippers/me/location", { lat, lng });
  return data;
}

// --- matching ----------------------------------------------------------------

export async function acceptOffer(orderId: string): Promise<void> {
  await apiClient.post("/matching/offers/accept", { order_id: orderId });
}

export async function declineOffer(orderId: string): Promise<void> {
  await apiClient.post("/matching/offers/decline", { order_id: orderId });
}

// --- ops ----------------------------------------------------------------

export async function opsLiveOrders(): Promise<LiveOrder[]> {
  const { data } = await apiClient.get("/ops/orders/live");
  return data;
}

export async function opsSummary(): Promise<SummaryReport> {
  const { data } = await apiClient.get("/ops/reports/summary");
  return data;
}

export async function opsComplaints(): Promise<unknown[]> {
  const { data } = await apiClient.get("/ops/complaints");
  return data;
}
