import { describe, expect, it } from "vitest";
import { parseVerdict, VERDICT_TOKENS } from "./verdict";

describe("parseVerdict", () => {
  it("extracts a verdict that is the last line", () => {
    expect(parseVerdict("did the work\nVERDICT: READY_FOR_REVIEW")).toBe("READY_FOR_REVIEW");
  });

  it.each(VERDICT_TOKENS)("accepts known token %s", (token) => {
    expect(parseVerdict(`summary line\nVERDICT: ${token}`)).toBe(token);
  });

  it("ignores trailing blank / whitespace-only lines after the verdict", () => {
    expect(parseVerdict("done\nVERDICT: CONVERGED\n\n  \n")).toBe("CONVERGED");
  });

  it("tolerates trailing whitespace on the verdict line itself", () => {
    expect(parseVerdict("done\nVERDICT: FIX_DONE   ")).toBe("FIX_DONE");
  });

  it("returns null when there is no verdict line", () => {
    expect(parseVerdict("I think the work is done now.")).toBeNull();
  });

  it("does not match a token mentioned inside prose", () => {
    expect(parseVerdict("it is not yet READY_FOR_REVIEW so I keep going")).toBeNull();
  });

  it("returns null when the verdict is not the last non-empty line", () => {
    expect(parseVerdict("VERDICT: FIX_DONE\nactually, one more thing")).toBeNull();
  });

  it("returns null on multiple verdict lines (ambiguous)", () => {
    expect(parseVerdict("VERDICT: NEEDS_FIX\nVERDICT: CONVERGED")).toBeNull();
  });

  it("returns null on a well-formed line carrying an unknown token", () => {
    expect(parseVerdict("VERDICT: ALL_GOOD")).toBeNull();
  });

  it("requires the exact 'VERDICT: ' prefix", () => {
    expect(parseVerdict("verdict: CONVERGED")).toBeNull();
    expect(parseVerdict("VERDICT:CONVERGED")).toBeNull();
    expect(parseVerdict("  VERDICT: CONVERGED")).toBe("CONVERGED");
  });

  it("returns null on an empty message", () => {
    expect(parseVerdict("")).toBeNull();
    expect(parseVerdict("   \n  \n")).toBeNull();
  });

  it("handles CRLF line endings", () => {
    expect(parseVerdict("did work\r\nVERDICT: CONVERGED\r\n")).toBe("CONVERGED");
  });

  it("returns null when a standalone VERDICT line also appears earlier", () => {
    expect(parseVerdict("VERDICT: NEEDS_FIX\nmore text\nVERDICT: CONVERGED")).toBeNull();
  });

  it("returns null on trailing content after the token on the verdict line", () => {
    expect(parseVerdict("done\nVERDICT: CONVERGED now")).toBeNull();
  });
});
