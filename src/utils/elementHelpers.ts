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
  groupId?: string;
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

// ── 선 매끄럽게 처리 ──────────────────────────────────────────────────────────

/** Douglas-Peucker 점 단순화 (내부 재귀) */
function dpRecurse(pts: [number, number][], epsilon: number): [number, number][] {
  if (pts.length < 3) return pts;
  let maxDist = 0, maxIdx = 1;
  const [x1, y1] = pts[0];
  const [x2, y2] = pts[pts.length - 1];
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const d = lenSq === 0
      ? Math.sqrt((px - x1) ** 2 + (py - y1) ** 2)
      : Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1) / Math.sqrt(lenSq);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist > epsilon) {
    const left = dpRecurse(pts.slice(0, maxIdx + 1), epsilon);
    const right = dpRecurse(pts.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [pts[0], pts[pts.length - 1]];
}

/** Douglas-Peucker 점 단순화 */
export function simplifyPoints(points: number[], epsilon: number): number[] {
  if (points.length < 6) return points;
  const pts: [number, number][] = [];
  for (let i = 0; i < points.length; i += 2) pts.push([points[i], points[i + 1]]);
  return dpRecurse(pts, epsilon).flatMap(p => p);
}

/** Chaikin 알고리즘으로 선 매끄럽게 처리 */
export function smoothPoints(points: number[], iterations = 3): number[] {
  if (points.length < 6) return points;
  let pts = [...points];
  for (let iter = 0; iter < iterations; iter++) {
    const newPts: number[] = [pts[0], pts[1]];
    for (let i = 0; i < pts.length - 2; i += 2) {
      const x1 = pts[i], y1 = pts[i + 1];
      const x2 = pts[i + 2], y2 = pts[i + 3];
      newPts.push(0.75 * x1 + 0.25 * x2, 0.75 * y1 + 0.25 * y2);
      newPts.push(0.25 * x1 + 0.75 * x2, 0.25 * y1 + 0.75 * y2);
    }
    newPts.push(pts[pts.length - 2], pts[pts.length - 1]);
    pts = newPts;
  }
  return pts;
}

// ── 도형 자동 인식 ────────────────────────────────────────────────────────────

/** 펜 획에서 원 또는 삼각형을 자동 인식하여 도형 엘리먼트로 변환 */
export function detectSmartShape(el: DrawElement): DrawElement | null {
  const { points } = el;
  if (points.length < 16) return null; // 최소 8개 점 필요

  const pts: [number, number][] = [];
  for (let i = 0; i < points.length; i += 2) pts.push([points[i], points[i + 1]]);

  // 바운딩 박스
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  pts.forEach(([x, y]) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  });
  const scale = Math.max(maxX - minX, maxY - minY);
  if (scale < 30) return null; // 너무 작은 획 무시

  // 닫힌 경로 여부 확인
  const closeDist = Math.sqrt(
    (pts[0][0] - pts[pts.length - 1][0]) ** 2 +
    (pts[0][1] - pts[pts.length - 1][1]) ** 2
  );
  if (closeDist > scale * 0.4) return null; // 열린 경로는 무시

  // ── 원 감지: 중심에서 모든 점의 거리가 일정한지 확인 ──
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const dists = pts.map(p => Math.sqrt((p[0] - cx) ** 2 + (p[1] - cy) ** 2));
  const avgR = dists.reduce((s, d) => s + d, 0) / dists.length;
  const variance = dists.reduce((s, d) => s + (d - avgR) ** 2, 0) / dists.length;
  const cv = Math.sqrt(variance) / avgR; // 변동계수 (작을수록 원에 가까움)

  if (cv < 0.22 && avgR > 15) {
    return { ...el, tool: 'circle', points: [cx - avgR, cy - avgR, cx + avgR, cy + avgR] };
  }

  // ── 삼각형 감지: Douglas-Peucker로 단순화 후 꼭짓점 수 확인 ──
  const simplified = dpRecurse(pts, scale * 0.07);
  // 닫힌 경로이므로 마지막 점이 첫 점과 같으면 제거
  const last = simplified[simplified.length - 1];
  const corners = (last[0] === simplified[0][0] && last[1] === simplified[0][1])
    ? simplified.slice(0, -1) : simplified;

  if (corners.length >= 3 && corners.length <= 4) {
    return { ...el, tool: 'triangle', points: [minX, minY, maxX, maxY] };
  }

  return null;
}
