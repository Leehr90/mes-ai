import { useQuery } from "@tanstack/react-query";
import type { StepContext, Disposition } from "../types";
import { fetchDispositionCatalog } from "../api/wip";

export interface CompleteModalProps {
  context: StepContext;
  disposition: string;
  onDispositionChange: (value: string) => void;
  qtyScrapped: string;
  onQtyScrappedChange: (value: string) => void;
  scrapUnit: boolean;
  onScrapUnitChange: (value: boolean) => void;
  scrapReason: string;
  onScrapReasonChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function CompleteModal({
  context,
  disposition,
  onDispositionChange,
  qtyScrapped,
  onQtyScrappedChange,
  scrapUnit,
  onScrapUnitChange,
  scrapReason,
  onScrapReasonChange,
  onConfirm,
  onCancel,
}: CompleteModalProps) {
  const isUnit = context.wip_type === "unit";
  const wipQty =
    isUnit || !("quantity" in context.wip)
      ? 1
      : (context.wip as { quantity: number }).quantity ?? 0;

  const scrapNum = isUnit ? (scrapUnit ? 1 : 0) : qtyScrapped === "" ? 0 : Number(qtyScrapped);
  const goodQty = wipQty - scrapNum;

  const { data: scrapReasons = [] } = useQuery({
    queryKey: ["dispositions", "scrap"],
    queryFn: () => fetchDispositionCatalog("scrap"),
    enabled: true,
  });

  const routingDispositionRequired =
    context.dispositions.length > 0 && (!isUnit || !scrapUnit);
  const canConfirm =
    (!routingDispositionRequired || disposition !== "") &&
    scrapNum >= 0 &&
    scrapNum <= wipQty &&
    (scrapNum === 0 || scrapReason !== "");


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Complete WIP"
    >
      <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-md">
        <h2 className="text-lg font-bold mb-4">Complete WIP</h2>

        <div className="space-y-4">
          {/* Disposition combobox (native select) */}
          <div>
            <label
              htmlFor="cm-disposition"
              className="block text-xs uppercase tracking-wide text-gray-400 mb-1"
            >
              Disposition
            </label>
            <select
              id="cm-disposition"
              value={disposition}
              onChange={(e) => onDispositionChange(e.target.value)}
              disabled={!routingDispositionRequired}
              className="input-field w-full disabled:opacity-50"
            >
              <option value="">— select disposition —</option>
              {renderDispositionOptions(context.dispositions)}
            </select>
          </div>

          {isUnit ? (
            <div className="flex items-center gap-2">
              <input
                id="cm-scrap-unit"
                type="checkbox"
                checked={scrapUnit}
                onChange={(e) => {
                  const shouldScrap = e.target.checked;
                  onScrapUnitChange(shouldScrap);
                  if (shouldScrap) onDispositionChange("");
                }}
                className="h-4 w-4"
              />
              <label htmlFor="cm-scrap-unit" className="text-sm text-gray-700">
                Scrap this unit
              </label>
            </div>
          ) : (
            <div>
            <label
              htmlFor="cm-qty-scrapped"
              className="block text-xs uppercase tracking-wide text-gray-400 mb-1"
            >
              Quantity Scrapped
            </label>
            <input
              id="cm-qty-scrapped"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={qtyScrapped}
              onChange={(e) =>
                onQtyScrappedChange(e.target.value.replace(/[^0-9]/g, ""))
              }
              className="input-field w-full"
              min="0"
              max={String(wipQty)}
            />
            <span className="text-xs text-gray-500 ml-2">
              ({goodQty} good{" " + (goodQty !== 1 ? "units" : "unit")} remaining)
            </span>
            </div>
          )}

          {/* A reason is required whenever any WIP is being scrapped. */}
          {(!isUnit || scrapUnit) && (
            <div>
              <label
                htmlFor="cm-scrap-reason"
                className="block text-xs uppercase tracking-wide text-gray-400 mb-1"
              >
                Scrap Reason
              </label>
              <select
                id="cm-scrap-reason"
                value={scrapReason}
                onChange={(e) => onScrapReasonChange(e.target.value)}
                disabled={scrapNum === 0}
                className="input-field w-full disabled:opacity-50"
              >
                <option value="">— select reason —</option>
                {scrapReasons.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}

        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

/** Build <option> elements from the disposition array. */
function renderDispositionOptions(
  dispositions: Disposition[],
): React.ReactElement[] {
  return dispositions.map((d) => {
    const label = d.name ?? d.label ?? d.id;
    return (
      <option key={d.id} value={label}>
        {label}
      </option>
    );
  });
}