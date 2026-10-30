/** The three primary destinations, in the same order on mobile and desktop. */
export const NAV_ITEMS = [
  { href: "/", label: "Upload", icon: "upload" },
  { href: "/companies", label: "Companies", icon: "companies" },
  { href: "/calendar", label: "My Calendar", icon: "calendar" },
] as const;

export type NavIcon = (typeof NAV_ITEMS)[number]["icon"];

/**
 * Upload is active on "/" and while a batch is being organized; Companies on
 * the list and on company pages.
 */
export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/batches/");
  return pathname === href || pathname.startsWith(`${href}/`);
}
