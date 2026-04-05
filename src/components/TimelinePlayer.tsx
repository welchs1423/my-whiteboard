import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Clock } from 'lucide-react';
import type { DrawElement } from '../utils/elementHelpers';

export interface TimelineEvent {
  timestamp: number;
  type: 'add' | 'update' | 'delete' | 'clear';
  snapshot: DrawElement[];
}

interface Theme {
  panel: string; border: string; text: string;
  textMuted: string; shadow: string;
}

interface TimelinePlayerProps {
  events: TimelineEvent[];
  theme: Theme;
  onSnapshot: (elements: DrawElement[]) => void;
  onClose: () => void;
}

export default function TimelinePlayer({ events, theme, onSnapshot, onClose }: TimelinePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = events.length;

  const goTo = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(idx, total - 1));
    setCurrentIdx(clamped);
    if (events[clamped]) onSnapshot(events[clamped].snapshot);
  }, [events, total, onSnapshot]);

  const stop = useCallback(() => {
    setIsPlaying(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const play = useCallback(() => {
    if (currentIdx >= total - 1) goTo(0);
    setIsPlaying(true);
    intervalRef.current = setInterval(() => {
      setCurrentIdx(prev => {
        if (prev >= total - 1) {
          stop();
          return prev;
        }
        const next = prev + 1;
        onSnapshot(events[next].snapshot);
        return next;
      });
    }, 200);
  }, [currentIdx, total, events, goTo, stop, onSnapshot]);

  useEffect(() => () => stop(), [stop]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const startTime = events[0]?.timestamp ?? 0;
  const currentTime = events[currentIdx]?.timestamp ?? 0;
  const endTime = events[total - 1]?.timestamp ?? 0;
  const progress = total > 1 ? currentIdx / (total - 1) : 0;

  return (
    <div style={{
      position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 50, backgroundColor: theme.panel, border: `1px solid ${theme.border}`,
      borderRadius: '16px', boxShadow: theme.shadow, padding: '14px 20px',
      display: 'flex', flexDirection: 'column', gap: '10px', width: '420px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: theme.text }}>
          <Clock size={14} /> 타임라인 플레이백
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, fontSize: '16px' }}>✕</button>
      </div>

      {/* 슬라이더 */}
      <div style={{ position: 'relative', height: '6px', backgroundColor: theme.border, borderRadius: '3px', cursor: 'pointer' }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          goTo(Math.round(ratio * (total - 1)));
        }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${progress * 100}%`, backgroundColor: '#6366f1', borderRadius: '3px', transition: 'width 0.1s' }} />
        <div style={{ position: 'absolute', top: '-5px', left: `calc(${progress * 100}% - 8px)`, width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#6366f1', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </div>

      {/* 컨트롤 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <button onClick={() => goTo(0)} title="처음으로" style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, display: 'flex' }}>
          <SkipBack size={18} />
        </button>
        <button onClick={() => goTo(currentIdx - 1)} title="이전" style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, display: 'flex' }}>
          ‹
        </button>
        <button
          onClick={isPlaying ? stop : play}
          style={{ backgroundColor: '#6366f1', border: 'none', cursor: 'pointer', color: 'white', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button onClick={() => goTo(currentIdx + 1)} title="다음" style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, display: 'flex' }}>
          ›
        </button>
        <button onClick={() => goTo(total - 1)} title="끝으로" style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, display: 'flex' }}>
          <SkipForward size={18} />
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: theme.textMuted }}>
        <span>{formatTime(currentTime - startTime)}</span>
        <span>{currentIdx + 1} / {total} 이벤트</span>
        <span>{formatTime(endTime - startTime)}</span>
      </div>
    </div>
  );
}
