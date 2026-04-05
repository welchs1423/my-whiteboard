import { useState, useRef, useCallback, useLayoutEffect } from 'react';
import Konva from 'konva';

export function useViewport() {
  // ── 상태 ──
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // ── Refs ──
  const stagePosRef = useRef({ x: 0, y: 0 });
  const stageScaleRef = useRef(1);
  const spaceHeldRef = useRef(false);
  const lastViewportEmit = useRef(0);
  const lastCursorEmit = useRef(0);

  // ── Ref 동기화 ──
  useLayoutEffect(() => { stagePosRef.current = stagePos; }, [stagePos]);
  useLayoutEffect(() => { stageScaleRef.current = stageScale; }, [stageScale]);
  useLayoutEffect(() => { spaceHeldRef.current = isSpaceHeld; }, [isSpaceHeld]);

  // ── 좌표 변환 ──
  const getCanvasPos = useCallback((stage: Konva.Stage): { x: number; y: number } | null => {
    const p = stage.getPointerPosition();
    if (!p) return null;
    return {
      x: (p.x - stagePosRef.current.x) / stageScaleRef.current,
      y: (p.y - stagePosRef.current.y) / stageScaleRef.current,
    };
  }, []);

  const canvasToScreen = useCallback((cx: number, cy: number) => ({
    x: cx * stageScaleRef.current + stagePosRef.current.x,
    y: cy * stageScaleRef.current + stagePosRef.current.y,
  }), []);

  const screenToCanvas = useCallback((sx: number, sy: number) => ({
    x: (sx - stagePosRef.current.x) / stageScaleRef.current,
    y: (sy - stagePosRef.current.y) / stageScaleRef.current,
  }), []);

  return {
    stageScale, setStageScale,
    stagePos, setStagePos,
    isSpaceHeld, setIsSpaceHeld,
    stageSize, setStageSize,
    stagePosRef,
    stageScaleRef,
    spaceHeldRef,
    lastViewportEmit,
    lastCursorEmit,
    getCanvasPos,
    canvasToScreen,
    screenToCanvas,
  };
}
