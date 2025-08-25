export default function Button({
  variant = "primary",
  children,
  className = "",
  ...props
}) {
  const baseClasses =
    "inline-flex items-center gap-2 rounded-xl2 px-4 py-2 font-medium focus:outline-none transition";

  const variants = {
    primary:
      "text-ink bg-amber hover:brightness-110 focus:ring-2 focus:ring-amber/60 active:translate-y-[1px]",
    secondary:
      "border border-glass bg-white/5 text-parchment hover:bg-white/7 focus:ring-2 focus:ring-plum/50",
    glass:
      "glass noisy border border-glass text-parchment hover:bg-white/7 focus:ring-2 focus:ring-plum/50",
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
