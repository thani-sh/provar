import React, { useState } from "react";
import { useCart } from "../store/CartContext";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";

export const Checkout: React.FC<{ onComplete: (orderId: string) => void }> = ({ onComplete }) => {
  const { cart, subtotal, discount, total, clearCart, user } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    address: user?.address || "",
    city: user?.city || "",
    zip: user?.zip || "",
    cardNumber: user?.cardNumber || "",
    expiry: user?.expiry || "",
    cvv: user?.cvv || ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          items: cart, 
          customer: formData,
          subtotal,
          discount,
          total
        })
      });
      const data = (await res.json()) as { success: boolean; orderId: string };
      if (data.success) {
        clearCart();
        onComplete(data.orderId);
      }
    } catch (err) {
      console.error("Checkout failed", err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (cart.length === 0) {
    return (
      <Card title="Your Cart is Empty">
        <p>Add some products to your cart to proceed with checkout.</p>
      </Card>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: "24px" }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <Card title="Shipping Information">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <Input 
              label="Full Name" 
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.currentTarget.value })} 
              required 
            />
            <Input 
              label="Email" 
              type="email" 
              value={formData.email} 
              onChange={e => setFormData({ ...formData, email: e.currentTarget.value })} 
              required 
            />
            <Input 
              label="Address" 
              className="span-2" 
              style={{ gridColumn: "span 2" }} 
              value={formData.address} 
              onChange={e => setFormData({ ...formData, address: e.currentTarget.value })} 
              required 
            />
            <Input 
              label="City" 
              value={formData.city} 
              onChange={e => setFormData({ ...formData, city: e.currentTarget.value })} 
              required 
            />
            <Input 
              label="ZIP Code" 
              value={formData.zip} 
              onChange={e => setFormData({ ...formData, zip: e.currentTarget.value })} 
              required 
            />
          </div>
        </Card>

        <Card title="Payment Method (Mock)">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
            <Input 
              label="Card Number" 
              style={{ gridColumn: "span 3" }} 
              value={formData.cardNumber} 
              onChange={e => setFormData({ ...formData, cardNumber: e.currentTarget.value })} 
              required 
            />
            <Input 
              label="Expiry" 
              value={formData.expiry} 
              onChange={e => setFormData({ ...formData, expiry: e.currentTarget.value })} 
              required 
            />
            <Input 
              label="CVV" 
              value={formData.cvv} 
              onChange={e => setFormData({ ...formData, cvv: e.currentTarget.value })} 
              required 
            />
          </div>
        </Card>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <Card title="Order Summary">
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {cart.map(item => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                <span>{item.name} x {item.quantity}</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            
            <div style={{ borderTop: "1px solid var(--color-outline-variant)", paddingTop: "12px", marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--color-on-surface-variant)" }}>
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              
              {discount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--color-tertiary)" }}>
                  <span>Registered User Discount (10%)</span>
                  <span>-${discount.toFixed(2)}</span>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "600", fontSize: "18px", marginTop: "4px" }}>
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <Button 
            onClick={handleSubmit} 
            style={{ width: "100%", marginTop: "24px" }} 
            disabled={isProcessing}
          >
            {isProcessing ? "Processing..." : "Complete Purchase"}
          </Button>
        </Card>
      </div>
    </div>
  );
};
