export type LoadingToggle = {
  start: () => void;
  stop: () => void;
};

export const createLoadingToggle = (button: HTMLElement): LoadingToggle => {
  const loadingSpan = document.createElement("span");
  let label = "";

  return {
    start: () => {
      label = button.textContent || "";
      button.textContent = "";
      button.appendChild(loadingSpan);
      loadingSpan.classList.add("bc-loading");
    },
    stop: () => {
      loadingSpan.classList.remove("bc-loading");
      button.textContent = label;
    },
  };
};

export const createRunGuard = (loading: LoadingToggle) => {
  let isRunning = false;
  return (run: () => Promise<void>) => async () => {
    if (isRunning) {
      return;
    }
    isRunning = true;
    try {
      loading.start();
      await run();
    } finally {
      loading.stop();
      isRunning = false;
    }
  };
};
