import React, { useState } from "react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { useCart } from "../store/CartContext";

export const Register: React.FC<{ onComplete: () => void; onSwitchToLogin: () => void }> = ({ onComplete, onSwitchToLogin }) => {
  const { setUser } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    address: "",
    city: "",
    zip: "",
    cardNumber: "",
    expiry: "",
    cvv: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = (await res.json()) as { success: boolean };
      if (data.success) {
        const { password, ...userFields } = formData;
        setUser(userFields);
        onComplete();
      }
    } catch (err) {
      console.error("Registration failed", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <Card title="Create Fresh Account">
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <Input 
              label="Full Name" 
              placeholder="John Doe"
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.currentTarget.value })} 
              required 
            />
            <Input 
              label="Email" 
              type="email" 
              placeholder="john@example.com"
              value={formData.email} 
              onChange={e => setFormData({ ...formData, email: e.currentTarget.value })} 
              required 
            />
            <Input 
              label="Password" 
              type="password" 
              placeholder="••••••••"
              value={formData.password} 
              onChange={e => setFormData({ ...formData, password: e.currentTarget.value })} 
              required 
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h4 style={{ fontSize: "12px", color: "var(--color-primary)", textTransform: "uppercase" }}>Shipping Address</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <Input 
                label="Address" 
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
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h4 style={{ fontSize: "12px", color: "var(--color-primary)", textTransform: "uppercase" }}>Payment Details</h4>
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
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
            <Button type="submit" disabled={isProcessing} style={{ width: "100%" }}>
              {isProcessing ? "Creating Account..." : "Register"}
            </Button>
            <Button type="button" variant="ghost" onClick={onSwitchToLogin} style={{ width: "100%" }}>
              Already have an account? Log in
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
