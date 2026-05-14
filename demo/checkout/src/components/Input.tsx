import React from "react";
import "./Input.css";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className = "", ...props }) => {
  return (
    <div className={`input-container ${className}`}>
      {label && <label className="input-label">{label}</label>}
      <input className="input-field" {...props} />
    </div>
  );
};
