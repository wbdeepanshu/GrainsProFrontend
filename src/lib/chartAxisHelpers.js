export function withAverageDelta(rows, amountKey = "total_amount") {
  const list = Array.isArray(rows) ? rows : [];
  const total = list.reduce((sum, row) => sum + Number(row?.[amountKey] || 0), 0);
  const average = list.length ? total / list.length : 0;
  const withDelta = list.map((row) => {
    const amount = Number(row?.[amountKey] || 0);
    const deltaPct = average > 0 ? ((amount - average) / average) * 100 : 0;
    return {
      ...row,
      average_amount: average,
      avg_delta_pct: deltaPct,
    };
  });
  return { average, rows: withDelta };
}

export function buildAmountAxis(maxVal) {
  const max = Math.max(Number(maxVal) || 0, 0);
  if (max <= 0) return { ticks: [0], domainMax: 1 };
  const nice = Math.ceil(max / 4) * 4 || max;
  const step = nice / 4;
  const ticks = [0, step, step * 2, step * 3, nice];
  return { ticks, domainMax: nice };
}

export function formatAxisAmount(value) {
  const n = Number(value) || 0;
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(Math.round(n));
}
