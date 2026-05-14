import React, { useEffect, useState } from "react";
import { type Product, useCart } from "../store/CartContext";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

export const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const { addToCart } = useCart();

  useEffect(() => {
    fetch("/api/products")
      .then(res => res.json() as Promise<Product[]>)
      .then(data => setProducts(data));
  }, []);

  return (
    <div className="product-list">
      <h2 style={{ marginBottom: "24px" }}>Fresh Daily Selection</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" }}>
        {products.map(product => (
          <Card key={product.id} title={product.name}>
            <p style={{ color: "var(--color-on-surface-variant)", marginBottom: "16px", minHeight: "42px" }}>
              {product.description}
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "18px", fontWeight: "600", color: "var(--color-primary)" }}>
                ${product.price.toFixed(2)}
              </span>
              <Button onClick={() => addToCart(product)}>Add to Cart</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
