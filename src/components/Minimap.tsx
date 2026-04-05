import { useMemo } from 'react';
import { getElementBounds } from '../utils/elementHelpers';
import type { DrawElement } from '../utils/elementHelpers';

interface Theme {
  panel: string;
  border: string;
  shadow: string;
}

interface MinimapProps {
  elements: DrawElement[];
  stagePos: { x: number; y: number };
  stageScale: number;
  theme: Theme;
  onNavigate: (pos: { x: number; y: number }) => void;
}

export default function Minimap({ elements, stagePos, stageScale, theme, onNavigate }: MinimapProps) {
  const MAP_WIDTH = 200;
  const MAP_HEIGHT = 150;

  const { minX, minY, mapScale, mapOffsetX, mapOffsetY, dots } = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    elements.forEach(el => {
      const b = getElementBounds(el);
      if (b) {
        minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width); maxY = Math.max(maxY, b.y + b.height);
      }
    });
    if (minX === Infinity) { minX = 0; minY = 0; maxX = window.innerWidth; maxY = window.innerHeight; }
    const mapPad = 500;
    minX -= mapPad; minY -= mapPad; maxX += mapPad; maxY += mapPad;
    const contentW = maxX - minX, contentH = maxY - minY;
    const mapScale = Math.min(MAP_WIDTH / contentW, MAP_HEIGHT / contentH);
    const mapOffsetX = (MAP_WIDTH - contentW * mapScale) / 2;
    const mapOffsetY = (MAP_HEIGHT - contentH * mapScale) / 2;
    const dots = elements.map((el, i) => {
      const b = getElementBounds(el);
      if (!b) return null;
      return (
        <rect
          key={i}
          x={mapOffsetX + (b.x - minX) * mapScale}
          y={mapOffsetY + (b.y - minY) * mapScale}
          width={b.width * mapScale}
          height={b.height * mapScale}
          fill={el.color === 'transparent' ? '#ccc' : el.color}
          opacity={0.6}
          rx={2}
        />
      );
    });
    return { minX, minY, mapScale, mapOffsetX, mapOffsetY, dots };
  }, [elements]);

  const viewRectX = mapOffsetX + (-stagePos.x / stageScale - minX) * mapScale;
  const viewRectY = mapOffsetY + (-stagePos.y / stageScale - minY) * mapScale;
  const viewRectW = (window.innerWidth / stageScale) * mapScale;
  const viewRectH = (window.innerHeight / stageScale) * mapScale;

  const handleInteraction = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const canvasX = (clickX - mapOffsetX) / mapScale + minX;
    const canvasY = (clickY - mapOffsetY) / mapScale + minY;
    onNavigate({
      x: -(canvasX * stageScale) + window.innerWidth / 2,
      y: -(canvasY * stageScale) + window.innerHeight / 2,
    });
  };

  return (
    <div
      style={{
        position: 'absolute', bottom: '20px', left: '20px', zIndex: 10,
        width: `${MAP_WIDTH}px`, height: `${MAP_HEIGHT}px`,
        backgroundColor: theme.panel, borderRadius: '8px',
        boxShadow: theme.shadow, overflow: 'hidden',
        border: `1px solid ${theme.border}`, cursor: 'crosshair',
      }}
      onMouseDown={handleInteraction}
      onMouseMove={handleInteraction}
      title="드래그하여 이동"
    >
      <svg width="100%" height="100%">
        {dots}
        <rect x={viewRectX} y={viewRectY} width={viewRectW} height={viewRectH} stroke="#ef4444" strokeWidth="2" fill="rgba(239, 68, 68, 0.15)" />
      </svg>
    </div>
  );
}
