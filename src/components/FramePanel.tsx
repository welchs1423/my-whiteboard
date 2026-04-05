import { useState } from 'react';
import { FileDown, Plus, Layout } from 'lucide-react';
import type { DrawElement } from '../utils/elementHelpers';

interface Theme {
  panel: string; border: string; text: string;
  textMuted: string; textSubtle: string; shadow: string;
}

interface FramePanelProps {
  frames: DrawElement[];
  allElements: DrawElement[];
  stageRef: React.RefObject<{ toDataURL: (config?: { pixelRatio?: number }) => string } | null>;
  stageScale: number;
  stagePos: { x: number; y: number };
  theme: Theme;
  onAddFrame: () => void;
  onNavigate: (frame: DrawElement) => void;
  onExportPDF: () => void;
  currentFrameId: string | null;
}

export default function FramePanel({
  frames, theme, onAddFrame, onNavigate, onExportPDF, currentFrameId,
}: FramePanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div style={{
      position: 'absolute', bottom: '80px', right: '20px',
      zIndex: 10, width: '200px', backgroundColor: theme.panel,
      borderRadius: '12px', boxShadow: theme.shadow,
      border: `1px solid ${theme.border}`, overflow: 'hidden',
    }}>
      {/* 헤더 */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', borderBottom: isOpen ? `1px solid ${theme.border}` : 'none',
          cursor: 'pointer', userSelect: 'none',
        }}
        onClick={() => setIsOpen(v => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: theme.text }}>
          <Layout size={14} /> 프레임 ({frames.length})
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {frames.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onExportPDF(); }}
              title="PDF 내보내기"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', display: 'flex', padding: '2px' }}
            >
              <FileDown size={14} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onAddFrame(); }}
            title="프레임 추가"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', display: 'flex', padding: '2px' }}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {frames.map((frame, i) => (
            <div
              key={frame.id}
              onClick={() => onNavigate(frame)}
              style={{
                padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                backgroundColor: frame.id === currentFrameId ? '#eff6ff' : 'transparent',
                borderLeft: frame.id === currentFrameId ? '3px solid #6366f1' : '3px solid transparent',
                fontSize: '12px', color: theme.text,
              }}
            >
              <span style={{ color: '#6366f1', fontWeight: 'bold', minWidth: '18px' }}>{i + 1}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {frame.frameTitle || `Frame ${i + 1}`}
              </span>
            </div>
          ))}
          {frames.length === 0 && (
            <div style={{ padding: '16px', textAlign: 'center', color: theme.textSubtle, fontSize: '12px' }}>
              프레임 버튼으로<br />슬라이드를 추가하세요
            </div>
          )}
        </div>
      )}
    </div>
  );
}
