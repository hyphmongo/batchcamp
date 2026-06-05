import PQueue from "p-queue";
import { useEffect, useState } from "react";

export const useQueue = () => {
  const [queue] = useState(() => new PQueue({ autoStart: false }));

  useEffect(
    () => () => {
      queue.clear();
    },
    [queue],
  );

  return queue;
};
