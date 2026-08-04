import { useEffect } from "react";

import { connectSocket, getSocket, joinOrderRoom, requestResync } from "@/api/ws";
import { useTrackingStore } from "@/stores/trackingStore";

/**
 * Subscribes to realtime order-status and shipper-location updates for a
 * single order for the lifetime of the calling screen, requesting a
 * resync snapshot on mount so the UI is correct even if events were
 * missed while the screen was closed.
 */
export function useOrderTracking(orderId: string | undefined) {
  const status = useTrackingStore((s) => (orderId ? s.orderStatusById[orderId] : undefined));
  const setOrderStatus = useTrackingStore((s) => s.setOrderStatus);
  const setShipperLocation = useTrackingStore((s) => s.setShipperLocation);
  const applyResync = useTrackingStore((s) => s.applyResync);

  useEffect(() => {
    if (!orderId) return;

    connectSocket();
    joinOrderRoom(orderId);
    requestResync(orderId);

    const socket = getSocket();

    const onStatusChanged = (data: { order_id: string; status: string }) => {
      if (data.order_id === orderId) setOrderStatus(data.order_id, data.status);
    };
    const onLocationUpdate = (data: { shipper_id: string; lat: number; lng: number }) => {
      setShipperLocation(data.shipper_id, data.lat, data.lng);
    };
    const onResync = (data: {
      order_id: string;
      status: string;
      shipper_id: string | null;
      shipper_location?: { lat: number; lng: number };
    }) => {
      if (data.order_id === orderId) applyResync(data);
    };

    socket.on("order.status_changed", onStatusChanged);
    socket.on("shipper.location_update", onLocationUpdate);
    socket.on("resync", onResync);

    return () => {
      socket.off("order.status_changed", onStatusChanged);
      socket.off("shipper.location_update", onLocationUpdate);
      socket.off("resync", onResync);
    };
  }, [orderId, setOrderStatus, setShipperLocation, applyResync]);

  return { status };
}
