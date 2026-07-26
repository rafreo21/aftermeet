"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="route-state">
      <div className="route-error-panel" role="alert">
        <span className="route-state-mark">A</span>
        <h1>Something didn’t load.</h1>
        <p>Your information is safe. Check your connection and try this page again.</p>
        <div>
          <button type="button" onClick={reset}>Try again</button>
          <a href="/">Return home</a>
        </div>
      </div>
    </main>
  );
}
