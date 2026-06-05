import { useEffect } from "react";

import { useStore } from "@/tab/store";

export const useConfig = () => {
  const config = useStore((state) => state.config);
  const configInitialized = useStore((state) => state.configInitialized);
  const initializeConfig = useStore((state) => state.initializeConfig);

  useEffect(() => {
    initializeConfig();
  }, [initializeConfig]);

  return { config, isLoading: !configInitialized };
};
