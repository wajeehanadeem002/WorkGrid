import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { totalPages } from "@/lib/security/pagination";

export function Pagination({
  page,
  pageSize,
  total,
  query,
  pageParam = "page",
  pageSizeParam = "pageSize",
}: {
  page: number;
  pageSize: number;
  total: number;
  query: Record<string, string | undefined>;
  pageParam?: string;
  pageSizeParam?: string;
}) {
  const pages = totalPages(total, pageSize);
  if (pages <= 1) return null;
  const hrefFor = (nextPage: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value) params.set(key, value);
    params.set(pageParam, String(nextPage));
    params.set(pageSizeParam, String(pageSize));
    return `?${params.toString()}`;
  };
  return (
    <nav className="pagination" aria-label="Pagination">
      <span>
        Page {page} of {pages} · {total} results
      </span>
      <div className="pagination__actions">
        {page > 1 ? (
          <Link
            className="button button--secondary button--small"
            href={hrefFor(page - 1)}
          >
            <ChevronLeft size={15} /> Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link
            className="button button--secondary button--small"
            href={hrefFor(page + 1)}
          >
            Next <ChevronRight size={15} />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
