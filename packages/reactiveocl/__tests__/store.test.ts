import { describe, expect, it } from "bun:test";
import { Store } from "@core/store";
import { vint, vstring } from "@core/values";

describe("field cells", () => {
  it("a registered cell reads back the value it was registered with", () => {
    const s = new Store();
    s.register("C", 1, "f", vint(42));
    expect(s.read("C:1:f")).toEqual(vint(42));
  });

  it("register hands back the signal backing the cell", () => {
    const s = new Store();
    const sig = s.register("C", 1, "x", vint(1));
    expect(sig.value).toEqual(vint(1));
    sig.value = vint(99);
    expect(s.read("C:1:x")).toEqual(vint(99));
  });

  it("writing a cell replaces its value", () => {
    const s = new Store();
    s.register("C", 1, "f", vint(0));
    s.write("C:1:f", vint(10));
    expect(s.read("C:1:f")).toEqual(vint(10));
  });

  it("an unregistered cell reads as undefined rather than throwing", () => {
    const s = new Store();
    expect(s.read("nonexistent")).toBeUndefined();
    expect(s.getSignal("nonexistent")).toBeUndefined();
  });

  it("writing an unregistered cell fails loudly", () => {
    const s = new Store();
    expect(() => s.write("Nope:1:x", vint(1))).toThrow(/unregistered state cell/);
    expect(s.read("Nope:1:x")).toBeUndefined();
  });
});

describe("snapshots", () => {
  it("a snapshot captures every cell", () => {
    const s = new Store();
    s.register("A", 1, "x", vint(10));
    s.register("A", 1, "y", vstring("hi"));
    const snap = s.snapshot();
    expect(snap.get("A:1:x")).toEqual(vint(10));
    expect(snap.get("A:1:y")).toEqual(vstring("hi"));
  });

  it("restoring a snapshot undoes the writes made since", () => {
    const s = new Store();
    s.register("A", 1, "x", vint(10));
    const snap = s.snapshot();
    s.write("A:1:x", vint(99));
    expect(s.read("A:1:x")).toEqual(vint(99));
    s.restore(snap);
    expect(s.read("A:1:x")).toEqual(vint(10));
  });

  it("restoring ignores entries for cells that no longer exist", () => {
    const s = new Store();
    s.register("C", 1, "x", vint(1));
    const snap = s.snapshot();
    snap.set("Gone:1:x", vint(5));
    s.write("C:1:x", vint(2));
    s.restore(snap);
    expect(s.read("C:1:x")).toEqual(vint(1));
  });
});

describe("lazy recording", () => {
  it("records a cell once, at the value it held when recording began", () => {
    const s = new Store();
    s.register("C", 1, "x", vint(1));
    const heap = s.beginRecording();
    s.write("C:1:x", vint(10));
    s.write("C:1:x", vint(20));
    expect([...heap.entries()]).toEqual([["C:1:x", vint(1)]]);
  });

  it("stops recording once recording ends", () => {
    const s = new Store();
    s.register("C", 1, "y", vint(2));
    const heap = s.beginRecording();
    s.endRecording();
    s.write("C:1:y", vint(30));
    expect(heap.has("C:1:y")).toBe(false);
    expect(s.getSignal("C:1:y")!.value).toEqual(vint(30));
  });
});
