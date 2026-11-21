/**
 * File names keep the ORIGINAL title. Only characters that file systems reject are swapped
 * for their full-width look-alikes, so "AC/DC: Back In Black" stays readable.
 */
const SUBSTITUTIONS: Record<string, string> = {
  "/": "⧸",
  "\\": "⧹",
  ":": "：",
  "*": "＊",
  "?": "？",
  '"': "＂",
  "<": "＜",
  ">": "＞",
  "|": "｜",
};

const RESERVED_WINDOWS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function sanitizeName(input: string | undefined | null, fallback = "archivo", maxBytes = 200): string {
  let s = (input ?? "").normalize("NFC");
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u001f\u007f]/g, "");
  s = s.replace(/[\/\\:*?"<>|]/g, (c) => SUBSTITUTIONS[c] ?? "_");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/^\.+/, "").replace(/[. ]+$/, "");
  if (!s || RESERVED_WINDOWS.test(s)) s = fallback;
  return truncateBytes(s, maxBytes);
}

function truncateBytes(s: string, maxBytes: number): string {
  if (Buffer.byteLength(s) <= maxBytes) return s;
  let out = "";
  for (const ch of s) {
    // "…" is 3 bytes in UTF-8
    if (Buffer.byteLength(out + ch) > maxBytes - 3) break;
    out += ch;
  }
  return out.trim() + "…";
}

/** "name.ext" -> {name, ext} where ext includes the dot (or ""). */
export function splitExt(file: string): { name: string; ext: string } {
  const i = file.lastIndexOf(".");
  if (i <= 0 || file.length - i > 6) return { name: file, ext: "" };
  return { name: file.slice(0, i), ext: file.slice(i) };
}

/** Returns a name not present in `used` (case-insensitive), adding " (2)", " (3)"… and records it. */
export function uniqueName(fileName: string, used: Set<string>): string {
  const { name, ext } = splitExt(fileName);
  let candidate = fileName;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${name} (${n})${ext}`;
    n++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/** Content-Disposition with UTF-8 name (RFC 5987) and an ASCII fallback. */
export function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
