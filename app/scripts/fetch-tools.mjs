// Downloads the command-line tools the app bundles (yt-dlp and ffmpeg) for each platform.
// ffprobe is deliberately not bundled: yt-dlp falls back to ffmpeg when it is missing.
// Usage: node scripts/fetch-tools.mjs [darwin-arm64] [darwin-x64] [win32-x64]   (default: the current machine)
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FFMPEG_TAG = "b6.1.1"; // release of github.com/eugeneware/ffmpeg-static
const YTDLP = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";
const FFMPEG = `https://github.com/eugeneware/ffmpeg-static/releases/download/${FFMPEG_TAG}`;

const TARGETS = {
  "darwin-arm64": { ytdlp: "yt-dlp_macos", ffmpeg: "ffmpeg-darwin-arm64", exe: "" },
  "darwin-x64": { ytdlp: "yt-dlp_macos", ffmpeg: "ffmpeg-darwin-x64", exe: "" },
  "win32-x64": { ytdlp: "yt-dlp.exe", ffmpeg: "ffmpeg-win32-x64", exe: ".exe" },
};

async function download(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function fetchTarget(name) {
  const t = TARGETS[name];
  if (!t) throw new Error(`Unknown target ${name}. Use: ${Object.keys(TARGETS).join(", ")}`);
  const dir = path.join(root, "resources", "bin", name);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const put = async (file, buf) => {
    await writeFile(path.join(dir, file), buf);
    if (!file.endsWith(".exe")) await chmod(path.join(dir, file), 0o755);
    console.log(`  ${name}/${file}  ${(buf.length / 1048576).toFixed(1)} MB`);
  };

  await put("yt-dlp" + t.exe, await download(`${YTDLP}/${t.ytdlp}`));
  await put("ffmpeg" + t.exe, gunzipSync(await download(`${FFMPEG}/${t.ffmpeg}.gz`)));
}

const wanted = process.argv.slice(2);
const targets = wanted.length ? wanted : [`${process.platform}-${process.arch}`];
for (const name of targets) {
  console.log(`Fetching tools for ${name}…`);
  await fetchTarget(name);
}
console.log("Done.");
