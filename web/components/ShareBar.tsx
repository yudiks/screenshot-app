"use client";

import { useState, useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

export default function ShareBar({ shareUrl }: { shareUrl: string }) {
  const [copied, setCopied] = useState(false);

  // window.location is only available on the client; useSyncExternalStore lets
  // SSR use the relative shareUrl while the client resolves the absolute one,
  // without a hydration mismatch.
  const fullUrl = useSyncExternalStore(
    subscribe,
    () => new URL(shareUrl, window.location.origin).toString(),
    () => shareUrl,
  );

  async function copyLink() {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-2 bg-neutral-800 px-3 py-2 text-sm text-white">
      <span className="truncate text-neutral-300">{fullUrl}</span>
      <button
        type="button"
        onClick={copyLink}
        className="ml-auto rounded bg-neutral-700 px-3 py-1.5 hover:bg-neutral-600"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
