"use client";

import type { Tool } from "@/lib/shapes";

const TOOLS: { id: Tool; label: string }[] = [
  { id: "select", label: "Select" },
  { id: "rect", label: "Rectangle" },
  { id: "circle", label: "Circle" },
  { id: "text", label: "Text" },
];

const FONT_SIZES = [16, 20, 28, 36, 48, 64];

export default function Toolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  fontSize,
  onFontSizeChange,
  onExport,
}: {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  color: string;
  onColorChange: (color: string) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  onExport: () => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-neutral-800 px-3 py-2 text-sm text-white">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onToolChange(t.id)}
          aria-pressed={tool === t.id}
          className={`rounded px-3 py-1.5 ${
            tool === t.id ? "bg-blue-600" : "bg-neutral-700 hover:bg-neutral-600"
          }`}
        >
          {t.label}
        </button>
      ))}

      <div className="mx-1 h-6 w-px bg-neutral-600" />

      <input
        type="color"
        aria-label="Annotation color"
        value={color}
        onChange={(e) => onColorChange(e.target.value)}
        className="h-8 w-8 cursor-pointer rounded border border-neutral-600 bg-transparent"
      />

      {tool === "text" && (
        <select
          aria-label="Font size"
          value={fontSize}
          onChange={(e) => onFontSizeChange(Number(e.target.value))}
          className="rounded border border-neutral-600 bg-neutral-700 px-2 py-1 text-sm text-white"
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}px
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        onClick={onExport}
        className="ml-auto rounded bg-neutral-700 px-3 py-1.5 hover:bg-neutral-600"
      >
        Download PNG
      </button>
    </div>
  );
}
