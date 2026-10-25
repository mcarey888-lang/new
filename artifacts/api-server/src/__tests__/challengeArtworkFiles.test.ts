import { describe, expect, it } from "vitest";
import { selectChallengeArtworkFile } from "../services/artwork/challengeArtworkFiles";
const file = (v: number, crop = "hero") => ({ name: `expedition-artwork/SIG053/v${v}/${crop}.jpg` });
describe("challenge artwork storage version selection", () => {
  it("selects latest numeric version, not the oldest lexicographic match", () => {
    expect(selectChallengeArtworkFile([file(2), file(1), file(10)], "hero")).toEqual(file(10));
  });
  it("serves exact approved version even when later candidates exist", () => {
    expect(selectChallengeArtworkFile([file(1), file(2), file(10)], "hero", 1)).toEqual(file(1));
  });
  it("never substitutes unapproved versions or different crops when approval is missing", () => {
    expect(selectChallengeArtworkFile([file(2), file(1, "card")], "hero", 1)).toBeUndefined();
  });
});
