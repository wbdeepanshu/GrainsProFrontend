import { useMemo, useState, useCallback, useEffect } from "react";
import { ArrowRightLeft, Loader2, MapPin, Plus, Trash2, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { suggestVehicleLoadingPlan } from "@/lib/outward_api";
import SplitLoadingRouteMapModal, {
  VEHICLE_ROUTE_COLORS,
  buildSplitVehicleMapRoutes,
} from "@/components/outward/SplitLoadingRouteMapModal";

function formatWeightQtl(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${num.toFixed(2)} Qtl`;
}

function newVehicleRow(seed = "") {
  return {
    key: `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    vehicle_no: seed,
    capacity_qtl: "",
  };
}

/**
 * Manage Vehicle wizard (vehicles → suggest/assign/map → confirm).
 * No distance calculation step.
 */
export default function ManageVehicleSplitModal({
  open,
  onClose,
  salesOrders = [],
  branchId = null,
  defaultVehicleNo = "",
  onConfirm,
  confirming = false,
}) {
  const [step, setStep] = useState("split-vehicle"); // split-vehicle | split-assign
  const [origin, setOrigin] = useState(null);
  const [vehicles, setVehicles] = useState([newVehicleRow(defaultVehicleNo)]);
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [assignmentBySo, setAssignmentBySo] = useState({});
  const [routeOrderByVehicle, setRouteOrderByVehicle] = useState({});

  const selectedSoIds = useMemo(() => {
    const ids = [];
    const seen = new Set();
    (salesOrders || []).forEach((so) => {
      const id = String(so.so_number || so.order_id || so.sales_order_id || "").trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      ids.push(id);
    });
    return ids;
  }, [salesOrders]);

  const vehiclePlans = plan?.data?.vehicles || [];
  const excluded = plan?.data?.excluded || [];

  const soCatalogById = useMemo(() => {
    const map = new Map();
    vehiclePlans.forEach((v) => {
      (v.sales_orders || []).forEach((s) => {
        if (s?.so_number) map.set(s.so_number, s);
      });
    });
    excluded.forEach((s) => {
      if (s?.so_number) map.set(s.so_number, s);
    });
    (salesOrders || []).forEach((s) => {
      const id = String(s.so_number || s.order_id || s.sales_order_id || "").trim();
      if (!id || map.has(id)) return;
      map.set(id, {
        ...s,
        so_number: id,
        customer_name: s.customer_name || s.party_name || "",
        weight_qtl: s.weight_qtl ?? s.total_qty_qtl ?? s.qty_qtl ?? null,
      });
    });
    return map;
  }, [vehiclePlans, excluded, salesOrders]);

  const splitVehicleMappings = useMemo(
    () =>
      vehiclePlans.map((v, index) => {
        const key = v.key || `veh-${index}-${v.vehicle_no}`;
        const assignedIds = Object.entries(assignmentBySo)
          .filter(([, vehicleKey]) => vehicleKey === key)
          .map(([soNumber]) => soNumber);
        const fallbackIds = (v.sales_orders || []).map((s) => s.so_number).filter(Boolean);
        const hasAssignmentState = Object.keys(assignmentBySo).length > 0;
        const orderFromRoute = routeOrderByVehicle[key];
        const order = hasAssignmentState
          ? (orderFromRoute?.length
              ? orderFromRoute.filter((id) => assignmentBySo[id] === key)
              : assignedIds)
          : fallbackIds;
        const mapped = [...new Set(order)]
          .map((id) => soCatalogById.get(id))
          .filter(Boolean);
        const mappedWeight = mapped.reduce((sum, s) => sum + (Number(s.weight_qtl) || 0), 0);
        return {
          ...v,
          key,
          mapped_sales_orders: mapped,
          sales_orders: mapped,
          mapped_weight_qtl: mappedWeight,
          remaining_capacity_qtl: Math.max(0, Number(v.capacity_qtl || 0) - mappedWeight),
        };
      }),
    [vehiclePlans, assignmentBySo, routeOrderByVehicle, soCatalogById],
  );

  const unassignedSalesOrders = useMemo(() => {
    const assigned = new Set(Object.keys(assignmentBySo));
    const list = [];
    const seen = new Set();
    const push = (s) => {
      const id = String(s?.so_number || "").trim();
      if (!id || seen.has(id) || assigned.has(id)) return;
      seen.add(id);
      list.push(soCatalogById.get(id) || s);
    };
    excluded.forEach(push);
    vehiclePlans.forEach((v) => (v.sales_orders || []).forEach(push));
    soCatalogById.forEach((s) => push(s));
    return list;
  }, [assignmentBySo, excluded, vehiclePlans, soCatalogById]);

  const liveSummary = useMemo(() => {
    const assignedSos = splitVehicleMappings.flatMap((v) => v.mapped_sales_orders || []);
    const assignedWeight = assignedSos.reduce((sum, s) => sum + (Number(s.weight_qtl) || 0), 0);
    const capacity = splitVehicleMappings.reduce(
      (sum, v) => sum + (Number(v.capacity_qtl) || 0),
      0,
    );
    return {
      assigned_so_count: assignedSos.length,
      assigned_weight_qtl: assignedWeight,
      total_vehicle_capacity_qtl: capacity,
      excluded_so_count: unassignedSalesOrders.length,
    };
  }, [splitVehicleMappings, unassignedSalesOrders]);

  const soCoordById = useMemo(() => {
    const map = {};
    const put = (s) => {
      if (!s?.so_number) return;
      map[s.so_number] = {
        lat: s.lat,
        long: s.long ?? s.lng,
        customer_name: s.customer_name,
        address: s.address,
        weight_qtl: s.weight_qtl,
        distance_km: s.distance_km,
        customer_id: s.customer_id,
        area_group: s.area_group,
        has_coordinates: s.has_coordinates,
      };
    };
    vehiclePlans.forEach((v) => (v.sales_orders || []).forEach(put));
    excluded.forEach(put);
    return map;
  }, [vehiclePlans, excluded]);

  const allSalesOrdersForMap = useMemo(() => {
    const list = [];
    const seen = new Set();
    vehiclePlans.forEach((v) => {
      (v.sales_orders || []).forEach((s) => {
        if (!s?.so_number || seen.has(s.so_number)) return;
        seen.add(s.so_number);
        list.push(s);
      });
    });
    excluded.forEach((s) => {
      if (!s?.so_number || seen.has(s.so_number)) return;
      seen.add(s.so_number);
      list.push(s);
    });
    return list;
  }, [vehiclePlans, excluded]);

  const mapRoutes = useMemo(
    () =>
      buildSplitVehicleMapRoutes({
        origin: origin || plan?.origin,
        vehicles: splitVehicleMappings,
        soCoordById,
      }),
    [origin, plan?.origin, splitVehicleMappings, soCoordById],
  );

  const assignmentBySoNumber = useMemo(() => {
    const map = {};
    Object.entries(assignmentBySo).forEach(([soNumber, vehicleKey]) => {
      const vehicle = splitVehicleMappings.find((v) => v.key === vehicleKey);
      if (vehicle?.vehicle_no) map[soNumber] = vehicle.vehicle_no;
    });
    return map;
  }, [assignmentBySo, splitVehicleMappings]);

  const moveSoToVehicleKey = useCallback((soNumber, targetKey) => {
    const soKey = String(soNumber || "").trim();
    if (!soKey) return { ok: false, message: "Sales order not found." };
    if (!targetKey) {
      setAssignmentBySo((prev) => {
        const next = { ...prev };
        delete next[soKey];
        return next;
      });
      setRouteOrderByVehicle((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          next[key] = (next[key] || []).filter((id) => id !== soKey);
        });
        return next;
      });
      return { ok: true, message: `${soKey} unassigned` };
    }
    setAssignmentBySo((prev) => ({ ...prev, [soKey]: targetKey }));
    setRouteOrderByVehicle((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        next[key] = (next[key] || []).filter((id) => id !== soKey);
      });
      next[targetKey] = [...(next[targetKey] || []).filter((id) => id !== soKey), soKey];
      return next;
    });
    return { ok: true, message: `${soKey} moved` };
  }, []);

  const reassignFromMap = useCallback(
    (soNumber, targetVehicleNo) => {
      const soKey = String(soNumber || "").trim();
      const target = splitVehicleMappings.find(
        (v) => String(v.vehicle_no || "").trim() === String(targetVehicleNo || "").trim(),
      );
      if (!soKey || !target) return { ok: false, message: "Sales order or vehicle not found." };
      const result = moveSoToVehicleKey(soKey, target.key);
      return result.ok
        ? { ok: true, message: `${soKey} moved to ${target.vehicle_no}` }
        : result;
    },
    [splitVehicleMappings, moveSoToVehicleKey],
  );

  const applyRouteSequenceFromMap = useCallback((nextOrder) => {
    setRouteOrderByVehicle((prev) => ({ ...prev, ...(nextOrder || {}) }));
  }, []);

  const resetMapAssignments = useCallback(() => {
    const assign = {};
    const routeOrder = {};
    vehiclePlans.forEach((v, index) => {
      const key = v.key || `veh-${index}-${v.vehicle_no}`;
      const sos = (v.sales_orders || []).map((s) => s.so_number).filter(Boolean);
      routeOrder[key] = sos;
      sos.forEach((id) => {
        assign[id] = key;
      });
    });
    setAssignmentBySo(assign);
    setRouteOrderByVehicle(routeOrder);
  }, [vehiclePlans]);

  useEffect(() => {
    if (!open) return;
    setStep("split-vehicle");
    setPlan(null);
    setPlanError("");
    setOrigin(null);
    setMapOpen(false);
    setAssignmentBySo({});
    setRouteOrderByVehicle({});
    setVehicles([newVehicleRow(defaultVehicleNo)]);
  }, [open, defaultVehicleNo, salesOrders]);

  if (!open) return null;

  const resetAndClose = () => {
    setStep("split-vehicle");
    setOrigin(null);
    setVehicles([newVehicleRow(defaultVehicleNo)]);
    setPlan(null);
    setPlanError("");
    setMapOpen(false);
    setAssignmentBySo({});
    setRouteOrderByVehicle({});
    onClose?.();
  };

  const updateVehicleField = (key, field, value) => {
    setVehicles((prev) =>
      prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  };

  const runSuggestPlan = async () => {
    setPlanError("");
    if (!selectedSoIds.length) {
      setPlanError("Select at least one sales order on the gate pass form.");
      return;
    }

    const cleaned = [];
    for (const row of vehicles) {
      const vehicle_no = String(row.vehicle_no || "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 10);
      const capacity = parseFloat(row.capacity_qtl);
      if (!vehicle_no) {
        setPlanError("Each vehicle needs a vehicle number.");
        return;
      }
      if (!Number.isFinite(capacity) || capacity <= 0) {
        setPlanError(`Vehicle ${vehicle_no || "(blank)"} needs a positive capacity (Qtl).`);
        return;
      }
      cleaned.push({ vehicle_no, capacity_qtl: capacity });
    }
    if (!cleaned.length) {
      setPlanError("Add at least one vehicle.");
      return;
    }

    setPlanLoading(true);
    try {
      const result = await suggestVehicleLoadingPlan({
        sales_order_ids: selectedSoIds,
        vehicles: cleaned,
        branch_id: branchId || undefined,
      });
      const vehiclesWithKeys = (result?.data?.vehicles || []).map((v, index) => ({
        ...v,
        key: `veh-${index}-${v.vehicle_no}`,
      }));
      setPlan({
        ...result,
        data: {
          ...result.data,
          vehicles: vehiclesWithKeys,
        },
      });
      setOrigin(result.origin || null);
      const assign = {};
      const routeOrder = {};
      vehiclesWithKeys.forEach((v) => {
        const sos = v.sales_orders || [];
        routeOrder[v.key] = sos.map((s) => s.so_number).filter(Boolean);
        sos.forEach((s) => {
          if (s.so_number) assign[s.so_number] = v.key;
        });
      });
      setAssignmentBySo(assign);
      setRouteOrderByVehicle(routeOrder);
      setStep("split-assign");
    } catch (err) {
      setPlanError(err?.message || "Failed to suggest vehicle loading plan");
    } finally {
      setPlanLoading(false);
    }
  };

  const handleConfirmCreate = async () => {
    const mappings = splitVehicleMappings
      .map((row, index) => {
        const ids = (row.mapped_sales_orders || row.sales_orders || [])
          .map((s) => String(s.so_number || s).trim())
          .filter(Boolean);
        return {
          sequence: index + 1,
          vehicle_no: row.vehicle_no,
          capacity_qtl: row.capacity_qtl,
          sales_order_ids: ids,
        };
      })
      .filter((row) => row.sales_order_ids.length > 0);

    if (!mappings.length) {
      setPlanError("No sales orders assigned to any vehicle.");
      return;
    }
    await onConfirm?.(mappings, { excluded, origin, plan });
  };

  return (
    <>
    {!mapOpen ? (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40">
      <div
        className={`bg-white rounded-xl shadow-xl border border-gray-200 w-full max-h-[90vh] overflow-hidden flex flex-col ${
          step === "split-assign" ? "max-w-5xl" : "max-w-3xl"
        }`}
      >
        <div className="px-5 py-4 border-b flex items-start justify-between gap-3 bg-slate-50">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Truck className="h-5 w-5" />
              {step === "split-vehicle"
                ? "Manage Vehicle — Vehicles"
                : "Manage Vehicle — Assign & Create"}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {step === "split-vehicle"
                ? "Enter vehicles and capacity (Qtl), then suggest loading plan."
                : "Move SOs between vehicles to split the load, then create gate passes."}
            </p>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">
            Selected SOs: <strong>{selectedSoIds.length}</strong>
            {selectedSoIds.length > 0 ? (
              <div className="mt-1 text-xs text-slate-600 break-all">
                {selectedSoIds.join(", ")}
              </div>
            ) : null}
          </div>

          {step === "split-vehicle" && (
            <>
              {planError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {planError}
                </div>
              ) : null}
              <div className="space-y-3">
                {vehicles.map((row, index) => (
                  <div
                    key={row.key}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_140px_40px] gap-2 items-end border rounded-lg p-3"
                  >
                    <div>
                      <Label className="text-xs">Vehicle {index + 1}</Label>
                      <Input
                        value={row.vehicle_no}
                        maxLength={10}
                        onChange={(e) =>
                          updateVehicleField(
                            row.key,
                            "vehicle_no",
                            e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10),
                          )
                        }
                        placeholder="KA01AB1234"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Capacity (Qtl)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.capacity_qtl}
                        onChange={(e) =>
                          updateVehicleField(row.key, "capacity_qtl", e.target.value)
                        }
                        placeholder="40"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-red-600"
                      disabled={vehicles.length <= 1}
                      onClick={() =>
                        setVehicles((prev) => prev.filter((v) => v.key !== row.key))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setVehicles((prev) => [...prev, newVehicleRow()])}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add vehicle
              </Button>
            </>
          )}

          {step === "split-assign" && plan && (
            <>
              {planError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {planError}
                </div>
              ) : null}
              <div className="rounded-lg border bg-slate-50 p-3 text-sm grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  Assigned SO: <strong>{liveSummary.assigned_so_count}</strong>
                </div>
                <div>
                  Weight: <strong>{formatWeightQtl(liveSummary.assigned_weight_qtl)}</strong>
                </div>
                <div>
                  Capacity:{" "}
                  <strong>{formatWeightQtl(liveSummary.total_vehicle_capacity_qtl)}</strong>
                </div>
                <div>
                  Unassigned: <strong>{liveSummary.excluded_so_count}</strong>
                </div>
              </div>

              <p className="text-xs text-slate-500 flex items-center gap-1">
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Use <span className="font-medium">Move to</span> on each sales order to split load across vehicles.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {splitVehicleMappings.map((vehicle, index) => {
                  const color = VEHICLE_ROUTE_COLORS[index % VEHICLE_ROUTE_COLORS.length];
                  const mapped = vehicle.mapped_sales_orders || [];
                  const overCapacity =
                    Number(vehicle.mapped_weight_qtl || 0) > Number(vehicle.capacity_qtl || 0);
                  return (
                    <div key={vehicle.key || vehicle.vehicle_no || index} className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 font-semibold text-sm mb-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        {vehicle.vehicle_no}
                        <span className={`font-normal ${overCapacity ? "text-red-600" : "text-slate-500"}`}>
                          {formatWeightQtl(vehicle.mapped_weight_qtl)} / {formatWeightQtl(vehicle.capacity_qtl)}
                        </span>
                      </div>
                      <ul className="text-sm space-y-2 max-h-52 overflow-y-auto">
                        {mapped.length ? (
                          mapped.map((so) => (
                            <li
                              key={so.so_number}
                              className="flex flex-col gap-1 rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5"
                            >
                              <div className="text-slate-800">
                                {so.so_number}
                                {so.customer_name ? ` — ${so.customer_name}` : ""}
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-slate-500">
                                  {so.weight_qtl != null ? formatWeightQtl(so.weight_qtl) : "—"}
                                </span>
                                {splitVehicleMappings.length > 1 ? (
                                  <select
                                    className="h-7 max-w-[160px] rounded border border-slate-200 bg-white px-1.5 text-xs text-slate-700"
                                    value={vehicle.key}
                                    onChange={(e) => moveSoToVehicleKey(so.so_number, e.target.value)}
                                    aria-label={`Move ${so.so_number} to another vehicle`}
                                  >
                                    {splitVehicleMappings.map((other) => (
                                      <option key={other.key} value={other.key}>
                                        {other.key === vehicle.key
                                          ? `On ${other.vehicle_no}`
                                          : `Move to ${other.vehicle_no}`}
                                      </option>
                                    ))}
                                  </select>
                                ) : null}
                              </div>
                            </li>
                          ))
                        ) : (
                          <li className="text-slate-400 text-sm py-2">
                            No SOs — pick a sales order on another vehicle and move it here.
                          </li>
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>

              {unassignedSalesOrders.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  <div className="font-medium text-amber-900 mb-2">Unassigned SOs</div>
                  <ul className="space-y-2">
                    {unassignedSalesOrders.map((so) => (
                      <li
                        key={so.so_number}
                        className="flex flex-wrap items-center justify-between gap-2 text-amber-900"
                      >
                        <span>
                          {so.so_number}
                          {so.customer_name ? ` — ${so.customer_name}` : ""}
                          {so.weight_qtl != null ? ` (${formatWeightQtl(so.weight_qtl)})` : ""}
                        </span>
                        <select
                          className="h-7 rounded border border-amber-300 bg-white px-1.5 text-xs text-slate-700"
                          defaultValue=""
                          onChange={(e) => {
                            if (!e.target.value) return;
                            moveSoToVehicleKey(so.so_number, e.target.value);
                          }}
                          aria-label={`Assign ${so.so_number} to a vehicle`}
                        >
                          <option value="">Assign to vehicle…</option>
                          {splitVehicleMappings.map((other) => (
                            <option key={other.key} value={other.key}>
                              {other.vehicle_no}
                            </option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t bg-white flex flex-wrap justify-between gap-2">
          <div className="flex gap-2">
            {step === "split-assign" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("split-vehicle")}
                disabled={confirming || planLoading}
              >
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={resetAndClose} disabled={confirming}>
              Cancel
            </Button>
            {step === "split-vehicle" && (
              <Button type="button" onClick={runSuggestPlan} disabled={planLoading || !selectedSoIds.length}>
                {planLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Suggesting…
                  </>
                ) : (
                  "Suggest plan"
                )}
              </Button>
            )}
            {step === "split-assign" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMapOpen(true)}
                  disabled={!mapRoutes.length}
                >
                  <MapPin className="h-4 w-4 mr-1" />
                  Open map
                </Button>
                <Button type="button" onClick={handleConfirmCreate} disabled={confirming}>
                  {confirming ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating…
                    </>
                  ) : (
                    "Create gate passes"
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
    ) : null}

      {mapOpen ? (
        <SplitLoadingRouteMapModal
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          routes={mapRoutes}
          origin={origin || plan?.origin}
          allSalesOrders={allSalesOrdersForMap}
          soCoordById={soCoordById}
          assignmentBySoNumber={assignmentBySoNumber}
          routeOrderByVehicle={routeOrderByVehicle}
          vehicles={splitVehicleMappings}
          onMoveSalesOrder={reassignFromMap}
          onRouteSequenceChange={applyRouteSequenceFromMap}
          onResetAssignments={resetMapAssignments}
          onManualAssignSalesOrder={reassignFromMap}
          onManualUnassignSalesOrder={(soNumber) => moveSoToVehicleKey(soNumber, "")}
        />
      ) : null}
    </>
  );
}
