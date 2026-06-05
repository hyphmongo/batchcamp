import { useEffect, useState } from "react";

import { backgroundStore } from "@/storage";

export const useAwaitingInitialItems = (totalCount: number): boolean => {
  const [awaiting, setAwaiting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const settle = () => {
      if (!cancelled) {
        setAwaiting(false);
      }
    };
    const timeout = setTimeout(settle, 2500);
    backgroundStore
      .get()
      .then(({ items }) => {
        if (items.length === 0) {
          settle();
        }
      })
      .catch(settle);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (totalCount > 0) {
      setAwaiting(false);
    }
  }, [totalCount]);

  return awaiting;
};
