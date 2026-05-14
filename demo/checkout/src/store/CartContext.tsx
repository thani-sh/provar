import React, { createContext, useContext, useState, useEffect } from "react";

export interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface User {
  name: string;
  email: string;
  address?: string;
  city?: string;
  zip?: string;
  cardNumber?: string;
  expiry?: string;
  cvv?: string;
}

interface CartContextType {
  cart: CartItem[];
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
  addToCart: (product: Product) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
  discount: number;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User | null>(null);

  const logout = () => {
    setUser(null);
    setCart([]);
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => 
      item.id === productId ? { ...item, quantity } : item
    ));
  };

  const clearCart = () => setCart([]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = user ? subtotal * 0.1 : 0;
  const total = subtotal - discount;

  return (
    <CartContext.Provider value={{ 
      cart, 
      user, 
      setUser, 
      logout,
      addToCart, 
      removeFromCart, 
      updateQuantity, 
      clearCart, 
      subtotal, 
      discount, 
      total 
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
};
