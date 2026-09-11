import { useState } from "react";
import type { DataDefinition, StepContext } from "../types";
import { apiErrorMessage, collectDataBatch } from "../api/wip";
import { buildDataItems, mergeSaved } from "../utils/dataCollection";

interface Props {
  context: StepContext;
  /** Raw field text keyed by definition id (§6.7). */
  dataValues: Record<string, string>;
  onDataChange: (definitionId: string, value: string) => void;
  /** Values already persisted — shown beneath each field. */
  savedValues: Record<string, string>;
  /** Merges newly persisted values into App's savedValues. */
  onSaved: (updated: Record<string, string>) => void;
}

function Field({
  def,
  value,
  savedValue,
  savingId,
  onChange,
  onSave,
}: {
  def: DataDefinition;
  value: string;
  /** Currently persisted value ("" when never saved). */
  savedValue: string;
  /** Id of the definition currently being saved, if any. */
  savingId: string | null;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  const id = `dc-${def.id}`;
  const limits =
    def.lower_limit != null && def.upper_limit != null
      ? `${def.lower_limit} – ${def.upper_limit}`
      : null;

  let control: React.ReactNode;
  if (def.data_type === "numeric") {
    control = (
      <input
        id={id}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={limits ?? ""}
        className="input-field"
      />
    );
  } else if (def.data_type === "boolean") {
    control = (
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
      >
        <option value="">—</option>
        <option value="true">True</option>
        <option value="false">False</option>
      </select>
    );
  } else if (def.data_type === "enum" && def.enum_values) {
    const options = def.enum_values
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    control = (
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  } else {
    control = (
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
      />
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {def.name}
          {def.is_required && <span className="text-red-500 ml-0.5">*</span>}
          {def.uom_symbol && (
            <span className="text-gray-400 font-normal"> ({def.uom_symbol})</span>
          )}
        </label>
        {limits && (
          <span className="text-xs text-gray-400 whitespace-nowrap">
            Spec: {limits}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-start gap-2">
        <div className="flex-1">{control}</div>
        <button
          onClick={onSave}
          disabled={savingId !== null || value.trim() === ""}
          aria-label={`Save ${def.name}`}
          className="btn-primary !px-3 !py-1.5 text-xs"
        >
          {savingId === def.id ? "…" : "Save"}
        </button>
      </div>
      {savedValue !== "" && (
        <p className="mt-1 text-xs text-green-600">Saved: {savedValue}</p>
      )}
    </div>
  );
}

export default function DataCollectionTab({
  context,
  dataValues,
  onDataChange,
  savedValues,
  onSaved,
}: Props) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const defs = context.data_definitions;

  /**
   * Per-item save (mirrors Consumption): persists this one value
   * immediately; the server upserts the current row for the definition,
   * so re-saving (even the same value) updates it in place.
   */
  const handleSaveOne = async (def: DataDefinition) => {
    if (savingId !== null) return;
    const raw = (dataValues[def.id] ?? "").trim();
    if (raw === "") return;
    setError(null);
    setMessage(null);

    if (def.data_type === "numeric" && !Number.isFinite(Number(raw))) {
      setError(`Invalid numeric value for ${def.name}.`);
      return;
    }

    setSavingId(def.id);
    try {
      await collectDataBatch(buildDataItems(context, [def], dataValues));
      onSaved(mergeSaved(savedValues, [def], dataValues));
      setMessage(`Saved ${def.name}.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-5 space-y-4">
      {defs.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-8">
          No data collection fields are defined for this step.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {defs.map((d) => (
              <Field
                key={d.id}
                def={d}
                value={dataValues[d.id] ?? ""}
                savedValue={savedValues[d.id] ?? ""}
                savingId={savingId}
                onChange={(v) => onDataChange(d.id, v)}
                onSave={() => handleSaveOne(d)}
              />
            ))}
          </div>

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
        </>
      )}
    </div>
  );
}

