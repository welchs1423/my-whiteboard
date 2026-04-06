export interface BoardTheme {
  id: string;
  name: string;
  emoji: string;
  bg: string;
  panel: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  shadow: string;
  gridColor: string;
  inputBg: string;
  inputBorder: string;
  chatBubbleSelf: string;
  chatBubbleOther: string;
  chatTextOther: string;
  defaultStrokeColor: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: 'light', name: '기본', emoji: '⬜',
    bg: '#f9fafb', panel: 'white', border: '#e5e7eb',
    text: '#374151', textMuted: '#6b7280', textSubtle: '#9ca3af',
    shadow: '0 4px 6px rgba(0,0,0,0.1)', gridColor: '#c8cdd6',
    inputBg: 'white', inputBorder: '#d1d5db',
    chatBubbleSelf: '#3b82f6', chatBubbleOther: '#f3f4f6', chatTextOther: '#374151',
    defaultStrokeColor: '#000000',
  },
  {
    id: 'dark', name: '다크', emoji: '⬛',
    bg: '#111827', panel: '#1f2937', border: '#374151',
    text: '#f3f4f6', textMuted: '#9ca3af', textSubtle: '#6b7280',
    shadow: '0 4px 6px rgba(0,0,0,0.5)', gridColor: '#374151',
    inputBg: '#374151', inputBorder: '#4b5563',
    chatBubbleSelf: '#3b82f6', chatBubbleOther: '#374151', chatTextOther: '#f3f4f6',
    defaultStrokeColor: '#ffffff',
  },
  {
    id: 'pastel', name: '파스텔', emoji: '🌸',
    bg: '#fdf4ff', panel: '#fae8ff', border: '#e9d5ff',
    text: '#6b21a8', textMuted: '#a855f7', textSubtle: '#c084fc',
    shadow: '0 4px 6px rgba(168,85,247,0.15)', gridColor: '#ddd6fe',
    inputBg: '#fdf4ff', inputBorder: '#d8b4fe',
    chatBubbleSelf: '#a855f7', chatBubbleOther: '#f3e8ff', chatTextOther: '#6b21a8',
    defaultStrokeColor: '#7c3aed',
  },
  {
    id: 'ocean', name: '오션', emoji: '🌊',
    bg: '#eff6ff', panel: '#dbeafe', border: '#93c5fd',
    text: '#1e40af', textMuted: '#3b82f6', textSubtle: '#60a5fa',
    shadow: '0 4px 6px rgba(59,130,246,0.15)', gridColor: '#bfdbfe',
    inputBg: '#eff6ff', inputBorder: '#93c5fd',
    chatBubbleSelf: '#2563eb', chatBubbleOther: '#dbeafe', chatTextOther: '#1e40af',
    defaultStrokeColor: '#1d4ed8',
  },
  {
    id: 'forest', name: '포레스트', emoji: '🌿',
    bg: '#f0fdf4', panel: '#dcfce7', border: '#86efac',
    text: '#166534', textMuted: '#16a34a', textSubtle: '#4ade80',
    shadow: '0 4px 6px rgba(22,163,74,0.15)', gridColor: '#bbf7d0',
    inputBg: '#f0fdf4', inputBorder: '#86efac',
    chatBubbleSelf: '#16a34a', chatBubbleOther: '#dcfce7', chatTextOther: '#166534',
    defaultStrokeColor: '#15803d',
  },
  {
    id: 'sunset', name: '선셋', emoji: '🌅',
    bg: '#fff7ed', panel: '#ffedd5', border: '#fdba74',
    text: '#9a3412', textMuted: '#ea580c', textSubtle: '#fb923c',
    shadow: '0 4px 6px rgba(234,88,12,0.15)', gridColor: '#fed7aa',
    inputBg: '#fff7ed', inputBorder: '#fdba74',
    chatBubbleSelf: '#ea580c', chatBubbleOther: '#ffedd5', chatTextOther: '#9a3412',
    defaultStrokeColor: '#c2410c',
  },
  {
    id: 'midnight', name: '미드나잇', emoji: '🌙',
    bg: '#0f0f23', panel: '#1a1a3e', border: '#2d2d6b',
    text: '#e2e8f0', textMuted: '#94a3b8', textSubtle: '#64748b',
    shadow: '0 4px 6px rgba(0,0,0,0.7)', gridColor: '#1e1e4a',
    inputBg: '#1a1a3e', inputBorder: '#2d2d6b',
    chatBubbleSelf: '#6366f1', chatBubbleOther: '#1e1e4a', chatTextOther: '#e2e8f0',
    defaultStrokeColor: '#a5b4fc',
  },
  {
    id: 'cherry', name: '체리', emoji: '🍒',
    bg: '#fff1f2', panel: '#ffe4e6', border: '#fecdd3',
    text: '#9f1239', textMuted: '#e11d48', textSubtle: '#fb7185',
    shadow: '0 4px 6px rgba(225,29,72,0.15)', gridColor: '#fda4af',
    inputBg: '#fff1f2', inputBorder: '#fecdd3',
    chatBubbleSelf: '#e11d48', chatBubbleOther: '#ffe4e6', chatTextOther: '#9f1239',
    defaultStrokeColor: '#be123c',
  },
];
