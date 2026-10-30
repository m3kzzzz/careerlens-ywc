"use client";

import type { Photo } from "@/domain/types";

/**
 * Object URLs for stored photos. Live queries return a fresh Blob instance on
 * every update, so URLs are cached per photo version instead of per Blob to
 * avoid flicker and leaks.
 */
const cache = new Map<string, { version: string; url: string }>();

export function photoUrl(photo: Photo): string {
  const version = photo.prepared ? "prepared" : "original";
  const hit = cache.get(photo.id);
  if (hit?.version === version) return hit.url;
  if (hit) URL.revokeObjectURL(hit.url);
  const url = URL.createObjectURL(photo.blob);
  cache.set(photo.id, { version, url });
  return url;
}
