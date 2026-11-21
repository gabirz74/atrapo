import { describe, expect, it } from "vitest";
import { pickBest, scoreCandidate } from "../src/main/engine/match";

const glacier = { title: "Glacier 3000", artists: ["Teho"], durationMs: 329_240 };

describe("matching a Spotify song to a video", () => {
  it("prefers the upload with the same length over longer extended or live versions", () => {
    const best = pickBest(glacier, [
      { id: "a", title: "Teho live from Glacier 3000, Switzerland | Cercle Stories", channel: "Cercle", duration: 495 },
      { id: "b", title: "Teho - Glacier 3000 (Original Mix)", channel: "Techno Wizard", duration: 496 },
      { id: "c", title: "Teho - Glacier 3000", channel: "ROMUL’ MUSIC", duration: 321 },
    ]);
    expect(best?.url).toContain("v=c");
    expect(best!.score).toBeGreaterThanOrEqual(45);
  });
  it("rejects a DJ-set clip that only mentions the song", () => {
    const track = { title: "Strange Days", artists: ["Kamilo Sanclemente"], durationMs: 480_000 };
    const s = scoreCandidate(track, { title: 'Hernan Cattaneo playing Kamilo Sanclemente - "Strange Days" (Original mix) @ ADE 2016', channel: "Hernan Cattaneo Fans", duration: 262 });
    expect(s).toBeLessThan(20);
  });
  it("loves an official Topic upload of the right length", () => {
    const track = { title: "Africa", artists: ["TOTO"], durationMs: 295_000 };
    expect(scoreCandidate(track, { title: "Africa", channel: "TOTO - Topic", duration: 295 })).toBeGreaterThan(90);
  });
});
