import { EyeOpen, EyeClosed } from "@/shared/icons";

export function CodeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button class="btn btn-sm btn-outline-secondary border-0" onClick={onToggle}>
      {show ? <EyeOpen /> : <EyeClosed />}
    </button>
  );
}

export function CardHeader({
  title,
  showCodes,
  onToggle,
}: {
  title: string;
  showCodes: boolean;
  onToggle: () => void;
}) {
  return (
    <div class="card-header fw-bold d-flex justify-content-between align-items-center">
      <span>{title}</span>
      <CodeToggle show={showCodes} onToggle={onToggle} />
    </div>
  );
}
