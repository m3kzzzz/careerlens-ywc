import { ACCEPTED_EXTENSIONS, ACCEPTED_MIME_TYPES, MAX_FILE_BYTES } from "./constants";

export type FileRejection = "unsupported_type" | "too_large" | "empty";

export interface FileLike {
  name: string;
  type: string;
  size: number;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

export function validateImageFile(file: FileLike): FileRejection | null {
  const type = file.type.toLowerCase();
  const typeOk = (ACCEPTED_MIME_TYPES as readonly string[]).includes(type);
  // Trust the extension only when the browser gave no MIME type at all.
  const extOk = type === "" && (ACCEPTED_EXTENSIONS as readonly string[]).includes(extensionOf(file.name));
  if (!typeOk && !extOk) return "unsupported_type";
  if (file.size === 0) return "empty";
  if (file.size > MAX_FILE_BYTES) return "too_large";
  return null;
}

export function isHeic(file: Pick<FileLike, "name" | "type">): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  const ext = extensionOf(file.name);
  return ext === ".heic" || ext === ".heif";
}
