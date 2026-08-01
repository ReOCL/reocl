import { products$, removeProduct } from "@/tabs/chaining-pipelines/model";
import { inStock$, itemValues$, totalInventoryValue$ } from "@/tabs/chaining-pipelines/invariants";
import { TOTAL_INVENTORY_LIMIT } from "@/tabs/chaining-pipelines/config";
import { PackageIcon, TrashIcon } from "@/shared/icons";

function Step({ op }: { op: string }) {
  return <div class="text-center text-secondary py-1">↓ {op}</div>;
}

function StageCard({ children }: { children: any }) {
  return (
    <div class="card border mb-2">
      <div class="card-body p-2">{children}</div>
    </div>
  );
}

export function PipelineCard() {
  const allProducts = products$.objects.value;
  const inStock = inStock$.objects.value;
  const itemValues = itemValues$.numbers().value;
  const totalValue = totalInventoryValue$.value;

  return (
    <div>
      <StageCard>
        <div class="table-responsive">
          <table class="table table-sm mb-0">
            <thead class="table-dark">
              <tr>
                <th></th>
                <th>Name</th>
                <th>Price (€)</th>
                <th>Qty</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {allProducts.map((p) => (
                <tr key={p.obj.oid}>
                  <td class="text-center">
                    <PackageIcon />
                  </td>
                  <td>{p.name$.value}</td>
                  <td>{p.price$.value.toLocaleString()}</td>
                  <td>{p.quantity$.value}</td>
                  <td class="text-center">
                    <button
                      class="btn btn-sm border-0 text-secondary p-0"
                      onClick={() => removeProduct(p.obj.oid)}
                      title="Remove"
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StageCard>

      <Step op={`select (quantity > 0)`} />

      <StageCard>
        <div class="table-responsive">
          <table class="table table-sm mb-0">
            <thead class="table-dark">
              <tr>
                <th></th>
                <th>Name</th>
                <th>Price (€)</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {inStock.map((p) => (
                <tr key={p.obj.oid}>
                  <td class="text-center">
                    <PackageIcon />
                  </td>
                  <td>{p.name$.value}</td>
                  <td>{p.price$.value.toLocaleString()}</td>
                  <td>{p.quantity$.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StageCard>

      <Step op={`collect (price × quantity)`} />

      <StageCard>
        <div class="d-flex flex-wrap gap-2">
          {itemValues.map((n, i) => (
            <span key={i} class="badge bg-light text-dark border">
              {n.toLocaleString()}€
            </span>
          ))}
        </div>
      </StageCard>

      <Step op="sum" />

      <StageCard>
        <div class={totalValue >= TOTAL_INVENTORY_LIMIT ? "text-danger" : ""}>
          <span class="fs-5 fw-bold">{totalValue.toLocaleString()}€</span>
          <span class="text-secondary ms-2">/ {TOTAL_INVENTORY_LIMIT.toLocaleString()}€ limit</span>
        </div>
      </StageCard>
    </div>
  );
}
