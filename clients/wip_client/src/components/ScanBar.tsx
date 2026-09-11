import { ArrowPathIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

interface Props {
  /** Controlled input value (the scanned identifier). */
  value: string;
  loading: boolean;
  error: string | null;
  successMsg: string | null;
  isLot: boolean;
  /** Whether a WIP is loaded (shows the New Scan reset link). */
  hasContext: boolean;
  onChange: (value: string) => void;
  onSearch: () => void;
  onReset: () => void;
}

export default function ScanBar({
  value,
  loading,
  error,
  successMsg,
  isLot,
  hasContext,
  onChange,
  onSearch,
  onReset,
}: Props) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSearch();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-5">
      <div className="flex items-end gap-4">
        <div className="flex-1">
          <label
            htmlFor="scan-input"
            className="block text-sm font-medium text-gray-600 mb-1"
          >
            {isLot ? "Lot Number" : "Serial Number"}
          </label>
          <input
            id="scan-input"
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isLot ? "Scan or type lot number…" : "Scan or type serial number…"
            }
            className="input-field"
            autoFocus
          />
        </div>
        <button onClick={onSearch} disabled={loading} className="btn-primary">
          <MagnifyingGlassIcon className="h-4 w-4 mr-1 inline-block" />
          {loading ? "Searching…" : "Search"}
        </button>
        {hasContext && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 pb-2"
          >
            <ArrowPathIcon className="h-4 w-4" /> New Scan
          </button>
        )}
      </div>

      {/* Error / success banner slots */}
      {error && (
        <div
          role="alert"
          className="mt-3 p-3 bg-red-50 text-red-700 text-sm rounded-md"
        >
          {error}
        </div>
      )}
      {successMsg && !error && (
        <div
          role="status"
          className="mt-3 p-3 bg-green-50 text-green-700 text-sm rounded-md"
        >
          {successMsg}
        </div>
      )}
    </div>
  );
}
