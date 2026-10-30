import type { MetadataRoute } from "next";

/** Installable app shell only: no service worker, no offline cache. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "CareerLens",
    short_name: "CareerLens",
    description: "Snap job fair brochures. CareerLens reads them, scans QR codes and organizes opportunities by company.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf9",
    theme_color: "#fafaf9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Full-bleed artwork with the glyph inside the safe zone, so the same files work as maskable.
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
