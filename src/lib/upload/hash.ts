import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

/**
 * Lower-case hex SHA-256 of a file's bytes.
 *
 * Web Crypto is only available in secure contexts (https / localhost). When the
 * app is opened over plain http on a LAN IP – e.g. testing on a phone – we fall
 * back to a pure-JS implementation so duplicate detection still works.
 */
export async function sha256Hex(data: Blob | ArrayBuffer | Uint8Array): Promise<string> {
  const buffer =
    data instanceof Blob ? await data.arrayBuffer() : data instanceof Uint8Array ? data : new Uint8Array(data);
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest("SHA-256", bytes as BufferSource);
    return bytesToHex(new Uint8Array(digest));
  }
  return bytesToHex(sha256(bytes));
}
