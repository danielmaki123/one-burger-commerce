"use client";

import { createContext, useContext, useMemo, useState } from "react";

type OrderTrackingSessionContextValue = {
  trackingWhatsapp: string;
  setTrackingWhatsapp: (value: string) => void;
  clearTrackingWhatsapp: () => void;
};

const OrderTrackingSessionContext = createContext<OrderTrackingSessionContextValue | null>(null);

export function OrderTrackingSessionProvider({ children }: { children: React.ReactNode }) {
  const [trackingWhatsapp, setTrackingWhatsappState] = useState("");

  const value = useMemo<OrderTrackingSessionContextValue>(
    () => ({
      trackingWhatsapp,
      setTrackingWhatsapp: (next: string) => setTrackingWhatsappState(next),
      clearTrackingWhatsapp: () => setTrackingWhatsappState(""),
    }),
    [trackingWhatsapp],
  );

  return (
    <OrderTrackingSessionContext.Provider value={value}>
      {children}
    </OrderTrackingSessionContext.Provider>
  );
}

export function useOrderTrackingSession() {
  const context = useContext(OrderTrackingSessionContext);
  if (!context) {
    throw new Error("useOrderTrackingSession must be used within OrderTrackingSessionProvider");
  }
  return context;
}
