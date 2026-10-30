import { cn } from "@/lib/cn";

const AVATARS = [
  "bg-[#ede9fe] text-[#5b21b6]",
  "bg-[#ccfbf1] text-[#115e59]",
  "bg-[#dbeafe] text-[#1e40af]",
  "bg-[#fce7f3] text-[#9d174d]",
  "bg-[#fef3c7] text-[#92400e]",
  "bg-[#dcfce7] text-[#166534]",
  "bg-[#e2e8f0] text-[#334155]",
  "bg-[#ffedd5] text-[#9a3412]",
];

/** "Lumen Pay" → "LP", "บริษัท ลูเมน" → "บล". Works for Thai and English names. */
export function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return [...words[0]].slice(0, 2).join("").toUpperCase();
  return ([...words[0]][0] + [...words[1]][0]).toUpperCase();
}

/** Stable pastel per company name. */
export function avatarClass(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return AVATARS[h % AVATARS.length];
}

export function CompanyAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex flex-none items-center justify-center font-bold", avatarClass(name), className)}
    >
      {initials(name)}
    </span>
  );
}
