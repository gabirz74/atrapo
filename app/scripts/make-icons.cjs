// Renders the Atrapo icon at every size the platforms need.  Run with:  npx electron scripts/make-icons.cjs
const { app, BrowserWindow } = require("electron");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const out = path.resolve(__dirname, "..", "build");
fs.mkdirSync(out, { recursive: true });

// macOS icons float inside a transparent margin (the squircle is 824 of 1024 px); Windows icons fill their square.
const svg = (full) => {
  const s = full ? { x: 0, y: 0, w: 1024, r: 224 } : { x: 100, y: 100, w: 824, r: 186 };
  const k = s.w / 824;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a52ff"/><stop offset="1" stop-color="#1f35e0"/></linearGradient></defs>
  <rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.w}" rx="${s.r}" fill="url(#g)"/>
  <circle cx="512" cy="512" r="${210 * k}" fill="none" stroke="#fff" stroke-width="${70 * k}"/>
  <circle cx="512" cy="512" r="${64 * k}" fill="#fff"/>
</svg>`;
};

async function render(full, file) {
  const html = path.join(out, `.icon-tmp-${full ? "full" : "mac"}.html`);
  fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent;overflow:hidden}</style>${svg(full)}`);
  const win = new BrowserWindow({ show: false, width: 1024, height: 1024, useContentSize: true, transparent: true, frame: false });
  await win.loadFile(html);
  await new Promise((r) => setTimeout(r, 500));
  let img = await win.webContents.capturePage();
  if (img.getSize().width !== 1024) img = img.resize({ width: 1024, height: 1024, quality: "best" }); // Retina captures come back at 2x
  fs.writeFileSync(file, img.toPNG());
  win.destroy();
  setTimeout(() => fs.rmSync(html, { force: true }), 1500);
}

function sips(size, from, to) {
  execFileSync("/usr/bin/sips", ["-z", String(size), String(size), from, "--out", to], { stdio: "ignore" });
}

app.on("window-all-closed", () => {}); // keep running between renders
app.whenReady().then(async () => {
  const macPng = path.join(out, "icon.png"); // 1024, with margin: used by electron-builder for the .icns
  const winPng = path.join(out, "icon-win-1024.png");
  await render(false, macPng);
  await render(true, winPng);

  // .icns through iconutil
  const set = path.join(out, "icon.iconset");
  fs.rmSync(set, { recursive: true, force: true });
  fs.mkdirSync(set);
  for (const s of [16, 32, 128, 256, 512]) {
    sips(s, macPng, path.join(set, `icon_${s}x${s}.png`));
    sips(s * 2, macPng, path.join(set, `icon_${s}x${s}@2x.png`));
  }
  execFileSync("/usr/bin/iconutil", ["-c", "icns", set, "-o", path.join(out, "icon.icns")]);
  fs.rmSync(set, { recursive: true, force: true });

  // .ico: a container of PNG images (supported since Windows Vista)
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = sizes.map((s) => {
    const f = path.join(out, `.ico-${s}.png`);
    sips(s, winPng, f);
    const buf = fs.readFileSync(f);
    fs.rmSync(f);
    return buf;
  });
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(sizes.length, 4);
  let offset = 6 + 16 * sizes.length;
  const dir = Buffer.concat(
    sizes.map((s, i) => {
      const e = Buffer.alloc(16);
      e.writeUInt8(s === 256 ? 0 : s, 0);
      e.writeUInt8(s === 256 ? 0 : s, 1);
      e.writeUInt16LE(1, 4);
      e.writeUInt16LE(32, 6);
      e.writeUInt32LE(pngs[i].length, 8);
      e.writeUInt32LE(offset, 12);
      offset += pngs[i].length;
      return e;
    }),
  );
  fs.writeFileSync(path.join(out, "icon.ico"), Buffer.concat([head, dir, ...pngs]));
  fs.copyFileSync(winPng, path.join(out, "icon-512.png")); // for the website / PWA
  sips(512, winPng, path.join(out, "icon-512.png"));
  fs.rmSync(winPng);
  app.quit();
});
