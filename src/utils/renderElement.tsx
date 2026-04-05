import type { MutableRefObject } from 'react';
import { Line, Rect, Ellipse, Text, Arrow, Image as KonvaImage, Group } from 'react-konva';
import type { DrawElement } from './elementHelpers';
import { getDashArray } from './elementHelpers';

export function renderElement(
  el: DrawElement,
  i: number,
  stageScale: number,
  imageCache: MutableRefObject<Map<string, HTMLImageElement>>,
) {
  const op = el.opacity ?? 1;
  const dash = getDashArray(el.dash, stageScale);

  if (el.tool === 'pen' || el.tool === 'eraser') {
    return (
      <Line key={i} points={el.points} stroke={el.color} strokeWidth={el.strokeWidth}
        tension={0.5} lineCap="round" lineJoin="round" opacity={op}
        globalCompositeOperation={el.tool === 'eraser' ? 'destination-out' : 'source-over'} />
    );
  }
  if (el.tool === 'rect' && el.points.length >= 4) {
    const x = Math.min(el.points[0], el.points[2]);
    const y = Math.min(el.points[1], el.points[3]);
    return (
      <Rect key={i} x={x} y={y} width={Math.abs(el.points[2] - el.points[0])} height={Math.abs(el.points[3] - el.points[1])}
        stroke={el.color} strokeWidth={el.strokeWidth} fill={el.filled ? el.color : undefined}
        dash={dash} opacity={op} />
    );
  }
  if (el.tool === 'circle' && el.points.length >= 4) {
    return (
      <Ellipse key={i}
        x={(el.points[0] + el.points[2]) / 2} y={(el.points[1] + el.points[3]) / 2}
        radiusX={Math.abs(el.points[2] - el.points[0]) / 2} radiusY={Math.abs(el.points[3] - el.points[1]) / 2}
        stroke={el.color} strokeWidth={el.strokeWidth} fill={el.filled ? el.color : undefined}
        dash={dash} opacity={op} />
    );
  }
  if (el.tool === 'triangle' && el.points.length >= 4) {
    const [x1, y1, x2, y2] = el.points;
    const midX = (x1 + x2) / 2;
    return (
      <Line key={i} points={[midX, y1, x2, y2, x1, y2]} closed
        stroke={el.color} strokeWidth={el.strokeWidth}
        fill={el.filled ? el.color : undefined}
        dash={dash} opacity={op} lineCap="round" lineJoin="round" />
    );
  }
  if (el.tool === 'text' && el.text) {
    return (
      <Text key={i} x={el.points[0]} y={el.points[1]} text={el.text}
        fontSize={el.fontSize || 20} fill={el.color} fontFamily="sans-serif" opacity={op} />
    );
  }
  if (el.tool === 'straight' && el.points.length >= 4) {
    return (
      <Line key={i} points={[el.points[0], el.points[1], el.points[2], el.points[3]]}
        stroke={el.color} strokeWidth={el.strokeWidth} lineCap="round" dash={dash} opacity={op} />
    );
  }
  if (el.tool === 'arrow' && el.points.length >= 4) {
    return (
      <Arrow key={i} points={[el.points[0], el.points[1], el.points[2], el.points[3]]}
        stroke={el.color} strokeWidth={el.strokeWidth} fill={el.color}
        pointerLength={12} pointerWidth={10} dash={dash} opacity={op} />
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
  return null;
}
