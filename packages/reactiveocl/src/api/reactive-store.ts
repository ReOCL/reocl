import type { ReadonlySignal } from "@core/signal";
import { Store } from "@core/store";
import { Transaction } from "@core/transaction";
import {
  TBool,
  TCollection,
  TInt,
  TObject,
  TString,
  type ClassId,
  type MetaModel,
  type OCLType,
} from "@core/types";
import { type OCLVal, VFalse, vint, vstring, VTrue } from "@core/values";
import { TypedReactiveCollection } from "./reactive-collection";
import { ReactiveObject } from "./reactive-object";

export type FieldDef =
  | { tag: "Int"; initial: number }
  | { tag: "String"; initial: string }
  | { tag: "Bool"; initial: boolean }
  | { tag: "Collection"; elementClass: ClassId };

export type FieldDefMap = Record<string, FieldDef>;

export interface ClassOptions {
  extends?: ClassId;
}

function fieldDefType(def: FieldDef): OCLType {
  switch (def.tag) {
    case "Int":
      return TInt;
    case "String":
      return TString;
    case "Bool":
      return TBool;
    case "Collection":
      return TCollection(TObject(def.elementClass));
  }
}

export class RegisteredClass {
  constructor(
    public readonly classId: ClassId,
    public readonly fields: FieldDefMap,
    private store: Store,
    private oidSource: () => number,
    public readonly superclass: ClassId | null = null,
    public readonly ancestry: readonly ClassId[] = [classId],
  ) {}

  create(fieldValues: Record<string, number | string | boolean>): ReactiveObject {
    const oid = this.oidSource();
    const collections = new Map<string, TypedReactiveCollection>();

    for (const [fname, def] of Object.entries(this.fields)) {
      if (def.tag === "Collection") {
        collections.set(fname, new TypedReactiveCollection([]));
        continue;
      }
      let val: OCLVal;
      if (fname in fieldValues) {
        const v = fieldValues[fname]!;
        switch (def.tag) {
          case "Int":
            val = vint(v as number);
            break;
          case "String":
            val = vstring(v as string);
            break;
          case "Bool":
            val = (v as boolean) ? VTrue : VFalse;
            break;
        }
      } else {
        switch (def.tag) {
          case "Int":
            val = vint(def.initial);
            break;
          case "String":
            val = vstring(def.initial);
            break;
          case "Bool":
            val = def.initial ? VTrue : VFalse;
            break;
        }
      }
      this.store.register(this.classId, oid, fname, val);
    }
    return new ReactiveObject(this.store, this.classId, oid, collections, this.ancestry);
  }
}

export class ReactiveStore {
  private readonly store: Store;
  private readonly classes: Map<ClassId, RegisteredClass>;
  private readonly nextOid: Map<ClassId, number>;

  constructor() {
    this.store = new Store();
    this.classes = new Map();
    this.nextOid = new Map();
  }

  get core(): Store {
    return this.store;
  }

  registerClass(
    classId: ClassId,
    fields: FieldDefMap,
    options: ClassOptions = {},
  ): RegisteredClass {
    const superclass = options.extends ?? null;
    if (superclass !== null && !this.classes.has(superclass)) {
      throw new Error(
        `Cannot register "${classId}": superclass "${superclass}" is not registered yet`,
      );
    }
    const parent = superclass !== null ? this.classes.get(superclass)! : null;
    const inherited = parent ? parent.fields : {};
    const ancestry = parent ? [classId, ...parent.ancestry] : [classId];

    this.nextOid.set(classId, 1);
    const cls = new RegisteredClass(
      classId,
      { ...inherited, ...fields },
      this.store,
      () => {
        const n = this.nextOid.get(classId)!;
        this.nextOid.set(classId, n + 1);
        return n;
      },
      superclass,
      ancestry,
    );
    this.classes.set(classId, cls);
    return cls;
  }

  getClass(classId: ClassId): RegisteredClass | undefined {
    return this.classes.get(classId);
  }

  get metaModel(): MetaModel {
    return {
      fieldType: (C, f) => {
        const def = this.classes.get(C)?.fields[f];
        return def ? fieldDefType(def) : null;
      },
      extends: (sub, sup) => this.classes.get(sub)?.ancestry.includes(sup) ?? false,
    };
  }

  transaction(...invariants: ReadonlySignal<boolean>[]): Transaction {
    const tx = new Transaction(this.store);
    for (const inv of invariants) tx.watch(inv);
    return tx;
  }
}
