import { useCallback } from 'react';
import type { RefObject, MutableRefObject, Dispatch, SetStateAction } from 'react';
import Konva from 'konva';
import type { Socket } from 'socket.io-client';
import type { DrawElement, ToolType, DashStyle, Bounds } from '../utils/elementHelpers';
import {
  generateId, getElementAtPoint, getElementsInRect, moveElementBy,
  smoothPoints, simplifyPoints, detectSmartShape,
} from '../utils/elementHelpers';

// ── 로컬 인터페이스 ──
interface EmojiReaction { id: string; x: number; y: number; emoji: string; nickname: string; }
interface TextInputState { x: number; y: number; value: string; targetIdx?: number; }

export interface CanvasEventsParams {
  // Refs
  isDrawing: MutableRefObject<boolean>;
  isPanning: MutableRefObject<boolean>;
  panStart: MutableRefObject<{ mx: number; my: number; sx: number; sy: number } | null>;
  spaceHeldRef: RefObject<boolean>;
  stagePosRef: RefObject<{ x: number; y: number }>;
  isBoxSelecting: MutableRefObject<boolean>;
  boxSelectStart: MutableRefObject<{ x: number; y: number } | null>;
  isDraggingSelected: MutableRefObject<boolean>;
  dragStartPos: MutableRefObject<{ x: number; y: number } | null>;
  dragOriginals: MutableRefObject<{ idx: number; el: DrawElement }[]>;
  elementsRef: RefObject<DrawElement[]>;
  toolRef: RefObject<ToolType>;
  isSmoothingRef: RefObject<boolean>;
  isSmartShapeRef: RefObject<boolean>;
  lastCursorEmit: MutableRefObject<number>;
  // State values
  contextMenu: { x: number; y: number } | null;
  elements: DrawElement[];
  selectedIndices: Set<number>;
  tool: ToolType;
  isEmojiMode: boolean;
  selectedEmoji: string;
  nickname: string;
  isViewOnly: boolean;
  currentColor: string;
  strokeWidth: number;
  isFilled: boolean;
  currentDash: DashStyle;
  currentOpacity: number;
  stickyBg: string;
  // Setters
  setContextMenu: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
  setEmojiReactions: Dispatch<SetStateAction<EmojiReaction[]>>;
  setTextInput: Dispatch<SetStateAction<TextInputState | null>>;
  setElements: Dispatch<SetStateAction<DrawElement[]>>;
  setSelectedIndices: Dispatch<SetStateAction<Set<number>>>;
  setBoxSelectRect: Dispatch<SetStateAction<Bounds | null>>;
  setStagePos: (v: { x: number; y: number }) => void;
  // Functions
  getCanvasPos: (stage: Konva.Stage) => { x: number; y: number } | null;
  snap: (v: number) => number;
  commitText: () => void;
  saveHistoryWith: (elements: DrawElement[]) => void;
  showToast: (message: string, type?: 'join' | 'leave' | 'info') => void;
  // Socket
  socket: Socket;
}

export function useCanvasEvents(p: CanvasEventsParams) {
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (p.contextMenu) p.setContextMenu(null);

    const stage = e.target.getStage();
    if (!stage) return;

    if (e.evt.button === 1 || p.spaceHeldRef.current) {
      p.isPanning.current = true;
      p.panStart.current = {
        mx: e.evt.clientX, my: e.evt.clientY,
        sx: p.stagePosRef.current!.x, sy: p.stagePosRef.current!.y,
      };
      return;
    }

    const pos = p.getCanvasPos(stage);
    if (!pos) return;

    if (p.isEmojiMode) {
      const reactionId = generateId();
      const reaction: EmojiReaction = { id: reactionId, x: pos.x, y: pos.y, emoji: p.selectedEmoji, nickname: p.nickname };
      p.setEmojiReactions(prev => [...prev, reaction]);
      setTimeout(() => p.setEmojiReactions(prev => prev.filter(r => r.id !== reactionId)), 1800);
      p.socket.emit('emoji_reaction', reaction);
      return;
    }

    if (p.isViewOnly) return;

    if (p.tool === 'text') {
      p.commitText();
      p.setTextInput({ x: p.snap(pos.x), y: p.snap(pos.y), value: '' });
      return;
    }

    if (p.tool === 'select') {
      const idx = getElementAtPoint(p.elements, pos.x, pos.y);
      if (idx === null) {
        if (!e.evt.shiftKey) p.setSelectedIndices(new Set());
        p.isBoxSelecting.current = true;
        p.boxSelectStart.current = pos;
        p.setBoxSelectRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
      } else {
        if (e.evt.shiftKey) {
          p.setSelectedIndices(prev => {
            const next = new Set(prev);
            if (next.has(idx)) { next.delete(idx); } else { next.add(idx); }
            return next;
          });
        } else {
          let newSel: Set<number>;
          if (p.selectedIndices.has(idx)) {
            newSel = p.selectedIndices;
          } else {
            newSel = new Set([idx]);
            const clickedGroupId = p.elements[idx]?.groupId;
            if (clickedGroupId) {
              p.elements.forEach((el, i) => {
                if (el.groupId === clickedGroupId) newSel.add(i);
              });
            }
          }
          p.setSelectedIndices(newSel);
          p.isDraggingSelected.current = true;
          p.dragStartPos.current = pos;
          p.dragOriginals.current = [...newSel]
            .filter(i => !p.elements[i]?.locked)
            .map(i => ({ idx: i, el: { ...p.elements[i], points: [...p.elements[i].points] } }));
        }
      }
      return;
    }

    p.isDrawing.current = true;
    const newEl: DrawElement = {
      id: generateId(), tool: p.tool,
      points: ['pen', 'eraser'].includes(p.tool)
        ? [p.snap(pos.x), p.snap(pos.y)]
        : [p.snap(pos.x), p.snap(pos.y), p.snap(pos.x), p.snap(pos.y)],
      color: p.currentColor, strokeWidth: p.strokeWidth,
      filled: p.isFilled, dash: p.currentDash, opacity: p.currentOpacity,
      ...(p.tool === 'sticky' ? { stickyBg: p.stickyBg } : {}),
    };
    p.setElements(prev => {
      const upd = [...prev, newEl];
      p.socket.emit('update_element', newEl);
      return upd;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.contextMenu, p.elements, p.selectedIndices, p.tool, p.isEmojiMode, p.selectedEmoji, p.nickname, p.isViewOnly, p.currentColor, p.strokeWidth, p.isFilled, p.currentDash, p.currentOpacity, p.stickyBg, p.getCanvasPos, p.snap, p.commitText]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (p.isPanning.current && p.panStart.current) {
      const dx = e.evt.clientX - p.panStart.current.mx;
      const dy = e.evt.clientY - p.panStart.current.my;
      p.setStagePos({ x: p.panStart.current.sx + dx, y: p.panStart.current.sy + dy });
      return;
    }

    const stage = e.target.getStage();
    if (!stage) return;
    const point = p.getCanvasPos(stage);
    if (!point) return;

    const now = Date.now();
    if (now - p.lastCursorEmit.current > 50) {
      p.socket.emit('cursor_move', { x: point.x, y: point.y });
      p.lastCursorEmit.current = now;
    }

    if (p.toolRef.current === 'select') {
      if (p.isDraggingSelected.current && p.dragStartPos.current && p.dragOriginals.current.length) {
        const dx = p.snap(point.x) - p.snap(p.dragStartPos.current.x);
        const dy = p.snap(point.y) - p.snap(p.dragStartPos.current.y);
        p.setElements(prev => {
          const upd = [...prev];
          p.dragOriginals.current.forEach(({ idx, el }) => {
            if (idx < upd.length) {
              const moved = moveElementBy(el, dx, dy);
              upd[idx] = moved;
              p.socket.emit('update_element', moved);
            }
          });
          return upd;
        });
      } else if (p.isBoxSelecting.current && p.boxSelectStart.current) {
        const r: Bounds = {
          x: p.boxSelectStart.current.x,
          y: p.boxSelectStart.current.y,
          width: point.x - p.boxSelectStart.current.x,
          height: point.y - p.boxSelectStart.current.y,
        };
        p.setBoxSelectRect(r);
        const inRect = getElementsInRect(p.elementsRef.current!, r.x, r.y, r.width, r.height);
        p.setSelectedIndices(new Set(inRect));
      }
      return;
    }

    if (!p.isDrawing.current) return;

    p.setElements(prev => {
      if (prev.length === 0) return prev;
      const upd = [...prev];
      const last = { ...upd[upd.length - 1] };
      if (last.tool === 'pen' || last.tool === 'eraser') {
        last.points = [...last.points, p.snap(point.x), p.snap(point.y)];
      } else {
        last.points = [last.points[0], last.points[1], p.snap(point.x), p.snap(point.y)];
      }
      upd[upd.length - 1] = last;
      p.socket.emit('update_element', last);
      return upd;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.getCanvasPos, p.snap, p.setStagePos, p.lastCursorEmit, p.toolRef]);

  const handleMouseUp = useCallback(() => {
    if (p.isPanning.current) { p.isPanning.current = false; p.panStart.current = null; return; }

    if (p.toolRef.current === 'select') {
      if (p.isDraggingSelected.current) {
        p.isDraggingSelected.current = false;
        p.dragStartPos.current = null;
        p.dragOriginals.current = [];
        p.setElements(latest => { p.saveHistoryWith(latest); return latest; });
      }
      if (p.isBoxSelecting.current) {
        p.isBoxSelecting.current = false;
        p.boxSelectStart.current = null;
        p.setBoxSelectRect(null);
      }
      return;
    }

    if (!p.isDrawing.current) return;
    p.isDrawing.current = false;

    if (p.toolRef.current === 'sticky') {
      p.setElements(latest => {
        p.saveHistoryWith(latest);
        const last = latest[latest.length - 1];
        if (last?.tool === 'sticky' && last.points.length >= 4) {
          const nx = Math.min(last.points[0], last.points[2]) + 8;
          const ny = Math.min(last.points[1], last.points[3]) + 8;
          p.setTextInput({ x: nx, y: ny, value: '', targetIdx: latest.length - 1 });
        }
        return latest;
      });
      return;
    }

    p.setElements(latest => {
      if (latest.length === 0) { p.saveHistoryWith(latest); return latest; }
      const last = latest[latest.length - 1];

      if (last.tool === 'pen' && (p.isSmartShapeRef.current || p.isSmoothingRef.current)) {
        const upd = [...latest];
        if (p.isSmartShapeRef.current) {
          const detected = detectSmartShape(last);
          if (detected) {
            upd[upd.length - 1] = detected;
            p.saveHistoryWith(upd);
            p.socket.emit('update_element', detected);
            setTimeout(() => p.showToast('도형이 자동 인식되었습니다 ✨', 'info'), 0);
            return upd;
          }
        }
        if (p.isSmoothingRef.current && last.points.length > 6) {
          const simplified = simplifyPoints(last.points, 3);
          const smoothed = smoothPoints(simplified, 3);
          const newEl = { ...last, points: smoothed };
          upd[upd.length - 1] = newEl;
          p.socket.emit('update_element', newEl);
        }
        p.saveHistoryWith(upd);
        return upd;
      }

      p.saveHistoryWith(latest);
      return latest;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.saveHistoryWith, p.showToast, p.toolRef, p.isSmartShapeRef, p.isSmoothingRef]);

  const handleDblClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (p.tool !== 'select') return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = p.getCanvasPos(stage);
    if (!pos) return;
    const idx = getElementAtPoint(p.elements, pos.x, pos.y);
    if (idx === null) return;
    const el = p.elements[idx];
    if (el.locked) return;
    if (el.tool === 'text') {
      p.setTextInput({ x: el.points[0], y: el.points[1], value: el.text || '', targetIdx: idx });
    } else if (el.tool === 'sticky') {
      const nx = Math.min(el.points[0], el.points[2]) + 8;
      const ny = Math.min(el.points[1], el.points[3]) + 8;
      p.setTextInput({ x: nx, y: ny, value: el.text || '', targetIdx: idx });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.tool, p.elements, p.getCanvasPos]);

  return { handleMouseDown, handleMouseMove, handleMouseUp, handleDblClick };
}
