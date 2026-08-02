<img src="docs/logo.png" width=300/>

# ReOCL

**ReOCL** is a reactive core of the Object Constraint Language (OCL) for TypeScript web applications. It compiles OCL invariants into reactive signals, providing incremental validation via delta-based collection maintenance and transactional `@pre` support.

## Installation

```bash
bun install
```

## Usage

```ts
import { ReactiveStore, invariant, intSignal, computed } from "reactiveocl";

// 1. Register the meta-model
const store = new ReactiveStore();
store.registerClass("PersonAccount", {
  checking: { tag: "Int", initial: 300 },
  savings:  { tag: "Int", initial: 700 },
});

// 2. Compile invariants into reactive signals
class CompiledPersonAccount {
  constructor(store, checking, savings) {
    this.obj = store.getClass("PersonAccount").create({ checking, savings });
    this.checking$ = intSignal(this.obj, "checking");
    this.savings$ = intSignal(this.obj, "savings");
    this.conservation$ = computed(() => {
      const curr = this.checking$.value + this.savings$.value;
      const prev = this.obj.preInt("checking") + this.obj.preInt("savings");
      return curr === prev;
    });
  }
}

const pa = new CompiledPersonAccount(store, 300, 700);
const inv = invariant("conservation", pa.conservation$,
  "self.checking + self.savings = self.checking@pre + self.savings@pre");

// 3. Wrap mutations in transactions
const tx = store.transaction(inv.value$);

function doTransfer(amount: number, from: string, to: string) {
  tx.begin();
  tx.mutate(() => {
    pa.obj.setInt(from, pa.obj.int(from) - amount);
    pa.obj.setInt(to,   pa.obj.int(to) + amount);
  });
  return tx.commit(); // rolls back if conservation$ is false
}

// 4. Integrate into your UI - signals auto-update
function TransactionDemo() {
  return <div>
    <button onClick={() => doTransfer(100, "savings", "checking")}>To Checking</button>
    <BalanceCard />
  </div>;
}

function BalanceCard() {
  return <div>
    <p>Checking: {pa.checking$.value}</p>
    <p>Savings: {pa.savings$.value}</p>
    <p>Conservation: {pa.conservation$.value ? "OK" : "VIOLATED"}</p>
  </div>;
}
```

See [`packages/demo-minimal/index.html`](packages/demo-minimal/index.html) for a live browser demo (run `bun run demo-minimal:build`, then `bun run demo-minimal:serve` to open [localhost:3000](http://localhost:3000)).

## Structure

This [Bun monorepo](https://bun.com/docs/guides/install/workspaces) contains four packages:

- [reactiveocl](packages/reactiveocl/) - core library (signals, store, transactions, incremental collections)
- [demo-vite](packages/demo-vite/) - interactive Vite demo showcasing the library
- [demo-minimal](packages/demo-minimal/) - single-file HTML demo (`bun run demo-minimal:build && bun run demo-minimal:serve`)
- [benchmark](packages/benchmark/) - performance benchmarks

## Development

```bash
# Run the full demo
bun run demo

# Build and serve the minimal demo
# at localhost:3000
bun run demo-minimal:build
bun run demo-minimal:serve

# Test, lint, or format
bun run test
bun run lint
bun run format
```

## License

MIT
