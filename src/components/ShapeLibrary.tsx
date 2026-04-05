import { X } from 'lucide-react';
import { SHAPE_PATHS } from '../utils/renderElement';

interface Theme {
  panel: string; border: string; text: string;
  textMuted: string; shadow: string;
}

interface ShapeLibraryProps {
  theme: Theme;
  currentShapeName: string;
  onSelect: (name: string) => void;
  onClose: () => void;
}

const SHAPES = [
  { name: 'diamond',       label: '다이아몬드', emoji: '◆' },
  { name: 'hexagon',       label: '육각형',     emoji: '⬡' },
  { name: 'star',          label: '별',          emoji: '★' },
  { name: 'parallelogram', label: '평행사변형',  emoji: '▱' },
  { name: 'cross',         label: '십자',        emoji: '✚' },
  { name: 'callout',       label: '말풍선',      emoji: '💬' },
];

export default function ShapeLibrary({ theme, currentShapeName, onSelect, onClose }: ShapeLibraryProps) {
  return (
    <div style={{
      position: 'absolute', top: '80px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 200, backgroundColor: theme.panel,
      borderRadius: '12px', boxShadow: theme.shadow,
      border: `1px solid ${theme.border}`,
      padding: '12px', width: '280px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 'bold', color: theme.text }}>도형 라이브러리</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {SHAPES.map(s => (
          <button
            key={s.name}
            onClick={() => { onSelect(s.name); onClose(); }}
            title={s.label}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '10px 8px', borderRadius: '8px', cursor: 'pointer', gap: '4px',
              border: currentShapeName === s.name ? '2px solid #6366f1' : `1px solid ${theme.border}`,
              background: currentShapeName === s.name ? '#eff6ff' : 'none',
              color: theme.text, fontSize: '22px',
            }}
          >
            <svg width="40" height="30" viewBox="0 0 1 1">
              <path d={SHAPE_PATHS[s.name]} fill="none" stroke="currentColor" strokeWidth={0.05} />
            </svg>
            <span style={{ fontSize: '10px', color: theme.textMuted }}>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
