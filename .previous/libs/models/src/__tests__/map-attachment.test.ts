import { describe, expect, test } from "bun:test";
import { __test__ } from "../client";

const { mapAttachment } = __test__;

describe("mapAttachment", () => {
  test("passes text attachments through verbatim", () => {
    expect(mapAttachment({ type: "text", text: "hello" })).toEqual({
      type: "text",
      text: "hello",
    });
  });

  test("wraps code in a fenced markdown block with the language tag", () => {
    const out = mapAttachment({
      type: "code",
      code: "const x = 1;",
      language: "ts",
    });
    expect(out).toEqual({
      type: "text",
      text: "```ts\nconst x = 1;\n```",
    });
  });

  test("code without a language still produces a fence (empty language tag)", () => {
    const out = mapAttachment({ type: "code", code: "echo hi" });
    expect(out).toEqual({ type: "text", text: "```\necho hi\n```" });
  });

  test("decodes base64 string image data into a Buffer", () => {
    const b64 = Buffer.from("PNGDATA", "utf-8").toString("base64");
    const out = mapAttachment({
      type: "image",
      data: b64,
      mimeType: "image/png",
    });
    if (out.type !== "image") throw new Error("expected image");
    expect(out.type).toBe("image");
    expect(out.mimeType).toBe("image/png");
    expect(Buffer.isBuffer(out.image)).toBe(true);
    expect((out.image as Buffer).toString("utf-8")).toBe("PNGDATA");
  });

  test("passes Buffer image data through without re-encoding", () => {
    const buf = Buffer.from([0x01, 0x02, 0x03]);
    const out = mapAttachment({
      type: "image",
      data: buf,
      mimeType: "image/jpeg",
    });
    if (out.type !== "image") throw new Error("expected image");
    expect(out.image).toBe(buf); // same reference, no copy
    expect(out.mimeType).toBe("image/jpeg");
  });

  test("throws on an unknown attachment type", () => {
    // Cast through unknown to bypass the Attachment union on purpose.
    const bogus = { type: "audio", data: "x" } as unknown as Parameters<
      typeof mapAttachment
    >[0];
    expect(() => mapAttachment(bogus)).toThrow(/Unsupported attachment type/);
  });
});
