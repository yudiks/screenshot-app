import { put } from "@vercel/blob";

export function getScreenshotUrl(id: string): string {
  return `/api/img/${id}`;
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
