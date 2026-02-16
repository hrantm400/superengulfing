import React from "react";
import "./LoadingSpinner.css";

interface LoadingSpinnerProps {
  /** Wrap in full-page centered layout (bg-background, min-h-screen) */
  fullPage?: boolean;
  className?: string;
}

export default function LoadingSpinner({ fullPage, className = "" }: LoadingSpinnerProps) {
  const spinner = (
    <div className={`loadingspinner ${className}`} aria-hidden="true">
      <div id="square1" />
      <div id="square2" />
      <div id="square3" />
      <div id="square4" />
      <div id="square5" />
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center">
        {spinner}
      </div>
    );
  }

  return spinner;
}
