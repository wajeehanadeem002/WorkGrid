import { SignIn } from "@clerk/nextjs";
import { Logo } from "@/components/logo";

export default function SignInPage() {
  return (
    <main id="main-content" className="auth-page">
      <aside className="auth-page__aside">
        <Logo />
        <div>
          <p className="eyebrow">Welcome back</p>
          <h1>Pick up where your team left off.</h1>
          <p>
            Sign in to review priorities, unblock work, and keep delivery
            moving.
          </p>
        </div>
        <small>Identity is secured by Clerk.</small>
      </aside>
      <section className="auth-page__main" aria-label="Sign in">
        <SignIn />
      </section>
    </main>
  );
}
