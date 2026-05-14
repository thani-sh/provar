import React, { useState } from "react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { useCart, type User } from "../store/CartContext";

export const Login: React.FC<{ onComplete: () => void; onSwitchToRegister: () => void }> = ({ onComplete, onSwitchToRegister }) => {
  const { setUser } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = (await res.json()) as { success: boolean; user?: User; message?: string };
      if (data.success && data.user) {
        setUser(data.user);
        onComplete();
      } else {
        setError(data.message || "Invalid credentials");
      }
    } catch (err) {
      console.error("Login failed", err);
      setError("An unexpected error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "0 auto" }}>
      <Card title="Member Login">
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {error && (
            <div style={{ padding: "12px", backgroundColor: "rgba(255, 180, 171, 0.1)", border: "1px solid var(--color-error)", borderRadius: "8px", color: "var(--color-error)", fontSize: "13px" }}>
              {error}
            </div>
          )}
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
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
            <Button type="submit" disabled={isProcessing} style={{ width: "100%" }}>
              {isProcessing ? "Logging in..." : "Login"}
            </Button>
            <Button type="button" variant="ghost" onClick={onSwitchToRegister} style={{ width: "100%" }}>
              Don't have an account? Register
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
