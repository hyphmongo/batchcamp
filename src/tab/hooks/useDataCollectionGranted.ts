import { useEffect, useState } from "react";

import { isDataCollectionGranted } from "@/shared/data-collection";
import { dataCollectionStore } from "@/storage";

export const useDataCollectionGranted = (): boolean => {
  const [granted, setGranted] = useState(true);
  useEffect(() => {
    let active = true;
    void isDataCollectionGranted().then((value) => {
      if (active) {
        setGranted(value);
      }
    });
    const unwatch = dataCollectionStore.watch((value) => {
      setGranted(value.granted);
    });
    return () => {
      active = false;
      unwatch();
    };
  }, []);
  return granted;
};
