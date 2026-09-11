import { useState } from "react";
import type { StepContext, StepParameter } from "../types";
import { apiErrorMessage, recordParameterValues } from "../api/wip";
import {
  buildParameterValueItems,
  mergeSavedParams,
} from "../utils/stepParameters";

interface Props {
  context: StepContext;
  /** Raw actual-value text keyed by parameter id (§6.7). */
  paramValues: Record<string, string>;
  onParamChange: (parameterId: string, value: string) => void;
  /** Values already persisted — shown beside each parameter. */
  savedParamValues: Record<string, string>;
  /** Merges newly persisted values into App's savedParamValues. */
  onSavedParams: (updated: Record<string, string>) => void;
}

export default function StepParametersTab({
  context,
  paramValues,
  onParamChange,
  savedParamValues,
  onSavedParams,
}: Props) {
  const params = context.step_parameters;
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Named list of required parameters still missing actuals — surfaced so the
  // operator can see exactly what blocks Complete (used again by ActionBar).
  const missing = params
    .filter(
      (p) =>
        p.is_required &&
        (paramValues[p.id] ?? "").trim() === "" &&
        (savedParamValues[p.id] ?? "").trim() === "",
    )
    .map((p) => p.name);

  /**
   * Per-row save (mirrors Data Collection): persists this one value
   * immediately; the server upserts the current row for the parameter, so
   * re-saving (even the same value) updates it in place.
   */
  const handleSaveOne = async (param: StepParameter) => {
    if (savingId !== null) return;
    const raw = (paramValues[param.id] ?? "").trim();
    if (raw === "") return;
    setError(null);
    setMessage(null);

    if (param.data_type === "numeric" && !Number.isFinite(Number(raw))) {
      setError(`Invalid numeric value for ${param.name}.`);
      return;
    }

    setSavingId(param.id);
    try {
      await recordParameterValues(
        buildParameterValueItems(context, [param], paramValues),
      );
      onSavedParams(mergeSavedParams(savedParamValues, [param], paramValues));
      setMessage(`Saved ${param.name}.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-5 space-y-4">
      {params.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-8">
          No step parameters are defined for this step.
        </p>
      ) : (
        <>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2.5">Parameter</th>
                <th className="px-3 py-2.5">Target</th>
                <th className="px-3 py-2.5">Lower</th>
                <th className="px-3 py-2.5">Upper</th>
                <th className="px-3 py-2.5">UoM</th>
                <th className="px-3 py-2.5">Actual</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {params.map((p) => {
                const value = paramValues[p.id] ?? "";
                const savedValue = savedParamValues[p.id] ?? "";
                const missingRequired =
                  p.is_required &&
                  value.trim() === "" &&
                  savedValue.trim() === "";
                return (
                  <tr
                    key={p.id}
                    className={missingRequired ? "bg-red-50/40" : undefined}
                  >
                    <td className="px-3 py-2.5 font-medium text-gray-800">
                      {p.name}
                      {p.is_required && (
                        <span className="text-red-500 ml-0.5">*</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">
                      {p.target_value ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">
                      {p.lower_limit ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">
                      {p.upper_limit ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">
                      {p.uom_symbol ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type={p.data_type === "numeric" ? "number" : "text"}
                        value={value}
                        onChange={(e) => onParamChange(p.id, e.target.value)}
                        aria-label={`Actual value for ${p.name}`}
                        className={`input-field max-w-[10rem] ${
                          missingRequired
                            ? "ring-2 ring-red-400 bg-red-50/50"
                            : ""
                        }`}
                      />
                      {savedValue !== "" && (
                        <p className="mt-1 text-xs text-green-600">
                          Saved: {savedValue}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => handleSaveOne(p)}
                        disabled={savingId !== null || value.trim() === ""}
                        aria-label={`Save ${p.name}`}
                        className="btn-primary !px-3 !py-1.5 text-xs"
                      >
                        {savingId === p.id ? "…" : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {error && (
            <div role="alert" className="p-3 bg-red-50 text-red-700 text-sm rounded-md">
              {error}
            </div>
          )}
          {message && !error && (
            <div role="status" className="p-3 bg-green-50 text-green-700 text-sm rounded-md">
              {message}
            </div>
          )}

          {missing.length > 0 && (
            <p className="text-red-500 text-xs font-medium">
              Required, still empty: {missing.join(", ")}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
