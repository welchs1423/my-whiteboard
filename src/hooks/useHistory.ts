import { useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import type { DrawElement } from '../utils/elementHelpers';

export function useHistory(
  setElements: React.Dispatch<React.SetStateAction<DrawElement[]>>,
  setSelectedIndices: React.Dispatch<React.SetStateAction<Set<number>>>,
  socket: Socket,
) {
  const historyRef = useRef<DrawElement[][]>([[]]);
  const historyStepRef = useRef(0);

  const saveHistoryWith = useCallback((els: DrawElement[]) => {
    const h = historyRef.current.slice(0, historyStepRef.current + 1);
    h.push([...els]);
    historyRef.current = h;
    historyStepRef.current = h.length - 1;
  }, []);

  const handleUndo = useCallback(() => {
    if (historyStepRef.current <= 0) return;
    historyStepRef.current--;
    const prev = historyRef.current[historyStepRef.current];
    setElements([...prev]);
    setSelectedIndices(new Set());
    socket.emit('draw_line', prev);
  }, [setElements, setSelectedIndices, socket]);

  const handleRedo = useCallback(() => {
    if (historyStepRef.current >= historyRef.current.length - 1) return;
    historyStepRef.current++;
    const next = historyRef.current[historyStepRef.current];
    setElements([...next]);
    setSelectedIndices(new Set());
    socket.emit('draw_line', next);
  }, [setElements, setSelectedIndices, socket]);

  return { saveHistoryWith, handleUndo, handleRedo, historyRef, historyStepRef };
}
