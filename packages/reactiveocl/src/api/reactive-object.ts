import type { ReadonlySignal } from "@core/signal";
import { Store } from "@core/store";
import { $pre } from "@core/transaction";
import type { ClassId } from "@core/types";
import { type OCLVal, vobj } from "@core/values";
import { TypedReactiveCollection } from "./reactive-collection";

export class ReactiveObject {
  private collections: Map<string, TypedReactiveCollection>;
  private readonly ancestry: readonly ClassId[];

  constructor(
    public readonly store: Store,
    public readonly classId: ClassId,
    public readonly oid: number,
    collections: Map<string, TypedReactiveCollection> = new Map(),
    ancestry: readonly ClassId[] = [classId],
  ) {
    this.collections = collections;
    this.ancestry = ancestry;
  }

  oclIsTypeOf(C: ClassId): boolean {
    return this.classId === C;
  }

  oclIsKindOf(C: ClassId): boolean {
    return this.ancestry.includes(C);
  }

  fieldValue(f: string): OCLVal | undefined {
    return this.store.read(`${this.classId}:${this.oid}:${f}`);
  }

  field(f: string): ReadonlySignal<OCLVal> {
    return this.store.getSignal(`${this.classId}:${this.oid}:${f}`)!;
  }

  int(f: string): number {
    const v = this.fieldValue(f);
    return v?.tag === "VInt" ? v.n : 0;
  }

  preInt(f: string): number {
    const sid = `${this.classId}:${this.oid}:${f}`;
    const pre = $pre(sid);
    return pre?.tag === "VInt" ? pre.n : this.int(f);
  }

  str(f: string): string {
    const v = this.fieldValue(f);
    return v?.tag === "VString" ? v.s : "";
  }

  bool(f: string): boolean {
    const v = this.fieldValue(f);
    return v?.tag === "VTrue";
  }

  collection(f: string): TypedReactiveCollection {
    return this.collections.get(f)!;
  }

  setInt(f: string, n: number): void {
    this.store.write(`${this.classId}:${this.oid}:${f}`, { tag: "VInt", n });
  }

  setString(f: string, str: string): void {
    this.store.write(`${this.classId}:${this.oid}:${f}`, { tag: "VString", s: str });
  }

  setBool(f: string, b: boolean): void {
    this.store.write(`${this.classId}:${this.oid}:${f}`, b ? { tag: "VTrue" } : { tag: "VFalse" });
  }

  toVal(): OCLVal {
    return vobj(this.oid, this.classId);
  }
}
