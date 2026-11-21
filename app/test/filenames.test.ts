import { describe, expect, it } from "vitest";
import { contentDisposition, sanitizeName, splitExt, uniqueName } from "../src/main/engine/filenames";

describe("sanitizeName", () => {
  it("keeps the original title, accents and emojis", () => {
    expect(sanitizeName("Canción de prueba 🎵 – Año")).toBe("Canción de prueba 🎵 – Año");
  });
  it("swaps only illegal characters for look-alikes", () => {
    expect(sanitizeName('AC/DC: Back In Black?')).toBe("AC⧸DC： Back In Black？");
    expect(sanitizeName('a<b>c|d"e*f\\g')).toBe("a＜b＞c｜d＂e＊f⧹g");
  });
  it("trims dots/spaces and avoids reserved names", () => {
    expect(sanitizeName("  ..hola.. ")).toBe("hola");
    expect(sanitizeName("CON")).toBe("archivo");
    expect(sanitizeName("")).toBe("archivo");
  });
  it("limits to a byte length without cutting characters", () => {
    const long = "ñ".repeat(300);
    const s = sanitizeName(long, "x", 100);
    expect(Buffer.byteLength(s)).toBeLessThanOrEqual(100);
    expect(s.endsWith("…")).toBe(true);
  });
});

describe("uniqueName", () => {
  it("adds (2), (3) on duplicates, case-insensitive", () => {
    const used = new Set<string>();
    expect(uniqueName("a.mp3", used)).toBe("a.mp3");
    expect(uniqueName("A.mp3", used)).toBe("A (2).mp3");
    expect(uniqueName("a.mp3", used)).toBe("a (3).mp3");
  });
  it("splitExt ignores dots that are not extensions", () => {
    expect(splitExt("Mr. Brightside")).toEqual({ name: "Mr. Brightside", ext: "" });
    expect(splitExt("x.tar.gz")).toEqual({ name: "x.tar", ext: ".gz" });
  });
});

describe("contentDisposition", () => {
  it("includes a UTF-8 filename* and an ASCII fallback", () => {
    const h = contentDisposition("Canción 🎵.mp3");
    expect(h).toContain("filename*=UTF-8''Canci%C3%B3n%20%F0%9F%8E%B5.mp3");
    expect(h).toMatch(/filename="Canci_n __?\.mp3"/);
  });
});
