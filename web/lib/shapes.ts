export type Tool = "select" | "rect" | "circle" | "text";

export type RectShape = {
  id: string;
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
};

export type CircleShape = {
  id: string;
  type: "circle";
  x: number;
  y: number;
  radius: number;
  stroke: string;
};

export type TextShape = {
  id: string;
  type: "text";
  x: number;
  y: number;
  text: string;
  fill: string;
};

export type ShapeData = RectShape | CircleShape | TextShape;
