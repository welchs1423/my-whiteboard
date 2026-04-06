import { useState, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import type React from 'react';
import type { ToolType, DashStyle, LineCapStyle, BrushType } from '../utils/elementHelpers';
import { generateId } from '../utils/elementHelpers';
import { BOARD_THEMES } from '../data/boardThemes';

export interface Toast {
  id: string;
  message: string;
  type: 'join' | 'leave' | 'info';
}

export function useBoardUI() {
  // ── 도구 ──
  const [tool, setTool] = useState<ToolType>('pen');
  const toolRef = useRef<ToolType>('pen');

  // ── 색상 ──
  const [currentColor, setCurrentColor] = useState('#000000');
  const [recentColors, setRecentColors] = useState<string[]>([]);

  // ── 스타일 ──
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [isFilled, setIsFilled] = useState(false);
  const [currentDash, setCurrentDash] = useState<DashStyle>('solid');
  const [currentLineCap, setCurrentLineCap] = useState<LineCapStyle>('round');
  const [currentOpacity, setCurrentOpacity] = useState(1.0);
  const [stickyBg, setStickyBg] = useState('#fef08a');
  const [currentShapeName, setCurrentShapeName] = useState('diamond');
  const [gradientColors, setGradientColors] = useState<[string, string] | null>(null);
  const [gradientAngle, setGradientAngle] = useState(0);
  // ── 리치 텍스트 ──
  const [fontStyle, setFontStyle] = useState<string>('normal');
  const [textDecoration, setTextDecoration] = useState<string>('');
  const [fontFamily, setFontFamily] = useState<string>('sans-serif');
  const [textAlign, setTextAlign] = useState<string>('left');

  // ── 펜 옵션 ──
  const [isSmoothing, setIsSmoothing] = useState(false);
  const [isSmartShape, setIsSmartShape] = useState(false);
  const [brushType, setBrushType] = useState<BrushType>('normal');
  const isSmoothingRef = useRef(false);
  const isSmartShapeRef = useRef(false);

  // ── 이모지 모드 ──
  const [isEmojiMode, setIsEmojiMode] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState('👍');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // ── UI 토글 ──
  const [showGrid, setShowGrid] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isSnapEnabled, setIsSnapEnabled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [boardThemeId, setBoardThemeId] = useState('light');
  const [showShapeLibrary, setShowShapeLibrary] = useState(false);
  const [isLaserMode, setIsLaserMode] = useState(false);
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const [isPresentingMode, setIsPresentingMode] = useState(false);
  const [presentingFrameIdx, setPresentingFrameIdx] = useState(0);
  const [showQRCode, setShowQRCode] = useState(false);
  const showHelpRef = useRef(false);
  const isSnapEnabledRef = useRef(false);

  const isDarkMode = useMemo(() => ['dark', 'midnight'].includes(boardThemeId), [boardThemeId]);

  const setIsDarkMode: React.Dispatch<React.SetStateAction<boolean>> = useCallback((v) => {
    const current = ['dark', 'midnight'].includes(boardThemeId);
    const newVal = typeof v === 'function' ? v(current) : v;
    setBoardThemeId(prev => {
      if (newVal && !['dark', 'midnight'].includes(prev)) return 'dark';
      if (!newVal && ['dark', 'midnight'].includes(prev)) return 'light';
      return prev;
    });
  }, [boardThemeId]) as React.Dispatch<React.SetStateAction<boolean>>;

  // ── 토스트 ──
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ── 테마 ──
  const theme = useMemo(() => {
    const t = BOARD_THEMES.find(bt => bt.id === boardThemeId);
    if (t) {
      return {
        bg: t.bg, panel: t.panel, border: t.border,
        text: t.text, textMuted: t.textMuted, textSubtle: t.textSubtle,
        shadow: t.shadow, gridColor: t.gridColor,
        inputBg: t.inputBg, inputBorder: t.inputBorder,
        chatBubbleSelf: t.chatBubbleSelf, chatBubbleOther: t.chatBubbleOther, chatTextOther: t.chatTextOther,
      };
    }
    return {
      bg: isDarkMode ? '#111827' : '#f9fafb',
      panel: isDarkMode ? '#1f2937' : 'white',
      border: isDarkMode ? '#374151' : '#e5e7eb',
      text: isDarkMode ? '#f3f4f6' : '#374151',
      textMuted: isDarkMode ? '#9ca3af' : '#6b7280',
      textSubtle: isDarkMode ? '#6b7280' : '#9ca3af',
      shadow: isDarkMode ? '0 4px 6px rgba(0,0,0,0.5)' : '0 4px 6px rgba(0,0,0,0.1)',
      gridColor: isDarkMode ? '#374151' : '#c8cdd6',
      inputBg: isDarkMode ? '#374151' : 'white',
      inputBorder: isDarkMode ? '#4b5563' : '#d1d5db',
      chatBubbleSelf: '#3b82f6',
      chatBubbleOther: isDarkMode ? '#374151' : '#f3f4f6',
      chatTextOther: isDarkMode ? '#f3f4f6' : '#374151',
    };
  }, [isDarkMode, boardThemeId]);

  // ── Ref 동기화 ──
  useLayoutEffect(() => { toolRef.current = tool; }, [tool]);
  useLayoutEffect(() => { isSmoothingRef.current = isSmoothing; }, [isSmoothing]);
  useLayoutEffect(() => { isSmartShapeRef.current = isSmartShape; }, [isSmartShape]);
  useLayoutEffect(() => { showHelpRef.current = showHelp; }, [showHelp]);
  useLayoutEffect(() => { isSnapEnabledRef.current = isSnapEnabled; }, [isSnapEnabled]);

  // ── 토스트 표시 ──
  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = generateId();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  // ── 색상 선택 ──
  const selectColor = useCallback((color: string) => {
    setCurrentColor(color);
    if (toolRef.current === 'eraser') setTool('pen');
    setRecentColors(prev => {
      const filtered = prev.filter(c => c !== color);
      return [color, ...filtered].slice(0, 5);
    });
  }, []);

  return {
    // tool
    tool, setTool, toolRef,
    // color
    currentColor, setCurrentColor, recentColors, setRecentColors, selectColor,
    // style
    strokeWidth, setStrokeWidth,
    isFilled, setIsFilled,
    currentDash, setCurrentDash,
    currentLineCap, setCurrentLineCap,
    currentOpacity, setCurrentOpacity,
    stickyBg, setStickyBg,
    currentShapeName, setCurrentShapeName,
    gradientColors, setGradientColors,
    gradientAngle, setGradientAngle,
    fontStyle, setFontStyle,
    textDecoration, setTextDecoration,
    fontFamily, setFontFamily,
    textAlign, setTextAlign,
    // pen options
    isSmoothing, setIsSmoothing, isSmoothingRef,
    isSmartShape, setIsSmartShape, isSmartShapeRef,
    brushType, setBrushType,
    // emoji
    isEmojiMode, setIsEmojiMode,
    selectedEmoji, setSelectedEmoji,
    showEmojiPicker, setShowEmojiPicker,
    // ui toggles
    showGrid, setShowGrid,
    isChatOpen, setIsChatOpen,
    isSnapEnabled, setIsSnapEnabled, isSnapEnabledRef,
    showHelp, setShowHelp, showHelpRef,
    isDragOver, setIsDragOver,
    isDarkMode, setIsDarkMode,
    showShapeLibrary, setShowShapeLibrary,
    isLaserMode, setIsLaserMode,
    bgImageUrl, setBgImageUrl,
    isPresentingMode, setIsPresentingMode,
    presentingFrameIdx, setPresentingFrameIdx,
    showQRCode, setShowQRCode,
    boardThemeId, setBoardThemeId,
    // toasts
    toasts, setToasts, showToast,
    // theme
    theme,
  };
}
