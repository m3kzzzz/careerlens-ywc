"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, CompaniesIcon, UploadIcon } from "@/components/icons/nav-icons";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/cn";
import { NAV_ITEMS, isActive, type NavIcon } from "./nav-items";

const ICONS: Record<NavIcon, typeof UploadIcon> = { upload: UploadIcon, companies: CompaniesIcon, calendar: CalendarIcon };

/** Desktop (≥1024px) top bar with the same three destinations as the mobile tab bar. */
export function DesktopHeader() {
  const pathname = usePathname();

  return (
    <header className="hidden h-16 items-center gap-8 border-b border-line bg-surface px-8 lg:flex">
      <Link href="/" aria-label="CareerLens home">
        <Logo size="md" />
      </Link>
      <nav aria-label="Main" className="flex gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-[10px] px-3.5 transition-colors",
                active ? "bg-primary-soft font-semibold text-primary-hover" : "font-medium text-ink-3 hover:bg-chip hover:text-ink",
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
