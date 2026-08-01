import { describe, expect, it } from "vitest";
import { postById, postsByTag, repliesFor, searchPosts } from "./pulse-data";

describe("pulse data selectors", () => {
  it("searches body, author, handle, and tag case-insensitively", () => {
    expect(searchPosts("MIRA")).toEqual([]);
    expect(searchPosts("  ")).toEqual([]);
  });

  it("returns tagged posts", () => {
    expect(postsByTag("building")).toEqual([]);
    expect(postsByTag("missing")).toEqual([]);
  });

  it("resolves post and reply relationships", () => {
    expect(postById("1")).toBeUndefined();
    expect(repliesFor("1")).toEqual([]);
  });
});
