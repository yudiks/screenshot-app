"use client";

import { useState, useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

function sourceHost(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.host;
  } catch {
    return null;
  }
}

export default function ShareBar({
  shareUrl,
  sourceUrl,
}: {
  shareUrl: string;
  sourceUrl?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const host = sourceUrl ? sourceHost(sourceUrl) : null;

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
      {host && (
        <a
          href={sourceUrl!}
          target="_blank"
          rel="noopener noreferrer"
          title={sourceUrl!}
          className="flex shrink-0 items-center gap-1 rounded bg-neutral-700 px-2 py-1 text-neutral-100 hover:bg-neutral-600"
        >
          <span aria-hidden>🔗</span>
          <span className="max-w-[16rem] truncate">Source: {host}</span>
        </a>
      )}
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
