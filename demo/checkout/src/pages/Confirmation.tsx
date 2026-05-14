import React from "react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

export const Confirmation: React.FC<{ orderId: string; onReset: () => void }> = ({ orderId, onReset }) => {
  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
      <Card title="Purchase Successful!">
        <div style={{ padding: "24px 0" }}>
          <div style={{ fontSize: "64px", marginBottom: "24px" }}>🎉</div>
          <p style={{ fontSize: "18px", marginBottom: "12px" }}>Thank you for your order.</p>
          <p style={{ color: "var(--color-on-surface-variant)", marginBottom: "32px" }}>
            Your order ID is: <code style={{ color: "var(--color-primary)", fontWeight: "600" }}>{orderId}</code>
          </p>
          <Button onClick={onReset} size="lg">Return to Shop</Button>
        </div>
      </Card>
    </div>
  );
};
