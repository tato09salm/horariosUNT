import { useState, useCallback } from 'react';

export function useHorarioHistory(initialState: any[]) {
  const [history, setHistory] = useState<any[][]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const setAsignacionesIniciales = useCallback((newState: any[]) => {
    setHistory([newState]);
    setCurrentIndex(0);
  }, []);

  const commitMove = useCallback((newState: any[]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push(newState);
      return newHistory;
    });
    setCurrentIndex(prev => prev + 1);
  }, [currentIndex]);

  const undo = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  }, []);

  const redo = useCallback(() => {
    setHistory(prev => {
      setCurrentIndex(curr => Math.min(prev.length - 1, curr + 1));
      return prev; 
    });
  }, []);

  return {
    asignaciones: history[currentIndex] || [],
    setAsignacionesIniciales,
    commitMove,
    undo,
    redo,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
  };
}
