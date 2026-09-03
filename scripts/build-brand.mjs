// Generates every raster/derived brand asset from public/brand/cogniflow-mark.svg.
// Run `bun run brand` after editing the mark; outputs are committed so builds
// never depend on this script.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pub = resolve(root, "public");
const brandDir = resolve(pub, "brand");
mkdirSync(brandDir, { recursive: true });

const NAME = "CogniFlow";
const TAGLINE = "Animated Architecture for AI";
const FONT = "Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const markSvg = readFileSync(resolve(brandDir, "cogniflow-mark.svg"), "utf8");
// Inner markup of the mark (everything inside <svg>…</svg>), reused in lockups.
const markInner = markSvg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

/** Full lockup: mark + wordmark + tagline. `theme` picks text colours. */
function lockupSvg(theme, { width = 1040, height = 320 } = {}) {
  const dark = theme === "dark";
  const cogni = dark ? "#F3F6FB" : "#173E7A";
  const flowA = dark ? "#5FB0F0" : "#2B6FB5";
  const flowB = dark ? "#8AD0FF" : "#3E9BDD";
  const tag = dark ? "#9AA6B8" : "#6B7280";
  const markSize = 260;
  const markX = 40;
  const markY = (height - markSize) / 2;
  const textX = markX + markSize + 36;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${NAME} — ${TAGLINE}">
  <defs>
    <linearGradient id="cf-w" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${flowA}"/>
      <stop offset="1" stop-color="${flowB}"/>
    </linearGradient>
  </defs>
  <g transform="translate(${markX} ${markY}) scale(${markSize / 256})">${markInner}</g>
  <text x="${textX}" y="${height / 2 + 14}" font-family="${FONT}" font-weight="700" font-size="128" letter-spacing="-4" fill="${cogni}">Cogni<tspan fill="url(#cf-w)">Flow</tspan></text>
  <text x="${textX + 4}" y="${height / 2 + 74}" font-family="${FONT}" font-weight="400" font-size="40" letter-spacing="0.5" fill="${tag}">${TAGLINE}</text>
</svg>
`;
}

/** Social card (1200×630) with the light lockup on a soft radial background. */
function ogSvg() {
  const w = 1200;
  const h = 630;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <radialGradient id="bg" cx="0.5" cy="0.5" r="0.7">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#EEF2F7"/>
    </radialGradient>
    <linearGradient id="cf-w" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#2B6FB5"/>
      <stop offset="1" stop-color="#3E9BDD"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <g transform="translate(110 175) scale(${280 / 256})">${markInner}</g>
  <text x="430" y="330" font-family="${FONT}" font-weight="700" font-size="124" letter-spacing="-4" fill="#173E7A">Cogni<tspan fill="url(#cf-w)">Flow</tspan></text>
  <text x="434" y="392" font-family="${FONT}" font-weight="400" font-size="38" fill="#6B7280">${TAGLINE}</text>
  <text x="434" y="466" font-family="${FONT}" font-weight="400" font-size="22" fill="#8B93A3">Open source · runs entirely in your browser · GIF, video and slide exports</text>
</svg>
`;
}

/** Wrap a single 256×256 PNG in an ICO container (PNG-in-ICO is supported everywhere modern). */
function pngToIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0); // width 256 → 0
  entry.writeUInt8(0, 1); // height 256 → 0
  entry.writeUInt8(0, 2); // palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(6 + 16, 12);
  return Buffer.concat([header, entry, png]);
}

const png = (svg, size, opts = {}) =>
  sharp(Buffer.from(svg), { density: 384 })
    .resize(size.w, size.h, {
      fit: "contain",
      background: opts.background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

const out = (name, data) => {
  writeFileSync(resolve(pub, name), data);
  console.log(`wrote public/${name}`);
};

// Favicons: SVG (modern), ICO (legacy), Apple touch icon (opaque, padded).
out("favicon.svg", markSvg);
out("favicon.ico", pngToIco(await png(markSvg, { w: 256, h: 256 })));
out(
  "apple-touch-icon.png",
  await sharp(await png(markSvg, { w: 150, h: 150 }))
    .extend({ top: 15, bottom: 15, left: 15, right: 15, background: "#F6F8FB" })
    .png()
    .toBuffer(),
);
out("brand/icon-512.png", await png(markSvg, { w: 512, h: 512 }));

// Lockups for docs and the app.
const light = lockupSvg("light");
const dark = lockupSvg("dark");
out("brand/cogniflow-logo.svg", light);
out("brand/cogniflow-logo-dark.svg", dark);
out("brand/cogniflow-logo.png", await png(light, { w: 1040, h: 320 }, { background: "#F6F8FB" }));
out("brand/og-image.png", await png(ogSvg(), { w: 1200, h: 630 }));
