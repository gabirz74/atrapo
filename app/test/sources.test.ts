import { describe, expect, it } from "vitest";
import { extractUrls, parseSpotify, parseUrl } from "../src/main/engine/sources";

describe("parseUrl", () => {
  it("accepts supported sites and normalizes to https", () => {
    expect(parseUrl("http://youtu.be/abc")?.source).toBe("youtube");
    expect(parseUrl("open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M")?.source).toBe("spotify");
    expect(parseUrl("https://es.pinterest.com/pin/123/")?.source).toBe("pinterest");
    expect(parseUrl("https://www.pinterest.co.uk/user/board/")?.source).toBe("pinterest");
    expect(parseUrl("https://x.com/u/status/1")?.source).toBe("twitter");
  });
  it("rejects unknown hosts, look-alikes, IPs, odd ports and credentials (SSRF guard)", () => {
    for (const bad of [
      "https://evil.com/youtube.com",
      "https://youtube.com.evil.com/x",
      "https://notyoutube.com/x",
      "http://127.0.0.1/x",
      "http://169.254.169.254/latest/meta-data",
      "http://localhost:8787/api",
      "https://youtube.com:8443/x",
      "https://user:pw@youtube.com/x",
      "file:///etc/passwd",
      "ftp://youtube.com/x",
      "javascript:alert(1)",
      "",
    ]) {
      expect(parseUrl(bad), bad).toBeNull();
    }
  });
});

describe("parseSpotify", () => {
  it("reads kind and id, with locale prefix", () => {
    expect(parseSpotify("https://open.spotify.com/intl-es/track/4cOdK2wGLETKBW3PvgPWqT?si=x")).toEqual({ kind: "track", id: "4cOdK2wGLETKBW3PvgPWqT" });
    expect(parseSpotify("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M")?.kind).toBe("playlist");
    expect(parseSpotify("https://open.spotify.com/artist/abc")).toBeNull();
  });
});

describe("extractUrls", () => {
  it("splits on whitespace and commas and dedupes", () => {
    expect(extractUrls("a b\nb,c")).toEqual(["a", "b", "c"]);
  });
});
