import { list } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { blobs } = await list({ prefix: `recordings/${id}.mp4`, limit: 1 });
  if (!blobs.length) return new NextResponse("Not found", { status: 404 });

  // Forward the client's Range header so the browser can seek within the video.
  const range = req.headers.get("range");
  const upstream = await fetch(blobs[0].url, {
    headers: {
      Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      ...(range ? { Range: range } : {}),
    },
  });
  if (!upstream.ok && upstream.status !== 206) {
    return new NextResponse("Not found", { status: 404 });
  }

  const headers = new Headers();
  headers.set("Content-Type", "video/mp4");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  for (const h of ["content-length", "content-range"]) {
    const value = upstream.headers.get(h);
    if (value) headers.set(h, value);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}
