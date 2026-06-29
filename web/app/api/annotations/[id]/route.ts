import { put, list } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

async function getBlobUrl(id: string) {
  const { blobs } = await list({ prefix: `annotations/${id}.json`, limit: 1 });
  return blobs[0]?.url ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = await getBlobUrl(id);
  if (!url) return NextResponse.json([]);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!res.ok) return NextResponse.json([]);
  const data = await res.json();
  return NextResponse.json(data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const shapes = await req.json();

  await put(`annotations/${id}.json`, JSON.stringify(shapes), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json",
  });

  return NextResponse.json({ ok: true });
}
