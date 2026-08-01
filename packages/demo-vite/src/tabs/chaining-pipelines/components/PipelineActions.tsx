import { useState } from "preact/hooks";
import { addProduct } from "@/tabs/chaining-pipelines/model";

export function PipelineActions() {
  const [price, setPrice] = useState(200);
  const [quantity, setQuantity] = useState(20);

  const handleAdd = () => {
    if (price > 0 && quantity >= 0) addProduct(price, quantity);
  };

  return (
    <div class="card border-0 bg-primary text-white mb-3">
      <div class="card-header fw-bold border-light">Actions</div>
      <div class="card-body">
        <div class="mb-2">
          <label class="form-label">Price €</label>
          <input
            type="number"
            class="form-control"
            value={price}
            onInput={(e) => setPrice(Number(e.currentTarget.value))}
            min={0}
          />
        </div>
        <div class="mb-2">
          <label class="form-label">Quantity</label>
          <input
            type="number"
            class="form-control"
            value={quantity}
            onInput={(e) => setQuantity(Number(e.currentTarget.value))}
            min={0}
          />
        </div>
        <button class="btn btn-light w-100" onClick={handleAdd}>
          Add Product
        </button>
      </div>
    </div>
  );
}
