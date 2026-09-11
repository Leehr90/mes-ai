/**
 * WIP Client — single-screen shell (Phase 3).
 *
 * Scan bar resolves a lot number / unit serial into a StepContext; the three
 * tab panels (Main, Data Collection, Step Parameters) render placeholders in
 * this phase and gain real content in Phases 4–6.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { StepContext } from "./types";
import {
  fetchUnitBySerial,
  fetchLotByNumber,
  fetchUnitStepContext,
  fetchLotStepContext,
  apiErrorMessage,
  fetchStepBomItems,
  fetchDataPoints,
  fetchParameterValues,
} from "./api/wip";
import useTrackingMode from "./hooks/useTrackingMode";
import { latestValuesByDefinition } from "./utils/dataCollection";
import { latestValuesByParameter } from "./utils/stepParameters";
import ScanBar from "./components/ScanBar";
import TabStrip, { type TabId } from "./components/TabStrip";
import MainTab from "./components/MainTab";
import ConsumptionTab from "./components/ConsumptionTab";
import DataCollectionTab from "./components/DataCollectionTab";
import StepParametersTab from "./components/StepParametersTab";
import ActionBar, { type CompleteResult } from "./components/ActionBar";
import CompleteModal from "./components/CompleteModal";

export default function App() {
  const { mode, isLot } = useTrackingMode();
  const [scanInput, setScanInput] = useState("");
  const [context, setContext] = useState<StepContext | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("main");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [equipmentOverride, setEquipmentOverride] = useState("");
  const [dataValues, setDataValues] = useState<Record<string, string>>({});
  const [savedValues, setSavedValues] = useState<Record<string, string>>({});
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [savedParamValues, setSavedParamValues] = useState<Record<string, string>>({});
  // Complete options (§6.7)
  const [completeResult, setCompleteResult] = useState<CompleteResult>("pass");
  const [selectedDisposition, setSelectedDisposition] = useState("");
  // Modal: opened when Complete is clicked; the action bar reads these
  // values to drive the API call. Defaults are pre-populated at open time.
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [modalDisposition, setModalDisposition] = useState<string>("");
  const [modalQtyScrapped, setModalQtyScrapped] = useState<string>("");
  const [modalScrapUnit, setModalScrapUnit] = useState(false);
  const [modalScrapReason, setModalScrapReason] = useState<string>("");
  // Populated by ActionBar with its complete handler; the modal's Confirm
  // button invokes it with the confirmed values so the transaction uses those
  // values directly rather than waiting on React state to commit.
  const confirmCompleteRef = useRef<
    ((disposition: string, qtyScrapped: string, scrapReason: string, shouldScrapUnit: boolean) => void) | null
  >(null);

  const openCompleteModal = () => {
    if (!context) return;
    setModalQtyScrapped("0");
    setModalScrapUnit(false);
    setModalScrapReason("");
    setModalDisposition("");
    setCompleteModalOpen(true);
  };

  const confirmComplete = (
    disposition: string,
    qtyScrapped: string,
    scrapReason: string,
    shouldScrapUnit: boolean,
  ) => {
    setSelectedDisposition(disposition);
    setCompleteModalOpen(false);
    // Run the complete transaction immediately with the confirmed values.
    confirmCompleteRef.current?.(disposition, qtyScrapped, scrapReason, shouldScrapUnit);
  };

  /** Re-fetch the step context after Start/Complete (§6.8 step 5). */
  const refreshContext = async () => {
    if (!context) return;
    try {
      const ctx = isLot
        ? await fetchLotStepContext(context.wip.id)
        : await fetchUnitStepContext(context.wip.id);
      setContext(ctx);
    } catch {
      /* keep showing the previous context on refresh failure */
    }
  };

  /** §6.8 step 5: clear entry state for the next step. */
  const handleAfterComplete = () => {
    setDataValues({});
    setSavedValues({});
    setParamValues({});
    setSavedParamValues({});
    setCompleteResult("pass");
    setSelectedDisposition("");
    setActiveTab("main");
  };

  // ── Hydrate persisted data-collection values ─────────────────────
  // Pre-populate the Data Collection fields with the values currently
  // saved for this WIP (e.g., after a client relaunch). Keyed on
  // wip + step so the post-Start context refresh (same step) does not
  // clobber in-progress edits.
  const wipId = context?.wip.id ?? null;
  const hydrateStepId = context?.step?.id ?? null;
  useEffect(() => {
    if (!context || wipId === null) return;
    let cancelled = false;
    fetchDataPoints(context.wip_type, wipId)
      .then((points) => {
        if (cancelled) return;
        const values = latestValuesByDefinition(
          points,
          context.data_definitions,
        );
        setDataValues(values);
        setSavedValues(values);
      })
      .catch(() => {
        /* keep local state when the fetch fails */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wipId, hydrateStepId]);

  // ── Hydrate persisted step-parameter values ───────────────────────
  // Pre-populate the Step Parameters actuals with the values currently
  // saved for this WIP (e.g., after a client relaunch).
  useEffect(() => {
    if (!context || wipId === null) return;
    let cancelled = false;
    fetchParameterValues(context.wip_type, wipId)
      .then((values) => {
        if (cancelled) return;
        const byParam = latestValuesByParameter(values, context.step_parameters);
        setParamValues(byParam);
        setSavedParamValues(byParam);
      })
      .catch(() => {
        /* keep local state when the fetch fails */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wipId, hydrateStepId]);

  // ── Tab visibility ─────────────────────────────────────────────
  // Consumption appears only when the step defines BOM materials;
  // Data Collection / Step Parameters appear only when the step defines
  // them. The bom-items query shares its cache key with ConsumptionTab,
  // so no request is duplicated.
  const stepId = context?.step?.id ?? null;
  const { data: bomItems = [] } = useQuery({
    queryKey: ["step-bom-items", stepId],
    queryFn: () => fetchStepBomItems(stepId!),
    enabled: stepId !== null,
  });
  const showConsumption = bomItems.length > 0;

  const tabs = useMemo(() => {
    const list: Array<{ id: TabId; label: string }> = [
      { id: "main", label: "WIP" },
    ];
    if (showConsumption) list.push({ id: "bom", label: "Consumption" });
    if ((context?.data_definitions.length ?? 0) > 0)
      list.push({ id: "dc", label: "Data Collection" });
    if ((context?.step_parameters.length ?? 0) > 0)
      list.push({ id: "sp", label: "Step Parameters" });
    return list;
  }, [showConsumption, context]);

  // Derived, not synced: if the selected tab disappears (e.g., the next step
  // has no DC fields), fall back to Main without a state round-trip.
  const effectiveTab = tabs.some((t) => t.id === activeTab) ? activeTab : "main";

  /** Scan-bar search: by-number lookup, then the step-context fetch. */
  const handleSearch = async () => {
    const value = scanInput.trim();
    if (!value || loading) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setContext(null);
    setEquipmentOverride("");
    setDataValues({});
    setSavedValues({});
    setParamValues({});
    setSavedParamValues({});
    setCompleteResult("pass");
    setSelectedDisposition("");

    try {
      const wip = isLot
        ? await fetchLotByNumber(value)
        : await fetchUnitBySerial(value);
      const ctx = isLot
        ? await fetchLotStepContext(wip.id)
        : await fetchUnitStepContext(wip.id);
      setContext(ctx);
      setActiveTab("main");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const resetScan = () => {
    setScanInput("");
    setContext(null);
    setError(null);
    setSuccessMsg(null);
    setActiveTab("main");
    setEquipmentOverride("");
    setDataValues({});
    setSavedValues({});
    setParamValues({});
    setSavedParamValues({});
    setCompleteResult("pass");
    setSelectedDisposition("");
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-4xl p-6 space-y-5">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">
            MES AI — WIP Processing
          </h1>
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            Tracking: {mode}
          </div>
        </header>

        <ScanBar
          value={scanInput}
          loading={loading}
          error={error}
          successMsg={successMsg}
          isLot={isLot}
          hasContext={context !== null}
          onChange={setScanInput}
          onSearch={handleSearch}
          onReset={resetScan}
        />

        <TabStrip
          tabs={tabs}
          activeTab={effectiveTab}
          onChange={setActiveTab}
          disabled={context === null}
        />

        {context === null ? (
          <div className="bg-white rounded-lg shadow-md p-8 min-h-[16rem]">
            <p className="text-center text-sm text-gray-400 mt-12">
              Scan or type a {isLot ? "lot number" : "serial number"} above to
              begin.
            </p>
          </div>
        ) : effectiveTab === "main" ? (
          <MainTab
            key={context.wip.id}
            context={context}
            equipmentOverride={equipmentOverride}
            onEquipmentOverrideChange={setEquipmentOverride}
          />
        ) : effectiveTab === "bom" ? (
          <ConsumptionTab key={context.wip.id} context={context} />
        ) : effectiveTab === "dc" ? (
          <DataCollectionTab
            context={context}
            dataValues={dataValues}
            onDataChange={(id, value) =>
              setDataValues((prev) => ({ ...prev, [id]: value }))
            }
            savedValues={savedValues}
            onSaved={setSavedValues}
          />
        ) : (
          <StepParametersTab
            context={context}
            paramValues={paramValues}
            onParamChange={(id, value) =>
              setParamValues((prev) => ({ ...prev, [id]: value }))
            }
            savedParamValues={savedParamValues}
            onSavedParams={setSavedParamValues}
          />
        )}

        {/* Action bar — always visible once a WIP is loaded (FR7) */}
        {context !== null && (
          <ActionBar
            context={context}
            equipmentOverride={equipmentOverride}
            completeResult={completeResult}
            onCompleteResultChange={setCompleteResult}
            selectedDisposition={selectedDisposition}
            onSelectDispositionChange={setSelectedDisposition}
            dataValues={dataValues}
            savedValues={savedValues}
            paramValues={paramValues}
            savedParamValues={savedParamValues}
            onAfterComplete={handleAfterComplete}
            refreshContext={refreshContext}
            onRequestComplete={openCompleteModal}
            confirmCompleteRef={confirmCompleteRef}
          />
        )}

        {/* Complete modal — disposition combobox + qty scrapped + scrap reason */}
        {completeModalOpen && context !== null && (
          <CompleteModal
            context={context}
            disposition={modalDisposition}
            onDispositionChange={setModalDisposition}
            qtyScrapped={modalQtyScrapped}
            onQtyScrappedChange={setModalQtyScrapped}
            scrapUnit={modalScrapUnit}
            onScrapUnitChange={setModalScrapUnit}
            scrapReason={modalScrapReason}
            onScrapReasonChange={setModalScrapReason}
            onConfirm={() =>
              confirmComplete(
                modalDisposition,
                modalQtyScrapped,
                modalScrapReason,
                modalScrapUnit,
              )
            }
            onCancel={() => setCompleteModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
