import { BOARD_THEMES } from '../data/boardThemes';

interface Props {
  theme: { panel: string; border: string; text: string; textMuted: string; shadow: string };
  boardThemeId: string;
  setBoardThemeId: (id: string) => void;
  onClose: () => void;
}

export default function ThemeSelector({ theme, boardThemeId, setBoardThemeId, onClose }: Props) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ backgroundColor: theme.panel, borderRadius: '16px', padding: '24px', boxShadow: theme.shadow, border: `1px solid ${theme.border}`, minWidth: '340px' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: theme.text }}>🎨 보드 테마</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, fontSize: '18px' }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {BOARD_THEMES.map(t => (
            <button
              key={t.id}
              onClick={() => { setBoardThemeId(t.id); onClose(); }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                padding: '10px 6px', borderRadius: '10px', cursor: 'pointer',
                border: boardThemeId === t.id ? '2px solid #3b82f6' : `1px solid ${theme.border}`,
                background: boardThemeId === t.id ? '#eff6ff' : t.panel,
                transition: 'all 0.15s',
              }}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: t.bg, border: `2px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
                {t.emoji}
              </div>
              <span style={{ fontSize: '11px', color: boardThemeId === t.id ? '#3b82f6' : theme.textMuted, fontWeight: boardThemeId === t.id ? 'bold' : 'normal' }}>
                {t.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
