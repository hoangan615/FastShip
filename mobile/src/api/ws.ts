import { io, Socket } from "socket.io-client";

import { API_BASE_URL } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(API_BASE_URL, {
    path: "/socket.io",
    transports: ["websocket"],
    autoConnect: false,
  });

  socket.on("connect", () => {
    const token = useAuthStore.getState().token;
    if (token) {
      socket?.emit("auth", { token });
    }
  });

  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) s.connect();
}

export function disconnectSocket(): void {
  socket?.disconnect();
}

export function joinOrderRoom(orderId: string): void {
  getSocket().emit("join_order", { order_id: orderId });
}

export function requestResync(orderId: string): void {
  getSocket().emit("resync", { order_id: orderId });
}
