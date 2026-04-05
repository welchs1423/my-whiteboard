import { useCallback } from 'react';
import type { RefObject, MutableRefObject, Dispatch, SetStateAction } from 'react';
import Konva from 'konva';
import type { Socket } from 'socket.io-client';
import type { DrawElement, ToolType, DashStyle, Bounds, LineCapStyle } from '../utils/elementHelpers';
import {
  generateId, getElementAtPoint, getElementsInRect, moveElementBy,
  smoothPoints, simplifyPoints, detectSmartShape,
} from '../utils/elementHelpers';

// ── 로컬 인터페이스 ──
interface EmojiReaction { id: string; x: number; y: number; emoji: string; nickname: string; }
interface TextInputState { x: number; y: number; value: string; targetIdx?: number; width?: number; height?: number; }

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
  lastPenTime: MutableRefObject<number>;       // 속도 감응 pen
  bezierPhase: MutableRefObject<number>;       // 0=idle 1=has-start 2=has-end
  bezierAnchor: MutableRefObject<number[]>;    // [sx,sy] or [sx,sy,ex,ey]
  connectorPhase: MutableRefObject<number>;    // 0=idle 1=has-first
  connectorFirst: MutableRefObject<{ id: string; x: number; y: number } | null>;
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
  currentLineCap: LineCapStyle;
  currentOpacity: number;
  stickyBg: string;
  currentShapeName: string;   // 도형 라이브러리 기본 선택
  gradientColors: [string, string] | null;
  gradientAngle: number;
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

    // ── 베지어 곡선 (3클릭: 시작→끝→커트롤포인트) ──
    if (p.tool === 'bezier') {
      if (p.bezierPhase.current === 0) {
        // 1클릭: 시작
        p.bezierAnchor.current = [p.snap(pos.x), p.snap(pos.y)];
        p.bezierPhase.current = 1;
        const newEl: DrawElement = {
          id: generateId(), tool: 'bezier',
          points: [p.snap(pos.x), p.snap(pos.y), p.snap(pos.x), p.snap(pos.y), p.snap(pos.x), p.snap(pos.y)],
          color: p.currentColor, strokeWidth: p.strokeWidth,
          filled: p.isFilled, dash: p.currentDash, opacity: p.currentOpacity, lineCap: p.currentLineCap,
        };
        p.isDrawing.current = true;
        p.setElements(prev => { const upd = [...prev, newEl]; p.socket.emit('update_element', newEl); return upd; });
      } else if (p.bezierPhase.current === 1) {
        // 2클릭: 끝점 고정
        p.bezierAnchor.current = [...p.bezierAnchor.current, p.snap(pos.x), p.snap(pos.y)];
        p.bezierPhase.current = 2;
      } else if (p.bezierPhase.current === 2) {
        // 3클릭: 커트론 포인트 고정 → 완성
        p.setElements(latest => {
          const upd = [...latest];
          const last = { ...upd[upd.length - 1] };
          const [sx, sy, ex, ey] = p.bezierAnchor.current;
          last.points = [sx, sy, p.snap(pos.x), p.snap(pos.y), ex, ey];
          upd[upd.length - 1] = last;
          p.saveHistoryWith(upd);
          p.socket.emit('update_element', last);
          return upd;
        });
        p.bezierPhase.current = 0;
        p.bezierAnchor.current = [];
        p.isDrawing.current = false;
      }
      return;
    }

    // ── 커넥터 (2클릭: 첫 요소 → 두 번째 요소) ──
    if (p.tool === 'connector') {
      const clickedIdx = getElementAtPoint(p.elements, pos.x, pos.y);
      if (p.connectorPhase.current === 0) {
        if (clickedIdx !== null) {
          p.connectorFirst.current = { id: p.elements[clickedIdx].id!, x: pos.x, y: pos.y };
          p.connectorPhase.current = 1;
          p.showToast('두 번째 요소를 클릭하세요', 'info');
        }
      } else {
        const first = p.connectorFirst.current!;
        const newEl: DrawElement = {
          id: generateId(), tool: 'connector',
          points: [first.x, first.y, pos.x, pos.y],
          color: p.currentColor, strokeWidth: p.strokeWidth,
          dash: p.currentDash, opacity: p.currentOpacity,
          connectorFrom: first.id,
          connectorTo: clickedIdx !== null ? p.elements[clickedIdx].id : undefined,
        };
        p.setElements(prev => {
          const upd = [...prev, newEl];
          p.saveHistoryWith(upd);
          p.socket.emit('update_element', newEl);
          return upd;
        });
        p.connectorPhase.current = 0;
        p.connectorFirst.current = null;
      }
      return;
    }

    // ── 핀 (댓글) ──
    if (p.tool === 'pin') {
      const newEl: DrawElement = {
        id: generateId(), tool: 'pin',
        points: [p.snap(pos.x), p.snap(pos.y)],
        color: p.currentColor, strokeWidth: 2,
        opacity: p.currentOpacity,
        pinText: '',
      };
      p.setElements(prev => {
        const upd = [...prev, newEl];
        p.saveHistoryWith(upd);
        p.socket.emit('update_element', newEl);
        return upd;
      });
      // 핀 텍스트 입력 모드
      p.setTextInput({ x: p.snap(pos.x) + 18, y: p.snap(pos.y) - 30, value: '', targetIdx: p.elementsRef.current!.length });
      return;
    }

    // ── 텍스트 ──
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
      ...(['pen','eraser','straight','arrow','bezier'].includes(p.tool) ? { lineCap: p.currentLineCap } : {}),
      ...(p.tool === 'sticky' ? { stickyBg: p.stickyBg } : {}),
      ...(p.tool === 'frame' ? { frameTitle: 'Frame' } : {}),
      ...(p.tool === 'shape' ? { shapeName: p.currentShapeName } : {}),
      ...(p.isFilled && p.gradientColors ? { gradientColors: p.gradientColors, gradientAngle: p.gradientAngle } : {}),
      ...(p.tool === 'pen' ? { widths: [p.strokeWidth] } : {}),
    };
    p.lastPenTime.current = Date.now();
    p.setElements(prev => {
      const upd = [...prev, newEl];
      p.socket.emit('update_element', newEl);
      return upd;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.contextMenu, p.elements, p.selectedIndices, p.tool, p.isEmojiMode, p.selectedEmoji, p.nickname, p.isViewOnly, p.currentColor, p.strokeWidth, p.isFilled, p.currentDash, p.currentLineCap, p.currentOpacity, p.stickyBg, p.currentShapeName, p.gradientColors, p.gradientAngle, p.getCanvasPos, p.snap, p.commitText]);

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
        const now = Date.now();
        const dt = Math.max(now - p.lastPenTime.current, 1);
        p.lastPenTime.current = now;
        const px = last.points[last.points.length - 2];
        const py = last.points[last.points.length - 1];
        const dist = Math.hypot(p.snap(point.x) - px, p.snap(point.y) - py);
        const speed = dist / dt; // px/ms
        // speed: fast (>2) = thin, slow (<0.1) = thick
        const minW = p.strokeWidth * 0.3;
        const maxW = p.strokeWidth * 1.6;
        const w = Math.min(maxW, Math.max(minW, maxW - (maxW - minW) * Math.min(speed / 2, 1)));
        last.points = [...last.points, p.snap(point.x), p.snap(point.y)];
        if (last.tool === 'pen') {
          last.widths = [...(last.widths || [p.strokeWidth]), w];
        }
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

    // 텍스트박스 mouseup: 텍스트 입력 모드 진입
    if (p.toolRef.current === 'textbox') {
      p.setElements(latest => {
        p.saveHistoryWith(latest);
        const last = latest[latest.length - 1];
        if (last?.tool === 'textbox' && last.points.length >= 4) {
          const nx = Math.min(last.points[0], last.points[2]) + 6;
          const ny = Math.min(last.points[1], last.points[3]) + 6;
          const w = Math.abs(last.points[2] - last.points[0]) - 12;
          const h = Math.abs(last.points[3] - last.points[1]) - 12;
          p.setTextInput({ x: nx, y: ny, value: '', targetIdx: latest.length - 1, width: w, height: h });
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
    } else if (el.tool === 'textbox') {
      const nx = Math.min(el.points[0], el.points[2]) + 6;
      const ny = Math.min(el.points[1], el.points[3]) + 6;
      const w = Math.abs(el.points[2] - el.points[0]) - 12;
      const h = Math.abs(el.points[3] - el.points[1]) - 12;
      p.setTextInput({ x: nx, y: ny, value: el.text || '', targetIdx: idx, width: w, height: h });
    } else if (el.tool === 'pin') {
      p.setTextInput({ x: el.points[0] + 18, y: el.points[1] - 30, value: el.pinText || el.text || '', targetIdx: idx });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.tool, p.elements, p.getCanvasPos]);

  return { handleMouseDown, handleMouseMove, handleMouseUp, handleDblClick };
}
