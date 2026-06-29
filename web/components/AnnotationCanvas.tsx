"use client";

import { useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Rect,
  Circle,
  Text as KonvaText,
  Transformer,
} from "react-konva";
import type Konva from "konva";
import { nanoid } from "nanoid";
import type { ShapeData, TextShape, Tool } from "@/lib/shapes";
import Toolbar from "@/components/Toolbar";
import ShareBar from "@/components/ShareBar";

const TOOLBAR_HEIGHT = 48;
const SHAREBAR_HEIGHT = 40;

export default function AnnotationCanvas({
  imageUrl,
  shareUrl,
}: {
  imageUrl: string;
  shareUrl: string;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "error">(
    "loading"
  );
  const [loadedImageUrl, setLoadedImageUrl] = useState(imageUrl);
  const [stageScale, setStageScale] = useState(1);
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState("#ff3b30");
  const [shapes, setShapes] = useState<ShapeData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editorBox, setEditorBox] = useState<{ left: number; top: number } | null>(
    null
  );

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const shapeRefs = useRef<Map<string, Konva.Node>>(new Map());
  const drawingRef = useRef<{ id: string; startX: number; startY: number } | null>(
    null
  );

  if (imageUrl !== loadedImageUrl) {
    setLoadedImageUrl(imageUrl);
    setImage(null);
    setImageStatus("loading");
  }

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImage(img);
      setImageStatus("loaded");
    };
    img.onerror = () => setImageStatus("error");
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (!image) return;
    function recalc() {
      if (!image) return;
      const maxWidth = window.innerWidth;
      const maxHeight = window.innerHeight - TOOLBAR_HEIGHT - SHAREBAR_HEIGHT;
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
      setStageScale(scale > 0 ? scale : 1);
    }
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [image]);

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    if (!selectedId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = shapeRefs.current.get(selectedId);
    if (node) {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedId, shapes]);

  useEffect(() => {
    if (!editingTextId) return;
    const stage = stageRef.current;
    if (!stage) return;
    const box = stage.container().getBoundingClientRect();
    setEditorBox({ left: box.left, top: box.top });
  }, [editingTextId]);

  function handlePointerDown(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;

    if (tool === "select") {
      if (e.target === stage) setSelectedId(null);
      return;
    }

    const id = nanoid();

    if (tool === "rect") {
      setShapes((prev) => [
        ...prev,
        { id, type: "rect", x: pos.x, y: pos.y, width: 0, height: 0, stroke: color },
      ]);
      drawingRef.current = { id, startX: pos.x, startY: pos.y };
      return;
    }

    if (tool === "circle") {
      setShapes((prev) => [
        ...prev,
        { id, type: "circle", x: pos.x, y: pos.y, radius: 0, stroke: color },
      ]);
      drawingRef.current = { id, startX: pos.x, startY: pos.y };
      return;
    }

    if (tool === "text") {
      setShapes((prev) => [
        ...prev,
        { id, type: "text", x: pos.x, y: pos.y, text: "", fill: color },
      ]);
      setSelectedId(id);
      setEditingTextId(id);
      setTool("select");
    }
  }

  function handlePointerMove() {
    const drawing = drawingRef.current;
    const stage = stageRef.current;
    if (!drawing || !stage) return;
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;

    setShapes((prev) =>
      prev.map((s) => {
        if (s.id !== drawing.id) return s;
        if (s.type === "rect") {
          return {
            ...s,
            x: Math.min(pos.x, drawing.startX),
            y: Math.min(pos.y, drawing.startY),
            width: Math.abs(pos.x - drawing.startX),
            height: Math.abs(pos.y - drawing.startY),
          };
        }
        if (s.type === "circle") {
          const dx = pos.x - drawing.startX;
          const dy = pos.y - drawing.startY;
          return { ...s, radius: Math.sqrt(dx * dx + dy * dy) };
        }
        return s;
      })
    );
  }

  function handlePointerUp() {
    const drawing = drawingRef.current;
    if (!drawing) return;
    drawingRef.current = null;
    setShapes((prev) =>
      prev.filter((s) => {
        if (s.id !== drawing.id) return true;
        if (s.type === "rect") return s.width > 4 && s.height > 4;
        if (s.type === "circle") return s.radius > 4;
        return true;
      })
    );
  }

  function handleDragEnd(id: string, node: Konva.Node) {
    setShapes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, x: node.x(), y: node.y() } : s))
    );
  }

  function handleTransformEnd(id: string, node: Konva.Node) {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    setShapes((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (s.type === "rect") {
          return {
            ...s,
            x: node.x(),
            y: node.y(),
            width: Math.max(5, s.width * scaleX),
            height: Math.max(5, s.height * scaleY),
          };
        }
        if (s.type === "circle") {
          return {
            ...s,
            x: node.x(),
            y: node.y(),
            radius: Math.max(5, s.radius * ((scaleX + scaleY) / 2)),
          };
        }
        return { ...s, x: node.x(), y: node.y() };
      })
    );
  }

  function commitText(id: string, text: string) {
    const trimmed = text.trim();
    setShapes((prev) =>
      trimmed
        ? prev.map((s) => (s.id === id && s.type === "text" ? { ...s, text: trimmed } : s))
        : prev.filter((s) => s.id !== id)
    );
    setEditingTextId(null);
  }

  function handleExport() {
    setSelectedId(null);
    requestAnimationFrame(() => {
      const stage = stageRef.current;
      if (!stage) return;
      const uri = stage.toDataURL({ pixelRatio: 1 / stageScale });
      const link = document.createElement("a");
      link.download = "annotated-screenshot.png";
      link.href = uri;
      link.click();
    });
  }

  function registerRef(id: string) {
    return (node: Konva.Node | null) => {
      if (node) shapeRefs.current.set(id, node);
      else shapeRefs.current.delete(id);
    };
  }

  const selectedShape = shapes.find((s) => s.id === selectedId);
  const allowResize = selectedShape?.type === "rect" || selectedShape?.type === "circle";
  const editingShape = editingTextId
    ? (shapes.find((s) => s.id === editingTextId) as TextShape | undefined)
    : undefined;

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        tool={tool}
        onToolChange={setTool}
        color={color}
        onColorChange={setColor}
        onExport={handleExport}
      />
      <div className="relative flex flex-1 items-center justify-center overflow-auto bg-neutral-950">
        {imageStatus === "loading" && (
          <p className="text-neutral-400">Loading...</p>
        )}
        {imageStatus === "error" && (
          <p className="text-neutral-400">Screenshot not found.</p>
        )}
        {imageStatus === "loaded" && image && (
          <Stage
            ref={stageRef}
            width={image.width * stageScale}
            height={image.height * stageScale}
            scaleX={stageScale}
            scaleY={stageScale}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          >
            <Layer>
              <KonvaImage image={image} listening={false} />
            </Layer>
            <Layer>
              {shapes.map((s) => {
                const common = {
                  draggable: tool === "select",
                  onClick: () => tool === "select" && setSelectedId(s.id),
                  onTap: () => tool === "select" && setSelectedId(s.id),
                  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
                    handleDragEnd(s.id, e.target),
                  onTransformEnd: (e: Konva.KonvaEventObject<Event>) =>
                    handleTransformEnd(s.id, e.target),
                  ref: registerRef(s.id),
                };
                if (s.type === "rect") {
                  return (
                    <Rect
                      key={s.id}
                      {...common}
                      x={s.x}
                      y={s.y}
                      width={s.width}
                      height={s.height}
                      stroke={s.stroke}
                      strokeWidth={3}
                    />
                  );
                }
                if (s.type === "circle") {
                  return (
                    <Circle
                      key={s.id}
                      {...common}
                      x={s.x}
                      y={s.y}
                      radius={s.radius}
                      stroke={s.stroke}
                      strokeWidth={3}
                    />
                  );
                }
                return (
                  <KonvaText
                    key={s.id}
                    {...common}
                    x={s.x}
                    y={s.y}
                    text={s.text}
                    fill={s.fill}
                    fontSize={20}
                  />
                );
              })}
              <Transformer
                ref={transformerRef}
                resizeEnabled={allowResize}
                rotateEnabled={allowResize}
              />
            </Layer>
          </Stage>
        )}
        {editingShape && editorBox && (
          <textarea
            autoFocus
            defaultValue={editingShape.text}
            style={{
              position: "fixed",
              left: editorBox.left + editingShape.x * stageScale,
              top: editorBox.top + editingShape.y * stageScale,
              fontSize: 20 * stageScale,
              color: editingShape.fill,
              background: "transparent",
              border: "1px dashed #999",
              outline: "none",
              resize: "none",
              minWidth: 120,
              zIndex: 50,
            }}
            onBlur={(e) => commitText(editingShape.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.blur();
              }
              if (e.key === "Escape") commitText(editingShape.id, "");
            }}
          />
        )}
      </div>
      <ShareBar shareUrl={shareUrl} />
    </div>
  );
}
