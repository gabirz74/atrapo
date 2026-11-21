import { spawn, execFile } from "node:child_process";

export class AbortError extends Error {
  constructor() {
    super("Cancelado");
    this.name = "AbortError";
  }
}

export interface RunOptions {
  signal?: AbortSignal;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  /** Max bytes of stdout kept in memory. */
  maxBuffer?: number;
  onStdoutLine?: (line: string) => void;
  onStderrLine?: (line: string) => void;
}

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Stops a process and everything it started (yt-dlp.exe on Windows spawns a child of its own). */
function killTree(pid: number | undefined, force: boolean) {
  if (!pid) return;
  if (process.platform === "win32") {
    execFile("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true }, () => {});
  } else {
    try {
      process.kill(pid, force ? "SIGKILL" : "SIGTERM");
    } catch {
      /* already gone */
    }
  }
}

export function run(cmd: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) return reject(new AbortError());
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, PYTHONWARNINGS: "ignore", PYTHONUNBUFFERED: "1", ...opts.env },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const maxBuffer = opts.maxBuffer ?? 64 * 1024 * 1024;
    const out: Buffer[] = [];
    let outSize = 0;
    let errTail = "";
    let outPending = "";
    let errPending = "";
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    let killTimer: NodeJS.Timeout | undefined;

    const kill = () => {
      killTree(child.pid, false);
      killTimer = setTimeout(() => killTree(child.pid, true), 3000);
    };
    const onAbort = () => kill();
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    if (opts.timeoutMs) timer = setTimeout(kill, opts.timeoutMs);

    const splitLines = (pending: string, chunk: string, cb?: (l: string) => void): string => {
      const text = pending + chunk;
      const parts = text.split(/[\r\n]+/);
      const rest = parts.pop() ?? "";
      if (cb) for (const p of parts) if (p) cb(p);
      return rest;
    };

    child.stdout.on("data", (b: Buffer) => {
      if (outSize < maxBuffer) {
        out.push(b);
        outSize += b.length;
      }
      if (opts.onStdoutLine) outPending = splitLines(outPending, b.toString("utf8"), opts.onStdoutLine);
    });
    child.stderr.on("data", (b: Buffer) => {
      const s = b.toString("utf8");
      errTail = (errTail + s).slice(-16 * 1024);
      if (opts.onStderrLine) errPending = splitLines(errPending, s, opts.onStderrLine);
    });

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      opts.signal?.removeEventListener("abort", onAbort);
      fn();
    };

    child.on("error", (err) => finish(() => reject(err)));
    child.on("close", (code) => {
      if (opts.onStdoutLine && outPending) opts.onStdoutLine(outPending);
      finish(() => {
        if (opts.signal?.aborted) return reject(new AbortError());
        resolve({ code, stdout: Buffer.concat(out).toString("utf8"), stderr: errTail });
      });
    });
  });
}

/** Last meaningful "ERROR:" line of a tool's stderr, for user-facing messages. */
export function friendlyError(stderr: string, fallback = "No se pudo completar la descarga"): string {
  if (process.env.ATRAPO_DEBUG) console.error("[tool stderr]", stderr.slice(-700));
  const lines = stderr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const err = [...lines].reverse().find((l) => /^ERROR:|\[error\]|error:/i.test(l));
  const msg = (err ?? lines[lines.length - 1] ?? fallback).replace(/^ERROR:\s*(\[[^\]]+\]\s*[\w-]+:\s*)?/i, "");
  if (/Sign in to confirm|not a bot|HTTP Error 429|Too Many Requests/i.test(stderr))
    return "El origen está limitando las peticiones desde tu conexión. Espera unos minutos y reintenta.";
  if (/Private video|This video is private/i.test(stderr)) return "El vídeo es privado.";
  if (/Video unavailable|not available|removed/i.test(stderr)) return "El contenido no está disponible.";
  if (/Unsupported URL/i.test(stderr)) return "Este enlace no es compatible.";
  if (/HTTP Error 403/i.test(stderr)) return "El origen rechazó la descarga por un momento.";
  if (/ENOTFOUND|getaddrinfo|Temporary failure in name resolution|Unable to download|timed out/i.test(stderr))
    return "No hay conexión con el origen. Comprueba tu internet.";
  return msg.slice(0, 240);
}
