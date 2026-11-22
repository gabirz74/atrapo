import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Options } from "@shared/types";
import { inspect } from "./engine/inspect";
import { tools } from "./engine/paths";
import { run } from "./engine/proc";
import { createJob, listJobs } from "./engine/queue";
import { setSettings } from "./engine/settings";
import { ensureTools, ytdlpVersion } from "./engine/ytdlp";

/**
 * `Atrapo --self-test` exercises the real engine of the installed app with no window:
 * tools present, each source readable, and a couple of real downloads. Prints PASS/FAIL lines, exits non-zero on failure.
 */
const OPTS: Options = { mode: "audio", container: "mp4", audioFormat: "mp3", subtitles: false, thumbnail: false, chapters: false };

export async function runSelfTest(ui?: () => Promise<string>): Promise<number> {
  let failed = 0;
  const out = path.join(tmpdir(), "atrapo-selftest");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  setSettings({ outputDir: out, collectionsAs: "zip" });

  const step = async (name: string, fn: () => Promise<string>) => {
    const t0 = Date.now();
    try {
      console.log(`PASS  ${name}: ${await fn()} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    } catch (e) {
      failed++;
      console.log(`FAIL  ${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const waitJob = async (id: string, timeoutMs = 300_000) => {
    const t0 = Date.now();
    for (;;) {
      const j = listJobs().find((x) => x.id === id);
      if (j && ["done", "error", "cancelled"].includes(j.status)) return j;
      if (Date.now() - t0 > timeoutMs) throw new Error("timeout");
      await new Promise((r) => setTimeout(r, 500));
    }
  };

  await step("tools", async () => {
    await ensureTools();
    const ff = await run(tools.ffmpeg, ["-version"], { timeoutMs: 20_000 });
    if (ff.code !== 0) throw new Error("ffmpeg does not run");
    return `yt-dlp ${await ytdlpVersion()}, ${ff.stdout.split("\n")[0]?.slice(0, 40)}`;
  });
  if (ui) await step("interface", ui);
  await step("read YouTube link", async () => {
    const p = await inspect("https://www.youtube.com/watch?v=jNQXAC9IVRw");
    if (!p.title) throw new Error("no title");
    return `"${p.title}" video heights ${p.video?.heights.slice(0, 3).join("/")}`;
  });
  await step("read Spotify track", async () => `"${(await inspect("https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8")).title}"`);
  await step("read Spotify playlist (hidden player)", async () => {
    const p = await inspect("https://open.spotify.com/playlist/0Jn35kSU3QOMndStZ9pJ0I");
    if (p.count < 5) throw new Error(`only ${p.count} songs`);
    return `${p.count} songs, cover ${p.thumbnail ? "yes" : "no"}`;
  });
  await step("read a big Spotify playlist completely", async () => {
    // 279 songs in the playlist; every one must be read (an old reader skipped rows on slow computers).
    const p = await inspect("https://open.spotify.com/playlist/4y3gkuwFFylCAronhOdXp7");
    if (p.partial) throw new Error(`Spotify says ${p.partial.declared}, read ${p.partial.read}`);
    if (p.count < 250) throw new Error(`only ${p.count} songs`);
    return `${p.count} songs, none missing`;
  });
  await step("read Pinterest board", async () => {
    const p = await inspect("https://www.pinterest.com/pinterest/official-news/");
    if (p.count < 5) throw new Error(`only ${p.count} files`);
    return `${p.count} files`;
  });
  await step("download YouTube audio (mp3)", async () => {
    const j = await waitJob(createJob(["https://www.youtube.com/watch?v=jNQXAC9IVRw"], OPTS, "selftest yt").id);
    if (j.status !== "done" || !j.result) throw new Error(j.message);
    return `${j.result.name} ${(j.result.size / 1e6).toFixed(1)} MB`;
  });
  await step("download Spotify song with cover", async () => {
    const j = await waitJob(createJob(["https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8"], { ...OPTS }, "selftest sp").id);
    if (j.status !== "done" || !j.result) throw new Error(j.message);
    const probe = await run(tools.ffmpeg, ["-hide_banner", "-i", j.result.path], { timeoutMs: 20_000 });
    const hasCover = /Video: (mjpeg|png)/.test(probe.stderr);
    const tagged = /title\s*:\s*Never Gonna Give You Up/i.test(probe.stderr);
    if (!hasCover || !tagged) throw new Error(`cover ${hasCover}, tags ${tagged}`);
    return `${j.result.name} with cover and tags`;
  });

  const files = existsSync(out) ? readdirSync(out).map((n) => `${n} (${(statSync(path.join(out, n)).size / 1e6).toFixed(1)} MB)`) : [];
  console.log("FILES " + files.join(" | "));
  console.log(failed ? `SELFTEST FAILED (${failed})` : "SELFTEST OK");
  return failed ? 1 : 0;
}

export const wantsSelfTest = () => process.argv.includes("--self-test");

