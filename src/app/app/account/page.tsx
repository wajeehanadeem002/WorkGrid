import { UserProfile } from "@clerk/nextjs";
import { Logo } from "@/components/logo";

export default function AccountPage() {
  return (
    <main id="main-content" className="page">
      <Logo href="/app" />
      <div style={{ marginTop: "2rem", display: "grid", placeItems: "center" }}>
        <UserProfile routing="hash" />
      </div>
    </main>
  );
}
