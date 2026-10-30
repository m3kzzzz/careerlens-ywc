"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, CompaniesIcon, UploadIcon } from "@/components/icons/nav-icons";
import { cn } from "@/lib/cn";
import { NAV_ITEMS, isActive, type NavIcon } from "./nav-items";

const ICONS: Record<NavIcon, typeof UploadIcon> = { upload: UploadIcon, companies: CompaniesIcon, calendar: CalendarIcon };

/** Mobile tab bar: three equal tabs, no raised button. Hidden on desktop. */
export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Spacer so page content clears the fixed bar. */}
      <div aria-hidden="true" className="h-[96px] lg:hidden" />
      <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface lg:hidden">
        <div className="mx-auto flex h-[78px] max-w-[560px] items-center gap-1 px-3 pb-4 pt-1.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = ICONS[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] focus-visible:outline-offset-[-2px]",
                  active ? "font-bold text-primary-hover" : "font-semibold text-muted",
                )}
              >
                <span className={cn("flex h-[30px] w-14 items-center justify-center rounded-full", active && "bg-primary-soft")}>
                  <Icon size={22} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
