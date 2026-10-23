/** Soft stubs — GrainPro may not expose the same accounts listing APIs. */

export async function fetchBusinessTypes() {
  return [];
}

export async function fetchCreditTypes() {
  return [];
}

export async function fetchCommonListings() {
  return { category_types: [], religions: [] };
}
