"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface CartItemModifier {
  groupName: string;
  optionName: string;
  priceDelta: number;
}

export interface CartItem {
  productId: string;
  productName: string;
  imageUrl?: string;
  imageAlt?: string | null;
  quantity: number;
  unitPrice: number;
  packagingUnitAmount: number;
  packagingTotalAmount: number;
  modifierOptionIds: string[];
  modifiers?: CartItemModifier[];
  notes?: string;
  lineTotal: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const CART_STORAGE_KEY = "one-burger-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  /**
   * ¿Ya se leyó el carrito guardado? El guardado **nunca** puede correr antes de la lectura: el efecto
   * que guarda corre en el primer render (con la lista todavía vacía) y escribiría `[]` encima del
   * carrito del cliente. En producción se recuperaba en el render siguiente, pero con el doble montaje
   * de StrictMode —y en la ventana entre el pisado y la lectura— el pedido se perdía y `/checkout`
   * mostraba «Tu carrito está vacío». Se encontró verificando el camino real del checkout.
   */
  const [hydrated, setHydrated] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
      } catch (e) {
        console.error("Failed to parse cart", e);
      }
    }
    setHydrated(true);
  }, []);

  // Save cart to localStorage on change, once the stored cart has been read
  useEffect(() => {
    if (!hydrated) return;

    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addItem = (newItem: CartItem) => {
    setItems((current) => [...current, newItem]);
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, quantity: number) => {
    setItems((current) =>
      current.map((item, i) =>
        i === index
          ? {
              ...item,
              quantity,
              lineTotal: item.unitPrice * quantity,
              packagingTotalAmount: item.packagingUnitAmount * quantity,
            }
          : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, subtotal }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
