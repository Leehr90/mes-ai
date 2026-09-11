export type TabId = "main" | "bom" | "dc" | "sp";

export interface TabDef {
  id: TabId;
  label: string;
}

interface Props {
  /** Visible tabs, computed by the caller (empty tabs are omitted). */
  tabs: TabDef[];
  activeTab: TabId;
  onChange: (tab: TabId) => void;
  /** Tabs are disabled until a WIP context has been loaded. */
  disabled?: boolean;
}

export default function TabStrip({ tabs, activeTab, onChange, disabled }: Props) {
  return (
    <div
      role="tablist"
      aria-label="WIP detail tabs"
      className="flex gap-1 border-b border-gray-200"
    >
      {tabs.map((tab) => {
        const selected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => onChange(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              selected
                ? "text-indigo-700 bg-white border border-b-0 border-gray-200 -mb-px"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

