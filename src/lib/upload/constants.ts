export const MAX_PHOTOS_PER_BATCH = 10;

/** Original files larger than this are rejected before hashing. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

/** Some platforms (notably Windows with HEIC) report an empty MIME type. */
export const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"] as const;

/** Value for `<input accept>`; extensions included so HEIC shows up in desktop pickers. */
export const FILE_INPUT_ACCEPT = ["image/*", ...ACCEPTED_EXTENSIONS].join(",");
