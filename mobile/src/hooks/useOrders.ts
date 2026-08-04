import { useQuery } from "@tanstack/react-query";

import * as api from "@/api/endpoints";
import { useAuthStore } from "@/stores/authStore";

export function useCustomerOrders() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["orders", "customer", "mine"],
    queryFn: api.listMyCustomerOrders,
    enabled: !!token,
    refetchInterval: 10_000,
  });
}

export function useMerchantOrders() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["orders", "merchant", "mine"],
    queryFn: api.listMyMerchantOrders,
    enabled: !!token,
    refetchInterval: 8_000,
  });
}

export function useShipperOrders() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["orders", "shipper", "mine"],
    queryFn: api.listMyShipperOrders,
    enabled: !!token,
    refetchInterval: 5_000,
  });
}

export function useOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: ["orders", orderId],
    queryFn: () => api.getOrder(orderId as string),
    enabled: !!orderId,
    refetchInterval: 5_000,
  });
}
