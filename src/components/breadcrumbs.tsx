import Link from "next/link";

export function Breadcrumbs({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item) =>
        item.href ? (
          <Link key={`${item.label}-${item.href}`} href={item.href}>
            {item.label}
          </Link>
        ) : (
          <span key={item.label} aria-current="page">
            {item.label}
          </span>
        ),
      )}
    </nav>
  );
}
