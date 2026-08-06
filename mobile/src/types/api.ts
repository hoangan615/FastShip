export type UserRole = "customer" | "merchant" | "shipper" | "ops";

export type OrderStatus =
  | "pending_confirmation"
  | "pending"
  | "assigned"
  | "picked_up"
  | "delivering"
  | "completed"
  | "failed"
  | "cancelled"
  | "rejected";

export type ProductStatus = "active" | "out_of_stock" | "hidden";
export type ShipperStatus = "offline" | "available" | "busy";
export type PaymentMethod = "cod" | "wallet" | "card";

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  user_id: string;
}

export interface Merchant {
  id: string;
  name: string;
  address: string;
  status: string;
}

export interface Product {
  id: string;
  merchant_id: string;
  name: string;
  price: string;
  stock_qty: number;
  status: ProductStatus;
  image_url: string | null;
}

export interface Address {
  address: string;
  lat: number;
  lng: number;
}

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
}

export interface Order {
  id: string;
  source: string;
  customer_id: string;
  merchant_id: string;
  shipper_id: string | null;
  status: OrderStatus;
  pickup_addr: Address;
  dropoff_addr: Address;
  subtotal: string;
  shipping_fee: string;
  commission_rate: string;
  merchant_payout: string;
  shipper_payout: string;
  cod_amount: string | null;
  sla_deadline: string | null;
  created_at: string;
  assigned_at: string | null;
  confirmed_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
}

export interface ShipperProfile {
  id: string;
  status: ShipperStatus;
  current_lat: string | null;
  current_lng: string | null;
  rating: string;
  vehicle_type: string;
  active_order_id: string | null;
}

export interface LiveOrder {
  id: string;
  status: OrderStatus;
  merchant_id: string;
  customer_id: string;
  shipper_id: string | null;
  created_at: string;
  sla_deadline: string | null;
}

export interface Rating {
  id: string;
  order_id: string;
  shipper_id: string;
  score: number;
  comment: string | null;
  created_at: string;
}

export interface MerchantRevenueReport {
  total_orders: number;
  completed_orders: number;
  total_revenue: string;
  commission_rate: string;
  pending_payout: string;
  released_payout: string;
}

export interface ShipperRevenueReport {
  total_deliveries: number;
  pending_payout: string;
  released_payout: string;
}

export interface OrderQuote {
  shipping_fee: string;
  distance_km: number;
}

export interface PlatformSettings {
  shipping_base_fee: string;
  shipping_per_km_rate: string;
}

export interface MerchantAdmin {
  id: string;
  name: string;
  status: string;
  commission_rate: string;
}

export interface HeatmapCell {
  lat_bucket: number;
  lng_bucket: number;
  shipper_count: number;
}

export interface SummaryReport {
  total_orders: number;
  completed_orders: number;
  failed_orders: number;
  active_orders: number;
  total_revenue: string;
  disputed_payments: number;
}
