import React, { useEffect, useState } from "react";
import { Card } from "../components/Card";
import { type CartItem } from "../store/CartContext";

interface Order {
  id: string;
  date: string;
  items: CartItem[];
  customer: any;
}

export const PreviousOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/orders")
      .then(res => res.json() as Promise<Order[]>)
      .then(data => {
        setOrders(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch orders", err);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return <div>Loading orders...</div>;
  }

  if (orders.length === 0) {
    return (
      <Card title="No Orders Found">
        <p style={{ color: "var(--color-on-surface-variant)" }}>You haven't placed any orders yet.</p>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <h2 style={{ marginBottom: "8px" }}>Order History</h2>
      {orders.map(order => (
        <Card key={order.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <div style={{ fontSize: "12px", color: "var(--color-on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                Order ID
              </div>
              <div style={{ fontWeight: "600", color: "var(--color-primary)", fontFamily: "var(--font-mono)" }}>
                {order.id}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "12px", color: "var(--color-on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                Date
              </div>
              <div>
                {new Date(order.date).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--color-outline-variant)", paddingTop: "16px" }}>
            {order.items.map((item, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "14px" }}>
                <span>{item.name} x {item.quantity}</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", fontWeight: "600", color: "var(--color-on-surface)", fontSize: "16px" }}>
              <span>Total Amount</span>
              <span>${order.items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
