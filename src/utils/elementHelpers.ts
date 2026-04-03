// ── 타입 정의 ────────────────────────────────────────────────────────────────

export type ToolType =
  | 'pen' | 'eraser' | 'rect' | 'circle' | 'text'
  | 'arrow' | 'straight' | 'select' | 'sticky' | 'image' | 'triangle';

export type DashStyle = 'solid' | 'dashed' | 'dotted';

export interface DrawElement {
  id?: string;
  tool: ToolType;
  points: number[];
  color: string;
  strokeWidth: number;
  filled?: boolean;
  text?: string;
  fontSize?: number;
  dash?: DashStyle;
  opacity?: number;
  stickyBg?: string;
  imageDataUrl?: string;
  locked?: boolean;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── 유틸리티 ─────────────────────────────────────────────────────────────────

export const generateId = (): string =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

/** 대시 패턴 배열 반환 (Konva dash prop용) */
export function getDashArray(style?: DashStyle, scale = 1): number[] | undefined {
  if (style === 'dashed') return [12 / scale, 6 / scale];
  if (style === 'dotted') return [2 / scale, 6 / scale];
  return undefined;
}

/** 엘리먼트의 바운딩 박스 계산 */
export function getElementBounds(el: DrawElement): Bounds | null {
  const pad = el.strokeWidth / 2 + 2;

  if (el.tool === 'pen' || el.tool === 'eraser') {
    if (el.points.length < 2) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < el.points.length; i += 2) {
      minX = Math.min(minX, el.points[i]);
      minY = Math.min(minY, el.points[i + 1]);
      maxX = Math.max(maxX, el.points[i]);
      maxY = Math.max(maxY, el.points[i + 1]);
    }
    return { x: minX - pad, y: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 };
  }

  if (['rect', 'circle', 'straight', 'arrow', 'sticky', 'triangle'].includes(el.tool)) {
    if (el.points.length < 4) return null;
    const x = Math.min(el.points[0], el.points[2]);
    const y = Math.min(el.points[1], el.points[3]);
    const w = Math.abs(el.points[2] - el.points[0]);
    const h = Math.abs(el.points[3] - el.points[1]);
    return { x: x - pad, y: y - pad, width: w + pad * 2, height: h + pad * 2 };
  }

  if (el.tool === 'text' && el.text) {
    const fontSize = el.fontSize || 20;
    return {
      x: el.points[0],
      y: el.points[1],
      width: el.text.length * fontSize * 0.62 + 10,
      height: fontSize * 1.5,
    };
  }

  if (el.tool === 'image' && el.points.length >= 4) {
    const w = el.points[2] || 200;
    const h = el.points[3] || 200;
    return { x: el.points[0], y: el.points[1], width: w, height: h };
  }

  return null;
}

/** 포인트 위에 있는 엘리먼트 인덱스 반환 (맨 위 우선) */
export function getElementAtPoint(
  elements: DrawElement[],
  x: number,
  y: number,
): number | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const b = getElementBounds(elements[i]);
    if (b && x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) return i;
  }
  return null;
}

/** 사각형 영역과 교차하는 엘리먼트 인덱스 목록 */
export function getElementsInRect(
  elements: DrawElement[],
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): number[] {
  const x1 = Math.min(rx, rx + rw), y1 = Math.min(ry, ry + rh);
  const x2 = Math.max(rx, rx + rw), y2 = Math.max(ry, ry + rh);
  const result: number[] = [];
  for (let i = 0; i < elements.length; i++) {
    const b = getElementBounds(elements[i]);
    if (b && b.x < x2 && b.x + b.width > x1 && b.y < y2 && b.y + b.height > y1) {
      result.push(i);
    }
  }
  return result;
}

/** 엘리먼트를 dx, dy만큼 이동 */
export function moveElementBy(el: DrawElement, dx: number, dy: number): DrawElement {
  return { ...el, points: el.points.map((p, i) => (i % 2 === 0 ? p + dx : p + dy)) };
}
