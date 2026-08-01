"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [offline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="route-state">
      <div className="route-error-panel" role="alert">
        <span className="route-state-mark">A</span>
        <h1>{offline ? "You’re offline." : "Something didn’t load."}</h1>
        <p>
          {offline
            ? "This card lives online. Connect to the internet, then open the link again."
            : "Your information is safe. Check your connection and try this page again."}
        </p>
        <div>
          <button type="button" onClick={reset}>Try again</button>
          <Link href="/">Return home</Link>
        </div>
      </div>
    </main>
  );
}
