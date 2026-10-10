import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".yaml": "application/yaml; charset=utf-8",
};

export async function staticAsset(pathname, root = new URL("../public/", import.meta.url)) {
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  if (!safePath || safePath.includes("\0")) return null;
  try {
    const body = await readFile(join(root.pathname, safePath));
    return {
      body,
      contentType: TYPES[extname(safePath)] ?? "application/octet-stream",
    };
  } catch {
    return null;
  }
}
