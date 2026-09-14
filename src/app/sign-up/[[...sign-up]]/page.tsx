import { SignUp } from "@clerk/nextjs";
import { Logo } from "@/components/logo";

export default function SignUpPage() {
  return (
    <main id="main-content" className="auth-page">
      <aside className="auth-page__aside">
        <Logo />
        <div>
          <p className="eyebrow">Create an account</p>
          <h1>Build a dependable operating rhythm.</h1>
          <p>
            Start a private organization, organize projects, and give every task
            a clear owner.
          </p>
        </div>
        <small>Your workspace data remains isolated by organization.</small>
      </aside>
      <section className="auth-page__main" aria-label="Create account">
        <SignUp />
      </section>
    </main>
  );
}
