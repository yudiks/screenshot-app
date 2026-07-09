import { list } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import type { ShapeData } from "@/lib/shapes";

export const runtime = "nodejs";

const STROKE_WIDTH = 3;

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    c === "<"
      ? "&lt;"
      : c === ">"
        ? "&gt;"
        : c === "&"
          ? "&amp;"
          : c === '"'
            ? "&quot;"
            : "&apos;"
  );
}

function shapesToSvg(shapes: ShapeData[], width: number, height: number): string {
  const parts = shapes.map((s) => {
    if (s.type === "rect") {
      return `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="none" stroke="${escapeXml(s.stroke)}" stroke-width="${STROKE_WIDTH}" />`;
    }
    if (s.type === "circle") {
      return `<ellipse cx="${s.x}" cy="${s.y}" rx="${s.radiusX}" ry="${s.radiusY}" fill="none" stroke="${escapeXml(s.stroke)}" stroke-width="${STROKE_WIDTH}" />`;
    }
    // text — Konva positions (x, y) at the top-left; SVG <text> y is the baseline,
    // so offset each line by the font size (~0.8 for the ascent).
    const lines = (s.text ?? "").split("\n");
    const tspans = lines
      .map(
        (line, i) =>
          `<tspan x="${s.x}" y="${s.y + s.fontSize * (i + 0.8)}">${escapeXml(line)}</tspan>`
      )
      .join("");
    return `<text font-family="Arial, Helvetica, sans-serif" font-size="${s.fontSize}" fill="${escapeXml(s.fill)}">${tspans}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${parts.join("")}</svg>`;
}

async function fetchBlobJson(prefix: string): Promise<ShapeData[]> {
  const { blobs } = await list({ prefix, limit: 1 });
  if (!blobs.length) return [];
  const res = await fetch(blobs[0].url, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { blobs } = await list({ prefix: `screenshots/${id}.png`, limit: 1 });
  if (!blobs.length) return new NextResponse("Not found", { status: 404 });

  const imgRes = await fetch(blobs[0].url, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!imgRes.ok) return new NextResponse("Not found", { status: 404 });

  const pngBuffer = Buffer.from(await imgRes.arrayBuffer());
  const shapes = await fetchBlobJson(`annotations/${id}.json`);

  let out = pngBuffer;
  if (shapes.length) {
    const base = sharp(pngBuffer);
    const { width, height } = await base.metadata();
    const svg = shapesToSvg(shapes, width, height);
    out = await base
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toBuffer();
  }

  return new NextResponse(out, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${id}.png"`,
      "Cache-Control": "no-store",
    },
  });
}
