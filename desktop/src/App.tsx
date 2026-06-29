import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

type CaptureStatus =
  | { status: "capturing" }
  | { status: "uploading" }
  | { status: "done"; shareUrl: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

function describe(status: CaptureStatus | null): string {
  if (!status) return "Press Cmd+Shift+9 or click below to capture a screenshot.";
  switch (status.status) {
    case "capturing":
      return "Select an area to capture...";
    case "uploading":
      return "Uploading screenshot...";
    case "done":
      return `Done! Opened ${status.shareUrl} in your browser.`;
    case "cancelled":
      return "Capture cancelled.";
    case "error":
      return `Error: ${status.message}`;
  }
}

function App() {
  const [status, setStatus] = useState<CaptureStatus | null>(null);

  useEffect(() => {
    const unlisten = listen<CaptureStatus>("capture-status", (event) => {
      setStatus(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const busy = status?.status === "capturing" || status?.status === "uploading";

  return (
    <main className="container">
      <h1>Screenshot App</h1>
      <p>{describe(status)}</p>
      <button disabled={busy} onClick={() => invoke("capture_now")}>
        {busy ? "Working..." : "Capture Now"}
      </button>
      <p className="hint">Global shortcut: Cmd+Shift+9</p>
    </main>
  );
}

export default App;
