import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react';
import type { DrawElement } from '../utils/elementHelpers';
import type { Socket } from 'socket.io-client';

interface Theme {
  panel: string; border: string; text: string;
  textMuted: string; shadow: string;
  bg: string;
}

interface PresentationModeProps {
  frames: DrawElement[];
  allElements?: DrawElement[];
  stageRef?: React.RefObject<unknown>;
  socket: Socket;
  roomId: string;
  nickname: string;
  theme: Theme;
  onNavigate: (frame: DrawElement) => void;
  onClose: () => void;
}

export default function PresentationMode({
  frames, socket, roomId, nickname, onNavigate, onClose,
}: PresentationModeProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const total = frames.length;
  const frame = frames[currentIdx];

  const goTo = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(idx, total - 1));
    setCurrentIdx(clamped);
    if (frames[clamped]) {
      onNavigate(frames[clamped]);
      socket.emit('presenting_frame', { room: roomId, frameId: frames[clamped].id, presenter: nickname });
    }
  }, [frames, total, setCurrentIdx, onNavigate, socket, roomId, nickname]);

  // 키보드 화살표 네비게이션
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goTo(currentIdx + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goTo(currentIdx - 1); }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentIdx, goTo, onClose]);

  // 풀스크린 진입
  useEffect(() => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    return () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  if (total === 0) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px',
      }}>
        <Maximize2 size={48} color="#6b7280" />
        <p style={{ color: '#9ca3af', fontSize: '18px' }}>프레임이 없습니다. 먼저 프레임 도구로 슬라이드를 만드세요.</p>
        <button onClick={onClose} style={{ padding: '10px 24px', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px' }}>닫기</button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* 헤더 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
      }}>
        <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>
          📊 {frame?.frameTitle || `Frame ${currentIdx + 1}`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#9ca3af', fontSize: '13px' }}>{currentIdx + 1} / {total}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', display: 'flex' }}>
            <X size={22} />
          </button>
        </div>
      </div>

      {/* 현재 프레임 이름 표시 */}
      <div style={{ color: 'white', fontSize: '22px', fontWeight: 'bold', marginBottom: '32px' }}>
        {frame?.frameTitle || `Frame ${currentIdx + 1}`}
      </div>

      {/* 슬라이드 썸네일 목록 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', maxWidth: '80vw', overflowX: 'auto', padding: '8px' }}>
        {frames.map((f, idx) => (
          <button
            key={f.id}
            onClick={() => goTo(idx)}
            style={{
              padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
              border: idx === currentIdx ? '2px solid #6366f1' : '2px solid transparent',
              background: idx === currentIdx ? '#6366f1' : 'rgba(255,255,255,0.1)',
              color: 'white', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {idx + 1}. {f.frameTitle || `Frame ${idx + 1}`}
          </button>
        ))}
      </div>

      {/* 네비게이션 버튼 */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <button
          onClick={() => goTo(currentIdx - 1)}
          disabled={currentIdx === 0}
          style={{
            padding: '12px 24px', borderRadius: '50%', cursor: currentIdx === 0 ? 'default' : 'pointer',
            backgroundColor: currentIdx === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)',
            border: 'none', color: currentIdx === 0 ? '#4b5563' : 'white', display: 'flex',
          }}
        >
          <ChevronLeft size={28} />
        </button>
        <button
          onClick={() => goTo(currentIdx + 1)}
          disabled={currentIdx >= total - 1}
          style={{
            padding: '12px 24px', borderRadius: '50%', cursor: currentIdx >= total - 1 ? 'default' : 'pointer',
            backgroundColor: currentIdx >= total - 1 ? 'rgba(255,255,255,0.1)' : '#6366f1',
            border: 'none', color: currentIdx >= total - 1 ? '#4b5563' : 'white', display: 'flex',
          }}
        >
          <ChevronRight size={28} />
        </button>
      </div>

      {/* 하단 힌트 */}
      <div style={{ position: 'absolute', bottom: '16px', color: '#6b7280', fontSize: '12px' }}>
        ← → 방향키로 이동 · Esc로 종료
      </div>
    </div>
  );
}
