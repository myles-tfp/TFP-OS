"use client";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
  busy = false,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
