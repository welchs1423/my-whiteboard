import { useEffect, type MutableRefObject } from 'react';
import type { Socket } from 'socket.io-client';
import type { DrawElement, ToolType } from '../utils/elementHelpers';
import { generateId, moveElementBy } from '../utils/elementHelpers';

interface UseKeyboardShortcutsParams {
  socket: Socket;
  elementsRef: MutableRefObject<DrawElement[]>;
  selectedIndicesRef: MutableRefObject<Set<number>>;
  showHelpRef: MutableRefObject<boolean>;
  clipboard: MutableRefObject<DrawElement | null>;
  setElements: React.Dispatch<React.SetStateAction<DrawElement[]>>;
  setSelectedIndices: React.Dispatch<React.SetStateAction<Set<number>>>;
  setTool: React.Dispatch<React.SetStateAction<ToolType>>;
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>;
  setStageScale: React.Dispatch<React.SetStateAction<number>>;
  setStagePos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  handleUndo: () => void;
  handleRedo: () => void;
  handleZoomToFit: () => void;
  handleGroup: () => void;
  handleUngroup: () => void;
  saveHistoryWith: (els: DrawElement[]) => void;
}

export function useKeyboardShortcuts({
  socket,
  elementsRef, selectedIndicesRef, showHelpRef, clipboard,
  setElements, setSelectedIndices, setTool, setShowHelp,
  setStageScale, setStagePos,
  handleUndo, handleRedo, handleZoomToFit, handleGroup, handleUngroup,
  saveHistoryWith,
}: UseKeyboardShortcutsParams) {
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
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        if (e.shiftKey) { handleUngroup(); } else { handleGroup(); }
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
          t: 'text', l: 'straight', a: 'arrow', s: 'select', n: 'sticky', v: 'triangle', b: 'table',
        };
        if (map[e.key]) { setTool(map[e.key]); setSelectedIndices(new Set()); }
      }

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
