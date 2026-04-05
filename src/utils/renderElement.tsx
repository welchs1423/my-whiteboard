import type { MutableRefObject } from 'react';
import { Line, Rect, Ellipse, Text, Arrow, Image as KonvaImage, Group, Path } from 'react-konva';
import type { DrawElement } from './elementHelpers';
import { getDashArray, getElementBounds } from './elementHelpers';

// ── 도형 라이브러리 패스 (0~1 정규화 좌표) ──────────────────────────
export const SHAPE_PATHS: Record<string, string> = {
  diamond:       'M 0.5 0 L 1 0.5 L 0.5 1 L 0 0.5 Z',
  hexagon:       'M 1 0.5 L 0.75 0.933 L 0.25 0.933 L 0 0.5 L 0.25 0.067 L 0.75 0.067 Z',
  star:          'M 0.5 0 L 0.61 0.35 L 0.98 0.35 L 0.68 0.57 L 0.79 0.91 L 0.5 0.7 L 0.21 0.91 L 0.32 0.57 L 0.02 0.35 L 0.39 0.35 Z',
  parallelogram: 'M 0.2 0 L 1 0 L 0.8 1 L 0 1 Z',
  cross:         'M 0.33 0 L 0.67 0 L 0.67 0.33 L 1 0.33 L 1 0.67 L 0.67 0.67 L 0.67 1 L 0.33 1 L 0.33 0.67 L 0 0.67 L 0 0.33 L 0.33 0.33 Z',
  callout:       'M 0 0 L 1 0 L 1 0.72 L 0.5 0.72 L 0.35 1 L 0.3 0.72 L 0 0.72 Z',
  cylinder_top:  'M 0.5 0.15 m -0.5 0 a 0.5 0.15 0 1 0 1 0 a 0.5 0.15 0 1 0 -1 0',
};

/** 그라디언트 or 단색 채우기 props 반환 */
function fillProps(el: DrawElement, w: number, h: number): object {
  if (el.filled && el.gradientColors) {
    const a = ((el.gradientAngle ?? 0) * Math.PI) / 180;
    return {
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: w * Math.cos(a), y: h * Math.sin(a) },
      fillLinearGradientColorStops: [0, el.gradientColors[0], 1, el.gradientColors[1]],
    };
  }
  return { fill: el.filled ? el.color : undefined };
}

export function renderElement(
  el: DrawElement,
  i: number,
  stageScale: number,
  imageCache: MutableRefObject<Map<string, HTMLImageElement>>,
  allElements?: DrawElement[],
) {
  const op = el.opacity ?? 1;
  const dash = getDashArray(el.dash, stageScale);

  // ── 펜 (속도 감응 선 굵기 지원) ──
  if (el.tool === 'pen' || el.tool === 'eraser') {
    if (el.widths && el.widths.length > 1 && el.tool === 'pen') {
      const n = el.widths.length - 1;
      return (
        <Group key={i} opacity={op}>
          {Array.from({ length: n }, (_, j) => (
            <Line key={j}
              points={[el.points[j*2], el.points[j*2+1], el.points[(j+1)*2], el.points[(j+1)*2+1]]}
              stroke={el.color}
              strokeWidth={(el.widths![j] + el.widths![j+1]) / 2}
              lineCap={el.lineCap ?? 'round'} lineJoin="round"
            />
          ))}
        </Group>
      );
    }
    return (
      <Line key={i} points={el.points} stroke={el.color} strokeWidth={el.strokeWidth}
        tension={0.5} lineCap={el.lineCap ?? 'round'} lineJoin="round" opacity={op}
        globalCompositeOperation={el.tool === 'eraser' ? 'destination-out' : 'source-over'} />
    );
  }

  if (el.tool === 'rect' && el.points.length >= 4) {
    const x = Math.min(el.points[0], el.points[2]);
    const y = Math.min(el.points[1], el.points[3]);
    const w = Math.abs(el.points[2] - el.points[0]);
    const h = Math.abs(el.points[3] - el.points[1]);
    return (
      <Rect key={i} x={x} y={y} width={w} height={h}
        stroke={el.color} strokeWidth={el.strokeWidth}
        {...fillProps(el, w, h)}
        dash={dash} opacity={op} />
    );
  }
  if (el.tool === 'circle' && el.points.length >= 4) {
    const w = Math.abs(el.points[2] - el.points[0]);
    const h = Math.abs(el.points[3] - el.points[1]);
    return (
      <Ellipse key={i}
        x={(el.points[0] + el.points[2]) / 2} y={(el.points[1] + el.points[3]) / 2}
        radiusX={w / 2} radiusY={h / 2}
        stroke={el.color} strokeWidth={el.strokeWidth}
        {...fillProps(el, w, h)}
        dash={dash} opacity={op} />
    );
  }
  if (el.tool === 'triangle' && el.points.length >= 4) {
    const [x1, y1, x2, y2] = el.points;
    const midX = (x1 + x2) / 2;
    const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
    return (
      <Line key={i} points={[midX, y1, x2, y2, x1, y2]} closed
        stroke={el.color} strokeWidth={el.strokeWidth}
        {...fillProps(el, w, h)}
        dash={dash} opacity={op} lineCap="round" lineJoin="round" />
    );
  }

  // ── 텍스트 (리치 텍스트 지원) ──
  if (el.tool === 'text' && el.text) {
    return (
      <Text key={i} x={el.points[0]} y={el.points[1]} text={el.text}
        fontSize={el.fontSize || 20} fill={el.color}
        fontFamily={el.fontFamily || 'sans-serif'}
        fontStyle={el.fontStyle || 'normal'}
        textDecoration={el.textDecoration || ''}
        align={(el.textAlign as 'left'|'center'|'right') || 'left'}
        opacity={op} />
    );
  }

  // ── 텍스트박스 (크기 조절 가능, 자동 줄바꿈) ──
  if (el.tool === 'textbox' && el.points.length >= 4) {
    const x = Math.min(el.points[0], el.points[2]);
    const y = Math.min(el.points[1], el.points[3]);
    const w = Math.abs(el.points[2] - el.points[0]);
    const h = Math.abs(el.points[3] - el.points[1]);
    return (
      <Group key={i} opacity={op}>
        <Rect x={x} y={y} width={w} height={h}
          stroke={el.color} strokeWidth={el.strokeWidth}
          fill={el.filled ? el.color : 'transparent'}
          dash={[4, 3]} />
        {el.text && (
          <Text x={x + 6} y={y + 6} text={el.text}
            width={w - 12} height={h - 12}
            fontSize={el.fontSize || 16} fill={el.filled ? 'white' : el.color}
            fontFamily={el.fontFamily || 'sans-serif'}
            fontStyle={el.fontStyle || 'normal'}
            textDecoration={el.textDecoration || ''}
            align={(el.textAlign as 'left'|'center'|'right') || 'left'}
            wrap="word" />
        )}
      </Group>
    );
  }

  if (el.tool === 'straight' && el.points.length >= 4) {
    return (
      <Line key={i} points={[el.points[0], el.points[1], el.points[2], el.points[3]]}
        stroke={el.color} strokeWidth={el.strokeWidth} lineCap={el.lineCap ?? 'round'} dash={dash} opacity={op} />
    );
  }
  if (el.tool === 'arrow' && el.points.length >= 4) {
    return (
      <Arrow key={i} points={[el.points[0], el.points[1], el.points[2], el.points[3]]}
        stroke={el.color} strokeWidth={el.strokeWidth} fill={el.color}
        pointerLength={12} pointerWidth={10} dash={dash} opacity={op}
        lineCap={el.lineCap ?? 'round'} />
    );
  }

  // ── 베지어 곡선 ──
  if (el.tool === 'bezier' && el.points.length >= 6) {
    // points: [sx, sy, cpx, cpy, ex, ey, cpx2, cpy2, ex2, ey2, ...]
    let d = `M ${el.points[0]} ${el.points[1]}`;
    for (let j = 2; j + 3 < el.points.length; j += 4) {
      d += ` Q ${el.points[j]} ${el.points[j+1]} ${el.points[j+2]} ${el.points[j+3]}`;
    }
    return (
      <Path key={i} data={d} stroke={el.color} strokeWidth={el.strokeWidth}
        lineCap={el.lineCap ?? 'round'} dash={dash} opacity={op}
        fill={el.filled ? el.color : 'transparent'} />
    );
  }

  // ── 커넥터 (두 요소 연결선) ──
  if (el.tool === 'connector' && allElements) {
    const fromEl = allElements.find(e => e.id === el.connectorFrom);
    const toEl = allElements.find(e => e.id === el.connectorTo);
    let sx = el.points[0], sy = el.points[1];
    let ex = el.points[2] ?? sx, ey = el.points[3] ?? sy;
    if (fromEl) {
      const b = getElementBounds(fromEl);
      if (b) { sx = b.x + b.width / 2; sy = b.y + b.height / 2; }
    }
    if (toEl) {
      const b = getElementBounds(toEl);
      if (b) { ex = b.x + b.width / 2; ey = b.y + b.height / 2; }
    }
    const cpX = (sx + ex) / 2;
    const cpY = Math.min(sy, ey) - Math.abs(ey - sy) * 0.4;
    const d = `M ${sx} ${sy} Q ${cpX} ${cpY} ${ex} ${ey}`;
    return (
      <Group key={i} opacity={op}>
        <Path data={d} stroke={el.color} strokeWidth={el.strokeWidth}
          lineCap="round" dash={dash} fill="transparent" />
        <Arrow
          points={[cpX + (ex - cpX) * 0.8, cpY + (ey - cpY) * 0.8, ex, ey]}
          stroke={el.color} fill={el.color}
          strokeWidth={el.strokeWidth} pointerLength={10} pointerWidth={8} />
      </Group>
    );
  }

  // ── 핀 (댓글) ──
  if (el.tool === 'pin') {
    const px = el.points[0], py = el.points[1];
    const txt = el.pinText || el.text || '';
    return (
      <Group key={i} opacity={op}>
        <Ellipse x={px} y={py - 20} radiusX={10} radiusY={10}
          fill={el.color} stroke="white" strokeWidth={2} />
        <Line points={[px, py - 10, px, py]} stroke={el.color} strokeWidth={2} lineCap="round" />
        {txt && (
          <>
            <Rect x={px + 14} y={py - 32} width={Math.min(txt.length * 7 + 12, 180)} height={24}
              fill={el.color} cornerRadius={4} />
            <Text x={px + 20} y={py - 27} text={txt}
              fontSize={12} fill="white" fontFamily="sans-serif"
              width={Math.min(txt.length * 7, 168)} />
          </>
        )}
      </Group>
    );
  }

  // ── 도형 라이브러리 ──
  if (el.tool === 'shape' && el.points.length >= 4) {
    const x = Math.min(el.points[0], el.points[2]);
    const y = Math.min(el.points[1], el.points[3]);
    const w = Math.abs(el.points[2] - el.points[0]);
    const h = Math.abs(el.points[3] - el.points[1]);
    const pathData = SHAPE_PATHS[el.shapeName || 'diamond'];
    return (
      <Path key={i} x={x} y={y} scaleX={w} scaleY={h}
        data={pathData}
        stroke={el.color} strokeWidth={el.strokeWidth / Math.max(w, 1)}
        strokeScaleEnabled={false}
        {...fillProps(el, 1, 1)}
        dash={dash} opacity={op} />
    );
  }

  if (el.tool === 'sticky' && el.points.length >= 4) {
    const x = Math.min(el.points[0], el.points[2]);
    const y = Math.min(el.points[1], el.points[3]);
    const w = Math.max(80, Math.abs(el.points[2] - el.points[0]));
    const h = Math.max(60, Math.abs(el.points[3] - el.points[1]));
    return (
      <Group key={i} opacity={op}>
        <Rect x={x} y={y} width={w} height={h} fill={el.stickyBg || '#fef08a'}
          stroke="#ca8a04" strokeWidth={1} cornerRadius={4}
          shadowColor="rgba(0,0,0,0.15)" shadowBlur={6} shadowOffsetY={2} shadowEnabled />
        {el.text && (
          <Text x={x + 8} y={y + 8} text={el.text} width={w - 16}
            fontSize={el.fontSize || 14} fill="#1c1917" fontFamily="sans-serif" wrap="word" />
        )}
      </Group>
    );
  }
  if (el.tool === 'image' && el.imageDataUrl) {
    const img = imageCache.current.get(el.imageDataUrl);
    if (!img) return null;
    return (
      <KonvaImage key={i} image={img} x={el.points[0]} y={el.points[1]}
        width={el.points[2] || img.naturalWidth} height={el.points[3] || img.naturalHeight}
        opacity={op} />
    );
  }
  if (el.tool === 'frame' && el.points.length >= 4) {
    const x = Math.min(el.points[0], el.points[2]);
    const y = Math.min(el.points[1], el.points[3]);
    const w = Math.abs(el.points[2] - el.points[0]);
    const h = Math.abs(el.points[3] - el.points[1]);
    return (
      <Group key={i} opacity={op}>
        <Rect x={x} y={y} width={w} height={h}
          fill="white" stroke="#6366f1" strokeWidth={2}
          dash={[8, 4]} cornerRadius={4} listening={false} />
        <Rect x={x} y={y - 22} width={Math.min(w, 200)} height={20}
          fill="#6366f1" cornerRadius={[4, 4, 0, 0]} listening={false} />
        <Text x={x + 6} y={y - 19} text={el.frameTitle || `Frame`}
          fontSize={12} fill="white" fontFamily="sans-serif" listening={false} />
      </Group>
    );
  }
  return null;
}

