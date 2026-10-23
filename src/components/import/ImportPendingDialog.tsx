import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export type ImportPendingItem = { key: string; label: string };
export type ImportModuleStatus = { key: string; label: string; value: number | string; pending: boolean };

type ImportPendingDialogProps = {
  open: boolean;
  pendingItems: ImportPendingItem[];
  moduleStatuses?: ImportModuleStatus[];
  onSkip: () => void;
  /** When false (e.g. on Import Data page), only "Skip" is shown. */
  showGoToImport?: boolean;
};

export function ImportPendingDialog({
  open,
  pendingItems,
  moduleStatuses = [],
  onSkip,
  showGoToImport = true,
}: ImportPendingDialogProps) {
  if (!open) return null;
  const hasStatusList = Array.isArray(moduleStatuses) && moduleStatuses.length > 0;
  if (!hasStatusList && pendingItems.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]">
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-pending-title"
      >
        <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50 to-white px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <AlertCircle className="h-5 w-5 text-amber-600" aria-hidden />
            </div>
            <div className="min-w-0 pt-0.5">
              <h3 id="import-pending-title" className="text-lg font-semibold tracking-tight text-gray-900">
                Import actions pending
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
                The following masters still have no records (count is 0). Add them from{" "}
                <span className="font-medium text-gray-800">Import Data</span> when ready. You can skip for
                now; this reminder returns on your next visit until each count is above zero.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Masters to complete</p>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-100 bg-gray-50/80">
            {hasStatusList
              ? moduleStatuses.map(({ key, label, value, pending }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 bg-white px-4 py-3 first:rounded-t-lg last:rounded-b-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          pending ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                        }`}
                        aria-hidden
                      >
                        {pending ? "!" : "\u2713"}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          pending ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
                        }`}
                      >
                        {pending ? "Pending" : "Done"}
                      </span>
                      <span className="text-xs text-gray-600">Count: {String(value)}</span>
                    </div>
                  </div>
                ))
              : pendingItems.map(({ key, label }, index) => (
                  <div
                    key={key}
                    className="flex items-center gap-3 bg-white px-4 py-3 first:rounded-t-lg last:rounded-b-lg"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white"
                      aria-hidden
                    >
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{label}</span>
                  </div>
                ))}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
          <Button type="button" variant="outline" onClick={onSkip} className="min-w-[7rem]">
            Skip for now
          </Button>
          {showGoToImport ? (
            <Button type="button" asChild className="min-w-[9rem] bg-gray-900 text-white hover:bg-gray-800">
              <Link href="/import">Go to Import Data</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
