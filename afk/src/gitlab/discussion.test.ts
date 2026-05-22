import { describe, expect, it } from "vitest";
import { toDiscussionSummary } from "./discussion";

describe("toDiscussionSummary", () => {
  it("maps a resolved discussion", () => {
    const raw = {
      id: "abc",
      notes: [{ body: "finding", resolvable: true, resolved: true, author: { username: "afk" } }],
    };
    expect(toDiscussionSummary(raw)).toEqual({
      id: "abc",
      resolved: true,
      notes: [{ author: "afk", body: "finding" }],
    });
  });

  it("is unresolved when any resolvable note is unresolved", () => {
    const raw = {
      id: "x",
      notes: [
        { body: "a", resolvable: true, resolved: true, author: { username: "u" } },
        { body: "b", resolvable: true, resolved: false, author: { username: "u" } },
      ],
    };
    expect(toDiscussionSummary(raw).resolved).toBe(false);
  });

  it("treats a discussion with no resolvable notes as resolved (non-blocking)", () => {
    const raw = { id: "sys", notes: [{ body: "system note", resolvable: false, author: null }] };
    expect(toDiscussionSummary(raw).resolved).toBe(true);
  });

  it("falls back to 'unknown' for a missing author", () => {
    const raw = {
      id: "x",
      notes: [{ body: "b", resolvable: true, resolved: false, author: null }],
    };
    expect(toDiscussionSummary(raw).notes[0]?.author).toBe("unknown");
  });

  it("keeps every note (resolvable or not) in the summary", () => {
    const raw = {
      id: "x",
      notes: [
        { body: "root", resolvable: true, resolved: false, author: { username: "a" } },
        { body: "reply", resolvable: false, author: { username: "b" } },
      ],
    };
    expect(toDiscussionSummary(raw).notes).toHaveLength(2);
  });

  it("is unresolved when a resolvable note has no `resolved` key", () => {
    const raw = { id: "x", notes: [{ body: "b", resolvable: true, author: { username: "u" } }] };
    expect(toDiscussionSummary(raw).resolved).toBe(false);
  });

  it("handles garbage / empty input without throwing", () => {
    expect(toDiscussionSummary(null)).toEqual({ id: "", resolved: true, notes: [] });
    expect(toDiscussionSummary({})).toEqual({ id: "", resolved: true, notes: [] });
    expect(toDiscussionSummary({ id: 5, notes: "nope" })).toEqual({
      id: "5",
      resolved: true,
      notes: [],
    });
  });

  it("drops non-object note entries instead of throwing", () => {
    const raw = {
      id: "x",
      notes: [
        null,
        5,
        { body: "real", resolvable: true, resolved: true, author: { username: "u" } },
      ],
    };
    const summary = toDiscussionSummary(raw);
    expect(summary.notes).toEqual([{ author: "u", body: "real" }]);
    expect(summary.resolved).toBe(true);
  });
});
