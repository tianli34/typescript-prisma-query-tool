import { useState, useCallback } from 'react';

export function useCommandHistory() {
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);

  const push = useCallback((cmd: string) => {
    setHistory(prev => {
      const filtered = prev.filter(c => c !== cmd);
      return [cmd, ...filtered].slice(0, 100);
    });
    setCursor(-1);
  }, []);

  const up = useCallback((current: string, history: string[]): string => {
    const next = cursor + 1;
    if (next < history.length) {
      setCursor(next);
      return history[next];
    }
    return current;
  }, [cursor]);

  const down = useCallback((history: string[]): string => {
    const next = cursor - 1;
    if (next >= 0) {
      setCursor(next);
      return history[next];
    }
    setCursor(-1);
    return '';
  }, [cursor]);

  return { history, push, up, down };
}
