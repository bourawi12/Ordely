"use client";

import { useRouter } from "next/navigation";
import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

export interface OrderStatusChangedEvent {
  orderId: number;
  status: string;
  updatedAt: string;
}

export interface OrderCreatedEvent {
  orderId: number;
  status: string;
  createdAt: string;
}

export interface CallStatusChangedEvent {
  callId: number;
  orderId: number;
  status: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: "order.created" | "order.status_changed" | "call.status_changed";
}

interface RealtimeContextValue {
  socket: Socket | null;
  connected: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  socket: null,
  connected: false,
  notifications: [],
  unreadCount: 0,
  markAllAsRead: () => {},
  clearNotifications: () => {},
});

export const useRealtime = () => useContext(RealtimeContext);

export default function RealtimeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const addNotification = (notif: AppNotification) => {
    setNotifications((prev) => [notif, ...prev].slice(0, 30));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    let socketInstance: Socket | null = null;
    let mounted = true;

    async function initSocket() {
      try {
        const res = await fetch("/api/ws-token");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.token || !mounted) return;

        const host =
          process.env.NEXT_PUBLIC_WS_URL ||
          (typeof window !== "undefined"
            ? `${window.location.protocol}//${window.location.hostname}:3001`
            : "http://localhost:3001");

        socketInstance = io(host, {
          auth: { token: data.token },
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 2000,
        });

        socketInstance.on("connect", () => {
          if (mounted) setConnected(true);
        });

        socketInstance.on("disconnect", () => {
          if (mounted) setConnected(false);
        });

        socketInstance.on("order.created", (payload: OrderCreatedEvent) => {
          if (mounted) {
            const id = String(Date.now() + Math.random());
            const orderLabel = payload.orderId ? `#${payload.orderId}` : "";
            addNotification({
              id,
              title: "New Order",
              message: payload.orderId
                ? `Order ${orderLabel} was added`
                : "New orders imported",
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              read: false,
              type: "order.created",
            });
            router.refresh();
          }
        });

        socketInstance.on(
          "order.status_changed",
          (payload: OrderStatusChangedEvent) => {
            if (mounted) {
              const id = String(Date.now() + Math.random());
              addNotification({
                id,
                title: "Order Status Updated",
                message: `Order #${payload.orderId} status changed to ${payload.status}`,
                timestamp: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                read: false,
                type: "order.status_changed",
              });
              router.refresh();
            }
          },
        );

        socketInstance.on(
          "call.status_changed",
          (payload: CallStatusChangedEvent) => {
            if (mounted) {
              const id = String(Date.now() + Math.random());
              addNotification({
                id,
                title: "Call Status Updated",
                message: `Call for Order #${payload.orderId} is now ${payload.status}`,
                timestamp: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                read: false,
                type: "call.status_changed",
              });
              router.refresh();
            }
          },
        );

        if (mounted) {
          setSocket(socketInstance);
        }
      } catch {
        // Fallback for socket error
      }
    }

    initSocket();

    return () => {
      mounted = false;
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, [router]);

  return (
    <RealtimeContext.Provider
      value={{
        socket,
        connected,
        notifications,
        unreadCount,
        markAllAsRead,
        clearNotifications,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}
