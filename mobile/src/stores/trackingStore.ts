import { create } from "zustand";

interface ShipperLocation {
  lat: number;
  lng: number;
}

interface TrackingState {
  orderStatusById: Record<string, string>;
  shipperLocationById: Record<string, ShipperLocation>;
  setOrderStatus: (orderId: string, status: string) => void;
  setShipperLocation: (shipperId: string, lat: number, lng: number) => void;
  applyResync: (snapshot: {
    order_id: string;
    status: string;
    shipper_id: string | null;
    shipper_location?: ShipperLocation;
  }) => void;
}

export const useTrackingStore = create<TrackingState>((set) => ({
  orderStatusById: {},
  shipperLocationById: {},
  setOrderStatus: (orderId, status) =>
    set((state) => ({ orderStatusById: { ...state.orderStatusById, [orderId]: status } })),
  setShipperLocation: (shipperId, lat, lng) =>
    set((state) => ({
      shipperLocationById: { ...state.shipperLocationById, [shipperId]: { lat, lng } },
    })),
  applyResync: (snapshot) =>
    set((state) => ({
      orderStatusById: { ...state.orderStatusById, [snapshot.order_id]: snapshot.status },
      shipperLocationById:
        snapshot.shipper_id && snapshot.shipper_location
          ? {
              ...state.shipperLocationById,
              [snapshot.shipper_id]: snapshot.shipper_location,
            }
          : state.shipperLocationById,
    })),
}));
