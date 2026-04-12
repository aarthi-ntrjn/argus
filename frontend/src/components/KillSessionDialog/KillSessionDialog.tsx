interface KillSessionDialogProps {
  open: boolean;
  sessionType?: string;
  sessionId?: string;
  isPending?: boolean;
  error?: Error | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function KillSessionDialog({
  open,
  sessionType,
  sessionId,
  isPending = false,
  error = null,
  onConfirm,
  onCancel,
}: KillSessionDialogProps) {
  if (!open) return null;

  const shortId = sessionId?.slice(0, 8) ?? 'unknown';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="kill-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-5">
        <h2 id="kill-dialog-title" className="text-sm font-semibold text-gray-900 mb-2">
          Kill Session
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to terminate this{' '}
          <span className="font-medium">{sessionType ?? 'AI'}</span>{' '}
          session (<code className="text-xs bg-gray-100 px-1 rounded">{shortId}</code>)?
          The process will be force-killed and cannot be resumed.
        </p>
        {error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">
            {error.message}
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-3 py-1.5 text-sm text-white bg-red-600 rounded hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isPending ? 'Killing...' : 'Kill Session'}
          </button>
        </div>
      </div>
    </div>
  );
}
