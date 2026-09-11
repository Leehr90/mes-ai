import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { StepEquipmentStatus } from "../types";
import { fetchStepEquipment } from "../api/wip";

interface Props {
  stepId: string;
  materialId?: string | null;
  assignedEquipmentId?: string | null;
  /** Query polls only while the WIP is queued or in_process. */
  active: boolean;
  /** Lifts rows up to MainTab (drives the Equipment Override select). */
  onRowsChange?: (rows: StepEquipmentStatus[]) => void;
}

function CheckMark({ on }: { on: boolean }) {
  return on ? (
    <span className="text-green-600 font-semibold">✓</span>
  ) : (
    <span className="text-gray-300">—</span>
  );
}

export default function EquipmentTable({
  stepId,
  materialId,
  assignedEquipmentId,
  active,
  onRowsChange,
}: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: [
      "step-equipment",
      stepId,
      materialId ?? null,
      assignedEquipmentId ?? null,
    ],
    queryFn: () => fetchStepEquipment(stepId, materialId, assignedEquipmentId),
    enabled: active,
    refetchInterval: 10_000, // NFR: 10 s poll while queued/in_process
  });

  // Lift rows to the parent for the Equipment Override select.
  useEffect(() => {
    if (data) onRowsChange?.(data);
  }, [data, onRowsChange]);

  if (!active) return null;

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-5 text-sm text-gray-400">
        Loading equipment…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-5 text-sm text-red-600">
        Failed to load equipment.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-2.5">Code</th>
            <th className="px-4 py-2.5">Name</th>
            <th className="px-4 py-2.5">Dispatch State</th>
            <th className="px-4 py-2.5">Queue Depth</th>
            <th className="px-4 py-2.5">Spare Capacity</th>
            <th className="px-4 py-2.5">Material Setup</th>
            <th className="px-4 py-2.5">Assigned</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {(data ?? []).map((row) => (
            <tr
              key={row.equipment_id}
              className={row.is_assigned ? "bg-indigo-50/60" : undefined}
            >
              <td className="px-4 py-2.5 font-mono font-medium text-gray-900">
                {row.equipment_code}
              </td>
              <td className="px-4 py-2.5 text-gray-700">
                {row.equipment_name ?? "—"}
              </td>
              <td className="px-4 py-2.5 text-gray-700">
                {row.dispatch_category ?? row.state ?? "—"}
              </td>
              <td className="px-4 py-2.5 text-gray-700">
                {row.queue_depth}
                {row.max_queue_depth != null ? ` / ${row.max_queue_depth}` : ""}
              </td>
              <td className="px-4 py-2.5">
                <CheckMark on={row.has_spare_capacity} />
              </td>
              <td className="px-4 py-2.5">
                <CheckMark on={row.material_setup} />
              </td>
              <td className="px-4 py-2.5">
                <CheckMark on={row.is_assigned} />
              </td>
            </tr>
          ))}
          {(data ?? []).length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                No equipment configured for this step.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
