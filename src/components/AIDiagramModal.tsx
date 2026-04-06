import { useState } from 'react';
import type { DrawElement } from '../utils/elementHelpers';
import { parseAIDiagram } from '../utils/aiDiagramParser';

interface Props {
  theme: { panel: string; border: string; text: string; textMuted: string; shadow: string; inputBg: string; inputBorder: string };
  onGenerate: (elements: DrawElement[]) => void;
  onClose: () => void;
}

const EXAMPLES = [
  { label: '플로우차트', text: 'flowchart:\n시작 -> 처리 -> 완료\n처리 -> 오류\n오류 -> 처리' },
  { label: '화살표 다이어그램', text: 'A -> B -> C -> D' },
  { label: '마인드맵', text: 'mindmap: 프로젝트\n  기획\n  개발\n  테스트\n  배포' },
  { label: '테이블', text: 'table: 3x4' },
  { label: '불릿 리스트', text: '- 아이디어 1\n- 아이디어 2\n- 아이디어 3' },
  { label: '번호 목록', text: '1. 첫 번째\n2. 두 번째\n3. 세 번째' },
];

export default function AIDiagramModal({ theme, onGenerate, onClose }: Props) {
  const [input, setInput] = useState('');

  const handleGenerate = () => {
    if (!input.trim()) return;
    const els = parseAIDiagram(input);
    onGenerate(els);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ backgroundColor: theme.panel, borderRadius: '16px', padding: '24px', boxShadow: theme.shadow, border: `1px solid ${theme.border}`, width: '520px', maxWidth: '95vw' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: theme.text }}>🤖 AI 다이어그램 생성</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, fontSize: '18px' }}>✕</button>
        </div>

        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="다이어그램 설명을 입력하세요..."
          style={{
            width: '100%', height: '120px', padding: '10px', borderRadius: '8px',
            border: `1px solid ${theme.inputBorder}`, backgroundColor: theme.inputBg,
            color: theme.text, fontSize: '14px', fontFamily: 'monospace',
            resize: 'vertical', outline: 'none', boxSizing: 'border-box',
          }}
          autoFocus
        />

        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '12px', color: theme.textMuted, marginBottom: '6px', fontWeight: 'bold' }}>예시:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {EXAMPLES.map(ex => (
              <button key={ex.label} onClick={() => setInput(ex.text)}
                style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', border: `1px solid ${theme.border}`, background: 'none', color: theme.textMuted }}>
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {input && (
          <div style={{ marginTop: '10px', padding: '8px 10px', borderRadius: '6px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, fontSize: '12px', color: theme.textMuted, fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: '80px', overflow: 'auto' }}>
            {input}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', border: `1px solid ${theme.border}`, background: 'none', cursor: 'pointer', color: theme.textMuted }}>취소</button>
          <button onClick={handleGenerate} disabled={!input.trim()}
            style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: input.trim() ? '#3b82f6' : '#9ca3af', color: 'white', cursor: input.trim() ? 'pointer' : 'default', fontWeight: 'bold' }}>
            ✨ 생성
          </button>
        </div>
      </div>
    </div>
  );
}
