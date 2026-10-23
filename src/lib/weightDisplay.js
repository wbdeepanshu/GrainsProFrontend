/**
 * Display helpers for total / item weights using API alternate_unit instead of hardcoded Qtl.
 */

/**
 * Header-level total weight: append total_weight_unit when value does not already include it.
 * When API omits unit, use fallbackUnit (default Qtl) for backward compatibility.
 */
export function formatTotalWeightDisplay(totalWeight, totalWeightUnit, fallbackUnit = "Qtl") {
  if (totalWeight == null || totalWeight === "") return "N/A";
  const tw = String(totalWeight).trim();
  if (tw === "N/A") return "N/A";
  const u = totalWeightUnit && String(totalWeightUnit).trim();
  const unit = u || (fallbackUnit && String(fallbackUnit).trim()) || "";
  if (!unit) return tw;
  if (tw.toLowerCase().includes(unit.toLowerCase())) return tw;
  return `${tw} ${unit}`.trim();
}

/** Per inward line: numeric total_weight + alternate_unit when not already present. */
export function formatInwardItemTotalWeightDisplay(totalWeight, alternateUnit) {
  if (totalWeight == null || totalWeight === "") return "N/A";
  const tw = String(totalWeight).trim();
  const alt = alternateUnit && String(alternateUnit).trim();
  if (!alt) return tw;
  if (tw.toLowerCase().includes(alt.toLowerCase())) return tw;
  return `${tw} ${alt}`.trim();
}

/**
 * PO item_weight from API is often "12 Qtl"; replace Qtl with stock alternate_unit when provided.
 */
export function formatItemWeightWithAlternateUnit(itemWeight, alternateUnitName) {
  if (itemWeight == null || itemWeight === "" || itemWeight === "N/A") {
    return itemWeight ?? "N/A";
  }
  const s = String(itemWeight).trim();
  const alt = alternateUnitName && String(alternateUnitName).trim();
  if (!alt) return s;
  if (s.toLowerCase().includes(alt.toLowerCase())) return s;
  const m = s.match(/^([\d.,]+)\s*Qtl\b/i);
  if (m) return `${m[1]} ${alt}`.trim();
  if (/\bqtl\b/i.test(s)) {
    return s.replace(/\s*Qtl\b/gi, ` ${alt}`).replace(/\s+/g, " ").trim();
  }
  return `${s} ${alt}`.trim();
}

/** Create-invoice dialog: show qty with alternate unit instead of hardcoded Qtl. */
export function formatInvoiceQuantityLabel(item) {
  if (!item) return "";
  if (item.total_weight != null && item.total_weight !== "") {
    return formatInwardItemTotalWeightDisplay(item.total_weight, item.alternate_unit);
  }
  return `${item.number_of_bags || 0} Bags`;
}

/** Consensus alternate/total weight unit across inward list rows (from total_weight_unit). */
export function inwardListSummaryWeightUnit(entries) {
  const units = (entries || []).map((e) => e.total_weight_unit).filter(Boolean);
  if (!units.length) return null;
  const first = units[0];
  return units.every((u) => u === first) ? first : null;
}
