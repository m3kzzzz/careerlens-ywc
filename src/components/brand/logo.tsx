import { cn } from "@/lib/cn";

const sizes = {
  sm: { box: "size-7 rounded-lg", icon: 15, text: "text-base" }, // mobile header 28px
  md: { box: "size-[30px] rounded-[9px]", icon: 16, text: "text-[17px] tracking-[-0.01em]" }, // desktop header
  lg: { box: "size-11 rounded-xl", icon: 22, text: "text-[28px]" },
} as const;

export function LogoMark({ size = "sm", className }: { size?: keyof typeof sizes; className?: string }) {
  const s = sizes[size];
  return (
    <span className={cn("bg-lens flex shrink-0 items-center justify-center", s.box, className)}>
      <svg width={s.icon} height={s.icon} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="M15 15l5 5" />
      </svg>
    </span>
  );
}

export function Logo({ size = "sm" }: { size?: keyof typeof sizes }) {
  return (
    <span className={cn("flex items-center", size === "sm" ? "gap-2" : "gap-2.5")}>
      <LogoMark size={size} />
      <span className={cn("font-semibold", sizes[size].text)}>CareerLens</span>
    </span>
  );
}
