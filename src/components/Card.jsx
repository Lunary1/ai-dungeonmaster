export default function Card({
  children,
  className = "",
  hover = true,
  ...props
}) {
  return (
    <div
      className={`glass noisy rounded-xl2 shadow-soft ring-1 ring-glass transition-all duration-300 ${
        hover
          ? "hover:-translate-y-0.5 hover:shadow-glow focus-within:shadow-glow"
          : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
