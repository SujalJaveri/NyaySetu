/**
 * Post-build patch script: fixes circular ESM dependency in the Nitro/Rolldown
 * SSR bundle that causes "createMiddleware is not a function" in Cloudflare Workers.
 *
 * Root cause: ssr.mjs dynamically imports a SMALL server chunk which in turn
 * statically imports the LARGE server chunk (circular). Because SMALL is the
 * dynamic import root, V8 evaluates LARGE before SMALL, but LARGE needs
 * createMiddleware from SMALL at module-eval time → crash.
 *
 * Fix: Add a static import of the LARGE chunk at the top of ssr.mjs so that
 * V8 resolves LARGE as a *dependency* of SMALL (not the root), which forces
 * SMALL to evaluate first and makes createMiddleware available.
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const SSR_DIRS = [
  "dist/_worker.js/_ssr",
  ".output/server/_ssr",
];

function patch(ssrDir) {
  const ssrMjs = join(ssrDir, "ssr.mjs");
  let ssrContent;
  try {
    ssrContent = readFileSync(ssrMjs, "utf8");
  } catch {
    return; // directory doesn't exist
  }

  // Find the dynamic import: import("./server-XXXX.mjs").then((n) => n.t)
  const dynamicImportMatch = ssrContent.match(
    /import\("\.\/server-([^"]+?)\.mjs"\)\.then\(\(n\) => n\.t\)/
  );
  if (!dynamicImportMatch) {
    console.log(`[patch] No dynamic import pattern found in ${ssrMjs}`);
    return;
  }

  const smallFileHash = dynamicImportMatch[1];
  const smallFilePath = join(ssrDir, `server-${smallFileHash}.mjs`);

  // Read SMALL file to find the LARGE file it imports from
  const smallContent = readFileSync(smallFilePath, "utf8");
  const largeImportMatch = smallContent.match(
    /import \{[^}]+\} from "\.\/(server-[^"]+2\.mjs)"/
  );
  if (!largeImportMatch) {
    console.log(`[patch] No large file import found in ${smallFilePath}`);
    return;
  }

  const largeFileName = largeImportMatch[1];
  const sideEffectImport = `import "./${largeFileName}";\n`;

  if (ssrContent.includes(sideEffectImport)) {
    console.log(`[patch] Already patched: ${ssrMjs}`);
    return;
  }

  // Prepend the side-effect import to ssr.mjs
  const patched = sideEffectImport + ssrContent;
  writeFileSync(ssrMjs, patched);
  console.log(`[patch] ✅ Patched ${ssrMjs}: added "import ./${largeFileName}" to force correct eval order`);
}

for (const dir of SSR_DIRS) {
  patch(dir);
}

function patchServerIndex(serverDir) {
  const indexMjs = join(serverDir, "index.mjs");
  try {
    let content = readFileSync(indexMjs, "utf8");
    if (!content.includes("globalThis.__cf_env_synced__")) {
      content = content.replace(
        /globalThis\.__env__ = env;/g,
        `globalThis.__env__ = env; globalThis.__cf_env_synced__ = true; if (env && typeof env === 'object') { try { for (const [k, v] of Object.entries(env)) { if (typeof v === 'string') { process.env[k] = v; } } } catch {} }`
      );
      content = content.replace(
        /mod\.fetch\(req\)/g,
        `mod.fetch(req, globalThis.__env__ || env)`
      );
      writeFileSync(indexMjs, content);
      console.log(`[patch] ✅ Patched ${indexMjs} for Cloudflare Worker env propagation`);
    }
  } catch (err) {
    // ignore if not present
  }
}

patchServerIndex(".output/server");
patchServerIndex("dist/_worker.js");
