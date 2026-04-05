const SHORTCUTS = [
  ['S', '선택/이동 도구'],
  ['P', '펜'],
  ['E', '지우개'],
  ['R', '사각형'],
  ['C', '원'],
  ['V', '삼각형'],
  ['T', '텍스트'],
  ['L', '직선'],
  ['A', '화살표'],
  ['N', '스티커 메모'],
  ['Ctrl+A', '전체 선택'],
  ['Ctrl+G', '선택 요소 그룹화'],
  ['Ctrl+Shift+G', '그룹 해제'],
  ['Ctrl+D', '선택 복제 (+20px)'],
  ['Ctrl+Z', '실행 취소'],
  ['Ctrl+Y', '다시 실행'],
  ['Ctrl+C', '선택 복사'],
  ['Ctrl+V', '붙여넣기'],
  ['Ctrl+0', '줌 초기화'],
  ['F', '전체 요소 보기 (줌 맞춤)'],
  ['↑↓←→', '선택 요소 1px 이동'],
  ['Shift+↑↓←→', '선택 요소 10px 이동'],
  ['Space+드래그', '캔버스 이동'],
  ['마우스 휠', '확대/축소'],
  ['Delete/Backspace', '선택 삭제'],
  ['Shift+클릭', '다중 선택'],
  ['ESC', '선택 해제'],
  ['?', '단축키 도움말'],
];

interface Theme {
  panel: string;
  border: string;
  text: string;
  textMuted: string;
}

interface Props {
  showHelp: boolean;
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>;
  theme: Theme;
  isDarkMode: boolean;
}

export default function HelpModal({ showHelp, setShowHelp, theme, isDarkMode }: Props) {
  if (!showHelp) return null;
  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={() => setShowHelp(false)}
    >
      <div
        style={{ backgroundColor: theme.panel, borderRadius: '12px', padding: '28px', maxWidth: '480px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: '18px', color: theme.text }}>⌨️ 키보드 단축키</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {SHORTCUTS.map(([key, desc]) => (
              <tr key={key} style={{ borderBottom: `1px solid ${theme.border}` }}>
                <td style={{ padding: '7px 0', width: '160px' }}>
                  <code style={{ backgroundColor: isDarkMode ? '#374151' : '#f3f4f6', padding: '2px 8px', borderRadius: '4px', fontSize: '13px', color: theme.text }}>{key}</code>
                </td>
                <td style={{ padding: '7px 0', fontSize: '14px', color: theme.textMuted }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => setShowHelp(false)} style={{ marginTop: '16px', padding: '8px 20px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', width: '100%' }}>닫기</button>
      </div>
    </div>
  );
}
