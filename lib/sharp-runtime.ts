/**
 * Cloudflare's local workerd dev sandbox (used by `npm run dev`) cannot load
 * the image library's native or WASM bindings — production (Vercel, via Nitro)
 * runs real Node.js and is unaffected.
 */
export function sharpAvailable() {
  return process.env.VERCEL === "1" || process.env.NITRO_PRESET === "vercel";
}

const SH_SPEC = ["sh", "arp"].join("");

type SharpInstance = {
  resize: (...args: unknown[]) => SharpInstance;
  extend: (...args: unknown[]) => SharpInstance;
  composite: (...args: unknown[]) => SharpInstance;
  flop: () => SharpInstance;
  rotate: () => SharpInstance;
  jpeg: (...args: unknown[]) => SharpInstance;
  png: (...args: unknown[]) => SharpInstance;
  toBuffer: () => Promise<Buffer>;
};

type SharpModule = ((input?: unknown) => SharpInstance) & {
  kernel: Record<string, unknown>;
};

export async function loadSharp(): Promise<SharpModule> {
  const mod = (await import(/* @vite-ignore */ SH_SPEC)) as { default: SharpModule };
  return mod.default;
}
