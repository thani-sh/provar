import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const baseStyles = "px-4 py-2 font-medium transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
  
  // Note: Since I'm not using Tailwind, I'll use standard CSS classes and define them in style.css or use inline styles for now.
  // Actually, I'll add the classes to style.css in the next step to keep it clean.
  
  const variantClass = `btn-${variant}`;
  
  return (
    <button 
      className={`btn ${variantClass} ${className}`}
      {...props}
    />
  );
}
