import { describe, expect, it } from "bun:test";
import { computed } from "@core/signal";
import { Store } from "@core/store";
import { Transaction } from "@core/transaction";
import { vint } from "@core/values";
import { TypedReactiveCollection } from "@api/reactive-collection";
import type { ReactiveObject } from "@api/reactive-object";
import { ReactiveStore } from "@api/reactive-store";

function cellStore(initial: number) {
  const store = new Store();
  store.register("C", 1, "x", vint(initial));
  const read = () => {
    const v = store.read("C:1:x");
    return v?.tag === "VInt" ? v.n : Number.NaN;
  };
  return { store, read };
}

function employees(salaries: number[]) {
  const store = new ReactiveStore();
  store.registerClass("Employee", { salary: { tag: "Int", initial: 0 } });
  const cls = store.getClass("Employee")!;
  const members = new TypedReactiveCollection(salaries.map((salary) => cls.create({ salary })));
  return { store, cls, members };
}

const salaryOf = (o: unknown) => (o as ReactiveObject).int("salary");

describe("committing and rolling back scalar fields", () => {
  it("a satisfied invariant keeps the mutation", () => {
    const { store, read } = cellStore(100);
    const ok$ = computed(() => read() > 0);

    const tx = new Transaction(store);
    tx.watch(ok$);
    tx.begin();
    tx.mutate(() => store.write("C:1:x", vint(200)));

    expect(tx.commit()).toBe(true);
    expect(read()).toBe(200);
  });

  it("a violated invariant restores the pre-state", () => {
    const { store, read } = cellStore(100);
    const ok$ = computed(() => read() < 200);

    const tx = new Transaction(store);
    tx.watch(ok$);
    tx.begin();
    tx.mutate(() => store.write("C:1:x", vint(300)));

    expect(tx.commit()).toBe(false);
    expect(read()).toBe(100);
  });

  it("mutating or committing outside a transaction fails loudly", () => {
    const tx = new Transaction(new Store());
    const notBegun = /Transaction not begun/;
    expect(() => tx.mutate(() => {})).toThrow(notBegun);
    expect(() => tx.commit()).toThrow(notBegun);
    expect(() => tx.rollback()).toThrow(notBegun);
  });
});

describe("pre-state through the typed accessors", () => {
  function account() {
    const store = new ReactiveStore();
    store.registerClass("Account", {
      balance: { tag: "Int", initial: 300 },
      label: { tag: "String", initial: "start" },
    });
    const obj = store.getClass("Account")!.create({});
    return { store, obj };
  }

  it("preInt reads the value the field held at begin, not the mutated one", () => {
    const { store, obj } = account();
    const tx = store.transaction();
    tx.begin();
    tx.mutate(() => obj.setInt("balance", 999));

    expect(obj.int("balance")).toBe(999);
    expect(obj.preInt("balance")).toBe(300);

    tx.commit();
  });

  it("preInt reads the current value for a field the transaction never touched", () => {
    const { store, obj } = account();
    const tx = store.transaction();
    tx.begin();
    tx.mutate(() => obj.setString("label", "changed"));

    expect(obj.preInt("balance")).toBe(300);
    tx.commit();
  });

  it("preInt falls back to the current value once the transaction is over", () => {
    const { store, obj } = account();
    const tx = store.transaction();
    tx.begin();
    tx.mutate(() => obj.setInt("balance", 999));
    tx.commit();

    expect(obj.preInt("balance")).toBe(999);
  });
});

describe("@pre reads", () => {
  it("reads the value a mutated field held at begin", () => {
    const { store } = cellStore(100);
    const tx = new Transaction(store);
    tx.begin();
    tx.mutate(() => store.write("C:1:x", vint(999)));

    expect(store.read("C:1:x")).toEqual(vint(999));
    expect(tx.$pre("C:1:x")).toEqual(vint(100));
    tx.commit();
  });

  it("is undefined outside a transaction", () => {
    expect(new Transaction(new Store()).$pre("C:1:x")).toBeUndefined();
  });
});

describe("reentrancy", () => {
  it("an inner transaction cannot steal the outer journal", () => {
    const { store, cls, members } = employees([100, 200]);
    const outer = store.transaction();
    const inner = store.transaction();

    outer.begin();
    inner.begin();
    outer.mutate(() => members.add(cls.create({ salary: 300 })));
    inner.mutate(() => members.add(cls.create({ salary: 400 })));

    inner.rollback();
    expect(members.size().value).toBe(3);

    outer.rollback();
    expect(members.size().value).toBe(2);
  });

  it("pre-state resolves to the innermost active transaction", () => {
    const { store, read } = cellStore(100);
    const outer = new Transaction(store);
    const inner = new Transaction(store);

    outer.begin();
    outer.mutate(() => store.write("C:1:x", vint(200)));
    inner.begin();
    inner.mutate(() => store.write("C:1:x", vint(300)));
    expect(read()).toBe(300);
    expect(inner.$pre("C:1:x")).toEqual(vint(200));
    expect(outer.$pre("C:1:x")).toEqual(vint(100));

    inner.rollback();
    expect(read()).toBe(200);

    outer.rollback();
    expect(read()).toBe(100);
  });

  it("a direct collection edit between begin and commit is still journaled", () => {
    const { store, cls, members } = employees([100, 200]);
    const tx = store.transaction();

    tx.begin();
    members.add(cls.create({ salary: 300 }));
    expect(members.size().value).toBe(3);

    tx.rollback();
    expect(members.size().value).toBe(2);
  });
});

describe("rolling back collection membership", () => {
  it("additions survive a successful commit", () => {
    const { store, cls, members } = employees([100, 200]);
    const size$ = members.size();
    const ok$ = members.forAll((o) => salaryOf(o) > 0);

    const tx = store.transaction(ok$);
    tx.begin();
    tx.mutate(() => members.add(cls.create({ salary: 300 })));

    expect(tx.commit()).toBe(true);
    expect(size$.value).toBe(3);
    expect(members.objects.value).toHaveLength(3);
  });

  it("an addition that breaks an invariant is undone", () => {
    const { store, cls, members } = employees([100, 200]);
    const size$ = members.size();
    const ok$ = members.forAll((o) => salaryOf(o) >= 50);

    const tx = store.transaction(ok$);
    tx.begin();
    tx.mutate(() => members.add(cls.create({ salary: 10 })));
    expect(size$.value).toBe(3);

    expect(tx.commit()).toBe(false);
    expect(size$.value).toBe(2);
    expect(members.objects.value).toHaveLength(2);
    expect(ok$.value).toBe(true);
  });

  it("a removal that breaks an invariant is undone", () => {
    const { store, members } = employees([100, 200, 300]);
    const size$ = members.size();
    const ok$ = members.forAll(() => size$.value >= 3);
    const victim = members.objects.value[0] as ReactiveObject;

    const tx = store.transaction(ok$);
    tx.begin();
    tx.mutate(() => members.removeByOid(victim.classId, victim.oid));
    expect(size$.value).toBe(2);

    expect(tx.commit()).toBe(false);
    expect(size$.value).toBe(3);
    expect(members.objects.value.map((o) => (o as ReactiveObject).oid).sort()).toEqual([1, 2, 3]);
  });

  it("a batch of mixed deltas is undone newest first", () => {
    const { store, cls, members } = employees([100, 200, 300]);
    const size$ = members.size();
    const sum$ = members.collect(salaryOf).sum();
    const ok$ = members.forAll(() => sum$.value <= 600);
    const victim = members.objects.value[0] as ReactiveObject;

    const tx = store.transaction(ok$);
    tx.begin();
    tx.mutate(() => {
      members.removeByOid(victim.classId, victim.oid);
      members.addAll([cls.create({ salary: 400 }), cls.create({ salary: 500 })]);
      members.add(cls.create({ salary: 600 }));
    });

    expect(tx.commit()).toBe(false);
    expect(size$.value).toBe(3);
    expect(sum$.value).toBe(600);
  });

  it("derived views are restored along with their source", () => {
    const { store, cls, members } = employees([100, 200]);
    const rich = members.select((o) => salaryOf(o) >= 200);
    const richCount$ = rich.size();
    const ok$ = members.forAll(() => richCount$.value <= 1);

    const tx = store.transaction(ok$);
    tx.begin();
    tx.mutate(() => members.add(cls.create({ salary: 900 })));
    expect(richCount$.value).toBe(2);

    expect(tx.commit()).toBe(false);
    expect(richCount$.value).toBe(1);
    expect(rich.objects.value).toHaveLength(1);
  });

  it("membership and scalar fields are restored together", () => {
    const store = new ReactiveStore();
    store.registerClass("Team", { budget: { tag: "Int", initial: 1000 } });
    store.registerClass("Employee", { salary: { tag: "Int", initial: 0 } });
    const team = store.getClass("Team")!.create({ budget: 1000 });
    const cls = store.getClass("Employee")!;
    const members = new TypedReactiveCollection([cls.create({ salary: 100 })]);
    const size$ = members.size();
    const ok$ = members.forAll(() => team.int("budget") >= 1000);

    const tx = store.transaction(ok$);
    tx.begin();
    tx.mutate(() => {
      team.setInt("budget", 10);
      members.add(cls.create({ salary: 700 }));
    });

    expect(tx.commit()).toBe(false);
    expect(team.int("budget")).toBe(1000);
    expect(size$.value).toBe(1);
  });

  it("rollback discards staged edits even when every invariant holds", () => {
    const { store, cls, members } = employees([100, 200]);
    const size$ = members.size();
    const ok$ = members.forAll(() => true);

    const tx = store.transaction(ok$);
    tx.begin();
    tx.mutate(() => members.addAll([cls.create({ salary: 300 }), cls.create({ salary: 400 })]));
    expect(size$.value).toBe(4);

    tx.rollback();
    expect(size$.value).toBe(2);
  });

  it("edits made before the transaction are never undone", () => {
    const { store, cls, members } = employees([100]);
    members.add(cls.create({ salary: 200 }));
    const size$ = members.size();
    const ok$ = members.forAll(() => false);

    const tx = store.transaction(ok$);
    tx.begin();
    tx.mutate(() => {});

    expect(tx.commit()).toBe(false);
    expect(size$.value).toBe(2);
  });
});
