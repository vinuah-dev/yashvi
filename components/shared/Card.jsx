"use client";

export default function Card({
  children,
  variant = "light",
  padding = "md",
  hover = true,
  className = "",
  header,
  footer,
  onClick,
}) {
  const variants = {
    light: "card-base",
    dark: "card-base card-dark",
  };

  const paddings = {
    sm: "p-3",
    md: "p-4 sm:p-5",
    lg: "p-5 sm:p-6 lg:p-8",
    none: "",
  };

  const hoverClass = hover ? "hover:shadow-md" : "";

  return (
    <div
      className={`${variants[variant]} ${paddings[padding]} ${hoverClass} ${className}`}
      onClick={onClick}
    >
      {header && (
        <div className="mb-4 pb-4 border-b border-gray-200">
          {header}
        </div>
      )}
      <div>{children}</div>
      {footer && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          {footer}
        </div>
      )}
    </div>
  );
}
