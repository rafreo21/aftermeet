"use client";

import { useEffect } from "react";

export default function LegacyQrPage() {
  useEffect(() => {
    window.location.replace("/app/cards#share");
  }, []);

  return null;
}
