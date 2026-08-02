import { Kroki } from "@/shared/Kroki";

export function MetamodelCard({ source }: { source: string }) {
  return (
    <div class="card border mt-3">
      <div class="card-header fw-bold">Metamodel</div>
      <div class="card-body bg-white">
        <Kroki source={source} />
      </div>
    </div>
  );
}
