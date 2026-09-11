import type { StepContext, StepParameter, StepParameterValue } from "../types";

/** Payload shape for POST /segment-parameter-values/batch items. */
export interface ParameterValueItem {
  parameter_id: string;
  unit_id?: string;
  lot_id?: string;
  value_numeric?: number;
  value_string?: string;
  value_boolean?: boolean;
}

/** Map parameters to record-batch items by data_type. */
export function buildParameterValueItems(
  context: StepContext,
  params: StepParameter[],
  paramValues: Record<string, string>,
): ParameterValueItem[] {
  return params.map((p) => {
    const raw = (paramValues[p.id] ?? "").trim();
    const item: ParameterValueItem = { parameter_id: p.id };
    if (context.wip_type === "unit") item.unit_id = context.wip.id;
    else item.lot_id = context.wip.id;

    if (p.data_type === "numeric") item.value_numeric = Number(raw);
    else if (p.data_type === "boolean") item.value_boolean = raw === "true";
    else item.value_string = raw;
    return item;
  });
}

/** Mark parameters as persisted in the saved-values map. */
export function mergeSavedParams(
  saved: Record<string, string>,
  params: StepParameter[],
  paramValues: Record<string, string>,
): Record<string, string> {
  const updated = { ...saved };
  for (const p of params) updated[p.id] = (paramValues[p.id] ?? "").trim();
  return updated;
}

/** Raw text for a persisted step-parameter value, by value column. */
function paramValueToString(v: StepParameterValue): string {
  if (v.value_numeric != null) return String(v.value_numeric);
  if (v.value_boolean != null) return v.value_boolean ? "true" : "false";
  return v.value_string ?? "";
}

/**
 * Reduce fetched parameter values to the latest persisted value per
 * parameter (raw text) — used to pre-populate the fields on scan / relaunch.
 */
export function latestValuesByParameter(
  values: StepParameterValue[],
  params: StepParameter[],
): Record<string, string> {
  const paramIds = new Set(params.map((p) => p.id));
  const latest = new Map<string, StepParameterValue>();
  for (const v of values) {
    if (!paramIds.has(v.parameter_id)) continue;
    const prev = latest.get(v.parameter_id);
    // Values are upserted (one current row per parameter/WIP); when more than
    // one row exists, keep the most recently created.
    if (!prev || v.created_at > prev.created_at) {
      latest.set(v.parameter_id, v);
    }
  }
  const out: Record<string, string> = {};
  for (const [paramId, v] of latest) {
    out[paramId] = paramValueToString(v);
  }
  return out;
}
