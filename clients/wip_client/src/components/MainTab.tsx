import { useCallback, useState } from "react";
import type { StepContext, StepEquipmentStatus } from "../types";
import WipInfoCard from "./WipInfoCard";
import EquipmentTable from "./EquipmentTable";

interface Props {
  context: StepContext;
  /** "" = auto-dispatch; otherwise a pinned equipment id (§6.7 state model). */
  equipmentOverride: string;
  onEquipmentOverrideChange: (value: string) => void;
}

export default function MainTab({
  context,
  equipmentOverride,
  onEquipmentOverrideChange,
}: Props) {
  const { wip, step } = context;

  // Single row source: lifted from EquipmentTable's poll.
  const [rows, setRows] = useState<StepEquipmentStatus[]>([]);
  const handleRowsChange = useCallback((r: StepEquipmentStatus[]) => {
    setRows(r);
  }, []);

  // Override select options: only machines with material setup.
  const eligible = rows.filter((r) => r.material_setup);

  // Resolve the assigned machine's code for the info card display.
  const assignedCode = wip.current_equipment_id
    ? (rows.find((r) => r.equipment_id === wip.current_equipment_id)
        ?.equipment_code ?? null)
    : null;

  return (
    <div className="space-y-4">
      <WipInfoCard context={context} assignedEquipmentCode={assignedCode} />

      {step && (
        <EquipmentTable
          stepId={step.id}
          materialId={wip.material_id}
          assignedEquipmentId={wip.current_equipment_id}
          active={wip.status === "queued" || wip.status === "in_process"}
          onRowsChange={handleRowsChange}
        />
      )}

      {wip.status === "queued" && step && (
        <div className="bg-white rounded-lg shadow-md p-4 flex items-center gap-3 flex-wrap">
          <label
            htmlFor="equipment-override"
            className="text-sm font-medium text-gray-600 whitespace-nowrap"
          >
            Equipment Override
          </label>
          <select
            id="equipment-override"
            value={equipmentOverride}
            onChange={(e) => onEquipmentOverrideChange(e.target.value)}
            className="input-field max-w-xs"
          >
            <option value="">Auto-dispatch</option>
            {eligible.map((r) => (
              <option key={r.equipment_id} value={r.equipment_id}>
                {r.equipment_code}
                {r.equipment_name ? ` — ${r.equipment_name}` : ""}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-400">
            {eligible.length === 0
              ? "No machines with material setup — server will auto-dispatch."
              : `${eligible.length} machine(s) with material setup.`}
          </span>
        </div>
      )}
    </div>
  );
}
