export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
export const MAX_PAGE = 10_000;

export interface Pagination {
  page: number;
  pageSize: number;
  from: number;
  to: number;
}

function parsePositiveInteger(
  value: string | string[] | undefined,
): number | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !/^\d+$/.test(candidate)) return null;
  const parsed = Number(candidate);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parsePagination(input: {
  page?: string | string[] | undefined;
  pageSize?: string | string[] | undefined;
}): Pagination {
  const requestedPage = parsePositiveInteger(input.page) ?? 1;
  const requestedPageSize =
    parsePositiveInteger(input.pageSize) ?? DEFAULT_PAGE_SIZE;
  const page = Math.min(requestedPage, MAX_PAGE);
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);
  const from = (page - 1) * pageSize;

  return { page, pageSize, from, to: from + pageSize - 1 };
}

export function totalPages(totalItems: number, pageSize: number): number {
  return Math.max(
    1,
    Math.ceil(Math.max(0, totalItems) / Math.max(1, pageSize)),
  );
}
