import { X } from 'lucide-react';
import type { TimelineEvent } from './TimelinePlayer';

interface Theme {
  panel: string; border: string; text: string; textMuted: string;
  textSubtle: string; shadow: string;
}

interface HistoryDiffPanelProps {
  events: TimelineEvent[];
  theme: Theme;
  onClose: () => void;
}

const changeTypeLabel: Record<string, string> = {
  update: '수정',
  clear: '전체 삭제',
  add: '추가',
  delete: '삭제',
};
const changeTypeColor: Record<string, string> = {
  update: '#3b82f6',
  clear: '#ef4444',
  add: '#22c55e',
  delete: '#f59e0b',
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}초 전`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getUserInitials(nickname?: string): string {
  if (!nickname) return '?';
  return nickname.slice(0, 2).toUpperCase();
}

function getUserColor(nickname?: string): string {
  if (!nickname) return '#6b7280';
  const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];
  const hash = nickname.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export default function HistoryDiffPanel({ events, theme, onClose }: HistoryDiffPanelProps) {
  const recent = [...events].reverse().slice(0, 30);

  return (
    <div style={{ position:'absolute', bottom:'80px', left:'50%', transform:'translateX(-50%)', zIndex:50,
      width:'380px', maxHeight:'420px', backgroundColor: theme.panel, borderRadius:'12px',
      boxShadow: theme.shadow, border:`1px solid ${theme.border}`, display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderBottom:`1px solid ${theme.border}` }}>
        <span style={{ fontSize:'14px', fontWeight:'bold', color: theme.text }}>📜 변경 이력</span>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color: theme.textMuted }}><X size={16}/></button>
      </div>
      <div style={{ overflowY:'auto', flex:1, padding:'8px 0' }}>
        {recent.length === 0 && (
          <div style={{ padding:'24px', textAlign:'center', color: theme.textMuted, fontSize:'13px' }}>변경 이력이 없습니다</div>
        )}
        {recent.map((ev, idx) => {
          const type = ev.type;
          return (
            <div key={idx} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 16px', borderBottom:`1px solid ${theme.border}` }}>
              <div style={{ width:'28px', height:'28px', borderRadius:'50%', backgroundColor: getUserColor(ev.nickname), display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', color:'white', fontWeight:'bold', flexShrink:0 }}>
                {getUserInitials(ev.nickname)}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'13px', color: theme.text }}>
                  <span style={{ fontWeight:'bold' }}>{ev.nickname ?? '알 수 없음'}</span>
                  {' '}
                  <span style={{ padding:'1px 6px', borderRadius:'4px', fontSize:'11px', backgroundColor: (changeTypeColor[type] ?? '#6b7280') + '22', color: changeTypeColor[type] ?? '#6b7280', fontWeight:'bold' }}>
                    {changeTypeLabel[type] ?? type}
                  </span>
                </div>
                <div style={{ fontSize:'11px', color: theme.textMuted, marginTop:'2px' }}>
                  {ev.snapshot ? `요소 ${ev.snapshot.length}개` : ''} · {timeAgo(ev.timestamp)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
