import React from "react";

interface StatusChipProps {
  label: string;
  variant?: "success" | "error" | "warning" | "info";
}

export function StatusChip({ label, variant = "info" }: StatusChipProps) {
  return (
    <span className={`status-chip status-${variant}`}>
      {label}
    </span>
  );
}
