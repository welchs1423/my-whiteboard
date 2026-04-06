import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { DEFAULT_SHORTCUTS, type ShortcutDef } from '../data/defaultShortcuts';

interface Theme {
  panel: string; border: string; text: string; textMuted: string;
  textSubtle: string; shadow: string; inputBg?: string; inputBorder?: string;
}

interface ShortcutSettingsProps {
  theme: Theme;
  onClose: () => void;
  onSave: (shortcuts: Record<string, string>) => void;
  currentShortcuts: Record<string, string>;
}

export default function ShortcutSettings({ theme, onClose, onSave, currentShortcuts }: ShortcutSettingsProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [shortcuts, setShortcuts] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    DEFAULT_SHORTCUTS.forEach(s => { base[s.id] = currentShortcuts[s.id] ?? s.defaultKey; });
    return base;
  });

  const categories: Record<string, ShortcutDef[]> = {};
  DEFAULT_SHORTCUTS.forEach(s => {
    if (!categories[s.category]) categories[s.category] = [];
    categories[s.category].push(s);
  });

  const catLabels: Record<string, string> = { tool: '🛠 도구', edit: '✏️ 편집', view: '👁 보기' };

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === 'Escape') { setEditing(null); return; }
      const key = e.key.toLowerCase();
      if (key.length === 1 || ['=', '-', '+'].includes(key)) {
        setShortcuts(prev => ({ ...prev, [editing]: key }));
        setEditing(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, backgroundColor:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ backgroundColor: theme.panel, borderRadius:'16px', padding:'28px', width:'560px', maxHeight:'80vh', overflowY:'auto', boxShadow: theme.shadow }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <h2 style={{ margin:0, fontSize:'20px', color: theme.text }}>⌨️ 단축키 설정</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color: theme.textMuted }}><X size={20}/></button>
        </div>
        <p style={{ fontSize:'12px', color: theme.textMuted, marginTop:0 }}>단축키를 클릭하고 새 키를 누르세요. ESC로 취소.</p>
        {Object.entries(categories).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom:'20px' }}>
            <div style={{ fontSize:'13px', fontWeight:'bold', color: theme.textMuted, marginBottom:'8px' }}>{catLabels[cat] ?? cat}</div>
            {items.map(def => (
              <div key={def.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:`1px solid ${theme.border}` }}>
                <span style={{ fontSize:'14px', color: theme.text }}>{def.label}</span>
                <button
                  onClick={() => setEditing(def.id)}
                  style={{ padding:'4px 14px', borderRadius:'6px', border: editing === def.id ? '2px solid #3b82f6' : `1px solid ${theme.border}`, background: editing === def.id ? '#eff6ff' : (theme.inputBg ?? 'white'), color: editing === def.id ? '#3b82f6' : theme.text, cursor:'pointer', fontFamily:'monospace', fontSize:'14px', minWidth:'48px', textAlign:'center' }}>
                  {editing === def.id ? '...' : shortcuts[def.id] ?? def.defaultKey}
                </button>
              </div>
            ))}
          </div>
        ))}
        <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end', marginTop:'16px' }}>
          <button onClick={() => { const base: Record<string, string> = {}; DEFAULT_SHORTCUTS.forEach(s => { base[s.id] = s.defaultKey; }); setShortcuts(base); }}
            style={{ padding:'8px 16px', borderRadius:'8px', border:`1px solid ${theme.border}`, background:'none', cursor:'pointer', color: theme.textMuted, fontSize:'13px' }}>
            기본값으로
          </button>
          <button onClick={() => { onSave(shortcuts); onClose(); }}
            style={{ padding:'8px 20px', borderRadius:'8px', border:'none', background:'#3b82f6', color:'white', cursor:'pointer', fontSize:'13px', fontWeight:'bold' }}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
