import { put, list } from "@vercel/blob";

export function getScreenshotUrl(id: string): string {
  return `/api/img/${id}`;
}

/** Persist the source URL a screenshot was captured from (e.g. a browser tab). */
export async function uploadSource(id: string, url: string): Promise<void> {
  await put(`sources/${id}.json`, JSON.stringify({ url }), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

/** Read the stored source URL for a screenshot, if any. Returns only http(s) URLs. */
export async function getSource(id: string): Promise<string | null> {
  const { blobs } = await list({ prefix: `sources/${id}.json`, limit: 1 });
  if (!blobs.length) return null;
  const res = await fetch(blobs[0].url, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  try {
    const data = await res.json();
    const url = typeof data?.url === "string" ? data.url : null;
    return url && /^https?:\/\//i.test(url) ? url : null;
  } catch {
    return null;
  }
}

export function getRecordingUrl(id: string): string {
  return `/api/vid/${id}`;
}

export async function uploadScreenshot(
  id: string,
  file: Blob
): Promise<{ url: string }> {
  const blob = await put(`screenshots/${id}.png`, file, {
    access: "private",
    addRandomSuffix: false,
    contentType: "image/png",
  });
  return { url: blob.url };
}

export async function uploadRecording(
  id: string,
  file: Blob
): Promise<{ url: string }> {
  const blob = await put(`recordings/${id}.mp4`, file, {
    access: "private",
    addRandomSuffix: false,
    contentType: "video/mp4",
  });
  return { url: blob.url };
}
