import Image from "next/image";
import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="logo" aria-label="WorkGrid home">
      <span className="logo__mark" aria-hidden="true">
        <Image
          src="/brand/workgrid-mark.png"
          alt=""
          width={32}
          height={32}
          unoptimized
        />
      </span>
      <span>WorkGrid</span>
    </Link>
  );
}
