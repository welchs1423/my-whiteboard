import React, { useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const ANIMAL_EMOJIS = ['🦊', '🐱', '🐻', '🐼', '🦁', '🐯', '🦝', '🐺', '🦄', '🐨'];

interface Props {
  isDarkMode: boolean;
  setIsDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  nickname: string;
  setNickname: React.Dispatch<React.SetStateAction<string>>;
  roomId: string;
  setRoomId: React.Dispatch<React.SetStateAction<string>>;
  onJoin: (viewOnly?: boolean, isAnonymous?: boolean) => void;
}

export default function LoginScreen({ isDarkMode, setIsDarkMode, nickname, setNickname, roomId, setRoomId, onJoin }: Props) {
  const [isAnonymous, setIsAnonymous] = useState(false);

  const handleAnonymousChange = (checked: boolean) => {
    setIsAnonymous(checked);
    if (checked) {
      const emoji = ANIMAL_EMOJIS[Math.floor(Math.random() * ANIMAL_EMOJIS.length)];
      setNickname(`익명${emoji}${Math.floor(Math.random() * 99) + 1}`);
    } else {
      setNickname('');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: isDarkMode ? '#111827' : '#f3f4f6' }}>
      <div style={{ padding: '30px', backgroundColor: isDarkMode ? '#1f2937' : 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '15px', width: '300px' }}>
        <h2 style={{ margin: 0, textAlign: 'center', color: isDarkMode ? '#f3f4f6' : '#374151' }}>화이트보드 입장</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>접속할 방 이름</label>
          <input
            type="text" value={roomId} onChange={(e) => setRoomId(e.target.value)}
            placeholder="예: project-a"
            style={{ padding: '10px', borderRadius: '6px', border: `1px solid ${isDarkMode ? '#374151' : '#d1d5db'}`, backgroundColor: isDarkMode ? '#374151' : 'white', color: isDarkMode ? '#f3f4f6' : '#374151' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>내 닉네임</label>
          <input
            type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onJoin(false, isAnonymous)}
            placeholder="닉네임을 입력하세요"
            disabled={isAnonymous}
            style={{ padding: '10px', borderRadius: '6px', border: `1px solid ${isDarkMode ? '#374151' : '#d1d5db'}`, backgroundColor: isAnonymous ? (isDarkMode ? '#2d3748' : '#f3f4f6') : (isDarkMode ? '#374151' : 'white'), color: isDarkMode ? '#f3f4f6' : '#374151', opacity: isAnonymous ? 0.6 : 1 }}
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => handleAnonymousChange(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          익명으로 참여
          {isAnonymous && <span style={{ fontSize: '12px', color: '#8b5cf6' }}>(닉네임 자동 생성)</span>}
        </label>

        <button onClick={() => onJoin(false, isAnonymous)} style={{ padding: '10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          입장하기
        </button>
        <button onClick={() => onJoin(true)} style={{ padding: '8px', background: 'none', border: `1px solid ${isDarkMode ? '#374151' : '#d1d5db'}`, borderRadius: '6px', cursor: 'pointer', color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: '13px' }}>
          👁️ 보기만 하기 (읽기 전용)
        </button>
        <button onClick={() => setIsDarkMode(v => !v)} style={{ padding: '6px', background: 'none', border: `1px solid ${isDarkMode ? '#374151' : '#d1d5db'}`, borderRadius: '6px', cursor: 'pointer', color: isDarkMode ? '#f3f4f6' : '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px' }}>
          {isDarkMode ? <Sun size={14} /> : <Moon size={14} />} {isDarkMode ? '라이트 모드' : '다크 모드'}
        </button>
      </div>
    </div>
  );
}