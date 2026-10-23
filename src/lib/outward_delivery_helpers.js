export function flattenOutwardDetailItems(detail) {
  if (!detail) return [];
  if (Array.isArray(detail.items)) return detail.items;
  if (Array.isArray(detail.data?.items)) return detail.data.items;
  return [];
}
