// Board component
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Stage, Layer, Rect, Image as KonvaImage, Line as KonvaLine, Circle as KonvaCircle, Arrow as KonvaArrow } from 'react-konva';
import Konva from 'konva';
import QRCode from 'qrcode';
import katex from 'katex';
import {
  Users, ChevronDown,
  ChevronsUp, ChevronUp, ChevronsDown, ZoomIn, ZoomOut, Copy,
  AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  Lock, Unlock, Maximize2,
  Group as GroupIcon, Ungroup as UngroupIcon,
  Trash2,
} from 'lucide-react';
import { io } from 'socket.io-client';
import { jsPDF } from 'jspdf';
import type { DrawElement, Bounds } from '../utils/elementHelpers';
import {
  generateId, getElementBounds, moveElementBy,
} from '../utils/elementHelpers';
import type { ResizeHandle } from '../utils/elementHelpers';
import { useHistory } from '../hooks/useHistory';
import { useSocketEvents } from '../hooks/useSocketEvents';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useBoardUI } from '../hooks/useBoardUI';
import { useViewport } from '../hooks/useViewport';
import { useCanvasEvents } from '../hooks/useCanvasEvents';
import { renderElement, renderMindmapNode, renderFormulaElement } from '../utils/renderElement';
import LoginScreen from './LoginScreen';
import HelpModal from './HelpModal';
import Toolbar from './Toolbar';
import Minimap from './Minimap';
import ChatPanel from './ChatPanel';
import LayerPanel from './LayerPanel';
import TimelinePlayer, { type TimelineEvent } from './TimelinePlayer';
import FramePanel from './FramePanel';
import VoiceChat from './VoiceChat';
import ShapeLibrary from './ShapeLibrary';
import PresentationMode from './PresentationMode';
import SearchPanel from './SearchPanel';
import TemplateGallery from './TemplateGallery';
import ShortcutSettings from './ShortcutSettings';
import HistoryDiffPanel from './HistoryDiffPanel';

const socket = io('http://localhost:3001');

// ── 인터페이스 ─────────────────────────────────────────────────────────────

interface CursorData { x: number; y: number; nickname: string; }
interface TextInputState { x: number; y: number; value: string; targetIdx?: number; width?: number; height?: number; }
interface ChatMessage { text: string; sender: string; time: string; }
interface UserInfo { id: string; nickname: string; }
interface EmojiReaction { id: string; x: number; y: number; emoji: string; nickname: string; }
interface UserViewport { scale: number; x: number; y: number; nickname: string; }

// ── 상수 ──────────────────────────────────────────────────────────────────

const CURSOR_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

const getCursorColor = (id: string) => {
  const hash = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
};

const RESIZABLE_TOOLS = ['rect', 'circle', 'triangle', 'sticky', 'textbox', 'shape', 'frame', 'arrow', 'straight', 'image', 'pen', 'eraser', 'table', 'mindmap', 'formula'];
const RESIZE_CURSORS: Record<string, string> = {
  'resize-nw': 'nwse-resize', 'resize-ne': 'nesw-resize',
  'resize-se': 'nwse-resize', 'resize-sw': 'nesw-resize',
  'resize-n': 'ns-resize', 'resize-s': 'ns-resize',
  'resize-e': 'ew-resize', 'resize-w': 'ew-resize',
};

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function Board() {
  // ── UI 상태 훅 ──
  const {
    tool, setTool, toolRef,
    currentColor, recentColors, selectColor,
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
    isSmoothing, setIsSmoothing, isSmoothingRef,
    isSmartShape, setIsSmartShape, isSmartShapeRef,
    brushType, setBrushType,
    isEmojiMode, setIsEmojiMode,
    selectedEmoji, setSelectedEmoji,
    showEmojiPicker, setShowEmojiPicker,
    showGrid, setShowGrid,
    isChatOpen, setIsChatOpen,
    isSnapEnabled, setIsSnapEnabled, isSnapEnabledRef,
    showHelp, setShowHelp, showHelpRef,
    isDragOver, setIsDragOver,
    isDarkMode, setIsDarkMode,
    showShapeLibrary, setShowShapeLibrary,
    isLaserMode, setIsLaserMode,
    setBgImageUrl,
    isPresentingMode, setIsPresentingMode,
    showQRCode, setShowQRCode,
    toasts, showToast,
    theme,
  } = useBoardUI();

  // ── 뷰포트 훅 ──
  const {
    stageScale, setStageScale,
    stagePos, setStagePos,
    isSpaceHeld, setIsSpaceHeld,
    stageSize, setStageSize,
    stagePosRef, stageScaleRef, spaceHeldRef,
    lastViewportEmit, lastCursorEmit,
    getCanvasPos, canvasToScreen, screenToCanvas,
  } = useViewport();

  // ── 세션 상태 ──
  const [isJoined, setIsJoined] = useState(false);
  const [nickname, setNickname] = useState('');
  const [roomId, setRoomId] = useState(() => new URLSearchParams(window.location.search).get('room') || 'main');
  const [isViewOnly, setIsViewOnly] = useState(false);

  // ── 권한 / 방장 ──
  const [hostId, setHostId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, 'edit' | 'view'>>({});

  // ── 레이어 패널 ──
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [hiddenIndices, setHiddenIndices] = useState<Set<number>>(new Set());

  // ── 프레임 패널 ──
  const [showFramePanel, setShowFramePanel] = useState(false);
  const [currentFrameId, setCurrentFrameId] = useState<string | null>(null);

  // ── 타임라인 ──
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);

  // ── 캔버스 데이터 ──
  const [elements, setElements] = useState<DrawElement[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [boxSelectRect, setBoxSelectRect] = useState<Bounds | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState<TextInputState | null>(null);
  const [, setImageLoadTick] = useState(0);

  // ── 새 상태 ──
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveIndicatorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [snapLines, setSnapLines] = useState<{ type: 'x' | 'y'; pos: number }[]>([]);
  const [tableCellEdit, setTableCellEdit] = useState<{ idx: number; row: number; col: number; value: string } | null>(null);

  // ── Feature 8: Zoom slider (uses stageScale from viewport hook) ──

  // ── Feature 9: Template Gallery ──
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);

  // ── Feature 10: Shortcut Settings ──
  const [showShortcutSettings, setShowShortcutSettings] = useState(false);
  const [customShortcuts, setCustomShortcuts] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('whiteboard-shortcuts');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  // ── Feature 11: Bulk Color Change ──
  const [bulkColor, setBulkColor] = useState('#000000');

  // ── Feature 12: Timer Widget ──
  const [showTimer, setShowTimer] = useState(false);
  const [timerState, setTimerState] = useState({
    mode: 'down' as 'up' | 'down',
    seconds: 0,
    targetSeconds: 300,
    isRunning: false,
  });
  const timerDragStart = useRef<{ mx: number; my: number; sx: number; sy: number } | null>(null);
  const [timerPosState, setTimerPosState] = useState({ x: 20, y: 200 });

  // ── Feature 5: Cursor DM ──
  const [dmTarget, setDmTarget] = useState<{ userId: string; nickname: string } | null>(null);
  const [dmInput, setDmInput] = useState('');
  const [dmToastList, setDmToastList] = useState<{ id: string; from: string; text: string }[]>([]);

  // ── Feature 6: Edit Indicators ──
  const [editingIndicators, setEditingIndicators] = useState<Record<string, { nickname: string; color: string }>>({});

  // ── Feature 1: Image Crop Mode ──
  const [isCropMode, setIsCropMode] = useState(false);
  const cropHandleRef = useRef<string | null>(null);
  const cropOriginRef = useRef<{ startPos: { x: number; y: number }; origEl: DrawElement } | null>(null);

  // ── Feature 7: History Diff ──
  const [showHistoryDiff, setShowHistoryDiff] = useState(false);

  // ── Formula cache ──
  const formulaCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // ── 협업 상태 ──
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);
  const [, setUserViewports] = useState<Record<string, UserViewport>>({});
  const [emojiReactions, setEmojiReactions] = useState<EmojiReaction[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [cursors, setCursors] = useState<Record<string, CursorData>>({});
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  // ── Refs ──
  const isDrawing = useRef(false);
  const stageRef = useRef<Konva.Stage>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingSelected = useRef(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const dragOriginals = useRef<{ idx: number; el: DrawElement }[]>([]);
  const isBoxSelecting = useRef(false);
  const boxSelectStart = useRef<{ x: number; y: number } | null>(null);
  const isPanning = useRef(false);
  const panStart = useRef<{ mx: number; my: number; sx: number; sy: number } | null>(null);
  const clipboard = useRef<DrawElement | null>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const elementsRef = useRef<DrawElement[]>([]);
  const selectedIndicesRef = useRef<Set<number>>(new Set());
  const followingUserRef = useRef<string | null>(null);
  // 신규 refs (베지어/커넥터/속도 감응/레이저)
  const lastPenTime = useRef<number>(0);
  const bezierPhase = useRef<number>(0);
  const bezierAnchor = useRef<number[]>([]);
  const connectorPhase = useRef<number>(0);
  const connectorFirst = useRef<{ id: string; x: number; y: number } | null>(null);
  // 신규 state
  const [lasers, setLasers] = useState<Record<string, { x: number; y: number; ts: number; nickname: string }>>({});
  const [bgKonvaImage, setBgKonvaImage] = useState<HTMLImageElement | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // ── 리사이즈 refs ──
  const isResizingRef = useRef(false);
  const resizeHandleRef = useRef<ResizeHandle | null>(null);
  const resizeOriginalRef = useRef<{ el: DrawElement; bounds: Bounds; idx: number; startPos: { x: number; y: number } } | null>(null);

  // ── 회전 refs ──
  const isRotatingRef = useRef(false);
  const rotateOriginRef = useRef<{ cx: number; cy: number; startAngle: number; origRotation: number; idx: number } | null>(null);

  // ── 다중 리사이즈 refs ──
  const isMultiResizingRef = useRef(false);
  const multiResizeHandleRef = useRef<ResizeHandle | null>(null);
  const multiResizeOriginRef = useRef<{ unionBounds: Bounds; origElements: { idx: number; el: DrawElement }[]; startPos: { x: number; y: number } } | null>(null);

  // ── 히스토리 훅 ──
  const { saveHistoryWith, handleUndo, handleRedo, historyRef, historyStepRef } = useHistory(
    setElements, setSelectedIndices, socket,
  );

  // Ref 동기화
  elementsRef.current = elements;
  selectedIndicesRef.current = selectedIndices;
  followingUserRef.current = followingUserId;

  // ── 선택 관련 ──
  const deleteSelected = () => {
    const idxSet = selectedIndicesRef.current;
    if (idxSet.size === 0) return;
    const updated = elementsRef.current.filter((el, i) => !idxSet.has(i) || el.locked);
    setElements(updated);
    setSelectedIndices(new Set());
    saveHistoryWith(updated);
    socket.emit('draw_line', updated); // 다중 삭제는 전체 동기화로 처리
  };

  const copySelected = () => {
    if (selectedIndicesRef.current.size !== 1) return;
    const idx = [...selectedIndicesRef.current][0];
    clipboard.current = { ...elementsRef.current[idx], points: [...elementsRef.current[idx].points] };
  };

  const pasteClipboard = () => {
    if (!clipboard.current) return;
    const pasted = { ...clipboard.current, id: generateId(), points: clipboard.current.points.map((p) => p + 20) };
    const updated = [...elementsRef.current, pasted];
    setElements(updated);
    setSelectedIndices(new Set([updated.length - 1]));
    saveHistoryWith(updated);
    socket.emit('update_element', pasted);
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

  // ── 그룹화 / 해제 ──
  const handleGroup = () => {
    const idxs = [...selectedIndicesRef.current];
    if (idxs.length < 2) return;
    const newGroupId = generateId();
    const upd = elementsRef.current.map((el, i) =>
      selectedIndicesRef.current.has(i) ? { ...el, groupId: newGroupId } : el
    );
    setElements(upd); saveHistoryWith(upd); socket.emit('draw_line', upd);
    showToast(`${idxs.length}개 요소가 그룹화되었습니다`);
  };

  const handleUngroup = () => {
    const idxs = [...selectedIndicesRef.current];
    if (idxs.length === 0) return;
    const groupIds = new Set(idxs.map(i => elementsRef.current[i]?.groupId).filter(Boolean));
    const upd = elementsRef.current.map((el) =>
      (el.groupId && groupIds.has(el.groupId)) ? { ...el, groupId: undefined } : el
    );
    setElements(upd); saveHistoryWith(upd); socket.emit('draw_line', upd);
    showToast('그룹이 해제되었습니다');
  };

  // ── 내보내기 / 가져오기 ──
  const handleDownloadPNG = useCallback(() => {
    if (!stageRef.current) return;
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
    const a = document.createElement('a');
    a.download = `whiteboard-${Date.now()}.png`;
    a.href = uri;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }, []);

  const handleExportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(elementsRef.current, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `whiteboard-${Date.now()}.json`; a.href = url;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

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
        saveHistoryWith(updated); 
        socket.emit('update_element', newEl);
        return updated;
      });
      setImageLoadTick((t) => t + 1);
    };
  };

  // 📌 API 기반 이미지 업로드 (Multer 연동)
  const handleImageFile = async (file: File, dropPos?: { x: number; y: number }) => {
    if (!file.type.startsWith('image/')) return;
    const pos = dropPos ?? screenToCanvas(stageSize.width / 2, stageSize.height / 2);
    
    const formData = new FormData();
    formData.append('image', file);

    try {
      showToast('이미지 업로드 중...', 'info');
      const res = await fetch('http://localhost:3001/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        insertImage(data.url, pos.x, pos.y);
      }
    } catch (err) {
      console.error(err);
      showToast('이미지 업로드에 실패했습니다.', 'leave');
    }
  };

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

  // ── 레이어 패널 핸들러 ──
  const handleLayerReorder = useCallback((from: number, to: number) => {
    const upd = [...elementsRef.current];
    const [el] = upd.splice(from, 1);
    upd.splice(to, 0, el);
    setElements(upd);
    saveHistoryWith(upd);
    socket.emit('draw_line', upd);
  }, [saveHistoryWith]);

  const handleLayerDelete = useCallback((idx: number) => {
    const upd = elementsRef.current.filter((_, i) => i !== idx);
    setElements(upd);
    setSelectedIndices(new Set());
    saveHistoryWith(upd);
    socket.emit('draw_line', upd);
  }, [saveHistoryWith]);

  const handleToggleLayerVisibility = useCallback((idx: number) => {
    setHiddenIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) { next.delete(idx); } else { next.add(idx); }
      return next;
    });
  }, []);

  const handleToggleLayerLock = useCallback((idx: number) => {
    const upd = elementsRef.current.map((el, i) =>
      i === idx ? { ...el, locked: !el.locked } : el
    );
    setElements(upd);
    saveHistoryWith(upd);
    socket.emit('draw_line', upd);
  }, [saveHistoryWith]);

  // ── 프레임 핸들러 ──
  const handleAddFrame = useCallback(() => {
    const cx = (stageSize.width / 2 - stagePos.x) / stageScale;
    const cy = (stageSize.height / 2 - stagePos.y) / stageScale;
    const w = 800, h = 600;
    const newEl: DrawElement = {
      id: generateId(), tool: 'frame',
      points: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2],
      color: '#6366f1', strokeWidth: 2,
      frameTitle: `Frame ${elementsRef.current.filter(e => e.tool === 'frame').length + 1}`,
    };
    setElements(prev => {
      const upd = [...prev, newEl];
      saveHistoryWith(upd);
      socket.emit('update_element', newEl);
      return upd;
    });
    setCurrentFrameId(newEl.id ?? null);
  }, [stageSize, stagePos, stageScale, saveHistoryWith]);

  const handleNavigateToFrame = useCallback((frame: DrawElement) => {
    if (frame.points.length < 4) return;
    setCurrentFrameId(frame.id ?? null);
    const x1 = Math.min(frame.points[0], frame.points[2]);
    const y1 = Math.min(frame.points[1], frame.points[3]);
    const fw = Math.abs(frame.points[2] - frame.points[0]);
    const fh = Math.abs(frame.points[3] - frame.points[1]);
    const pad = 40;
    const newScale = Math.min(
      (stageSize.width - pad * 2) / fw,
      (stageSize.height - pad * 2) / fh,
      4,
    );
    setStageScale(newScale);
    setStagePos({
      x: stageSize.width / 2 - (x1 + fw / 2) * newScale,
      y: stageSize.height / 2 - (y1 + fh / 2) * newScale,
    });
  }, [stageSize, setStagePos, setStageScale]);

  // ── PDF 내보내기 ──
  const handleExportPDF = useCallback(async () => {
    const frames = elementsRef.current.filter(el => el.tool === 'frame');
    if (!frames.length || !stageRef.current) { showToast('내보낼 프레임이 없습니다', 'info'); return; }

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      handleNavigateToFrame(frame);
      // 뷰포트 반영 대기
      await new Promise(r => setTimeout(r, 100));
      const dataUrl = stageRef.current!.toDataURL({ pixelRatio: 1.5 });
      if (i > 0) pdf.addPage();
      pdf.addImage(dataUrl, 'PNG', 0, 0, pageW, pageH);
    }

    pdf.save(`whiteboard-frames-${Date.now()}.pdf`);
    showToast(`${frames.length}개 프레임을 PDF로 저장했습니다`, 'info');
  }, [handleNavigateToFrame, showToast]);

  // ── 권한 핸들러 ──
  const handleSetPermission = useCallback((targetId: string, perm: 'edit' | 'view') => {
    socket.emit('set_permission', { targetId, permission: perm, room: roomId });
  }, [roomId]);

  // ── SVG 내보내기 ──
  const handleExportSVG = useCallback(() => {
    const els = elementsRef.current;
    const svgParts: string[] = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    els.forEach(el => {
      const b = getElementBounds(el);
      if (b) {
        minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width); maxY = Math.max(maxY, b.y + b.height);
      }
    });
    if (minX === Infinity) { minX = 0; minY = 0; maxX = 800; maxY = 600; }
    const pad = 20;
    const vw = maxX - minX + pad * 2, vh = maxY - minY + pad * 2;
    const ox = minX - pad, oy = minY - pad;

    els.forEach(el => {
      const c = el.color; const sw = el.strokeWidth; const op = el.opacity ?? 1;
      const fill = el.filled ? c : 'none';
      if (el.tool === 'rect' && el.points.length >= 4) {
        const x = Math.min(el.points[0], el.points[2]) - ox;
        const y = Math.min(el.points[1], el.points[3]) - oy;
        const w = Math.abs(el.points[2] - el.points[0]);
        const h = Math.abs(el.points[3] - el.points[1]);
        svgParts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${c}" stroke-width="${sw}" opacity="${op}"/>`);
      } else if (el.tool === 'circle' && el.points.length >= 4) {
        const cx = (el.points[0] + el.points[2]) / 2 - ox;
        const cy = (el.points[1] + el.points[3]) / 2 - oy;
        const rx = Math.abs(el.points[2] - el.points[0]) / 2;
        const ry = Math.abs(el.points[3] - el.points[1]) / 2;
        svgParts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${c}" stroke-width="${sw}" opacity="${op}"/>`);
      } else if ((el.tool === 'pen' || el.tool === 'straight' || el.tool === 'bezier') && el.points.length >= 4) {
        const pts = el.points;
        let d = `M ${pts[0]-ox} ${pts[1]-oy}`;
        for (let j = 2; j < pts.length - 1; j += 2) d += ` L ${pts[j]-ox} ${pts[j+1]-oy}`;
        svgParts.push(`<path d="${d}" fill="${fill}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`);
      } else if (el.tool === 'text' && el.text) {
        const x = el.points[0] - ox, y = el.points[1] - oy;
        const fs = el.fontStyle || 'normal';
        svgParts.push(`<text x="${x}" y="${y}" fill="${c}" font-size="${el.fontSize||20}" font-family="${el.fontFamily||'sans-serif'}" font-style="${fs.includes('italic')?'italic':'normal'}" font-weight="${fs.includes('bold')?'bold':'normal'}" opacity="${op}">${el.text}</text>`);
      } else if (el.tool === 'triangle' && el.points.length >= 4) {
        const [x1,y1,x2,y2] = el.points;
        const mid = (x1+x2)/2;
        svgParts.push(`<polygon points="${mid-ox},${y1-oy} ${x2-ox},${y2-oy} ${x1-ox},${y2-oy}" fill="${fill}" stroke="${c}" stroke-width="${sw}" opacity="${op}"/>`);
      } else if (el.tool === 'arrow' && el.points.length >= 4) {
        const [x1,y1,x2,y2] = el.points;
        svgParts.push(`<line x1="${x1-ox}" y1="${y1-oy}" x2="${x2-ox}" y2="${y2-oy}" stroke="${c}" stroke-width="${sw}" marker-end="url(#arrow)" opacity="${op}"/>`);
      }
    });

    const arrowDef = `<defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="${els.find(e=>e.tool==='arrow')?.color||'black'}"/></marker></defs>`;
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="0 0 ${vw} ${vh}">${arrowDef}${svgParts.join('\n')}</svg>`;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `whiteboard-${Date.now()}.svg`; a.href = url;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('SVG로 내보냈습니다', 'info');
  }, [showToast]);

  // ── QR 코드 생성 ──
  const handleShowQRCode = useCallback(async () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 200, margin: 2 });
      setQrDataUrl(dataUrl);
      setShowQRCode(true);
    } catch (e) { console.error(e); }
  }, [roomId, setShowQRCode]);

  // ── 배경 이미지 ──
  const handleBgImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setBgImageUrl(dataUrl);
      const img = new window.Image();
      img.src = dataUrl;
      img.onload = () => setBgKonvaImage(img);
    };
    reader.readAsDataURL(file);
  }, [setBgImageUrl]);

  // ── 레이저 포인터 emit (mouse move 시) ──
  const handleLaserMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isLaserMode) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = getCanvasPos(stage);
    if (!pos) return;
    socket.emit('laser_move', { x: pos.x, y: pos.y });
  }, [isLaserMode, getCanvasPos]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const snap = useCallback((v: number) => isSnapEnabledRef.current ? Math.round(v / 28) * 28 : v, []);

  // ── Effects ──
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

  useEffect(() => {
    const h = () => setStageSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isJoined) return;
    const now = Date.now();
    if (now - lastViewportEmit.current < 80) return;
    lastViewportEmit.current = now;
    socket.emit('viewport_update', { scale: stageScale, x: stagePos.x, y: stagePos.y });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageScale, stagePos, isJoined]);

  useEffect(() => {
    if (showTimeline) {
      socket.emit('request_timeline', { room: roomId });
    }
  }, [showTimeline, roomId]);

  // 레이저 포인터 비활성화 시 알림
  useEffect(() => {
    if (!isLaserMode) {
      socket.emit('laser_stop');
    }
  }, [isLaserMode]);

  // 레이저 점 자동 만료 (2초)
  useEffect(() => {
    if (Object.keys(lasers).length === 0) return;
    const t = setInterval(() => {
      const now = Date.now();
      setLasers(prev => {
        const filtered: typeof prev = {};
        for (const [id, l] of Object.entries(prev)) {
          if (now - l.ts < 2000) filtered[id] = l;
        }
        return filtered;
      });
    }, 500);
    return () => clearInterval(t);
  }, [lasers]);

  useEffect(() => {
    const up = () => {
      if (isPanning.current) {
        isPanning.current = false; panStart.current = null; return;
      }
      if (isDraggingSelected.current) {
        isDraggingSelected.current = false; dragStartPos.current = null; dragOriginals.current = [];
        const cur = elementsRef.current;
        saveHistoryWith(cur);
        socket.emit('draw_line', cur); // 드래그 종료 시 전체 동기화로 묶어줌
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
    const upAll = (e: MouseEvent) => { if (e.button === 1 && isPanning.current) { isPanning.current = false; panStart.current = null; } };
    window.addEventListener('mouseup', up);
    window.addEventListener('mouseup', upAll);
    return () => { window.removeEventListener('mouseup', up); window.removeEventListener('mouseup', upAll); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 자동 저장 인디케이터 ──
  useEffect(() => {
    if (elements.length === 0) return;
    setSaveState('saving');
    if (saveIndicatorTimer.current) clearTimeout(saveIndicatorTimer.current);
    saveIndicatorTimer.current = setTimeout(() => {
      setSaveState('saved');
      saveIndicatorTimer.current = setTimeout(() => setSaveState('idle'), 3000);
    }, 2000);
  }, [elements]);

  // ── 클립보드 이미지 붙여넣기 ──
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!isJoined || isViewOnly) return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            if (!dataUrl) return;
            const img = new window.Image();
            img.src = dataUrl;
            img.onload = () => {
              imageCache.current.set(dataUrl, img);
              const center = screenToCanvas(stageSize.width / 2, stageSize.height / 2);
              const w = Math.min(img.naturalWidth, 600);
              const h = (img.naturalHeight / img.naturalWidth) * w;
              const newEl: DrawElement = {
                id: generateId(), tool: 'image',
                points: [center.x - w / 2, center.y - h / 2, w, h],
                color: 'transparent', strokeWidth: 0,
                imageDataUrl: dataUrl, opacity: currentOpacity,
              };
              setElements(prev => {
                const updated = [...prev, newEl];
                saveHistoryWith(updated);
                socket.emit('update_element', newEl);
                return updated;
              });
              setImageLoadTick(t => t + 1);
              showToast('이미지가 붙여넣어졌습니다', 'info');
            };
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
   
  }, [isJoined, isViewOnly, currentOpacity, screenToCanvas, stageSize, saveHistoryWith, showToast]);

  // ── Ctrl+F 검색 단축키 ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useKeyboardShortcuts({
    socket, elementsRef, selectedIndicesRef, showHelpRef, clipboard,
    setElements, setSelectedIndices, setTool, setShowHelp,
    setStageScale, setStagePos,
    handleUndo, handleRedo, handleZoomToFit, handleGroup, handleUngroup,
    saveHistoryWith,
    customShortcuts,
  });

  useSocketEvents({
    socket, setElements, setSelectedIndices,
    setUsers, setMessages, setCursors,
    setUserViewports, setFollowingUserId,
    setTypingUsers, setStageScale, setStagePos,
    setEmojiReactions, showToast,
    followingUserRef, historyRef, historyStepRef,
    setHostId, setPermissions, setTimelineEvents,
    setLasers,
    onPresentingFrame: (frameId) => {
      const frame = elementsRef.current.find(el => el.id === frameId && el.tool === 'frame');
      if (frame) handleNavigateToFrame(frame);
    },
  });

  // ── Feature 5: DM 수신 ──
  useEffect(() => {
    const onDM = (data: { from: string; text: string }) => {
      const id = generateId();
      setDmToastList(prev => [...prev, { id, from: data.from, text: data.text }]);
      setTimeout(() => setDmToastList(prev => prev.filter(t => t.id !== id)), 5000);
    };
    socket.on('receive_dm', onDM);
    return () => { socket.off('receive_dm', onDM); };
  }, []);

  // ── Feature 6: 편집 중 표시 ──
  useEffect(() => {
    const onStart = (data: { elementId: string; nickname: string; color: string }) => {
      setEditingIndicators(prev => ({ ...prev, [data.elementId]: { nickname: data.nickname, color: data.color } }));
    };
    const onStop = (data: { elementId: string }) => {
      setEditingIndicators(prev => { const next = { ...prev }; delete next[data.elementId]; return next; });
    };
    socket.on('element_editing', onStart);
    socket.on('element_edit_stop', onStop);
    return () => { socket.off('element_editing', onStart); socket.off('element_edit_stop', onStop); };
  }, []);

  // ── Feature 12: Timer sync ──
  useEffect(() => {
    const onSync = (state: typeof timerState) => setTimerState(state);
    socket.on('timer_sync', onSync);
    return () => { socket.off('timer_sync', onSync); };
  }, []);

  // ── Feature 12: Timer interval ──
  useEffect(() => {
    if (!timerState.isRunning) return;
    const id = setInterval(() => {
      setTimerState(prev => {
        if (!prev.isRunning) return prev;
        if (prev.mode === 'up') {
          return { ...prev, seconds: prev.seconds + 1 };
        } else {
          if (prev.seconds <= 0) {
            clearInterval(id);
            showToast('⏰ 타이머 종료!', 'info');
            return { ...prev, seconds: 0, isRunning: false };
          }
          return { ...prev, seconds: prev.seconds - 1 };
        }
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerState.isRunning, timerState.mode, showToast]);

  // ── Formula rendering ──
  const renderFormulaToImage = useCallback(async (latex: string): Promise<HTMLImageElement> => {
    const html = katex.renderToString(latex, { throwOnError: false, displayMode: true });
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><foreignObject width="300" height="100"><div xmlns="http://www.w3.org/1999/xhtml" style="padding:8px;background:white;">${html}</div></foreignObject></svg>`;
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    return new Promise(resolve => {
      const img = new window.Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.src = url;
    });
  }, []);

  useEffect(() => {
    const formulaEls = elements.filter(el => el.tool === 'formula' && el.formulaLatex && !formulaCache.current.has(el.formulaLatex));
    formulaEls.forEach(async (el) => {
      if (!el.formulaLatex) return;
      const img = await renderFormulaToImage(el.formulaLatex);
      formulaCache.current.set(el.formulaLatex, img);
      setImageLoadTick(t => t + 1);
    });
  }, [elements, renderFormulaToImage]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

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
      const newScale = e.deltaY < 0 ? Math.min(oldScale * scaleBy, 10) : Math.max(oldScale / scaleBy, 0.05);
      const origin = {
        x: (pointer.x - stagePosRef.current.x) / oldScale,
        y: (pointer.y - stagePosRef.current.y) / oldScale,
      };
      setStageScale(newScale);
      setStagePos({ x: pointer.x - origin.x * newScale, y: pointer.y - origin.y * newScale });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJoined]);

  // ── Feature 4: Touch / Pinch-to-Zoom ──
  const lastTouchDist = useRef(0);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);
  const touchPanStart = useRef<{ mx: number; my: number; sx: number; sy: number } | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      const t0 = e.touches[0], t1 = e.touches[1];
      lastTouchDist.current = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      lastTouchCenter.current = { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
      touchPanStart.current = null;
    } else if (e.touches.length === 1) {
      touchPanStart.current = { mx: e.touches[0].clientX, my: e.touches[0].clientY, sx: stagePosRef.current.x, sy: stagePosRef.current.y };
      lastTouchDist.current = 0;
      lastTouchCenter.current = null;
    }
  }, [stagePosRef]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const center = { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
      if (lastTouchDist.current > 0) {
        const scaleFactor = dist / lastTouchDist.current;
        const oldScale = stageScaleRef.current;
        const newScale = Math.max(0.05, Math.min(10, oldScale * scaleFactor));
        const origin = { x: (center.x - stagePosRef.current.x) / oldScale, y: (center.y - stagePosRef.current.y) / oldScale };
        setStageScale(newScale);
        setStagePos({ x: center.x - origin.x * newScale, y: center.y - origin.y * newScale });
      }
      lastTouchDist.current = dist;
      lastTouchCenter.current = center;
    } else if (e.touches.length === 1 && touchPanStart.current) {
      const dx = e.touches[0].clientX - touchPanStart.current.mx;
      const dy = e.touches[0].clientY - touchPanStart.current.my;
      setStagePos({ x: touchPanStart.current.sx + dx, y: touchPanStart.current.sy + dy });
    }
  }, [stageScaleRef, stagePosRef, setStageScale, setStagePos]);

  const handleTouchEnd = useCallback(() => {
    lastTouchDist.current = 0;
    lastTouchCenter.current = null;
    touchPanStart.current = null;
  }, []);

  // ── 핸들러 ──
  const handleJoin = (viewOnly = false) => {
    const name = viewOnly ? '관람자' : nickname.trim();
    if (!name || !roomId.trim()) return;
    if (viewOnly) {
      setNickname('관람자');
      setIsViewOnly(true);
    }
    window.history.pushState({}, '', `?room=${roomId}`);
    socket.emit('join_room', { nickname: name, room: roomId });
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

  const handleChatInputChange = useCallback((value: string) => {
    setInputText(value);
    socket.emit('typing', nickname);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => socket.emit('stop_typing', nickname), 1500);
  }, [nickname]);

  const handleClearAll = useCallback(() => {
    setElements([]); setSelectedIndices(new Set());
    historyRef.current = [[]]; historyStepRef.current = 0;
    socket.emit('clear_all');
  }, [historyRef, historyStepRef]);

  const commitText = () => {
    if (!textInput) return;
    if (textInput.targetIdx !== undefined) {
      setElements((prev) => {
        const upd = [...prev];
        const el = upd[textInput.targetIdx!];
        if (el?.tool === 'pin') {
          upd[textInput.targetIdx!] = { ...el, pinText: textInput.value };
        } else {
          upd[textInput.targetIdx!] = { ...el, text: textInput.value };
        }
        saveHistoryWith(upd); 
        socket.emit('update_element', upd[textInput.targetIdx!]);
        return upd;
      });
    } else if (textInput.value.trim()) {
      const fontSize = Math.max(12, strokeWidth * 3);
      const newEl: DrawElement = {
        id: generateId(), tool: 'text',
        points: [textInput.x, textInput.y], color: currentColor,
        strokeWidth, text: textInput.value, fontSize,
        dash: currentDash, opacity: currentOpacity,
        fontStyle: fontStyle || 'normal',
        textDecoration: textDecoration || '',
        fontFamily: fontFamily || 'sans-serif',
        textAlign: textAlign || 'left',
      };
      setElements((prev) => {
        const upd = [...prev, newEl];
        saveHistoryWith(upd); 
        socket.emit('update_element', newEl);
        return upd;
      });
    }
    setTextInput(null);
  };

  // ── 테이블 셀 편집 커밋 ──
  const commitTableCell = () => {
    if (!tableCellEdit) return;
    const { idx, row, col, value } = tableCellEdit;
    setElements(prev => {
      const upd = [...prev];
      const el = upd[idx];
      if (!el || el.tool !== 'table') return prev;
      const rows = el.rows ?? 3;
      const cols = el.cols ?? 3;
      const newData: string[][] = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => el.tableData?.[r]?.[c] || '')
      );
      newData[row][col] = value;
      const updated = { ...el, tableData: newData };
      upd[idx] = updated;
      saveHistoryWith(upd);
      socket.emit('update_element', updated);
      return upd;
    });
    setTableCellEdit(null);
  };

  // ── Feature 2: Mindmap creation handler ──
  const handleMindmapClick = useCallback((x: number, y: number) => {
    // Check if clicking on existing mindmap node
    let clickedIdx = -1;
    for (let i = elementsRef.current.length - 1; i >= 0; i--) {
      const elem = elementsRef.current[i];
      if (elem.tool !== 'mindmap') continue;
      const cx = elem.points[0], cy = elem.points[1];
      const w = elem.points[2] ?? 160, h = elem.points[3] ?? 50;
      if (Math.abs(x - cx) <= w / 2 && Math.abs(y - cy) <= h / 2) { clickedIdx = i; break; }
    }
    if (clickedIdx >= 0) {
      // Create child node
      const parent = elementsRef.current[clickedIdx];
      const level = (parent.mindmapLevel ?? 0) + 1;
      const childCount = (parent.mindmapChildren ?? []).length;
      const childId = generateId();
      const childNode: DrawElement = {
        id: childId, tool: 'mindmap',
        points: [parent.points[0] + 250, parent.points[1] + (childCount - 0.5) * 80, 130, 44],
        color: '#3b82f6', strokeWidth: 2,
        mindmapLabel: '새 노드', mindmapLevel: level,
        mindmapParent: parent.id,
      };
      const updParent = { ...parent, mindmapChildren: [...(parent.mindmapChildren ?? []), childId] };
      const upd = elementsRef.current.map((el, i) => i === clickedIdx ? updParent : el);
      const final = [...upd, childNode];
      setElements(final);
      saveHistoryWith(final);
      socket.emit('draw_line', final);
    } else {
      // Create root node
      const newNode: DrawElement = {
        id: generateId(), tool: 'mindmap',
        points: [x, y, 160, 50],
        color: '#8b5cf6', strokeWidth: 2,
        mindmapLabel: '중심 주제', mindmapLevel: 0,
      };
      const upd = [...elementsRef.current, newNode];
      setElements(upd);
      saveHistoryWith(upd);
      socket.emit('update_element', newNode);
    }
  }, [elementsRef, setElements, saveHistoryWith]);

  // ── Feature 3: Formula creation handler ──
  const handleFormulaCreate = useCallback(async (x: number, y: number) => {
    const latex = window.prompt('LaTeX 수식을 입력하세요:', '\\frac{a}{b} = \\sqrt{c^2}');
    if (!latex) return;
    const img = await renderFormulaToImage(latex);
    formulaCache.current.set(latex, img);
    const newEl: DrawElement = {
      id: generateId(), tool: 'formula',
      points: [x, y, 300, 100],
      color: '#000000', strokeWidth: 1,
      formulaLatex: latex, opacity: currentOpacity,
    };
    const upd = [...elementsRef.current, newEl];
    setElements(upd);
    saveHistoryWith(upd);
    socket.emit('update_element', newEl);
    setImageLoadTick(t => t + 1);
  }, [elementsRef, setElements, saveHistoryWith, renderFormulaToImage, currentOpacity]);

  // ── 캔버스 이벤트 훅 ──
  const { handleMouseDown: _handleMouseDown, handleMouseMove, handleMouseUp: _handleMouseUp, handleDblClick } = useCanvasEvents({
    // Refs
    isDrawing, isPanning, panStart, spaceHeldRef, stagePosRef,
    isBoxSelecting, boxSelectStart, isDraggingSelected, dragStartPos, dragOriginals,
    elementsRef, toolRef, isSmoothingRef, isSmartShapeRef, lastCursorEmit,
    lastPenTime, bezierPhase, bezierAnchor, connectorPhase, connectorFirst,
    isResizingRef, resizeHandleRef, resizeOriginalRef,
    isRotatingRef, rotateOriginRef,
    isMultiResizingRef, multiResizeHandleRef, multiResizeOriginRef,
    // State
    contextMenu, elements, selectedIndices, tool,
    isEmojiMode, selectedEmoji, nickname, isViewOnly,
    currentColor, strokeWidth, isFilled, currentDash, currentLineCap, currentOpacity, stickyBg,
    currentShapeName, gradientColors, gradientAngle,
    brushType,
    // Setters
    setContextMenu, setEmojiReactions, setTextInput,
    setElements, setSelectedIndices, setBoxSelectRect, setStagePos,
    setSnapLines,
    setTableCellEdit,
    // Functions
    getCanvasPos, snap, commitText, saveHistoryWith, showToast,
    // Socket
    socket,
  });

  // Wrap mouseDown to handle mindmap/formula tools and crop mode and element_editing emit
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    // Crop handle logic (Feature 1)
    if (isCropMode) {
      const name = e.target.name();
      if (name.startsWith('crop-')) {
        cropHandleRef.current = name;
        const pos = getCanvasPos(stage);
        if (!pos) return;
        const idx = [...selectedIndices][0];
        if (idx === undefined) return;
        cropOriginRef.current = { startPos: pos, origEl: { ...elementsRef.current[idx] } };
        return;
      }
      if (e.target === stage || !(e.target.name() ?? '').includes('crop')) {
        setIsCropMode(false);
        cropHandleRef.current = null;
        cropOriginRef.current = null;
      }
      return;
    }

    // Feature 6: emit element_editing when starting drag on selected element
    if (tool === 'select' && selectedIndices.size > 0) {
      const targetName = e.target.name?.() ?? '';
      if (!targetName.startsWith('resize-') && !targetName.startsWith('multi-') && !targetName.includes('rotate')) {
        const idx = [...selectedIndices][0];
        const el = elementsRef.current[idx];
        if (el?.id) {
          socket.emit('element_editing', { elementId: el.id });
        }
      }
    }

    // Mindmap tool click (Feature 2)
    if (tool === 'mindmap' && !isViewOnly) {
      const pos = getCanvasPos(stage);
      if (pos) {
        handleMindmapClick(pos.x, pos.y);
        return;
      }
    }

    // Formula tool click (Feature 3)
    if (tool === 'formula' && !isViewOnly) {
      const pos = getCanvasPos(stage);
      if (pos) {
        handleFormulaCreate(pos.x, pos.y);
        return;
      }
    }

    _handleMouseDown(e);
  }, [_handleMouseDown, tool, isViewOnly, isCropMode, selectedIndices, elementsRef, getCanvasPos, handleMindmapClick, handleFormulaCreate]);

  const handleMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // Crop handle release (Feature 1)
    if (cropHandleRef.current) {
      cropHandleRef.current = null;
      cropOriginRef.current = null;
      return;
    }

    // Feature 6: emit element_edit_stop
    if (isDraggingSelected.current || isResizingRef.current || isRotatingRef.current) {
      const idx = [...selectedIndicesRef.current][0];
      const el = elementsRef.current[idx];
      if (el?.id) socket.emit('element_edit_stop', { elementId: el.id });
    }

    void e;
    _handleMouseUp();
  }, [_handleMouseUp, isDraggingSelected, isResizingRef, isRotatingRef, selectedIndicesRef, elementsRef]);

  // Wrap handleMouseMove for crop drag (Feature 1)
  const handleMouseMoveWrapped = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isCropMode && cropHandleRef.current && cropOriginRef.current) {
      const stage = e.target.getStage();
      if (!stage) return;
      const pos = getCanvasPos(stage);
      if (!pos) return;
      const origin = cropOriginRef.current;
      const dx = pos.x - origin.startPos.x;
      const dy = pos.y - origin.startPos.y;
      const origEl = origin.origEl;
      const img = imageCache.current.get(origEl.imageDataUrl ?? '');
      const naturalW = img?.naturalWidth ?? (origEl.points[2] || 200);
      const naturalH = img?.naturalHeight ?? (origEl.points[3] || 200);
      const imgW = origEl.points[2] || naturalW;
      const imgH = origEl.points[3] || naturalH;
      const scaleX = naturalW / imgW, scaleY = naturalH / imgH;
      const handle = cropHandleRef.current;
      let cX = origEl.cropX ?? 0;
      let cY = origEl.cropY ?? 0;
      let cW = origEl.cropWidth ?? naturalW;
      let cH = origEl.cropHeight ?? naturalH;
      const dxNat = dx * scaleX, dyNat = dy * scaleY;
      if (handle.includes('e')) cW = Math.max(10, (origEl.cropWidth ?? naturalW) + dxNat);
      if (handle.includes('s')) cH = Math.max(10, (origEl.cropHeight ?? naturalH) + dyNat);
      if (handle.includes('w')) { cX = Math.min(origEl.cropX ?? 0) + dxNat; cW = Math.max(10, (origEl.cropWidth ?? naturalW) - dxNat); }
      if (handle.includes('n')) { cY = (origEl.cropY ?? 0) + dyNat; cH = Math.max(10, (origEl.cropHeight ?? naturalH) - dyNat); }
      cX = Math.max(0, Math.min(cX, naturalW - 10));
      cY = Math.max(0, Math.min(cY, naturalH - 10));
      cW = Math.min(cW, naturalW - cX);
      cH = Math.min(cH, naturalH - cY);
      const idx = [...selectedIndicesRef.current][0];
      if (idx === undefined) return;
      setElements(prev => {
        const upd = [...prev];
        upd[idx] = { ...upd[idx], cropX: cX, cropY: cY, cropWidth: cW, cropHeight: cH };
        return upd;
      });
      return;
    }
    handleMouseMove(e);
  }, [isCropMode, handleMouseMove, getCanvasPos, imageCache, selectedIndicesRef, setElements]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const dropPos = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top);
    handleImageFile(file, dropPos);
  };

  const getCursor = (): string => {
    if (isSpaceHeld) return isPanning.current ? 'grabbing' : 'grab';
    if (tool === 'eraser') return 'cell';
    if (tool === 'text') return 'text';
    if (tool === 'select') return isDraggingSelected.current ? 'grabbing' : 'default';
    return 'crosshair';
  };

  // ── 선택 바운딩 박스 & 리사이즈 핸들 ──
  const { selectionRects, groupRects, resizeHandles } = useMemo(() => {
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

    const groupBoundsMap = new Map<string, Bounds>();
    [...selectedIndices].forEach((idx) => {
      if (idx >= elements.length) return;
      const el = elements[idx];
      if (!el.groupId) return;
      const b = getElementBounds(el);
      if (!b) return;
      const ex = groupBoundsMap.get(el.groupId);
      if (ex) {
        const nx = Math.min(ex.x, b.x), ny = Math.min(ex.y, b.y);
        groupBoundsMap.set(el.groupId, {
          x: nx, y: ny,
          width: Math.max(ex.x + ex.width, b.x + b.width) - nx,
          height: Math.max(ex.y + ex.height, b.y + b.height) - ny,
        });
      } else {
        groupBoundsMap.set(el.groupId, { ...b });
      }
    });
    const groupRects = [...groupBoundsMap.entries()].map(([gid, b]) => (
      <Rect key={`group-${gid}`}
        x={b.x - 10} y={b.y - 10} width={b.width + 20} height={b.height + 20}
        stroke="#f59e0b" strokeWidth={2 / stageScale}
        dash={[8 / stageScale, 4 / stageScale]}
        fill="rgba(245,158,11,0.04)" listening={false} cornerRadius={4} />
    ));

    // 리사이즈 핸들 (단일 선택, select 도구, 잠금되지 않은 요소)
    let resizeHandles: React.ReactNode[] = [];
    if (selectedIndices.size === 1 && tool === 'select' && !isViewOnly) {
      const idx = [...selectedIndices][0];
      if (idx < elements.length) {
        const el = elements[idx];
        const b = getElementBounds(el);
        if (b && !el.locked && RESIZABLE_TOOLS.includes(el.tool)) {
          const bx = b.x - 4, by = b.y - 4, bw = b.width + 8, bh = b.height + 8;
          const hs = 8 / stageScale; // 핸들 크기 (스케일 보정)
          const handles = [
            { name: 'resize-nw', x: bx, y: by },
            { name: 'resize-n',  x: bx + bw / 2, y: by },
            { name: 'resize-ne', x: bx + bw, y: by },
            { name: 'resize-e',  x: bx + bw, y: by + bh / 2 },
            { name: 'resize-se', x: bx + bw, y: by + bh },
            { name: 'resize-s',  x: bx + bw / 2, y: by + bh },
            { name: 'resize-sw', x: bx, y: by + bh },
            { name: 'resize-w',  x: bx, y: by + bh / 2 },
          ];
          resizeHandles = handles.map(h => (
            <Rect
              key={h.name}
              name={h.name}
              x={h.x - hs / 2}
              y={h.y - hs / 2}
              width={hs}
              height={hs}
              fill="white"
              stroke="#3b82f6"
              strokeWidth={1.5 / stageScale}
              cornerRadius={1.5 / stageScale}
              listening={true}
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = RESIZE_CURSORS[h.name] || 'default';
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = '';
              }}
            />
          ));

          // 회전 핸들
          const handleX = bx + bw / 2;
          const handleY = by - 20 / stageScale;
          resizeHandles.push(
            <KonvaLine key="rotate-line"
              points={[handleX, by, handleX, handleY]}
              stroke="#3b82f6" strokeWidth={1 / stageScale} listening={false}
            />,
            <KonvaCircle key="rotate-handle"
              name="rotate-handle"
              x={handleX} y={handleY}
              radius={5 / stageScale}
              fill="white" stroke="#3b82f6" strokeWidth={1.5 / stageScale}
              listening={true}
              onMouseEnter={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'crosshair'; }}
              onMouseLeave={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = ''; }}
            />,
          );
        }
      }
    }

    // 다중 선택 리사이즈 핸들
    if (selectedIndices.size > 1 && tool === 'select' && !isViewOnly) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let hasValid = false;
      [...selectedIndices].forEach(idx => {
        if (idx >= elements.length) return;
        const b = getElementBounds(elements[idx]);
        if (b) {
          hasValid = true;
          minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
          maxX = Math.max(maxX, b.x + b.width); maxY = Math.max(maxY, b.y + b.height);
        }
      });
      if (hasValid) {
        const bx = minX - 4, by = minY - 4;
        const bw = (maxX - minX) + 8, bh = (maxY - minY) + 8;
        const hs = 8 / stageScale;
        const mHandles = [
          { name: 'multi-resize-nw', x: bx, y: by },
          { name: 'multi-resize-n',  x: bx + bw / 2, y: by },
          { name: 'multi-resize-ne', x: bx + bw, y: by },
          { name: 'multi-resize-e',  x: bx + bw, y: by + bh / 2 },
          { name: 'multi-resize-se', x: bx + bw, y: by + bh },
          { name: 'multi-resize-s',  x: bx + bw / 2, y: by + bh },
          { name: 'multi-resize-sw', x: bx, y: by + bh },
          { name: 'multi-resize-w',  x: bx, y: by + bh / 2 },
        ];
        mHandles.forEach(h => {
          resizeHandles.push(
            <Rect
              key={h.name}
              name={h.name}
              x={h.x - hs / 2} y={h.y - hs / 2}
              width={hs} height={hs}
              fill="white" stroke="#f59e0b"
              strokeWidth={1.5 / stageScale}
              cornerRadius={1.5 / stageScale}
              listening={true}
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = RESIZE_CURSORS[h.name.replace('multi-', '')] || 'default';
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = '';
              }}
            />,
          );
        });
      }
    }

    return { selectionRects, groupRects, resizeHandles };
  }, [selectedIndices, elements, stageScale, tool, isViewOnly]);

  // ── Feature 1: Crop handles (when in crop mode) ──
  const cropHandles = useMemo(() => {
    if (!isCropMode || selectedIndices.size !== 1) return [];
    const idx = [...selectedIndices][0];
    const el = elements[idx];
    if (!el || el.tool !== 'image') return [];
    const b = getElementBounds(el);
    if (!b) return [];
    const img = imageCache.current.get(el.imageDataUrl ?? '');
    const naturalW = img?.naturalWidth ?? (el.points[2] || 200);
    const naturalH = img?.naturalHeight ?? (el.points[3] || 200);
    const cropX = el.cropX ?? 0;
    const cropY = el.cropY ?? 0;
    const cropW = el.cropWidth ?? naturalW;
    const cropH = el.cropHeight ?? naturalH;
    // Map crop coords to canvas coords
    const imgW = el.points[2] || naturalW;
    const imgH = el.points[3] || naturalH;
    const imgX = el.points[0], imgY = el.points[1];
    const scaleX = imgW / naturalW, scaleY = imgH / naturalH;
    const cx = imgX + cropX * scaleX;
    const cy = imgY + cropY * scaleY;
    const cw = cropW * scaleX;
    const ch = cropH * scaleY;
    const hs = 8 / stageScale;
    const green = '#22c55e';
    const cropHndls = [
      { name: 'crop-nw', x: cx, y: cy },
      { name: 'crop-n', x: cx + cw/2, y: cy },
      { name: 'crop-ne', x: cx + cw, y: cy },
      { name: 'crop-e', x: cx + cw, y: cy + ch/2 },
      { name: 'crop-se', x: cx + cw, y: cy + ch },
      { name: 'crop-s', x: cx + cw/2, y: cy + ch },
      { name: 'crop-sw', x: cx, y: cy + ch },
      { name: 'crop-w', x: cx, y: cy + ch/2 },
    ];
    return [
      <Rect key="crop-rect" x={cx} y={cy} width={cw} height={ch}
        stroke={green} strokeWidth={2/stageScale} dash={[6/stageScale,3/stageScale]}
        fill="rgba(34,197,94,0.05)" listening={false} />,
      ...cropHndls.map(h => (
        <Rect key={h.name} name={h.name}
          x={h.x - hs/2} y={h.y - hs/2} width={hs} height={hs}
          fill="white" stroke={green} strokeWidth={1.5/stageScale}
          cornerRadius={1.5/stageScale} listening={true}
          onMouseEnter={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = RESIZE_CURSORS['resize-' + h.name.replace('crop-', '')] || 'crosshair'; }}
          onMouseLeave={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = ''; }}
        />
      ))
    ];
  }, [isCropMode, selectedIndices, elements, stageScale]);

  const textAreaScreen = textInput ? canvasToScreen(textInput.x, textInput.y) : null;

  const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, display: 'flex', alignItems: 'center', padding: '2px' };
  const layerBtn = (disabled = false): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer',
    color: disabled ? theme.border : theme.textMuted, display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px',
  });

  // ── 렌더링 ──
  if (!isJoined) {
    return (
      <LoginScreen
        isDarkMode={isDarkMode} 
        setIsDarkMode={setIsDarkMode}
        nickname={nickname} 
        setNickname={setNickname}
        roomId={roomId}
        setRoomId={setRoomId}
        onJoin={handleJoin}
      />
    );
  }

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
      {isDragOver && (
        <div style={{ position:'absolute', inset:0, zIndex:50, backgroundColor:'rgba(59,130,246,0.1)', border:'3px dashed #3b82f6', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
          <div style={{ fontSize:'24px', color:'#3b82f6', fontWeight:'bold' }}>이미지를 여기에 놓으세요</div>
        </div>
      )}

      {/* ── 상단 도구 모음 ── */}
      <Toolbar
        tool={tool} setTool={setTool} setSelectedIndices={setSelectedIndices}
        isViewOnly={isViewOnly} theme={theme} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}
        currentColor={currentColor} selectColor={selectColor} recentColors={recentColors}
        strokeWidth={strokeWidth} setStrokeWidth={setStrokeWidth}
        isFilled={isFilled} setIsFilled={setIsFilled}
        showGrid={showGrid} setShowGrid={setShowGrid}
        isSnapEnabled={isSnapEnabled} setIsSnapEnabled={setIsSnapEnabled}
        currentDash={currentDash} setCurrentDash={setCurrentDash}
        currentOpacity={currentOpacity} setCurrentOpacity={setCurrentOpacity}
        stickyBg={stickyBg} setStickyBg={setStickyBg}
        isSmoothing={isSmoothing} setIsSmoothing={setIsSmoothing}
        isSmartShape={isSmartShape} setIsSmartShape={setIsSmartShape}
        isEmojiMode={isEmojiMode} setIsEmojiMode={setIsEmojiMode}
        selectedEmoji={selectedEmoji} setSelectedEmoji={setSelectedEmoji}
        showEmojiPicker={showEmojiPicker} setShowEmojiPicker={setShowEmojiPicker}
        handleUndo={handleUndo} handleRedo={handleRedo}
        handleDownloadPNG={handleDownloadPNG} handleExportJSON={handleExportJSON} handleClearAll={handleClearAll}
        handleImportJSON={handleImportJSON} handleImageFile={handleImageFile}
        setShowHelp={setShowHelp}
        importInputRef={importInputRef} imageInputRef={imageInputRef}
        currentLineCap={currentLineCap} setCurrentLineCap={setCurrentLineCap}
        showLayerPanel={showLayerPanel} setShowLayerPanel={setShowLayerPanel}
        showFramePanel={showFramePanel} setShowFramePanel={setShowFramePanel}
        showTimeline={showTimeline} setShowTimeline={setShowTimeline}
        // 신규 props
        currentShapeName={currentShapeName}
        showShapeLibrary={showShapeLibrary} setShowShapeLibrary={setShowShapeLibrary}
        gradientColors={gradientColors} setGradientColors={setGradientColors}
        gradientAngle={gradientAngle} setGradientAngle={setGradientAngle}
        fontStyle={fontStyle} setFontStyle={setFontStyle}
        textDecoration={textDecoration} setTextDecoration={setTextDecoration}
        fontFamily={fontFamily} setFontFamily={setFontFamily}
        textAlign={textAlign} setTextAlign={setTextAlign}
        isLaserMode={isLaserMode} setIsLaserMode={setIsLaserMode}
        isPresentingMode={isPresentingMode} setIsPresentingMode={setIsPresentingMode}
        bgImageInputRef={bgImageInputRef}
        handleExportSVG={handleExportSVG}
        handleShowQRCode={handleShowQRCode}
        brushType={brushType} setBrushType={setBrushType}
        showSearch={showSearch} setShowSearch={setShowSearch}
        showTemplateGallery={showTemplateGallery} setShowTemplateGallery={setShowTemplateGallery}
        showShortcutSettings={showShortcutSettings} setShowShortcutSettings={setShowShortcutSettings}
        showTimer={showTimer} setShowTimer={setShowTimer}
        showHistoryDiff={showHistoryDiff} setShowHistoryDiff={setShowHistoryDiff}
      />

      {/* 저장 인디케이터 */}
      {saveState !== 'idle' && (
        <div style={{
          position: 'absolute', bottom: '20px', right: '320px', zIndex: 15,
          padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '500',
          backgroundColor: saveState === 'saving' ? '#fef3c7' : '#d1fae5',
          color: saveState === 'saving' ? '#92400e' : '#065f46',
          border: `1px solid ${saveState === 'saving' ? '#fcd34d' : '#6ee7b7'}`,
          pointerEvents: 'none',
        }}>
          {saveState === 'saving' ? '⏳ 저장 중...' : '✓ 저장됨'}
        </div>
      )}

      {/* 검색 패널 */}
      {showSearch && (
        <SearchPanel
          elements={elements}
          theme={theme}
          onNavigate={(el) => {
            const b = getElementBounds(el);
            if (!b) return;
            const pad = 80;
            const w = window.innerWidth, h = window.innerHeight;
            const cw = b.width || 1, ch = b.height || 1;
            const newScale = Math.min((w - pad * 2) / cw, (h - pad * 2) / ch, 4);
            setStageScale(newScale);
            setStagePos({ x: w / 2 - (b.x + cw / 2) * newScale, y: h / 2 - (b.y + ch / 2) * newScale });
          }}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* 줌 슬라이더 (Feature 8) */}
      <div style={{ position:'absolute', bottom:'20px', left:'50%', transform:'translateX(-50%)', zIndex:10, display:'flex', alignItems:'center', gap:'8px', padding:'6px 14px', backgroundColor: theme.panel, borderRadius:'20px', boxShadow: theme.shadow, fontSize:'13px', color: theme.textMuted }}>
        <button onClick={() => setStageScale(prev => Math.max(prev / 1.25, 0.05))} title="축소 (-)" style={{ ...iconBtn, padding:'0' }}><ZoomOut size={16}/></button>
        <input type="range" min="5" max="1000" value={Math.round(stageScale * 100)}
          onChange={(e) => setStageScale(Number(e.target.value) / 100)}
          style={{ width:'80px', accentColor:'#3b82f6' }} />
        <span style={{ minWidth:'44px', textAlign:'center', fontWeight:'bold', color: theme.text }}>{Math.round(stageScale*100)}%</span>
        <button onClick={() => setStageScale(prev => Math.min(prev * 1.25, 10))} title="확대 (=)" style={{ ...iconBtn, padding:'0' }}><ZoomIn size={16}/></button>
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
              <button onClick={handleGroup} title="그룹화 (Ctrl+G)" style={{ ...layerBtn(), color:'#f59e0b' }}><GroupIcon size={18}/></button>
            </>
          )}
          {[...selectedIndices].some(i => elements[i]?.groupId) && (
            <button onClick={handleUngroup} title="그룹 해제 (Ctrl+Shift+G)" style={{ ...layerBtn(), color:'#f59e0b' }}><UngroupIcon size={18}/></button>
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
          {/* Feature 1: Crop button for single image */}
          {selectedIndices.size === 1 && singleIdx !== null && elements[singleIdx]?.tool === 'image' && (
            <>
              <span style={{ width:'1px', height:'20px', backgroundColor: theme.border, margin:'0 4px' }} />
              <button
                onClick={() => setIsCropMode(v => !v)}
                style={{ padding:'2px 8px', borderRadius:'6px', fontSize:'12px', cursor:'pointer', border: isCropMode ? '2px solid #22c55e' : `1px solid ${theme.border}`, background: isCropMode ? '#dcfce7' : 'none', color: isCropMode ? '#16a34a' : theme.textMuted }}>
                ✂️ 크롭
              </button>
              {isCropMode && (
                <button
                  onClick={() => {
                    const upd = [...elements];
                    upd[singleIdx] = { ...upd[singleIdx], cropX: undefined, cropY: undefined, cropWidth: undefined, cropHeight: undefined };
                    setElements(upd); saveHistoryWith(upd); socket.emit('draw_line', upd);
                  }}
                  style={{ padding:'2px 8px', borderRadius:'6px', fontSize:'12px', cursor:'pointer', border:`1px solid ${theme.border}`, background:'none', color:'#ef4444' }}>
                  크롭 초기화
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Feature 11: Bulk Color Change (multiple selection) */}
      {selectedIndices.size > 1 && !isViewOnly && (() => {
        const selArr = [...selectedIndices];
        const bounds = selArr.map(i => getElementBounds(elements[i])).filter(Boolean);
        if (bounds.length === 0) return null;
        const minX = Math.min(...bounds.map(b => b!.x));
        const minY = Math.min(...bounds.map(b => b!.y));
        const sc = canvasToScreen(minX, minY);
        return (
          <div style={{ position:'absolute', left: sc.x, top: Math.max(sc.y - 70, 10), zIndex:20, display:'flex', gap:'8px', padding:'8px 12px', backgroundColor: theme.panel, borderRadius:'12px', boxShadow: theme.shadow, alignItems:'center', border:`1px solid ${theme.border}` }}>
            <span style={{ fontSize:'11px', color: theme.textMuted, whiteSpace:'nowrap' }}>일괄 변경</span>
            <label title="색상" style={{ position:'relative', width:'28px', height:'28px', cursor:'pointer' }}>
              <input type="color" value={bulkColor} onChange={(e) => {
                const color = e.target.value;
                setBulkColor(color);
                const upd = [...elements];
                selArr.forEach(idx => { if (!upd[idx].locked) upd[idx] = { ...upd[idx], color }; });
                setElements(upd); saveHistoryWith(upd); socket.emit('draw_line', upd);
              }} style={{ position:'absolute', opacity:0, width:'100%', height:'100%', cursor:'pointer' }} />
              <div style={{ width:'28px', height:'28px', borderRadius:'50%', backgroundColor: bulkColor, border:`2px solid ${theme.border}` }} />
            </label>
          </div>
        );
      })()}

      {/* 접속자 목록 */}
      <div style={{ position:'absolute', top:'20px', right:'20px', zIndex:10, backgroundColor: theme.panel, padding:'14px', borderRadius:'12px', boxShadow: theme.shadow, width:'190px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px', fontSize:'14px', fontWeight:'bold', color: theme.text }}>
          <Users size={18}/> {roomId} 방 ({users.length}명)
        </div>
        {users.map((u) => {
          const isMe = u.nickname === nickname;
          const isFollowing = followingUserId === u.id;
          const isHost = u.id === hostId;
          const myId = socket.id;
          const iAmHost = myId === hostId;
          const userPerm = permissions[u.id] ?? 'edit';
          return (
            <div key={u.id} style={{ fontSize:'13px', color: theme.textMuted, display:'flex', alignItems:'center', gap:'4px', marginBottom:'4px' }}>
              <div style={{ width:'6px', height:'6px', borderRadius:'50%', backgroundColor:'#22c55e', flexShrink:0 }}/>
              {isHost && <span title="방장" style={{ fontSize:'11px' }}>👑</span>}
              <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.nickname}</span>
              {!isMe && (
                <>
                  <button
                    onClick={() => setFollowingUserId(isFollowing ? null : u.id)}
                    title={isFollowing ? '팔로우 중지' : '화면 따라가기'}
                    style={{ background:'none', border:'none', cursor:'pointer', padding:'1px', fontSize:'12px', color: isFollowing ? '#3b82f6' : theme.textSubtle, borderRadius:'3px' }}
                  >
                    {isFollowing ? '👁️' : '👁'}
                  </button>
                  {iAmHost && (
                    <button
                      onClick={() => handleSetPermission(u.id, userPerm === 'edit' ? 'view' : 'edit')}
                      title={userPerm === 'edit' ? '읽기 전용으로 변경' : '편집 권한 부여'}
                      style={{ background:'none', border:'none', cursor:'pointer', padding:'1px', fontSize:'10px', color: userPerm === 'edit' ? '#22c55e' : '#f59e0b', borderRadius:'3px' }}
                    >
                      {userPerm === 'edit' ? '✏️' : '👁'}
                    </button>
                  )}
                </>
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
      <ChatPanel
        theme={theme}
        isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen}
        messages={messages} nickname={nickname}
        typingUsers={typingUsers}
        inputText={inputText}
        handleSendMessage={handleSendMessage}
        handleInputChange={handleChatInputChange}
        chatEndRef={chatEndRef}
      />

      {/* 🗺️ 미니맵 (좌측 하단) */}
      <Minimap
        elements={elements}
        stagePos={stagePos}
        stageScale={stageScale}
        theme={theme}
        onNavigate={(pos) => setStagePos(pos)}
      />

      {/* 다른 사용자 커서 */}
      {Object.entries(cursors).map(([id, cur]) => {
        const sc = canvasToScreen(cur.x, cur.y);
        return (
          <div key={id} style={{ position:'absolute', left:sc.x, top:sc.y, zIndex:15, pointerEvents:'auto', transform:'translate(-4px,-4px)' }}>
            <div style={{ width:'12px', height:'12px', borderRadius:'50%', backgroundColor:getCursorColor(id), border:'2px solid white', boxShadow:'0 0 4px rgba(0,0,0,0.3)', pointerEvents:'none' }}/>
            <div
              onClick={() => { setDmTarget({ userId: id, nickname: cur.nickname }); setDmInput(''); }}
              title={`${cur.nickname}에게 DM 보내기`}
              style={{ position:'absolute', top:'14px', left:'8px', fontSize:'11px', fontWeight:'bold', color:'white', backgroundColor:getCursorColor(id), padding:'1px 6px', borderRadius:'4px', whiteSpace:'nowrap', boxShadow:'0 1px 3px rgba(0,0,0,0.2)', cursor:'pointer' }}>
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

      <HelpModal showHelp={showHelp} setShowHelp={setShowHelp} theme={theme} isDarkMode={isDarkMode} />

      {/* ── 레이어 패널 ── */}
      {showLayerPanel && (
        <LayerPanel
          elements={elements}
          selectedIndices={selectedIndices}
          theme={theme}
          onSelect={(indices) => setSelectedIndices(indices)}
          onReorder={handleLayerReorder}
          onDelete={handleLayerDelete}
          onToggleLock={handleToggleLayerLock}
          onToggleVisibility={handleToggleLayerVisibility}
          hiddenIndices={hiddenIndices}
        />
      )}

      {/* ── 프레임 패널 ── */}
      {showFramePanel && (
        <FramePanel
          frames={elements.filter(el => el.tool === 'frame')}
          allElements={elements}
          stageRef={stageRef}
          stageScale={stageScale}
          stagePos={stagePos}
          theme={theme}
          onAddFrame={handleAddFrame}
          onNavigate={handleNavigateToFrame}
          onExportPDF={handleExportPDF}
          currentFrameId={currentFrameId}
        />
      )}

      {/* ── 타임라인 플레이어 ── */}
      {showTimeline && (
        <TimelinePlayer
          events={timelineEvents}
          theme={theme}
          onSnapshot={(snapshot) => setElements(snapshot)}
          onClose={() => setShowTimeline(false)}
        />
      )}

      {/* ── 음성 채팅 ── */}
      {isJoined && (
        <VoiceChat
          socket={socket}
          nickname={nickname}
          roomId={roomId}
          theme={theme}
        />
      )}

      {/* ── 접속자 목록 (방장/권한 표시 포함) ── */}
      {contextMenu && (
        <div
          style={{
            position: 'absolute',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 100,
            backgroundColor: theme.panel,
            border: `1px solid ${theme.border}`,
            borderRadius: '8px',
            boxShadow: theme.shadow,
            padding: '4px 0',
            minWidth: '150px',
            display: 'flex',
            flexDirection: 'column'
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button onClick={() => { copySelected(); setContextMenu(null); }} style={{ background: 'none', border: 'none', padding: '8px 16px', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: theme.text }}>복사 (Ctrl+C)</button>
          <button onClick={() => { pasteClipboard(); setContextMenu(null); }} style={{ background: 'none', border: 'none', padding: '8px 16px', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: theme.text }}>붙여넣기 (Ctrl+V)</button>
          <div style={{ height: '1px', backgroundColor: theme.border, margin: '4px 0' }} />
          <button onClick={() => { bringToFront(); setContextMenu(null); }} style={{ background: 'none', border: 'none', padding: '8px 16px', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: theme.text }}>맨 앞으로</button>
          <button onClick={() => { sendToBack(); setContextMenu(null); }} style={{ background: 'none', border: 'none', padding: '8px 16px', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: theme.text }}>맨 뒤로</button>
          <div style={{ height: '1px', backgroundColor: theme.border, margin: '4px 0' }} />
          <button onClick={() => { handleGroup(); setContextMenu(null); }} style={{ background: 'none', border: 'none', padding: '8px 16px', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: theme.text }}>그룹화</button>
          <button onClick={() => { handleUngroup(); setContextMenu(null); }} style={{ background: 'none', border: 'none', padding: '8px 16px', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: theme.text }}>그룹 해제</button>
          <button onClick={() => { toggleLock(); setContextMenu(null); }} style={{ background: 'none', border: 'none', padding: '8px 16px', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: theme.text }}>잠금 / 해제</button>
          <div style={{ height: '1px', backgroundColor: theme.border, margin: '4px 0' }} />
          <button onClick={() => { deleteSelected(); setContextMenu(null); }} style={{ background: 'none', border: 'none', padding: '8px 16px', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: '#ef4444' }}>삭제 (Del)</button>
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
        onMouseDown={isLaserMode ? undefined : handleMouseDown}
        onMouseMove={(e) => { if (isLaserMode) handleLaserMove(e); else handleMouseMoveWrapped(e); }}
        onMouseUp={isLaserMode ? undefined : handleMouseUp}
        onDblClick={isLaserMode ? undefined : handleDblClick}
        onTouchStart={(e) => handleTouchStart(e.evt)}
        onTouchMove={(e) => handleTouchMove(e.evt)}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => {
          e.evt.preventDefault();
          if (selectedIndices.size > 0) {
            setContextMenu({ x: e.evt.clientX, y: e.evt.clientY });
          }
        }}
        style={{ cursor: isLaserMode ? 'none' : getCursor() }}
      >
        <Layer>
          {bgKonvaImage && <KonvaImage image={bgKonvaImage} x={0} y={0} opacity={0.35} listening={false} />}
          {elements.map((el, i) => {
            if (hiddenIndices.has(i)) return null;
            if (el.tool === 'mindmap') return renderMindmapNode(el, i, stageScale);
            if (el.tool === 'formula') return renderFormulaElement(el, i, formulaCache);
            return renderElement(el, i, stageScale, imageCache, elements);
          })}
          {/* Mindmap connection lines */}
          {elements.map((el, i) => {
            if (el.tool !== 'mindmap' || !el.mindmapChildren?.length) return null;
            return el.mindmapChildren.map(childId => {
              const child = elements.find(e => e.id === childId);
              if (!child) return null;
              return (
                <KonvaArrow key={`mm-conn-${i}-${childId}`}
                  points={[el.points[0], el.points[1], child.points[0], child.points[1]]}
                  stroke="#94a3b8" strokeWidth={1.5 / stageScale}
                  fill="#94a3b8" pointerLength={8/stageScale} pointerWidth={6/stageScale}
                  listening={false} />
              );
            });
          })}
          {/* Feature 6: Edit indicators */}
          {Object.entries(editingIndicators).map(([elementId, info]) => {
            const el = elements.find(e => e.id === elementId);
            if (!el) return null;
            const b = getElementBounds(el);
            if (!b) return null;
            return (
              <Rect key={`editing-${elementId}`}
                x={b.x - 6} y={b.y - 6} width={b.width + 12} height={b.height + 12}
                stroke={info.color} strokeWidth={2 / stageScale}
                fill="transparent" cornerRadius={4}
                dash={[6/stageScale, 3/stageScale]} listening={false} />
            );
          })}
          {selectionRects}
          {groupRects}
          {resizeHandles}
          {cropHandles}
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
          {snapLines.map((sl, i) => (
            <KonvaLine key={`snap-${i}`}
              points={sl.type === 'x'
                ? [sl.pos, -10000, sl.pos, 10000]
                : [-10000, sl.pos, 10000, sl.pos]}
              stroke="#ef4444" strokeWidth={1 / stageScale}
              dash={[4 / stageScale, 4 / stageScale]}
              listening={false}
            />
          ))}
        </Layer>
      </Stage>

      {/* 레이저 포인터 오버레이 */}
      {Object.entries(lasers).map(([id, l]) => {
        const sc = canvasToScreen(l.x, l.y);
        const age = (Date.now() - l.ts) / 2000;
        return (
          <div key={id} style={{ position:'absolute', left:sc.x - 10, top:sc.y - 10, zIndex:40, pointerEvents:'none' }}>
            <div style={{ width:'20px', height:'20px', borderRadius:'50%', backgroundColor:'rgba(239,68,68,0.8)', boxShadow:'0 0 12px 4px rgba(239,68,68,0.5)', opacity: Math.max(0, 1 - age) }}/>
            <div style={{ position:'absolute', top:'22px', left:'50%', transform:'translateX(-50%)', fontSize:'10px', color:'white', backgroundColor:'rgba(239,68,68,0.8)', padding:'1px 5px', borderRadius:'4px', whiteSpace:'nowrap' }}>{l.nickname}</div>
          </div>
        );
      })}

      {/* 내 레이저 포인터 (마우스 위치) */}
      {isLaserMode && (
        <style>{`* { cursor: none !important; }`}</style>
      )}

      {/* hidden 입력: 배경 이미지 */}
      <input ref={bgImageInputRef} type="file" accept="image/*" style={{ display:'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBgImageFile(f); e.target.value = ''; }}
      />

      {/* QR 코드 모달 */}
      {showQRCode && qrDataUrl && (
        <div style={{ position:'fixed', inset:0, zIndex:200, backgroundColor:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setShowQRCode(false)}>
          <div style={{ backgroundColor: theme.panel, borderRadius:'16px', padding:'28px', textAlign:'center', boxShadow: theme.shadow }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:'18px', fontWeight:'bold', color: theme.text, marginBottom:'16px' }}>방 공유 QR 코드</div>
            <img src={qrDataUrl} alt="QR Code" style={{ width:'200px', height:'200px', borderRadius:'8px' }}/>
            <div style={{ fontSize:'12px', color: theme.textMuted, marginTop:'10px' }}>
              {`${window.location.origin}${window.location.pathname}?room=${roomId}`}
            </div>
            <button onClick={() => setShowQRCode(false)} style={{ marginTop:'16px', padding:'8px 24px', borderRadius:'8px', border:'none', background:'#3b82f6', color:'white', cursor:'pointer', fontWeight:'bold' }}>닫기</button>
          </div>
        </div>
      )}

      {/* 도형 라이브러리 */}
      {showShapeLibrary && (
        <ShapeLibrary
          theme={theme}
          currentShapeName={currentShapeName}
          onSelect={(name) => { setCurrentShapeName(name); setShowShapeLibrary(false); setTool('shape'); }}
          onClose={() => setShowShapeLibrary(false)}
        />
      )}

      {/* 테이블 셀 편집 오버레이 */}
      {tableCellEdit !== null && (() => {
        const el = elements[tableCellEdit.idx];
        if (!el || el.tool !== 'table') return null;
        const x = Math.min(el.points[0], el.points[2]);
        const y = Math.min(el.points[1], el.points[3]);
        const w = Math.abs(el.points[2] - el.points[0]);
        const h = Math.abs(el.points[3] - el.points[1]);
        const rows = el.rows ?? 3;
        const cols = el.cols ?? 3;
        const cellW = w / cols;
        const cellH = h / rows;
        const cellX = x + tableCellEdit.col * cellW + 4;
        const cellY = y + tableCellEdit.row * cellH + 4;
        const sc = canvasToScreen(cellX, cellY);
        const scW = cellW * stageScale - 8;
        const scH = cellH * stageScale - 8;
        return (
          <textarea
            key="table-cell-edit"
            autoFocus
            value={tableCellEdit.value}
            onChange={(e) => setTableCellEdit({ ...tableCellEdit, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitTableCell(); }
              if (e.key === 'Escape') setTableCellEdit(null);
            }}
            onBlur={() => commitTableCell()}
            style={{
              position: 'absolute', left: sc.x, top: sc.y, zIndex: 20,
              width: scW, height: scH,
              background: 'white', border: '2px solid #3b82f6', outline: 'none',
              resize: 'none', fontSize: `${(el.fontSize || 13) * stageScale}px`,
              fontFamily: 'sans-serif', padding: '0', lineHeight: '1.4',
            }}
          />
        );
      })()}

      {/* 발표 모드 */}
      {isPresentingMode && (
        <PresentationMode
          frames={elements.filter(el => el.tool === 'frame')}
          allElements={elements}
          stageRef={stageRef}
          socket={socket}
          roomId={roomId}
          nickname={nickname}
          theme={theme}
          onNavigate={handleNavigateToFrame}
          onClose={() => setIsPresentingMode(false)}
        />
      )}

      {/* Feature 9: Template Gallery */}
      {showTemplateGallery && (
        <TemplateGallery
          theme={theme}
          onLoad={(els) => { setElements(els); setSelectedIndices(new Set()); saveHistoryWith(els); socket.emit('draw_line', els); }}
          onClose={() => setShowTemplateGallery(false)}
        />
      )}

      {/* Feature 10: Shortcut Settings */}
      {showShortcutSettings && (
        <ShortcutSettings
          theme={theme}
          currentShortcuts={customShortcuts}
          onSave={(sc) => { setCustomShortcuts(sc); localStorage.setItem('whiteboard-shortcuts', JSON.stringify(sc)); showToast('단축키가 저장되었습니다', 'info'); }}
          onClose={() => setShowShortcutSettings(false)}
        />
      )}

      {/* Feature 12: Timer Widget */}
      {showTimer && (
        <div
          style={{ position:'absolute', left: timerPosState.x, top: timerPosState.y, zIndex:50, backgroundColor: theme.panel, borderRadius:'12px', boxShadow: theme.shadow, border:`1px solid ${theme.border}`, padding:'12px 16px', minWidth:'200px', userSelect:'none' }}
          onMouseDown={(e) => {
            timerDragStart.current = { mx: e.clientX, my: e.clientY, sx: timerPosState.x, sy: timerPosState.y };
            const move = (ev: MouseEvent) => {
              if (!timerDragStart.current) return;
              setTimerPosState({ x: timerDragStart.current.sx + ev.clientX - timerDragStart.current.mx, y: timerDragStart.current.sy + ev.clientY - timerDragStart.current.my });
            };
            const up = () => { timerDragStart.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
          }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
            <span style={{ fontSize:'12px', fontWeight:'bold', color: theme.textMuted, cursor:'grab' }}>⏱ 타이머</span>
            <div style={{ display:'flex', gap:'4px' }}>
              <button onClick={() => setTimerState(prev => ({ ...prev, mode: prev.mode === 'up' ? 'down' : 'up' }))}
                style={{ fontSize:'10px', padding:'2px 6px', borderRadius:'4px', border:`1px solid ${theme.border}`, cursor:'pointer', background:'none', color: theme.textMuted }}>
                {timerState.mode === 'up' ? '카운트업' : '카운트다운'}
              </button>
              <button onClick={() => setShowTimer(false)} style={{ background:'none', border:'none', cursor:'pointer', color: theme.textMuted, fontSize:'14px' }}>✕</button>
            </div>
          </div>
          <div style={{ textAlign:'center', fontSize:'36px', fontWeight:'bold', color: theme.text, fontFamily:'monospace', marginBottom:'8px' }}>
            {String(Math.floor(timerState.seconds / 60)).padStart(2, '0')}:{String(timerState.seconds % 60).padStart(2, '0')}
          </div>
          {timerState.mode === 'down' && (
            <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px' }}>
              <span style={{ fontSize:'11px', color: theme.textMuted }}>목표:</span>
              <input type="number" min="1" max="3600" value={Math.floor(timerState.targetSeconds / 60)}
                onChange={(e) => setTimerState(prev => ({ ...prev, targetSeconds: Number(e.target.value) * 60, seconds: Number(e.target.value) * 60 }))}
                style={{ width:'50px', padding:'2px 4px', border:`1px solid ${theme.border}`, borderRadius:'4px', fontSize:'12px' }} />
              <span style={{ fontSize:'11px', color: theme.textMuted }}>분</span>
            </div>
          )}
          <div style={{ display:'flex', gap:'6px', justifyContent:'center' }}>
            <button
              onClick={() => {
                const next = { ...timerState, isRunning: !timerState.isRunning };
                if (!timerState.isRunning && timerState.mode === 'down' && timerState.seconds === 0) {
                  next.seconds = timerState.targetSeconds;
                }
                setTimerState(next);
                socket.emit('timer_sync', next);
              }}
              style={{ padding:'4px 14px', borderRadius:'6px', border:'none', background: timerState.isRunning ? '#ef4444' : '#22c55e', color:'white', cursor:'pointer', fontWeight:'bold', fontSize:'13px' }}>
              {timerState.isRunning ? '⏸' : '▶'}
            </button>
            <button
              onClick={() => {
                const next = { ...timerState, isRunning: false, seconds: timerState.mode === 'down' ? timerState.targetSeconds : 0 };
                setTimerState(next);
                socket.emit('timer_sync', next);
              }}
              style={{ padding:'4px 14px', borderRadius:'6px', border:`1px solid ${theme.border}`, background:'none', color: theme.textMuted, cursor:'pointer', fontSize:'13px' }}>
              ↺
            </button>
          </div>
        </div>
      )}

      {/* Feature 5: DM Modal */}
      {dmTarget && (
        <div style={{ position:'fixed', inset:0, zIndex:200, backgroundColor:'rgba(0,0,0,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setDmTarget(null)}>
          <div style={{ backgroundColor: theme.panel, borderRadius:'12px', padding:'20px', width:'320px', boxShadow: theme.shadow }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:'16px', fontWeight:'bold', color: theme.text, marginBottom:'12px' }}>
              💬 {dmTarget.nickname}에게 DM
            </div>
            <input
              autoFocus
              value={dmInput}
              onChange={(e) => setDmInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && dmInput.trim()) {
                  socket.emit('dm_message', { to: dmTarget.userId, text: dmInput });
                  showToast(`💬 ${dmTarget.nickname}에게 전송됨`, 'info');
                  setDmTarget(null); setDmInput('');
                }
                if (e.key === 'Escape') setDmTarget(null);
              }}
              placeholder="메시지 입력 후 Enter..."
              style={{ width:'100%', padding:'8px', border:`1px solid ${theme.border}`, borderRadius:'6px', fontSize:'14px', outline:'none', boxSizing:'border-box' }}
            />
            <div style={{ display:'flex', gap:'8px', marginTop:'10px', justifyContent:'flex-end' }}>
              <button onClick={() => setDmTarget(null)} style={{ padding:'6px 14px', borderRadius:'6px', border:`1px solid ${theme.border}`, background:'none', cursor:'pointer', color: theme.textMuted }}>취소</button>
              <button onClick={() => {
                if (dmInput.trim()) {
                  socket.emit('dm_message', { to: dmTarget.userId, text: dmInput });
                  showToast(`💬 ${dmTarget.nickname}에게 전송됨`, 'info');
                  setDmTarget(null); setDmInput('');
                }
              }} style={{ padding:'6px 14px', borderRadius:'6px', border:'none', background:'#3b82f6', color:'white', cursor:'pointer', fontWeight:'bold' }}>전송</button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 5: DM Toasts */}
      <div style={{ position:'fixed', bottom:'80px', right:'20px', zIndex:200, display:'flex', flexDirection:'column', gap:'8px', pointerEvents:'none' }}>
        {dmToastList.map(t => (
          <div key={t.id} style={{ padding:'10px 16px', borderRadius:'8px', fontSize:'13px', fontWeight:'500', backgroundColor:'#8b5cf6', color:'white', boxShadow:'0 4px 12px rgba(0,0,0,0.2)', animation:'slideIn 0.3s ease', maxWidth:'280px' }}>
            💬 <strong>{t.from}</strong>: {t.text}
          </div>
        ))}
      </div>

      {/* Feature 7: History Diff Panel */}
      {showHistoryDiff && (
        <HistoryDiffPanel
          events={timelineEvents}
          theme={theme}
          onClose={() => setShowHistoryDiff(false)}
        />
      )}

      {/* Feature 6: Editing indicator labels (HTML overlay) */}
      {Object.entries(editingIndicators).map(([elementId, info]) => {
        const el = elements.find(e => e.id === elementId);
        if (!el) return null;
        const b = getElementBounds(el);
        if (!b) return null;
        const sc = canvasToScreen(b.x + b.width / 2, b.y);
        return (
          <div key={`editing-label-${elementId}`} style={{ position:'absolute', left: sc.x, top: sc.y - 20, zIndex:15, pointerEvents:'none', transform:'translateX(-50%)', fontSize:'10px', backgroundColor: info.color, color:'white', padding:'1px 6px', borderRadius:'4px', whiteSpace:'nowrap' }}>
            ✏️ {info.nickname}
          </div>
        );
      })}
    </div>
  );
}
