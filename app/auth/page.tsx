import { readPublicSupabaseConfig } from "../../lib/supabase/env";
import { sanitizeIntendedDestination } from "../../lib/auth/redirect";
import { AuthForm } from "./AuthForm";
import Link from "next/link";
import "./auth.css";

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const environment = readPublicSupabaseConfig();
  const errors: Record<string, string> = {
    callback: "That sign-in link is invalid or has expired. Request a new one.",
    provisioning: "We couldn’t create your private workspace. Your session was closed; please try again.",
  };
  return (
    <main className="auth-page">
      <Link className="auth-logo" href="/"><span>A</span><strong>AfterMeet</strong></Link>
      <section className="auth-panel">
        <div className="auth-intro">
          <span><b className="auth-emoji" aria-hidden="true">👋</b> Welcome</span>
          <h1>Sign in or sign up<br />in seconds.</h1>
          <p>Enter your email and we’ll send a secure, single-use sign-in link.</p>
        </div>
        {!environment.config ? (
          <div className="auth-config" role="alert">
            <strong>Authentication is not configured.</strong>
            <p>Add {environment.missing.join(", ")} to your local environment, then restart the app.</p>
          </div>
        ) : (
          <AuthForm
            appUrl={environment.config.appUrl}
            next={sanitizeIntendedDestination(params.next)}
            initialError={params.error ? errors[params.error] ?? "" : ""}
          />
        )}
      </section>
      <footer className="auth-footer"><span>Private by default</span></footer>
    </main>
  );
}
