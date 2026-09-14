import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main id="main-content" className="auth-page__main">
      <div className="empty-state">
        <Logo />
        <h1>Page not found</h1>
        <p>The page may have moved, or you may not have access to it.</p>
        <div className="empty-state__action">
          <Link className="button button--primary" href="/app">
            Return to WorkGrid
          </Link>
        </div>
      </div>
    </main>
  );
}
