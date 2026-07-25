import { redirect } from "next/navigation";
import { getAppUser } from "../../lib/auth/context";
import { OnboardingForm } from "./OnboardingForm";
import Link from "next/link";
import "../app/product.css";
import "../app/flow.css";

export default async function OnboardingPage() {
  const user = await getAppUser();
  if (!user) redirect("/auth");
  if (user.onboardingStatus === "completed") redirect("/app");
  return (
    <main className="onboarding-shell">
      <section className="onboarding-panel onboarding-profile">
        <Link className="onboarding-brand" href="/"><span>A</span>AfterMeet</Link>
        <span className="step-pill"><b aria-hidden="true">👋</b> Set up your workspace</span>
        <h1>Make AfterMeet yours.</h1>
        <p>These details personalise your private workspace. You can change them later in Settings.</p>
        <OnboardingForm initialName={user.displayName ?? ""} />
      </section>
    </main>
  );
}
