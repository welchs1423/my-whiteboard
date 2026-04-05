import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Rect, Ellipse, Text, Arrow, Image as KonvaImage, Group } from 'react-konva';
import Konva from 'konva';
import {
  Eraser, Pen, Trash2, Download, Users, MessageSquare, Send, Square, Circle,
  Undo2, Redo2, Type, ArrowRight, Minus, PaintBucket, Grid2X2, ChevronDown,
  MousePointer, ChevronsUp, ChevronUp, ChevronsDown, FileJson, Upload,
  HelpCircle, ImageIcon, StickyNote, ZoomIn, ZoomOut, Copy,
  AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  Lock, Unlock, Magnet, Sun, Moon, Triangle, Maximize2,
} from 'lucide-react';
import { io } from 'socket.io-client';
import type { DrawElement, ToolType, DashStyle, Bounds } from '../utils/elementHelpers';
import {
  generateId, getElementBounds, getElementAtPoint, getElementsInRect, moveElementBy, getDashArray,
} from '../utils/elementHelpers';

const socket = io('http://localhost:3001');

// ── 인터페이스 ─────────────────────────────────────────────────────────────

interface CursorData { x: number; y: number; nickname: string; }
interface TextInputState { x: number; y: number; value: string; targetIdx?: number; }
interface ChatMessage { text: string; sender: string; time: string; }
interface Toast { id: string; message: string; type: 'join' | 'leave' | 'info'; }
interface UserInfo { id: string; nickname: string; }
interface EmojiReaction { id: string; x: number; y: number; emoji: string; nickname: string; }
interface UserViewport { scale: number; x: number; y: number; nickname: string; }

// ── 상수 ──────────────────────────────────────────────────────────────────

const COLORS = ['#000000', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
const CURSOR_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '😮', '👏', '✨'];
const STICKY_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa'];

const getCursorColor = (id: string) => {
  const hash = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
};

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

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function Board() {
  // ── 상태 ──
  const [isJoined, setIsJoined] = useState(false);
  const [nickname, setNickname] = useState('');
  const [elements, setElements] = useState<DrawElement[]>([]);
  const [currentColor, setCurrentColor] = useState(COLORS[0]);
  const [tool, setTool] = useState<ToolType>('pen');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [users, setUsers] = useState<UserInfo[]>([]);
  // 협업 기능
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);
  const [userViewports, setUserViewports] = useState<Record<string, UserViewport>>({});
  const [emojiReactions, setEmojiReactions] = useState<EmojiReaction[]>([]);
  const [isEmojiMode, setIsEmojiMode] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState('👍');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [textInput, setTextInput] = useState<TextInputState | null>(null);
  const [isFilled, setIsFilled] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [cursors, setCursors] = useState<Record<string, CursorData>>({});
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  // 선택
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [boxSelectRect, setBoxSelectRect] = useState<Bounds | null>(null);
  // 줌/패닝
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  // 스타일
  const [currentDash, setCurrentDash] = useState<DashStyle>('solid');
  const [currentOpacity, setCurrentOpacity] = useState(1.0);
  const [stickyBg, setStickyBg] = useState('#fef08a');
  // UI
  const [isSnapEnabled, setIsSnapEnabled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [, setImageLoadTick] = useState(0); // 이미지 로딩 후 강제 리렌더
  // 다크 모드
  const [isDarkMode, setIsDarkMode] = useState(false);
  // 최근 사용 색상 (최대 5개)
  const [recentColors, setRecentColors] = useState<string[]>([]);
  // 토스트 알림
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ── Refs ──
  const isDrawing = useRef(false);
  const stageRef = useRef<Konva.Stage>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const lastCursorEmit = useRef(0);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef = useRef<DrawElement[][]>([[]]);
  const historyStepRef = useRef(0);
  const isDraggingSelected = useRef(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const dragOriginals = useRef<{ idx: number; el: DrawElement }[]>([]);
  const isBoxSelecting = useRef(false);
  const boxSelectStart = useRef<{ x: number; y: number } | null>(null);
  const isPanning = useRef(false);
  const panStart = useRef<{ mx: number; my: number; sx: number; sy: number } | null>(null);
  const clipboard = useRef<DrawElement | null>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  // 최신값 ref (useEffect 스테일 클로저 방지)
  const elementsRef = useRef<DrawElement[]>([]);
  const selectedIndicesRef = useRef<Set<number>>(new Set());
  const stagePosRef = useRef({ x: 0, y: 0 });
  const stageScaleRef = useRef(1);
  const showHelpRef = useRef(false);
  const spaceHeldRef = useRef(false);
  const isSnapEnabledRef = useRef(false);
  const followingUserRef = useRef<string | null>(null);
  const lastViewportEmit = useRef(0);

  // ── 테마 ──
  const theme = {
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

  // ── 토스트 ──
  const showToast = (message: string, type: Toast['type'] = 'info') => {
    const id = generateId();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  // ── 색상 선택 (최근 색상 기록) ──
  const selectColor = (color: string) => {
    setCurrentColor(color);
    if (tool === 'eraser') setTool('pen');
    setRecentColors(prev => {
      const filtered = prev.filter(c => c !== color);
      return [color, ...filtered].slice(0, 5);
    });
  };

  // Ref 동기화
  elementsRef.current = elements;
  selectedIndicesRef.current = selectedIndices;
  stagePosRef.current = stagePos;
  stageScaleRef.current = stageScale;
  showHelpRef.current = showHelp;
  spaceHeldRef.current = isSpaceHeld;
  isSnapEnabledRef.current = isSnapEnabled;
  followingUserRef.current = followingUserId;

  // ── 좌표 변환 ──

  /** Stage 포인터 위치 → 캔버스 좌표 */
  const getCanvasPos = (stage: Konva.Stage): { x: number; y: number } | null => {
    const p = stage.getPointerPosition();
    if (!p) return null;
    return {
      x: (p.x - stagePosRef.current.x) / stageScaleRef.current,
      y: (p.y - stagePosRef.current.y) / stageScaleRef.current,
    };
  };

  /** 캔버스 좌표 → 화면 좌표 */
  const canvasToScreen = (cx: number, cy: number) => ({
    x: cx * stageScale + stagePos.x,
    y: cy * stageScale + stagePos.y,
  });

  // ── 히스토리 ──

  const saveHistoryWith = (els: DrawElement[]) => {
    const h = historyRef.current.slice(0, historyStepRef.current + 1);
    h.push([...els]);
    historyRef.current = h;
    historyStepRef.current = h.length - 1;
  };

  const handleUndo = () => {
    if (historyStepRef.current <= 0) return;
    historyStepRef.current--;
    const prev = historyRef.current[historyStepRef.current];
    setElements([...prev]);
    setSelectedIndices(new Set());
    socket.emit('draw_line', prev);
  };

  const handleRedo = () => {
    if (historyStepRef.current >= historyRef.current.length - 1) return;
    historyStepRef.current++;
    const next = historyRef.current[historyStepRef.current];
    setElements([...next]);
    setSelectedIndices(new Set());
    socket.emit('draw_line', next);
  };

  // ── 선택 관련 ──

  const deleteSelected = () => {
    const idxSet = selectedIndicesRef.current;
    if (idxSet.size === 0) return;
    const updated = elementsRef.current.filter((el, i) => !idxSet.has(i) || el.locked);
    setElements(updated);
    setSelectedIndices(new Set());
    saveHistoryWith(updated);
    socket.emit('draw_line', updated);
  };

  const copySelected = () => {
    if (selectedIndicesRef.current.size !== 1) return;
    const idx = [...selectedIndicesRef.current][0];
    clipboard.current = { ...elementsRef.current[idx], points: [...elementsRef.current[idx].points] };
  };


  // ── 레이어 관리 (단일 선택 시) ──

  const singleIdx = selectedIndices.size === 1 ? [...selectedIndices][0] : null;

  const bringToFront = () => {
    if (singleIdx === null) return;
    const upd = [...elements];
    const [el] = upd.splice(singleIdx, 1);
    upd.push(el);
    setElements(upd); setSelectedIndices(new Set([upd.length - 1]));
    saveHistoryWith(upd); socket.emit('draw_line', upd);
  };
  const sendToBack = () => {
    if (singleIdx === null) return;
    const upd = [...elements];
    const [el] = upd.splice(singleIdx, 1);
    upd.unshift(el);
    setElements(upd); setSelectedIndices(new Set([0]));
    saveHistoryWith(upd); socket.emit('draw_line', upd);
  };
  const moveForward = () => {
    if (singleIdx === null || singleIdx >= elements.length - 1) return;
    const upd = [...elements];
    [upd[singleIdx], upd[singleIdx + 1]] = [upd[singleIdx + 1], upd[singleIdx]];
    setElements(upd); setSelectedIndices(new Set([singleIdx + 1]));
    saveHistoryWith(upd); socket.emit('draw_line', upd);
  };
  const moveBackward = () => {
    if (singleIdx === null || singleIdx <= 0) return;
    const upd = [...elements];
    [upd[singleIdx], upd[singleIdx - 1]] = [upd[singleIdx - 1], upd[singleIdx]];
    setElements(upd); setSelectedIndices(new Set([singleIdx - 1]));
    saveHistoryWith(upd); socket.emit('draw_line', upd);
  };

  // ── 정렬 ──

  const alignElements = (dir: 'left' | 'centerH' | 'right' | 'top' | 'middleV' | 'bottom') => {
    const idxs = [...selectedIndicesRef.current];
    if (idxs.length < 2) return;
    const pairs = idxs.map(i => ({ idx: i, b: getElementBounds(elementsRef.current[i]) })).filter(p => p.b !== null) as { idx: number; b: NonNullable<ReturnType<typeof getElementBounds>> }[];
    if (pairs.length < 2) return;
    const upd = [...elementsRef.current];
    let target: number;
    switch (dir) {
      case 'left':
        target = Math.min(...pairs.map(p => p.b.x));
        pairs.forEach(({ idx, b }) => { upd[idx] = moveElementBy(upd[idx], target - b.x, 0); });
        break;
      case 'centerH':
        target = (Math.min(...pairs.map(p => p.b.x)) + Math.max(...pairs.map(p => p.b.x + p.b.width))) / 2;
        pairs.forEach(({ idx, b }) => { upd[idx] = moveElementBy(upd[idx], target - (b.x + b.width / 2), 0); });
        break;
      case 'right':
        target = Math.max(...pairs.map(p => p.b.x + p.b.width));
        pairs.forEach(({ idx, b }) => { upd[idx] = moveElementBy(upd[idx], target - (b.x + b.width), 0); });
        break;
      case 'top':
        target = Math.min(...pairs.map(p => p.b.y));
        pairs.forEach(({ idx, b }) => { upd[idx] = moveElementBy(upd[idx], 0, target - b.y); });
        break;
      case 'middleV':
        target = (Math.min(...pairs.map(p => p.b.y)) + Math.max(...pairs.map(p => p.b.y + p.b.height))) / 2;
        pairs.forEach(({ idx, b }) => { upd[idx] = moveElementBy(upd[idx], 0, target - (b.y + b.height / 2)); });
        break;
      case 'bottom':
        target = Math.max(...pairs.map(p => p.b.y + p.b.height));
        pairs.forEach(({ idx, b }) => { upd[idx] = moveElementBy(upd[idx], 0, target - (b.y + b.height)); });
        break;
    }
    setElements(upd); saveHistoryWith(upd); socket.emit('draw_line', upd);
  };

  // ── 잠금/해제 ──

  const toggleLock = () => {
    const idxs = [...selectedIndicesRef.current];
    if (idxs.length === 0) return;
    const allLocked = idxs.every(i => elementsRef.current[i]?.locked);
    const upd = elementsRef.current.map((el, i) =>
      selectedIndicesRef.current.has(i) ? { ...el, locked: !allLocked } : el
    );
    setElements(upd); saveHistoryWith(upd); socket.emit('draw_line', upd);
  };

  // ── 내보내기 / 가져오기 ──

  const handleDownloadPNG = () => {
    if (!stageRef.current) return;
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
    const a = document.createElement('a');
    a.download = `whiteboard-${Date.now()}.png`;
    a.href = uri;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(elements, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `whiteboard-${Date.now()}.json`; a.href = url;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as DrawElement[];
        if (!Array.isArray(data)) throw new Error();
        setElements(data); setSelectedIndices(new Set());
        saveHistoryWith(data); socket.emit('draw_line', data);
      } catch { alert('유효하지 않은 JSON 파일입니다.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const insertImage = (dataUrl: string, x: number, y: number) => {
    const img = new window.Image();
    img.src = dataUrl;
    img.onload = () => {
      const w = Math.min(img.naturalWidth, 600);
      const h = (img.naturalHeight / img.naturalWidth) * w;
      imageCache.current.set(dataUrl, img);
      const newEl: DrawElement = {
        id: generateId(), tool: 'image',
        points: [x, y, w, h], color: 'transparent', strokeWidth: 0,
        imageDataUrl: dataUrl, opacity: currentOpacity,
      };
      setElements((prev) => {
        const updated = [...prev, newEl];
        saveHistoryWith(updated); socket.emit('draw_line', updated);
        return updated;
      });
      setImageLoadTick((t) => t + 1);
    };
  };

  const handleImageFile = (file: File, dropPos?: { x: number; y: number }) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const pos = dropPos ?? screenToCanvas(stageSize.width / 2, stageSize.height / 2);
      insertImage(dataUrl, pos.x, pos.y);
    };
    reader.readAsDataURL(file);
  };

  const screenToCanvas = (sx: number, sy: number) => ({
    x: (sx - stagePosRef.current.x) / stageScaleRef.current,
    y: (sy - stagePosRef.current.y) / stageScaleRef.current,
  });

  // ── 전체 요소 보기 (Zoom to Fit) ──
  const handleZoomToFit = () => {
    const els = elementsRef.current;
    if (els.length === 0) { setStageScale(1); setStagePos({ x: 0, y: 0 }); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    els.forEach(el => {
      const b = getElementBounds(el);
      if (b) {
        minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width); maxY = Math.max(maxY, b.y + b.height);
      }
    });
    if (minX === Infinity) return;
    const pad = 80;
    const w = window.innerWidth, h = window.innerHeight;
    const cw = maxX - minX || 1, ch = maxY - minY || 1;
    const newScale = Math.min((w - pad * 2) / cw, (h - pad * 2) / ch, 10);
    setStageScale(newScale);
    setStagePos({ x: (w - cw * newScale) / 2 - minX * newScale, y: (h - ch * newScale) / 2 - minY * newScale });
  };

  /** 그리드 스냅 (28px 격자) */
  const snap = (v: number) => isSnapEnabledRef.current ? Math.round(v / 28) * 28 : v;

  // ── Effects ──

  // 이미지 프리로드
  useEffect(() => {
    const unloaded = elements.filter(
      (el) => el.tool === 'image' && el.imageDataUrl && !imageCache.current.has(el.imageDataUrl),
    );
    if (unloaded.length === 0) return;
    let done = 0;
    unloaded.forEach((el) => {
      const img = new window.Image();
      img.src = el.imageDataUrl!;
      img.onload = () => {
        imageCache.current.set(el.imageDataUrl!, img);
        done++;
        if (done === unloaded.length) setImageLoadTick((t) => t + 1);
      };
    });
  }, [elements]);

  // 창 크기
  useEffect(() => {
    const h = () => setStageSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // 뷰포트 변경 시 브로드캐스트 (Follow Me)
  useEffect(() => {
    if (!isJoined) return;
    const now = Date.now();
    if (now - lastViewportEmit.current < 80) return;
    lastViewportEmit.current = now;
    socket.emit('viewport_update', { scale: stageScale, x: stagePos.x, y: stagePos.y });
  }, [stageScale, stagePos, isJoined]);

  // 마우스 업 (캔버스 밖)
  useEffect(() => {
    const up = () => {
      if (isPanning.current) {
        isPanning.current = false; panStart.current = null; return;
      }
      if (isDraggingSelected.current) {
        isDraggingSelected.current = false; dragStartPos.current = null; dragOriginals.current = [];
        const cur = elementsRef.current;
        saveHistoryWith(cur);
        socket.emit('draw_line', cur);
        return;
      }
      if (isBoxSelecting.current) {
        isBoxSelecting.current = false; boxSelectStart.current = null;
        setBoxSelectRect(null);
        return;
      }
      if (!isDrawing.current) return;
      isDrawing.current = false;
      setElements((latest) => { saveHistoryWith(latest); return latest; });
    };
    // 중간 버튼 mouseup도 처리
    const upAll = (e: MouseEvent) => { if (e.button === 1 && isPanning.current) { isPanning.current = false; panStart.current = null; } };
    window.addEventListener('mouseup', up);
    window.addEventListener('mouseup', upAll);
    return () => { window.removeEventListener('mouseup', up); window.removeEventListener('mouseup', upAll); };
  }, []);

  // 스페이스바 (패닝 모드)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const active = document.activeElement;
        if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        spaceHeldRef.current = true;
        setIsSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false;
        setIsSpaceHeld(false);
        isPanning.current = false;
        panStart.current = null;
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // 키보드 단축키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); handleRedo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); setStageScale(1); setStagePos({ x: 0, y: 0 }); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIndices(new Set(elementsRef.current.map((_, i) => i)));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        const idxs = [...selectedIndicesRef.current];
        if (idxs.length === 0) return;
        const newEls: DrawElement[] = idxs.map(i => ({
          ...elementsRef.current[i],
          id: generateId(),
          points: elementsRef.current[i].points.map(p => p + 20),
          locked: false,
        }));
        const updated = [...elementsRef.current, ...newEls];
        const newIdxs = new Set(Array.from({ length: newEls.length }, (_, k) => elementsRef.current.length + k));
        setElements(updated); setSelectedIndices(newIdxs);
        saveHistoryWith(updated); socket.emit('draw_line', updated);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        if (selectedIndicesRef.current.size === 1) {
          const idx = [...selectedIndicesRef.current][0];
          clipboard.current = { ...elementsRef.current[idx], points: [...elementsRef.current[idx].points] };
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        if (!clipboard.current) return;
        const pasted: DrawElement = { ...clipboard.current, id: generateId(), points: clipboard.current.points.map((p) => p + 20) };
        const updated = [...elementsRef.current, pasted];
        setElements(updated);
        setSelectedIndices(new Set([updated.length - 1]));
        saveHistoryWith(updated);
        socket.emit('draw_line', updated);
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIndicesRef.current.size > 0) {
        e.preventDefault();
        const idxSet = selectedIndicesRef.current;
        const updated = elementsRef.current.filter((el, i) => !idxSet.has(i) || el.locked);
        setElements(updated); setSelectedIndices(new Set());
        saveHistoryWith(updated); socket.emit('draw_line', updated);
        return;
      }

      if (e.key === 'Escape') {
        if (showHelpRef.current) { setShowHelp(false); return; }
        setSelectedIndices(new Set()); return;
      }
      if (e.key === '?') { setShowHelp((v) => !v); return; }

      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (e.key === 'f' || e.key === 'F') { e.preventDefault(); handleZoomToFit(); return; }
        const map: Record<string, ToolType> = {
          p: 'pen', e: 'eraser', r: 'rect', c: 'circle',
          t: 'text', l: 'straight', a: 'arrow', s: 'select', n: 'sticky', v: 'triangle',
        };
        if (map[e.key]) { setTool(map[e.key]); setSelectedIndices(new Set()); }
      }

      // 화살표 키로 선택 요소 이동
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && selectedIndicesRef.current.size > 0) {
        e.preventDefault();
        const delta = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0;
        const dy = e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0;
        const upd = elementsRef.current.map((el, i) =>
          selectedIndicesRef.current.has(i) && !el.locked ? moveElementBy(el, dx, dy) : el
        );
        setElements(upd); saveHistoryWith(upd); socket.emit('draw_line', upd);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 소켓 이벤트
  useEffect(() => {
    socket.on('draw_line', (data: DrawElement[]) => setElements(data));
    socket.on('clear_all', () => {
      setElements([]); setSelectedIndices(new Set());
      historyRef.current = [[]]; historyStepRef.current = 0;
    });
    socket.on('user_list', (list: UserInfo[]) => setUsers(list));
    socket.on('receive_message', (msg: ChatMessage) => setMessages((p) => [...p, msg]));
    socket.on('cursor_move', (data: CursorData & { id: string }) => {
      setCursors((p) => ({ ...p, [data.id]: { x: data.x, y: data.y, nickname: data.nickname } }));
    });
    socket.on('cursor_leave', (id: string) => {
      setCursors((p) => { const n = { ...p }; delete n[id]; return n; });
      setUserViewports((p) => { const n = { ...p }; delete n[id]; return n; });
      setFollowingUserId((prev) => prev === id ? null : prev);
    });
    socket.on('typing', (name: string) => setTypingUsers((p) => p.includes(name) ? p : [...p, name]));
    socket.on('stop_typing', (name: string) => setTypingUsers((p) => p.filter((n) => n !== name)));
    socket.on('user_joined', (name: string) => showToast(`${name}님이 입장했습니다`, 'join'));
    socket.on('user_left', (name: string) => showToast(`${name}님이 퇴장했습니다`, 'leave'));
    // Follow Me: 다른 유저의 뷰포트 수신
    socket.on('viewport_update', (data: UserViewport & { id: string }) => {
      setUserViewports((p) => ({ ...p, [data.id]: { scale: data.scale, x: data.x, y: data.y, nickname: data.nickname } }));
      if (followingUserRef.current === data.id) {
        setStageScale(data.scale);
        setStagePos({ x: data.x, y: data.y });
      }
    });
    // 이모지 반응 수신
    socket.on('emoji_reaction', (data: EmojiReaction) => {
      setEmojiReactions((p) => [...p, data]);
      setTimeout(() => setEmojiReactions((p) => p.filter((r) => r.id !== data.id)), 1800);
    });
    return () => {
      ['draw_line','clear_all','user_list','receive_message','cursor_move','cursor_leave',
       'typing','stop_typing','user_joined','user_left','viewport_update','emoji_reaction']
        .forEach((ev) => socket.off(ev));
    };
  }, []);

  // 채팅 자동 스크롤
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // 마우스 휠 줌 (passive:false 필요)
  useEffect(() => {
    const el = stageRef.current?.container();
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const oldScale = stageScaleRef.current;
      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition()!;
      const scaleBy = 1.08;
      const newScale = e.deltaY < 0
        ? Math.min(oldScale * scaleBy, 10)
        : Math.max(oldScale / scaleBy, 0.05);
      const origin = {
        x: (pointer.x - stagePosRef.current.x) / oldScale,
        y: (pointer.y - stagePosRef.current.y) / oldScale,
      };
      setStageScale(newScale);
      setStagePos({
        x: pointer.x - origin.x * newScale,
        y: pointer.y - origin.y * newScale,
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isJoined]); // isJoined가 바뀔 때 Stage가 마운트됨

  // ── 핸들러 ──

  const handleJoin = (viewOnly = false) => {
    const name = viewOnly ? '관람자' : nickname.trim();
    if (!name) return;
    if (viewOnly) {
      setNickname('관람자');
      setIsViewOnly(true);
    }
    socket.emit('set_nickname', name);
    setIsJoined(true);
  };

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    socket.emit('send_message', {
      text: inputText, sender: nickname,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    socket.emit('stop_typing', nickname);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    setInputText('');
  };

  const handleClearAll = () => {
    setElements([]); setSelectedIndices(new Set());
    historyRef.current = [[]]; historyStepRef.current = 0;
    socket.emit('clear_all');
  };

  const commitText = () => {
    if (!textInput) return;
    if (textInput.targetIdx !== undefined) {
      // 스티커 메모 텍스트 업데이트
      setElements((prev) => {
        const upd = [...prev];
        upd[textInput.targetIdx!] = { ...upd[textInput.targetIdx!], text: textInput.value };
        saveHistoryWith(upd); socket.emit('draw_line', upd);
        return upd;
      });
    } else if (textInput.value.trim()) {
      const fontSize = Math.max(12, strokeWidth * 3);
      const newEl: DrawElement = {
        id: generateId(), tool: 'text',
        points: [textInput.x, textInput.y], color: currentColor,
        strokeWidth, text: textInput.value, fontSize,
        dash: currentDash, opacity: currentOpacity,
      };
      setElements((prev) => {
        const upd = [...prev, newEl];
        saveHistoryWith(upd); socket.emit('draw_line', upd);
        return upd;
      });
    }
    setTextInput(null);
  };

  // ── 캔버스 이벤트 ──

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    // 중간 버튼 또는 스페이스바 → 패닝
    if (e.evt.button === 1 || spaceHeldRef.current) {
      isPanning.current = true;
      panStart.current = { mx: e.evt.clientX, my: e.evt.clientY, sx: stagePosRef.current.x, sy: stagePosRef.current.y };
      return;
    }

    const pos = getCanvasPos(stage);
    if (!pos) return;

    // 이모지 반응 모드
    if (isEmojiMode) {
      const reactionId = generateId();
      const reaction: EmojiReaction = { id: reactionId, x: pos.x, y: pos.y, emoji: selectedEmoji, nickname };
      setEmojiReactions((p) => [...p, reaction]);
      setTimeout(() => setEmojiReactions((p) => p.filter((r) => r.id !== reactionId)), 1800);
      socket.emit('emoji_reaction', reaction);
      return;
    }

    // 읽기 전용: 그리기 불가
    if (isViewOnly) return;

    // 텍스트 도구
    if (tool === 'text') {
      commitText();
      setTextInput({ x: snap(pos.x), y: snap(pos.y), value: '' });
      return;
    }

    // 선택 도구
    if (tool === 'select') {
      const idx = getElementAtPoint(elements, pos.x, pos.y);
      if (idx === null) {
        // 빈 공간 클릭 → 박스 선택 시작
        if (!e.evt.shiftKey) setSelectedIndices(new Set());
        isBoxSelecting.current = true;
        boxSelectStart.current = pos;
        setBoxSelectRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
      } else {
        // 요소 클릭
        if (e.evt.shiftKey) {
          setSelectedIndices((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) { next.delete(idx); } else { next.add(idx); }
            return next;
          });
        } else {
          const newSel = selectedIndices.has(idx) ? selectedIndices : new Set([idx]);
          setSelectedIndices(newSel);
          // 드래그 준비
          isDraggingSelected.current = true;
          dragStartPos.current = pos;
          const sel = selectedIndices.has(idx) ? selectedIndices : new Set([idx]);
          dragOriginals.current = [...sel].filter(i => !elements[i]?.locked).map((i) => ({
            idx: i,
            el: { ...elements[i], points: [...elements[i].points] },
          }));
        }
      }
      return;
    }

    // 그리기 도구
    isDrawing.current = true;
    const newEl: DrawElement = {
      id: generateId(), tool,
      points: ['pen', 'eraser'].includes(tool) ? [snap(pos.x), snap(pos.y)] : [snap(pos.x), snap(pos.y), snap(pos.x), snap(pos.y)],
      color: currentColor, strokeWidth,
      filled: isFilled, dash: currentDash, opacity: currentOpacity,
      ...(tool === 'sticky' ? { stickyBg } : {}),
    };
    setElements((prev) => [...prev, newEl]);
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // 패닝
    if (isPanning.current && panStart.current) {
      const dx = e.evt.clientX - panStart.current.mx;
      const dy = e.evt.clientY - panStart.current.my;
      setStagePos({ x: panStart.current.sx + dx, y: panStart.current.sy + dy });
      return;
    }

    const stage = e.target.getStage();
    if (!stage) return;
    const point = getCanvasPos(stage);
    if (!point) return;

    // 커서 브로드캐스트 (캔버스 좌표로 전송)
    const now = Date.now();
    if (now - lastCursorEmit.current > 50) {
      socket.emit('cursor_move', { x: point.x, y: point.y });
      lastCursorEmit.current = now;
    }

    // 선택 드래그
    if (tool === 'select') {
      if (isDraggingSelected.current && dragStartPos.current && dragOriginals.current.length) {
        const dx = snap(point.x) - snap(dragStartPos.current.x);
        const dy = snap(point.y) - snap(dragStartPos.current.y);
        setElements((prev) => {
          const upd = [...prev];
          dragOriginals.current.forEach(({ idx, el }) => {
            if (idx < upd.length) upd[idx] = moveElementBy(el, dx, dy);
          });
          socket.emit('draw_line', upd);
          return upd;
        });
      } else if (isBoxSelecting.current && boxSelectStart.current) {
        const r: Bounds = {
          x: boxSelectStart.current.x,
          y: boxSelectStart.current.y,
          width: point.x - boxSelectStart.current.x,
          height: point.y - boxSelectStart.current.y,
        };
        setBoxSelectRect(r);
        const inRect = getElementsInRect(elements, r.x, r.y, r.width, r.height);
        setSelectedIndices(new Set(inRect));
      }
      return;
    }

    if (!isDrawing.current) return;

    setElements((prev) => {
      if (prev.length === 0) return prev;
      const upd = [...prev];
      const last = { ...upd[upd.length - 1] };
      if (last.tool === 'pen' || last.tool === 'eraser') {
        last.points = [...last.points, snap(point.x), snap(point.y)];
      } else {
        last.points = [last.points[0], last.points[1], snap(point.x), snap(point.y)];
      }
      upd[upd.length - 1] = last;
      socket.emit('draw_line', upd);
      return upd;
    });
  };

  const handleMouseUp = () => {
    if (isPanning.current) { isPanning.current = false; panStart.current = null; return; }

    if (tool === 'select') {
      if (isDraggingSelected.current) {
        isDraggingSelected.current = false; dragStartPos.current = null; dragOriginals.current = [];
        setElements((latest) => { saveHistoryWith(latest); socket.emit('draw_line', latest); return latest; });
      }
      if (isBoxSelecting.current) {
        isBoxSelecting.current = false; boxSelectStart.current = null;
        setBoxSelectRect(null);
      }
      return;
    }

    if (!isDrawing.current) return;
    isDrawing.current = false;

    // 스티커 메모 완성 → 텍스트 입력 모드
    if (tool === 'sticky') {
      setElements((latest) => {
        saveHistoryWith(latest);
        const last = latest[latest.length - 1];
        if (last?.tool === 'sticky' && last.points.length >= 4) {
          const nx = Math.min(last.points[0], last.points[2]) + 8;
          const ny = Math.min(last.points[1], last.points[3]) + 8;
          setTextInput({ x: nx, y: ny, value: '', targetIdx: latest.length - 1 });
        }
        return latest;
      });
      return;
    }

    setElements((latest) => { saveHistoryWith(latest); return latest; });
  };

  // ── 텍스트/스티커 더블클릭 편집 ──
  const handleDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool !== 'select') return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = getCanvasPos(stage);
    if (!pos) return;
    const idx = getElementAtPoint(elements, pos.x, pos.y);
    if (idx === null) return;
    const el = elements[idx];
    if (el.locked) return;
    if (el.tool === 'text') {
      setTextInput({ x: el.points[0], y: el.points[1], value: el.text || '', targetIdx: idx });
    } else if (el.tool === 'sticky') {
      const nx = Math.min(el.points[0], el.points[2]) + 8;
      const ny = Math.min(el.points[1], el.points[3]) + 8;
      setTextInput({ x: nx, y: ny, value: el.text || '', targetIdx: idx });
    }
  };

  // ── 드래그 앤 드롭 이미지 ──

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const dropPos = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top);
    handleImageFile(file, dropPos);
  };

  // ── 엘리먼트 렌더링 ──

  const renderElement = (el: DrawElement, i: number) => {
    const op = el.opacity ?? 1;
    const dash = getDashArray(el.dash, stageScale);

    if (el.tool === 'pen' || el.tool === 'eraser') {
      return (
        <Line key={i} points={el.points} stroke={el.color} strokeWidth={el.strokeWidth}
          tension={0.5} lineCap="round" lineJoin="round" opacity={op}
          globalCompositeOperation={el.tool === 'eraser' ? 'destination-out' : 'source-over'} />
      );
    }
    if (el.tool === 'rect' && el.points.length >= 4) {
      const x = Math.min(el.points[0], el.points[2]);
      const y = Math.min(el.points[1], el.points[3]);
      return (
        <Rect key={i} x={x} y={y} width={Math.abs(el.points[2]-el.points[0])} height={Math.abs(el.points[3]-el.points[1])}
          stroke={el.color} strokeWidth={el.strokeWidth} fill={el.filled ? el.color : undefined}
          dash={dash} opacity={op} />
      );
    }
    if (el.tool === 'circle' && el.points.length >= 4) {
      return (
        <Ellipse key={i}
          x={(el.points[0]+el.points[2])/2} y={(el.points[1]+el.points[3])/2}
          radiusX={Math.abs(el.points[2]-el.points[0])/2} radiusY={Math.abs(el.points[3]-el.points[1])/2}
          stroke={el.color} strokeWidth={el.strokeWidth} fill={el.filled ? el.color : undefined}
          dash={dash} opacity={op} />
      );
    }
    if (el.tool === 'triangle' && el.points.length >= 4) {
      const [x1, y1, x2, y2] = el.points;
      const midX = (x1 + x2) / 2;
      return (
        <Line key={i} points={[midX, y1, x2, y2, x1, y2]} closed
          stroke={el.color} strokeWidth={el.strokeWidth}
          fill={el.filled ? el.color : undefined}
          dash={dash} opacity={op} lineCap="round" lineJoin="round" />
      );
    }
    if (el.tool === 'text' && el.text) {
      return (
        <Text key={i} x={el.points[0]} y={el.points[1]} text={el.text}
          fontSize={el.fontSize||20} fill={el.color} fontFamily="sans-serif" opacity={op} />
      );
    }
    if (el.tool === 'straight' && el.points.length >= 4) {
      return (
        <Line key={i} points={[el.points[0],el.points[1],el.points[2],el.points[3]]}
          stroke={el.color} strokeWidth={el.strokeWidth} lineCap="round" dash={dash} opacity={op} />
      );
    }
    if (el.tool === 'arrow' && el.points.length >= 4) {
      return (
        <Arrow key={i} points={[el.points[0],el.points[1],el.points[2],el.points[3]]}
          stroke={el.color} strokeWidth={el.strokeWidth} fill={el.color}
          pointerLength={12} pointerWidth={10} dash={dash} opacity={op} />
      );
    }
    if (el.tool === 'sticky' && el.points.length >= 4) {
      const x = Math.min(el.points[0], el.points[2]);
      const y = Math.min(el.points[1], el.points[3]);
      const w = Math.max(80, Math.abs(el.points[2]-el.points[0]));
      const h = Math.max(60, Math.abs(el.points[3]-el.points[1]));
      return (
        <Group key={i} opacity={op}>
          <Rect x={x} y={y} width={w} height={h} fill={el.stickyBg||'#fef08a'}
            stroke="#ca8a04" strokeWidth={1} cornerRadius={4}
            shadowColor="rgba(0,0,0,0.15)" shadowBlur={6} shadowOffsetY={2} shadowEnabled />
          {el.text && (
            <Text x={x+8} y={y+8} text={el.text} width={w-16}
              fontSize={el.fontSize||14} fill="#1c1917" fontFamily="sans-serif" wrap="word" />
          )}
        </Group>
      );
    }
    if (el.tool === 'image' && el.imageDataUrl) {
      const img = imageCache.current.get(el.imageDataUrl);
      if (!img) return null;
      return (
        <KonvaImage key={i} image={img} x={el.points[0]} y={el.points[1]}
          width={el.points[2]||img.naturalWidth} height={el.points[3]||img.naturalHeight}
          opacity={op} />
      );
    }
    return null;
  };

  // ── 커서 ──

  const getCursor = (): string => {
    if (isSpaceHeld) return isPanning.current ? 'grabbing' : 'grab';
    if (tool === 'eraser') return 'cell';
    if (tool === 'text') return 'text';
    if (tool === 'select') return isDraggingSelected.current ? 'grabbing' : 'default';
    return 'crosshair';
  };

  // ── 선택 바운딩 박스 (Konva Rect로 렌더링) ──

  const selectionRects = [...selectedIndices].map((idx) => {
    if (idx >= elements.length) return null;
    const b = getElementBounds(elements[idx]);
    if (!b) return null;
    return (
      <Rect key={`sel-${idx}`}
        x={b.x - 4} y={b.y - 4} width={b.width + 8} height={b.height + 8}
        stroke="#3b82f6" strokeWidth={1.5 / stageScale}
        dash={[6 / stageScale, 3 / stageScale]}
        fill="rgba(59,130,246,0.05)" listening={false} />
    );
  });

  // 텍스트 입력 화면 좌표
  const textAreaScreen = textInput ? canvasToScreen(textInput.x, textInput.y) : null;

  // ── 스타일 헬퍼 ──
  const toolBtn = (active: boolean): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer',
    color: active ? '#3b82f6' : theme.textSubtle, display: 'flex', alignItems: 'center', padding: '2px',
  });
  const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, display: 'flex', alignItems: 'center', padding: '2px' };
  const layerBtn = (disabled = false): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer',
    color: disabled ? theme.border : theme.textMuted, display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px',
  });
  const dashBtn = (active: boolean): React.CSSProperties => ({
    padding: '3px 8px', border: active ? '2px solid #3b82f6' : `1px solid ${theme.border}`,
    borderRadius: '4px', cursor: 'pointer', background: active ? '#eff6ff' : 'none',
    color: active ? '#3b82f6' : theme.textMuted, fontSize: '13px', fontWeight: 'bold', lineHeight: 1,
  });

  // ── 입장 화면 ──
  if (!isJoined) {
    return (
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', backgroundColor: isDarkMode ? '#111827' : '#f3f4f6' }}>
        <div style={{ padding:'30px', backgroundColor: isDarkMode ? '#1f2937' : 'white', borderRadius:'12px', boxShadow:'0 4px 6px rgba(0,0,0,0.1)', display:'flex', flexDirection:'column', gap:'15px', width:'300px' }}>
          <h2 style={{ margin:0, textAlign:'center', color: isDarkMode ? '#f3f4f6' : '#374151' }}>화이트보드 입장</h2>
          <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key==='Enter' && handleJoin()} placeholder="닉네임을 입력하세요"
            style={{ padding:'10px', borderRadius:'6px', border:`1px solid ${isDarkMode ? '#374151' : '#d1d5db'}`, backgroundColor: isDarkMode ? '#374151' : 'white', color: isDarkMode ? '#f3f4f6' : '#374151' }} />
          <button onClick={() => handleJoin()} style={{ padding:'10px', backgroundColor:'#3b82f6', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'bold' }}>
            입장하기
          </button>
          <button onClick={() => handleJoin(true)} style={{ padding:'8px', backgroundColor:'none', background:'none', border:`1px solid ${isDarkMode ? '#374151' : '#d1d5db'}`, borderRadius:'6px', cursor:'pointer', color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize:'13px' }}>
            👁️ 보기만 하기 (읽기 전용)
          </button>
          <button onClick={() => setIsDarkMode(v => !v)} style={{ padding:'6px', background:'none', border:`1px solid ${isDarkMode ? '#374151' : '#d1d5db'}`, borderRadius:'6px', cursor:'pointer', color: isDarkMode ? '#f3f4f6' : '#374151', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', fontSize:'13px' }}>
            {isDarkMode ? <Sun size={14}/> : <Moon size={14}/>} {isDarkMode ? '라이트 모드' : '다크 모드'}
          </button>
        </div>
      </div>
    );
  }

  // ── 메인 ──
  return (
    <div
      style={{
        position:'relative', width:'100vw', height:'100vh', overflow:'hidden',
        backgroundColor: theme.bg,
        backgroundImage: showGrid ? `radial-gradient(circle, ${theme.gridColor} 1px, transparent 1px)` : 'none',
        backgroundSize: showGrid ? `${28*stageScale}px ${28*stageScale}px` : 'auto',
        backgroundPosition: showGrid ? `${stagePos.x}px ${stagePos.y}px` : 'auto',
        cursor: getCursor(),
      }}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
    >

      {/* 드래그 오버레이 */}
      {isDragOver && (
        <div style={{ position:'absolute', inset:0, zIndex:50, backgroundColor:'rgba(59,130,246,0.1)', border:'3px dashed #3b82f6', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
          <div style={{ fontSize:'24px', color:'#3b82f6', fontWeight:'bold' }}>이미지를 여기에 놓으세요</div>
        </div>
      )}

      {/* ── 상단 도구 모음 ── */}
      <div style={{ position:'absolute', top:'16px', left:'50%', transform:'translateX(-50%)', zIndex:10, display:'flex', flexDirection:'column', gap:'6px', alignItems:'center' }}>
        {/* 1행: 도구 */}
        <div style={{ display:'flex', gap:'12px', padding:'8px 16px', backgroundColor: theme.panel, borderRadius:'12px', boxShadow: theme.shadow, alignItems:'center' }}>

          {/* 도구 선택 */}
          {!isViewOnly && (
          <div style={{ display:'flex', gap:'6px', borderRight:`2px solid ${theme.border}`, paddingRight:'12px' }}>
            <button onClick={() => { setTool('select'); setSelectedIndices(new Set()); }} title="선택 (S)" style={toolBtn(tool==='select')}><MousePointer size={22}/></button>
            <button onClick={() => setTool('pen')} title="펜 (P)" style={toolBtn(tool==='pen')}><Pen size={22}/></button>
            <button onClick={() => setTool('eraser')} title="지우개 (E)" style={toolBtn(tool==='eraser')}><Eraser size={22}/></button>
            <button onClick={() => setTool('rect')} title="사각형 (R)" style={toolBtn(tool==='rect')}><Square size={22}/></button>
            <button onClick={() => setTool('circle')} title="원 (C)" style={toolBtn(tool==='circle')}><Circle size={22}/></button>
            <button onClick={() => setTool('text')} title="텍스트 (T)" style={toolBtn(tool==='text')}><Type size={22}/></button>
            <button onClick={() => setTool('straight')} title="직선 (L)" style={toolBtn(tool==='straight')}><Minus size={22}/></button>
            <button onClick={() => setTool('arrow')} title="화살표 (A)" style={toolBtn(tool==='arrow')}><ArrowRight size={22}/></button>
            <button onClick={() => setTool('sticky')} title="스티커 메모 (N)" style={toolBtn(tool==='sticky')}><StickyNote size={22}/></button>
            <button onClick={() => setTool('triangle')} title="삼각형 (V)" style={toolBtn(tool==='triangle')}><Triangle size={22}/></button>
          </div>
          )}

          {/* 이모지 반응 */}
          {!isViewOnly && (
            <div style={{ position:'relative', borderRight:`2px solid ${theme.border}`, paddingRight:'12px' }}>
              <button
                onClick={() => setShowEmojiPicker(v => !v)}
                title="이모지 반응"
                style={{ ...toolBtn(isEmojiMode), fontSize:'20px', minWidth:'28px', border: isEmojiMode ? '2px solid #3b82f6' : '2px solid transparent', borderRadius:'6px', padding:'2px 4px' }}
              >
                {selectedEmoji}
              </button>
              {showEmojiPicker && (
                <div style={{ position:'absolute', top:'38px', left:0, zIndex:100, backgroundColor: theme.panel, borderRadius:'10px', padding:'8px 10px', display:'flex', gap:'4px', boxShadow: theme.shadow, border:`1px solid ${theme.border}` }}>
                  {REACTION_EMOJIS.map(emoji => (
                    <button key={emoji} onClick={() => { setSelectedEmoji(emoji); setIsEmojiMode(true); setShowEmojiPicker(false); }}
                      style={{ fontSize:'22px', background: selectedEmoji === emoji && isEmojiMode ? '#eff6ff' : 'none', border: selectedEmoji === emoji && isEmojiMode ? '2px solid #3b82f6' : '2px solid transparent', borderRadius:'6px', cursor:'pointer', padding:'4px', lineHeight:1 }}>
                      {emoji}
                    </button>
                  ))}
                  {isEmojiMode && (
                    <button onClick={() => { setIsEmojiMode(false); setShowEmojiPicker(false); }}
                      style={{ fontSize:'12px', background:'#fee2e2', border:'none', borderRadius:'6px', cursor:'pointer', padding:'4px 6px', color:'#ef4444', fontWeight:'bold', alignSelf:'center' }}>
                      OFF
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 채우기 */}
          {!isViewOnly && (
          <div style={{ borderRight:`2px solid ${theme.border}`, paddingRight:'12px' }}>
            <button onClick={() => setIsFilled(v => !v)} title={isFilled ? '채우기 ON' : '채우기 OFF'}
              style={{ background:isFilled?'#3b82f6':'none', border:isFilled?'none':`1px solid ${theme.border}`, borderRadius:'6px', cursor:'pointer', color:isFilled?'white': theme.textSubtle, padding:'2px 6px', display:'flex', alignItems:'center' }}>
              <PaintBucket size={22}/>
            </button>
          </div>
          )}

          {/* 색상 */}
          {!isViewOnly && (
          <div style={{ display:'flex', gap:'8px', borderRight:`2px solid ${theme.border}`, paddingRight:'12px', alignItems:'center', flexWrap:'wrap', maxWidth:'260px' }}>
            <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => selectColor(c)}
                  style={{ width:'22px', height:'22px', borderRadius:'50%', backgroundColor:c, border: currentColor===c && tool!=='eraser' ? '3px solid #3b82f6' : `1px solid ${theme.border}`, cursor:'pointer' }} />
              ))}
              <label title="커스텀 색상" style={{ position:'relative', width:'22px', height:'22px', cursor:'pointer' }}>
                <input type="color" value={currentColor} onChange={(e) => selectColor(e.target.value)}
                  style={{ position:'absolute', opacity:0, width:'100%', height:'100%', cursor:'pointer', top:0, left:0 }} />
                <div style={{ width:'22px', height:'22px', borderRadius:'50%', background:'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)', border: !COLORS.includes(currentColor)&&tool!=='eraser' ? '3px solid #3b82f6' : `1px solid ${theme.border}` }} />
              </label>
            </div>
            {/* 최근 사용 색상 */}
            {recentColors.length > 0 && (
              <div style={{ display:'flex', gap:'4px', alignItems:'center', borderLeft:`1px solid ${theme.border}`, paddingLeft:'6px' }}>
                <span style={{ fontSize:'10px', color:theme.textSubtle, whiteSpace:'nowrap' }}>최근</span>
                {recentColors.map((c, i) => (
                  <button key={i} onClick={() => selectColor(c)} title={c}
                    style={{ width:'18px', height:'18px', borderRadius:'50%', backgroundColor:c, border: currentColor===c ? '2px solid #3b82f6' : `1px solid ${theme.border}`, cursor:'pointer' }} />
                ))}
              </div>
            )}
            {/* 스티커 배경 색 (sticky 선택 시) */}
            {tool === 'sticky' && (
              <div style={{ display:'flex', gap:'4px', alignItems:'center', borderLeft:`1px solid ${theme.border}`, paddingLeft:'8px' }}>
                {STICKY_COLORS.map(c => (
                  <button key={c} onClick={() => setStickyBg(c)}
                    style={{ width:'20px', height:'20px', borderRadius:'4px', backgroundColor:c, border: stickyBg===c ? '2px solid #3b82f6' : '1px solid #d1d5db', cursor:'pointer' }} />
                ))}
              </div>
            )}
          </div>
          )}

          {/* 굵기 */}
          {!isViewOnly && (
          <div style={{ display:'flex', alignItems:'center', gap:'8px', borderRight:`2px solid ${theme.border}`, paddingRight:'12px' }}>
            <span style={{ fontSize:'11px', color:theme.textMuted, whiteSpace:'nowrap' }}>{tool==='text' ? '크기' : '굵기'}</span>
            <input type="range" min="1" max="50" value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} style={{ width:'70px' }} />
            <span style={{ fontSize:'11px', color:theme.textSubtle, minWidth:'20px' }}>{tool==='text' ? Math.max(12,strokeWidth*3) : strokeWidth}</span>
          </div>
          )}

          {/* 선 스타일 */}
          {!isViewOnly && (
          <div style={{ display:'flex', gap:'4px', alignItems:'center', borderRight:`2px solid ${theme.border}`, paddingRight:'12px' }}>
            <button style={dashBtn(currentDash==='solid')} onClick={() => setCurrentDash('solid')} title="실선">—</button>
            <button style={dashBtn(currentDash==='dashed')} onClick={() => setCurrentDash('dashed')} title="파선">- -</button>
            <button style={dashBtn(currentDash==='dotted')} onClick={() => setCurrentDash('dotted')} title="점선">···</button>
          </div>
          )}

          {/* 투명도 */}
          {!isViewOnly && (
          <div style={{ display:'flex', alignItems:'center', gap:'6px', borderRight:`2px solid ${theme.border}`, paddingRight:'12px' }}>
            <span style={{ fontSize:'11px', color:theme.textMuted }}>투명도</span>
            <input type="range" min="10" max="100" value={Math.round(currentOpacity*100)} onChange={(e) => setCurrentOpacity(Number(e.target.value)/100)} style={{ width:'60px' }} />
            <span style={{ fontSize:'11px', color:theme.textSubtle, minWidth:'28px' }}>{Math.round(currentOpacity*100)}%</span>
          </div>
          )}

          {/* 액션 버튼 */}
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            {isViewOnly ? (
              <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'4px 10px', backgroundColor:'#fef3c7', border:'1px solid #f59e0b', borderRadius:'8px', color:'#92400e', fontSize:'12px', fontWeight:'bold' }}>
                👁️ 읽기 전용
              </div>
            ) : (
              <>
                <button onClick={handleUndo} title="실행 취소 (Ctrl+Z)" style={iconBtn}><Undo2 size={22}/></button>
                <button onClick={handleRedo} title="다시 실행 (Ctrl+Y)" style={iconBtn}><Redo2 size={22}/></button>
                <button onClick={() => setShowGrid(v => !v)} title="그리드 토글" style={{ ...iconBtn, color: showGrid?'#3b82f6':'#9ca3af' }}><Grid2X2 size={22}/></button>
                <button onClick={() => setIsSnapEnabled(v => !v)} title="그리드 스냅 ON/OFF" style={{ ...iconBtn, color: isSnapEnabled?'#3b82f6':'#9ca3af' }}><Magnet size={22}/></button>
                <button onClick={handleDownloadPNG} title="PNG 저장" style={iconBtn}><Download size={22}/></button>
                <button onClick={handleExportJSON} title="JSON 내보내기" style={iconBtn}><FileJson size={22}/></button>
                <button onClick={() => importInputRef.current?.click()} title="JSON 가져오기" style={iconBtn}><Upload size={22}/></button>
                <button onClick={() => imageInputRef.current?.click()} title="이미지 삽입" style={iconBtn}><ImageIcon size={22}/></button>
                <button onClick={handleClearAll} title="전체 지우기" style={{ ...iconBtn, color:'#ef4444' }}><Trash2 size={22}/></button>
              </>
            )}
            <button onClick={() => setShowHelp(v => !v)} title="단축키 도움말 (?)" style={iconBtn}><HelpCircle size={22}/></button>
            <button onClick={() => setIsDarkMode(v => !v)} title={isDarkMode ? '라이트 모드' : '다크 모드'} style={{ ...iconBtn, color: isDarkMode ? '#f59e0b' : '#6b7280' }}>
              {isDarkMode ? <Sun size={22}/> : <Moon size={22}/>}
            </button>
          </div>

          <input ref={importInputRef} type="file" accept=".json" onChange={handleImportJSON} style={{ display:'none' }} />
          <input ref={imageInputRef} type="file" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]); e.target.value=''; }} style={{ display:'none' }} />
        </div>
      </div>

      {/* 줌 인디케이터 */}
      <div style={{ position:'absolute', bottom:'20px', left:'50%', transform:'translateX(-50%)', zIndex:10, display:'flex', alignItems:'center', gap:'8px', padding:'6px 14px', backgroundColor: theme.panel, borderRadius:'20px', boxShadow: theme.shadow, fontSize:'13px', color: theme.textMuted }}>
        <button onClick={() => { const ns = Math.max(stageScale/1.2, 0.05); setStageScale(ns); }} title="축소" style={{ ...iconBtn, padding:'0' }}><ZoomOut size={16}/></button>
        <span style={{ minWidth:'44px', textAlign:'center', fontWeight:'bold', color: theme.text }}>{Math.round(stageScale*100)}%</span>
        <button onClick={() => { const ns = Math.min(stageScale*1.2, 10); setStageScale(ns); }} title="확대" style={{ ...iconBtn, padding:'0' }}><ZoomIn size={16}/></button>
        <span style={{ width:'1px', height:'14px', backgroundColor: theme.border }} />
        <button onClick={() => { setStageScale(1); setStagePos({x:0,y:0}); }} title="리셋 (Ctrl+0)" style={{ ...iconBtn, fontSize:'11px', padding:'0' }}>100%</button>
        <span style={{ width:'1px', height:'14px', backgroundColor: theme.border }} />
        <button onClick={handleZoomToFit} title="전체 요소 보기 (F)" style={{ ...iconBtn, padding:'0' }}><Maximize2 size={16}/></button>
      </div>

      {/* 레이어 관리 패널 (선택 시) */}
      {selectedIndices.size > 0 && (
        <div style={{ position:'absolute', bottom:'70px', left:'50%', transform:'translateX(-50%)', zIndex:10, display:'flex', gap:'4px', padding:'8px 14px', backgroundColor: theme.panel, borderRadius:'12px', boxShadow: theme.shadow, alignItems:'center' }}>
          {selectedIndices.size === 1 && (
            <>
              <span style={{ fontSize:'11px', color: theme.textSubtle, marginRight:'6px' }}>레이어</span>
              <button onClick={sendToBack} title="맨 뒤로" style={layerBtn(singleIdx===0)}><ChevronsDown size={18}/></button>
              <button onClick={moveBackward} title="뒤로" style={layerBtn(singleIdx===0)}><ChevronDown size={18}/></button>
              <button onClick={moveForward} title="앞으로" style={layerBtn(singleIdx===elements.length-1)}><ChevronUp size={18}/></button>
              <button onClick={bringToFront} title="맨 앞으로" style={layerBtn(singleIdx===elements.length-1)}><ChevronsUp size={18}/></button>
              <button onClick={copySelected} title="복사 (Ctrl+C)" style={{ ...layerBtn(), marginLeft:'4px' }}><Copy size={18}/></button>
              <span style={{ width:'1px', height:'20px', backgroundColor: theme.border, margin:'0 4px' }} />
            </>
          )}
          {selectedIndices.size >= 2 && (
            <>
              <span style={{ fontSize:'11px', color: theme.textSubtle, marginRight:'4px' }}>정렬</span>
              <button onClick={() => alignElements('left')} title="왼쪽 정렬" style={layerBtn()}><AlignLeft size={18}/></button>
              <button onClick={() => alignElements('centerH')} title="가운데(수평) 정렬" style={layerBtn()}><AlignCenter size={18}/></button>
              <button onClick={() => alignElements('right')} title="오른쪽 정렬" style={layerBtn()}><AlignRight size={18}/></button>
              <button onClick={() => alignElements('top')} title="위 정렬" style={layerBtn()}><AlignStartVertical size={18}/></button>
              <button onClick={() => alignElements('middleV')} title="중간(수직) 정렬" style={layerBtn()}><AlignCenterVertical size={18}/></button>
              <button onClick={() => alignElements('bottom')} title="아래 정렬" style={layerBtn()}><AlignEndVertical size={18}/></button>
              <span style={{ width:'1px', height:'20px', backgroundColor: theme.border, margin:'0 4px' }} />
            </>
          )}
          <span style={{ fontSize:'11px', color: theme.textSubtle, marginRight:'4px' }}>
            {selectedIndices.size}개 선택
          </span>
          <button
            onClick={toggleLock}
            title={[...selectedIndices].every(i => elements[i]?.locked) ? '잠금 해제' : '잠금'}
            style={{ ...layerBtn(), color: [...selectedIndices].every(i => elements[i]?.locked) ? '#f59e0b' : '#6b7280' }}
          >
            {[...selectedIndices].every(i => elements[i]?.locked) ? <Unlock size={18}/> : <Lock size={18}/>}
          </button>
          <button onClick={deleteSelected} title="삭제 (Del)" style={{ ...layerBtn(), color:'#ef4444' }}><Trash2 size={18}/></button>
        </div>
      )}

      {/* 접속자 목록 */}
      <div style={{ position:'absolute', top:'20px', right:'20px', zIndex:10, backgroundColor: theme.panel, padding:'14px', borderRadius:'12px', boxShadow: theme.shadow, width:'170px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px', fontSize:'14px', fontWeight:'bold', color: theme.text }}>
          <Users size={18}/> 온라인 ({users.length})
        </div>
        {users.map((u) => {
          const isMe = u.nickname === nickname;
          const isFollowing = followingUserId === u.id;
          return (
            <div key={u.id} style={{ fontSize:'13px', color: theme.textMuted, display:'flex', alignItems:'center', gap:'5px', marginBottom:'4px' }}>
              <div style={{ width:'6px', height:'6px', borderRadius:'50%', backgroundColor:'#22c55e', flexShrink:0 }}/>
              <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.nickname}</span>
              {!isMe && (
                <button
                  onClick={() => setFollowingUserId(isFollowing ? null : u.id)}
                  title={isFollowing ? '팔로우 중지' : '화면 따라가기'}
                  style={{ background:'none', border:'none', cursor:'pointer', padding:'1px 2px', fontSize:'13px', color: isFollowing ? '#3b82f6' : theme.textSubtle, borderRadius:'3px' }}
                >
                  {isFollowing ? '👁️' : '👁'}
                </button>
              )}
            </div>
          );
        })}
        {followingUserId && (
          <div style={{ marginTop:'6px', padding:'4px 6px', backgroundColor:'#eff6ff', borderRadius:'6px', fontSize:'11px', color:'#3b82f6', fontWeight:'bold' }}>
            📺 화면 따라가는 중
          </div>
        )}
      </div>

      {/* 채팅창 */}
      <div style={{ position:'absolute', bottom:'20px', right:'20px', zIndex:10, width:'280px', backgroundColor: theme.panel, borderRadius:'12px', boxShadow: theme.shadow, display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'12px', borderBottom:isChatOpen?`1px solid ${theme.border}`:'none', fontWeight:'bold', display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', color: theme.text }} onClick={() => setIsChatOpen(v => !v)}>
          <MessageSquare size={18}/>
          <span style={{ flex:1 }}>채팅 {messages.length>0 && !isChatOpen && <span style={{ fontSize:'11px', backgroundColor:'#3b82f6', color:'white', borderRadius:'10px', padding:'1px 6px' }}>{messages.length}</span>}</span>
          <ChevronDown size={16} style={{ color: theme.textSubtle, transform:isChatOpen?'rotate(0deg)':'rotate(-90deg)', transition:'transform 0.2s' }}/>
        </div>
        {isChatOpen && (
          <>
            <div style={{ height:'240px', padding:'10px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'8px' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ alignSelf:msg.sender===nickname?'flex-end':'flex-start', maxWidth:'85%' }}>
                  <div style={{ fontSize:'10px', color: theme.textSubtle, textAlign:msg.sender===nickname?'right':'left' }}>{msg.sender}</div>
                  <div style={{ padding:'6px 10px', borderRadius:'10px', fontSize:'13px', backgroundColor:msg.sender===nickname ? theme.chatBubbleSelf : theme.chatBubbleOther, color:msg.sender===nickname?'white': theme.chatTextOther }}>{msg.text}</div>
                </div>
              ))}
              <div ref={chatEndRef}/>
            </div>
            {typingUsers.length > 0 && (
              <div style={{ padding:'4px 12px', fontSize:'11px', color: theme.textSubtle, fontStyle:'italic' }}>
                {typingUsers.join(', ')}이(가) 입력 중...
              </div>
            )}
            <div style={{ padding:'10px', borderTop:`1px solid ${theme.border}`, display:'flex', gap:'5px' }}>
              <input type="text" value={inputText} onChange={(e) => {
                setInputText(e.target.value);
                socket.emit('typing', nickname);
                if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
                typingTimerRef.current = setTimeout(() => socket.emit('stop_typing', nickname), 1500);
              }} onKeyDown={(e) => e.key==='Enter' && handleSendMessage()} placeholder="메시지..."
                style={{ flex:1, padding:'6px', borderRadius:'4px', border:`1px solid ${theme.inputBorder}`, fontSize:'13px', backgroundColor: theme.inputBg, color: theme.text }} />
              <button onClick={handleSendMessage} style={{ padding:'6px', backgroundColor:'#3b82f6', color:'white', border:'none', borderRadius:'4px', cursor:'pointer' }}><Send size={16}/></button>
            </div>
          </>
        )}
      </div>

      {/* 다른 사용자 커서 (캔버스 → 화면 좌표 변환) */}
      {Object.entries(cursors).map(([id, cur]) => {
        const sc = canvasToScreen(cur.x, cur.y);
        return (
          <div key={id} style={{ position:'absolute', left:sc.x, top:sc.y, zIndex:15, pointerEvents:'none', transform:'translate(-4px,-4px)' }}>
            <div style={{ width:'12px', height:'12px', borderRadius:'50%', backgroundColor:getCursorColor(id), border:'2px solid white', boxShadow:'0 0 4px rgba(0,0,0,0.3)' }}/>
            <div style={{ position:'absolute', top:'14px', left:'8px', fontSize:'11px', fontWeight:'bold', color:'white', backgroundColor:getCursorColor(id), padding:'1px 6px', borderRadius:'4px', whiteSpace:'nowrap', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}>
              {cur.nickname}
            </div>
          </div>
        );
      })}

      {/* 텍스트 입력 오버레이 */}
      {textInput && textAreaScreen && (
        <textarea ref={textareaRef} value={textInput.value} autoFocus
          onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
          onKeyDown={(e) => {
            if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); commitText(); }
            if (e.key==='Escape') setTextInput(null);
          }}
          placeholder={textInput.targetIdx !== undefined ? '스티커 텍스트...' : '텍스트 입력 후 Enter'}
          style={{
            position:'absolute', left:textAreaScreen.x, top:textAreaScreen.y, zIndex:20,
            background:'transparent', border:'1px dashed #3b82f6', outline:'none',
            resize:'none', overflow:'hidden', minWidth:'120px',
            minHeight:`${(textInput.targetIdx !== undefined && elements[textInput.targetIdx]?.tool === 'text' ? (elements[textInput.targetIdx].fontSize ?? 20) : Math.max(12,strokeWidth*3))*stageScale+10}px`,
            fontSize:`${(textInput.targetIdx !== undefined && elements[textInput.targetIdx]?.tool === 'text' ? (elements[textInput.targetIdx].fontSize ?? 20) : Math.max(12,strokeWidth*3))*stageScale}px`,
            fontFamily:'sans-serif', color:currentColor, lineHeight:'1.4',
            padding:'2px 4px', caretColor:currentColor,
          }} rows={1}/>
      )}

      {/* 이모지 반응 오버레이 */}
      {emojiReactions.map((r) => {
        const sc = canvasToScreen(r.x, r.y);
        return (
          <div key={r.id} style={{ position:'absolute', left:sc.x, top:sc.y, zIndex:30, pointerEvents:'none', transform:'translate(-50%,-50%)', textAlign:'center' }}>
            <div style={{ fontSize:'32px', animation:'emojiPop 1.8s ease forwards', display:'inline-block' }}>{r.emoji}</div>
            <div style={{ fontSize:'10px', color: theme.textMuted, backgroundColor: theme.panel, padding:'1px 5px', borderRadius:'6px', whiteSpace:'nowrap', animation:'emojiPop 1.8s ease forwards' }}>{r.nickname}</div>
          </div>
        );
      })}

      {/* 토스트 알림 */}
      <div style={{ position:'fixed', bottom:'80px', left:'20px', zIndex:200, display:'flex', flexDirection:'column', gap:'8px', pointerEvents:'none' }}>
        {toasts.map(toast => (
          <div key={toast.id} style={{
            padding:'10px 16px', borderRadius:'8px', fontSize:'13px', fontWeight:'500',
            backgroundColor: toast.type === 'join' ? '#22c55e' : toast.type === 'leave' ? '#ef4444' : '#3b82f6',
            color:'white', boxShadow:'0 4px 12px rgba(0,0,0,0.2)',
            animation:'slideIn 0.3s ease',
          }}>
            {toast.type === 'join' ? '🟢' : toast.type === 'leave' ? '🔴' : 'ℹ️'} {toast.message}
          </div>
        ))}
      </div>

      {/* 단축키 도움말 모달 */}
      {showHelp && (
        <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setShowHelp(false)}>
          <div style={{ backgroundColor: theme.panel, borderRadius:'12px', padding:'28px', maxWidth:'480px', width:'90%', maxHeight:'80vh', overflowY:'auto' }}
            onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin:'0 0 16px', fontSize:'18px', color: theme.text }}>⌨️ 키보드 단축키</h2>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <tbody>
                {SHORTCUTS.map(([key, desc]) => (
                  <tr key={key} style={{ borderBottom:`1px solid ${theme.border}` }}>
                    <td style={{ padding:'7px 0', width:'160px' }}>
                      <code style={{ backgroundColor: isDarkMode ? '#374151' : '#f3f4f6', padding:'2px 8px', borderRadius:'4px', fontSize:'13px', color: theme.text }}>{key}</code>
                    </td>
                    <td style={{ padding:'7px 0', fontSize:'14px', color: theme.textMuted }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setShowHelp(false)} style={{ marginTop:'16px', padding:'8px 20px', backgroundColor:'#3b82f6', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', width:'100%' }}>닫기</button>
          </div>
        </div>
      )}

      {/* 캔버스 */}
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDblClick={handleDblClick}
        style={{ cursor: getCursor() }}
      >
        <Layer>
          {elements.map(renderElement)}
          {/* 선택 박스 오버레이 */}
          {selectionRects}
          {/* 박스 선택 중 영역 표시 */}
          {boxSelectRect && (
            <Rect
              x={Math.min(boxSelectRect.x, boxSelectRect.x + boxSelectRect.width)}
              y={Math.min(boxSelectRect.y, boxSelectRect.y + boxSelectRect.height)}
              width={Math.abs(boxSelectRect.width)}
              height={Math.abs(boxSelectRect.height)}
              fill="rgba(59,130,246,0.08)" stroke="#3b82f6"
              strokeWidth={1/stageScale} dash={[4/stageScale, 2/stageScale]}
              listening={false}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
}
