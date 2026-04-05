import { useState } from 'react';
import { Layers, Eye, EyeOff, Lock, Unlock, Trash2, X } from 'lucide-react';
import type { DrawElement } from '../utils/elementHelpers';

interface Theme {
  panel: string; border: string; text: string;
  textMuted: string; textSubtle: string; shadow: string;
  bg: string; inputBg: string;
}

interface LayerPanelProps {
  elements: DrawElement[];
  selectedIndices: Set<number>;
  theme: Theme;
  onSelect: (indices: Set<number>) => void;
  onReorder: (from: number, to: number) => void;
  onDelete: (idx: number) => void;
  onToggleLock: (idx: number) => void;
  onToggleVisibility: (idx: number) => void;
  hiddenIndices: Set<number>;
}

const TOOL_ICONS: Record<string, string> = {
  pen: '✏️', eraser: '🧹', rect: '▭', circle: '⬭', text: 'T',
  arrow: '→', straight: '─', select: '↖', sticky: '📝',
  image: '🖼', triangle: '△', frame: '⊡',
};

function getLabel(el: DrawElement, idx: number): string {
  if (el.tool === 'text' && el.text) return el.text.slice(0, 20) + (el.text.length > 20 ? '…' : '');
  if (el.tool === 'sticky' && el.text) return el.text.slice(0, 20) + (el.text.length > 20 ? '…' : '');
  if (el.tool === 'frame') return el.frameTitle || `Frame ${idx + 1}`;
  return `${el.tool} #${idx + 1}`;
}

export default function LayerPanel({
  elements, selectedIndices, theme,
  onSelect, onReorder, onDelete, onToggleLock, onToggleVisibility, hiddenIndices,
}: LayerPanelProps) {
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  // 역순 표시 (맨 위 레이어가 목록 상단)
  const reversedIndices = [...Array(elements.length).keys()].reverse();

  return (
    <div style={{
      position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)',
      zIndex: 10, width: '200px', backgroundColor: theme.panel,
      borderRadius: '12px', boxShadow: theme.shadow,
      border: `1px solid ${theme.border}`, overflow: 'hidden',
      maxHeight: '60vh', display: 'flex', flexDirection: 'column',
    }}>
      {/* 헤더 */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', borderBottom: `1px solid ${theme.border}`,
          cursor: 'pointer', userSelect: 'none',
        }}
        onClick={() => setIsOpen(v => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: theme.text }}>
          <Layers size={14} /> 레이어 ({elements.length})
        </div>
        <X size={14} style={{ color: theme.textMuted }} />
      </div>

      {isOpen && (
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {reversedIndices.map((idx) => {
            const el = elements[idx];
            const isSelected = selectedIndices.has(idx);
            const isHidden = hiddenIndices.has(idx);
            const isDragging = draggingIdx === idx;
            const isDragOver = dragOverIdx === idx;

            return (
              <div
                key={el.id ?? idx}
                draggable
                onDragStart={() => setDraggingIdx(idx)}
                onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                onDragEnd={() => {
                  if (draggingIdx !== null && dragOverIdx !== null && draggingIdx !== dragOverIdx) {
                    onReorder(draggingIdx, dragOverIdx);
                  }
                  setDraggingIdx(null);
                  setDragOverIdx(null);
                }}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button')) return;
                  onSelect(new Set([idx]));
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 10px', cursor: 'pointer', fontSize: '12px',
                  backgroundColor: isSelected ? '#eff6ff' : isDragOver ? '#f3f4f6' : 'transparent',
                  borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
                  opacity: isDragging ? 0.4 : isHidden ? 0.4 : 1,
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ fontSize: '14px', flexShrink: 0 }}>{TOOL_ICONS[el.tool] ?? '?'}</span>
                <span style={{
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: theme.text, textDecoration: isHidden ? 'line-through' : 'none',
                }}>
                  {getLabel(el, idx)}
                </span>
                {/* 가시성 토글 */}
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleVisibility(idx); }}
                  title={isHidden ? '표시' : '숨기기'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px', color: theme.textMuted, display: 'flex' }}
                >
                  {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
                {/* 잠금 */}
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleLock(idx); }}
                  title={el.locked ? '잠금 해제' : '잠금'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px', color: el.locked ? '#f59e0b' : theme.textMuted, display: 'flex' }}
                >
                  {el.locked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
                {/* 삭제 */}
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(idx); }}
                  title="삭제"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px', color: '#ef4444', display: 'flex' }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
          {elements.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: theme.textSubtle, fontSize: '12px' }}>
              요소가 없습니다
            </div>
          )}
        </div>
      )}
    </div>
  );
}
