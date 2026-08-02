interface Props {
  name: string;
  satisfied: boolean;
  code: string;
  showCode: boolean;
}

export function InvariantStatus({ name, satisfied, code, showCode }: Props) {
  const cls = satisfied ? "alert-success" : "alert-danger";

  const check = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="me-2">
      <polyline
        points="4,13 9,18 20,5"
        stroke="#1a6d1a"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );

  const cross = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="me-2">
      <line
        x1="7"
        y1="7"
        x2="17"
        y2="17"
        stroke="#8B4513"
        stroke-width="3"
        stroke-linecap="round"
      />
      <line
        x1="17"
        y1="7"
        x2="7"
        y2="17"
        stroke="#8B4513"
        stroke-width="3"
        stroke-linecap="round"
      />
    </svg>
  );

  return (
    <div>
      <div class={`alert d-flex align-items-center py-2 mb-0 rounded-0 ${cls}`}>
        {satisfied ? check : cross}
        <strong>{name}</strong>
      </div>
      {showCode && (
        <pre class="bg-light border-top p-3 mb-0" style={{ whiteSpace: "normal" }}>
          {code}
        </pre>
      )}
    </div>
  );
}
