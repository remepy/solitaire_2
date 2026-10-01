// Builds one static site per language, laid out exactly as on S3 (bridge spec §4.1):
//   dist/games/solitaire/he/{index.html, translations.json, assets/…}
//   dist/games/solitaire/en/…
// Every URL in a build is relative, so each folder also works under any other prefix.
// Usage: npm run build            (both languages)
//        npm run build -- he      (one language)
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const GAME_ID = "solitaire";
const LANGS = ["he", "en"];

const requested = process.argv.slice(2).filter((a) => a !== "--");
const langs = requested.length ? requested : LANGS;
for (const lang of langs) if (!LANGS.includes(lang)) throw new Error(`Unknown language: ${lang}`);

if (!requested.length) rmSync("dist", { recursive: true, force: true });
rmSync(join("public", "translations.json"), { force: true }); // dev-only copy

for (const lang of langs) {
  const outDir = join("dist", GAME_ID, lang);
  console.log(`\n▶ Building ${GAME_ID}/${lang} → ${outDir}`);
  execFileSync("npx", ["vite", "build"], {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production", OUT_DIR: outDir },
  });
  const source = join("translations", `${lang}.json`);
  copyFileSync(source, join(outDir, "translations.json"));
  // First paint already carries the right lang attribute; the game re-applies
  // lang and dir from translations.json at runtime, which stays authoritative.
  const tr = JSON.parse(readFileSync(source, "utf8"));
  const indexPath = join(outDir, "index.html");
  if (!existsSync(indexPath)) throw new Error(`no index.html in ${outDir}`);
  writeFileSync(indexPath, readFileSync(indexPath, "utf8").replace("<html>", `<html lang="${tr.locale}">`));
}
console.log(`\n✔ Built ${langs.join(", ")} under dist/games/${GAME_ID}/`);
