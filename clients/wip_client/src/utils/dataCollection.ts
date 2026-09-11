import type { DataDefinition, DataPoint, StepContext } from "../types";

/** Payload shape for POST /data/collect-batch items. */
export interface DataItem {
  definition_id: string;
  unit_id?: string;
  lot_id?: string;
  value_numeric?: number;
  value_string?: string;
  value_boolean?: boolean;
  /** Update the current row for (definition, WIP) instead of appending. */
  upsert?: boolean;
}

/**
 * Map definitions to collect-batch items by data_type. Items are marked
 * `upsert` so re-saving a value updates the existing row in place.
 */
export function buildDataItems(
  context: StepContext,
  defs: DataDefinition[],
  dataValues: Record<string, string>,
): DataItem[] {
  return defs.map((d) => {
    const raw = (dataValues[d.id] ?? "").trim();
    const item: DataItem = { definition_id: d.id, upsert: true };
    if (context.wip_type === "unit") item.unit_id = context.wip.id;
    else item.lot_id = context.wip.id;

    if (d.data_type === "numeric") item.value_numeric = Number(raw);
    else if (d.data_type === "boolean") item.value_boolean = raw === "true";
    else item.value_string = raw;
    return item;
  });
}

/** Mark definitions as persisted in the saved-values map. */
export function mergeSaved(
  saved: Record<string, string>,
  defs: DataDefinition[],
  dataValues: Record<string, string>,
): Record<string, string> {
  const updated = { ...saved };
  for (const d of defs) updated[d.id] = (dataValues[d.id] ?? "").trim();
  return updated;
}

/** Raw text for a persisted data point, by value column. */
function pointToString(p: DataPoint): string {
  if (p.value_numeric != null) return String(p.value_numeric);
  if (p.value_boolean != null) return p.value_boolean ? "true" : "false";
  return p.value_string ?? "";
}

/**
 * Reduce fetched data points to the latest persisted value per definition
 * (raw text) — used to pre-populate the fields on scan / client relaunch.
 */
export function latestValuesByDefinition(
  points: DataPoint[],
  definitions: DataDefinition[],
): Record<string, string> {
  const defIds = new Set(definitions.map((d) => d.id));
  const latest = new Map<string, DataPoint>();
  for (const p of points) {
    if (!defIds.has(p.definition_id)) continue;
    const prev = latest.get(p.definition_id);
    if (!prev || p.collected_at > prev.collected_at) {
      latest.set(p.definition_id, p);
    }
  }
  const values: Record<string, string> = {};
  for (const [defId, p] of latest) {
    values[defId] = pointToString(p);
  }
  return values;
}
