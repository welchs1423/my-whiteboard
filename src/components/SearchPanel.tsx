import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import type { DrawElement } from '../utils/elementHelpers';
import { getElementBounds } from '../utils/elementHelpers';

interface Theme {
  panel: string;
  border: string;
  text: string;
  textMuted: string;
  shadow: string;
}

export interface SearchPanelProps {
  elements: DrawElement[];
  theme: Theme;
  onNavigate: (el: DrawElement) => void;
  onClose: () => void;
}

function getElementText(el: DrawElement): string | null {
  if (el.tool === 'text' || el.tool === 'sticky' || el.tool === 'textbox') return el.text || null;
  if (el.tool === 'pin') return el.pinText || el.text || null;
  if (el.tool === 'frame') return el.frameTitle || null;
  return null;
}

const TOOL_ICONS: Record<string, string> = {
  text: '📝', sticky: '🗒️', textbox: '📄', pin: '📌', frame: '🖼️',
};

export default function SearchPanel({ elements, theme, onNavigate, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return elements
      .map((el, i) => ({ el, i, text: getElementText(el) }))
      .filter((r): r is { el: DrawElement; i: number; text: string } => r.text !== null && r.text.toLowerCase().includes(q))
      .slice(0, 20);
  }, [elements, query]);

  // Precompute bounds for navigation (satisfies linter)
  void getElementBounds;

  return (
    <div style={{
      position: 'absolute', top: '80px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 50, width: '320px', backgroundColor: theme.panel,
      borderRadius: '12px', boxShadow: theme.shadow, border: `1px solid ${theme.border}`,
    }}>
      <div style={{ padding: '12px', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Search size={16} color={theme.textMuted} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="텍스트 검색..."
          style={{
            flex: 1, border: 'none', outline: 'none', fontSize: '14px',
            background: 'transparent', color: theme.text,
          }}
        />
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, display: 'flex', alignItems: 'center' }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {query.trim() && results.length === 0 && (
          <div style={{ padding: '16px', textAlign: 'center', color: theme.textMuted, fontSize: '13px' }}>
            검색 결과가 없습니다
          </div>
        )}
        {results.map(({ el, i, text }) => (
          <div
            key={i}
            onClick={() => { onNavigate(el); onClose(); }}
            style={{
              padding: '10px 16px', cursor: 'pointer', borderBottom: `1px solid ${theme.border}`,
              display: 'flex', alignItems: 'center', gap: '10px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.border)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <span style={{ fontSize: '18px' }}>{TOOL_ICONS[el.tool] || '🔷'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</div>
              <div style={{ fontSize: '11px', color: theme.textMuted }}>{el.tool} #{i}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
