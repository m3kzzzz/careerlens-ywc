// Copies the zxing QR reader WebAssembly into /public so it is served by this
// app instead of being fetched from a third-party CDN at runtime.
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const src = require.resolve("zxing-wasm/reader/zxing_reader.wasm");
const destDir = join(process.cwd(), "public", "wasm");

mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, "zxing_reader.wasm"));
console.log("copied zxing_reader.wasm → public/wasm/");
