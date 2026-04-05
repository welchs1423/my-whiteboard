import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Stage, Layer, Rect, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import QRCode from 'qrcode';
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
import { useHistory } from '../hooks/useHistory';
import { useSocketEvents } from '../hooks/useSocketEvents';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useBoardUI } from '../hooks/useBoardUI';
import { useViewport } from '../hooks/useViewport';
import { useCanvasEvents } from '../hooks/useCanvasEvents';
import { renderElement } from '../utils/renderElement';
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTimeline]);

  // 레이저 포인터 비활성화 시 알림
  useEffect(() => {
    if (!isLaserMode) {
      socket.emit('laser_stop');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useKeyboardShortcuts({
    socket, elementsRef, selectedIndicesRef, showHelpRef, clipboard,
    setElements, setSelectedIndices, setTool, setShowHelp,
    setStageScale, setStagePos,
    handleUndo, handleRedo, handleZoomToFit, handleGroup, handleUngroup,
    saveHistoryWith,
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

  // ── 캔버스 이벤트 훅 ──
  const { handleMouseDown, handleMouseMove, handleMouseUp, handleDblClick } = useCanvasEvents({
    // Refs
    isDrawing, isPanning, panStart, spaceHeldRef, stagePosRef,
    isBoxSelecting, boxSelectStart, isDraggingSelected, dragStartPos, dragOriginals,
    elementsRef, toolRef, isSmoothingRef, isSmartShapeRef, lastCursorEmit,
    lastPenTime, bezierPhase, bezierAnchor, connectorPhase, connectorFirst,
    // State
    contextMenu, elements, selectedIndices, tool,
    isEmojiMode, selectedEmoji, nickname, isViewOnly,
    currentColor, strokeWidth, isFilled, currentDash, currentLineCap, currentOpacity, stickyBg,
    currentShapeName, gradientColors, gradientAngle,
    // Setters
    setContextMenu, setEmojiReactions, setTextInput,
    setElements, setSelectedIndices, setBoxSelectRect, setStagePos,
    // Functions
    getCanvasPos, snap, commitText, saveHistoryWith, showToast,
    // Socket
    socket,
  });

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

  // ── 선택 바운딩 박스 ──
  const { selectionRects, groupRects } = useMemo(() => {
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

    return { selectionRects, groupRects };
  }, [selectedIndices, elements, stageScale]);

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
      />

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
        </div>
      )}

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
        onMouseMove={(e) => { if (isLaserMode) handleLaserMove(e); else handleMouseMove(e); }}
        onMouseUp={isLaserMode ? undefined : handleMouseUp}
        onDblClick={isLaserMode ? undefined : handleDblClick}
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
          {elements.map((el, i) => hiddenIndices.has(i) ? null : renderElement(el, i, stageScale, imageCache, elements))}
          {selectionRects}
          {groupRects}
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
    </div>
  );
}
