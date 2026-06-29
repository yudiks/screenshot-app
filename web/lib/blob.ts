import { put } from "@vercel/blob";

export function getScreenshotUrl(id: string): string {
  const base = process.env.BLOB_BASE_URL;
  if (!base) {
    throw new Error("BLOB_BASE_URL is not set");
  }
  return `${base}/screenshots/${id}.png`;
}

export async function uploadScreenshot(
  id: string,
  file: Blob
): Promise<{ url: string }> {
  const blob = await put(`screenshots/${id}.png`, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: "image/png",
  });
  return { url: blob.url };
}
