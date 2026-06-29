import { nanoid } from "nanoid";
import { uploadScreenshot } from "@/lib/blob";

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.type !== "image/png") {
    return Response.json({ error: "File must be a PNG" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "File too large" }, { status: 400 });
  }

  const id = nanoid();
  const { url: blobUrl } = await uploadScreenshot(id, file);

  return Response.json({ id, url: `/s/${id}`, blobUrl });
}
