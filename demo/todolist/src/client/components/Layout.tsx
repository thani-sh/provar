import React from "react";

interface LayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export function Layout({ sidebar, children }: LayoutProps) {
  return (
    <div className="layout">
      <aside className="sidebar">
        {sidebar}
      </aside>
      <main className="content">
        {children}
      </main>
    </div>
  );
}
