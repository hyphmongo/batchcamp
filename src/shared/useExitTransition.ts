import { useEffect, useState } from "react";

const EXIT_DURATION_MS = 140;

export const useExitTransition = (
  open: boolean,
  durationMs = EXIT_DURATION_MS,
) => {
  const [present, setPresent] = useState(open);

  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    if (!present) {
      return;
    }
    const timer = setTimeout(() => setPresent(false), durationMs);
    return () => clearTimeout(timer);
  }, [open, present, durationMs]);

  return { present, closing: present && !open };
};
