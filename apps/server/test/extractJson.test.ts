import { describe, it, expect } from "vitest";
import { extractJson } from "../src/ai/extractJson.js";

describe("extractJson", () => {
  it("returns parsed JSON when input is pure JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it("strips ```json fences", () => {
    expect(extractJson("```json\n{\"a\":2}\n```")).toEqual({ a: 2 });
  });
  it("strips ``` (no language tag)", () => {
    expect(extractJson("```\n{\"a\":3}\n```")).toEqual({ a: 3 });
  });
  it("finds the first JSON object embedded in prose", () => {
    expect(extractJson("Sure, here:\n{\"a\":4}\nThanks.")).toEqual({ a: 4 });
  });
  it("throws on no JSON", () => {
    expect(() => extractJson("nope")).toThrow();
  });
});
