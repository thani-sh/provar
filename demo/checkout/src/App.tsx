import React, { useState } from "react";
import { CartProvider, useCart } from "./store/CartContext";
import { ProductList } from "./pages/ProductList";
import { Checkout } from "./pages/Checkout";
import { Confirmation } from "./pages/Confirmation";
import { Register } from "./pages/Register";
import { Login } from "./pages/Login";
import { PreviousOrders } from "./pages/PreviousOrders";
import { Button } from "./components/Button";

type Page = "products" | "checkout" | "confirmation" | "register" | "login" | "orders";

const SidebarItem = ({ label, active, onClick, icon, style }: { label: string; active?: boolean; onClick: () => void; icon: string; style?: React.CSSProperties }) => (
  <div 
    onClick={onClick}
    style={{
      padding: "12px 16px",
      borderRadius: "8px",
      cursor: "pointer",
      backgroundColor: active ? "var(--color-surface-container-high)" : "transparent",
      color: active ? "var(--color-primary)" : "var(--color-on-surface-variant)",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      transition: "all 0.2s ease",
      fontWeight: active ? "600" : "400",
      ...style
    }}
  >
    <span>{icon}</span>
    <span>{label}</span>
  </div>
);

const AppContent = () => {
  const [page, setPage] = useState<Page>("products");
  const [orderId, setOrderId] = useState("");
  const { cart, user, logout, subtotal, discount, total } = useCart();

  const handleCheckoutComplete = (id: string) => {
    setOrderId(id);
    setPage("confirmation");
  };

  const handleLogout = () => {
    logout();
    setPage("products");
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar */}
      <aside style={{ 
        width: "260px", 
        minWidth: "260px",
        backgroundColor: "var(--color-surface-container-low)",
        borderRight: "1px solid var(--color-outline-variant)",
        display: "flex",
        flexDirection: "column",
        padding: "24px 16px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "40px", padding: "0 8px" }}>
          <div style={{ 
            width: "32px", 
            height: "32px", 
            backgroundColor: "var(--color-tertiary)", 
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-on-tertiary)",
            fontWeight: "bold",
            fontSize: "18px"
          }}>🍎</div>
          <h1 style={{ fontSize: "18px", letterSpacing: "-0.02em" }}>Fresh Harvest</h1>
        </div>

        {user && (
          <div style={{ 
            padding: "12px", 
            backgroundColor: "var(--color-surface-container-high)", 
            borderRadius: "12px", 
            marginBottom: "24px",
            border: "1px solid var(--color-tertiary-container)"
          }}>
            <div style={{ fontSize: "11px", color: "var(--color-tertiary)", textTransform: "uppercase", fontWeight: "600", marginBottom: "4px" }}>Gold Member</div>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--color-on-surface)" }}>{user.name}</div>
            <div style={{ fontSize: "11px", color: "var(--color-on-surface-variant)" }}>10% Fresh Discount</div>
          </div>
        )}

        <nav style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
          <SidebarItem 
            label="Shop Fruit" 
            icon="🧺" 
            active={page === "products"} 
            onClick={() => setPage("products")} 
          />
          
          {user && (
            <>
              <div style={{ marginTop: "24px", padding: "0 16px", fontSize: "11px", fontWeight: "600", textTransform: "uppercase", color: "var(--color-outline)", letterSpacing: "0.05em" }}>
                History
              </div>
              <SidebarItem 
                label="Previous Orders" 
                icon="📜" 
                active={page === "orders"}
                onClick={() => setPage("orders")} 
              />
            </>
          )}

          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
            {user ? (
              <SidebarItem 
                label="Logout" 
                icon="🚪" 
                onClick={handleLogout} 
                style={{ color: "var(--color-error)" }}
              />
            ) : (
              <>
                <SidebarItem 
                  label="Login" 
                  icon="🔑" 
                  active={page === "login"} 
                  onClick={() => setPage("login")} 
                />
                <SidebarItem 
                  label="Register" 
                  icon="👤" 
                  active={page === "register"} 
                  onClick={() => setPage("register")} 
                />
              </>
            )}
          </div>
        </nav>

        <div style={{ marginTop: "24px", padding: "16px", backgroundColor: "var(--color-surface-container)", borderRadius: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "12px", color: "var(--color-on-surface-variant)" }}>Subtotal ({cartCount})</div>
              <div style={{ fontSize: "14px", color: "var(--color-on-surface)" }}>${subtotal.toFixed(2)}</div>
            </div>
            
            {discount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "11px", color: "var(--color-tertiary)" }}>10% Discount</div>
                <div style={{ fontSize: "12px", color: "var(--color-tertiary)" }}>-${discount.toFixed(2)}</div>
              </div>
            )}
            
            <div style={{ borderTop: "1px solid var(--color-outline-variant)", paddingTop: "8px", marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "12px", fontWeight: "600" }}>Total</div>
              <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--color-primary)" }}>
                ${total.toFixed(2)}
              </div>
            </div>
          </div>
          <Button 
            style={{ width: "100%", marginTop: "12px" }} 
            size="sm"
            onClick={() => setPage("checkout")}
            disabled={cart.length === 0}
          >
            Checkout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflowY: "auto", padding: "40px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          {page === "products" && <ProductList />}
          {page === "checkout" && <Checkout onComplete={handleCheckoutComplete} />}
          {page === "confirmation" && <Confirmation orderId={orderId} onReset={() => setPage("products")} />}
          {page === "register" && <Register onComplete={() => setPage("products")} onSwitchToLogin={() => setPage("login")} />}
          {page === "login" && <Login onComplete={() => setPage("products")} onSwitchToRegister={() => setPage("register")} />}
          {page === "orders" && <PreviousOrders />}
        </div>
      </main>
    </div>
  );
};

export const App = () => (
  <CartProvider>
    <AppContent />
  </CartProvider>
);
