const SAMPLE_WINDOW_MS = 5000;

const receivedBytes = new Map<string, number>();
let receivedTotal = 0;
let samples: { t: number; bytes: number }[] = [];
let listeners: (() => void)[] = [];

const notify = () => {
  for (const fn of listeners) {
    fn();
  }
};

const setBytes = (itemId: string, bytes: number) => {
  receivedTotal += bytes - (receivedBytes.get(itemId) ?? 0);
  receivedBytes.set(itemId, bytes);
};

const pruneSamples = (now: number) => {
  const cutoff = now - SAMPLE_WINDOW_MS;
  const firstFresh = samples.findIndex((sample) => sample.t >= cutoff);
  if (firstFresh > 0) {
    samples = samples.slice(firstFresh);
  } else if (firstFresh === -1 && samples.length > 0) {
    samples = [];
  }
};

export const onProgressChange = (listener: () => void) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((fn) => fn !== listener);
  };
};

export const reportBytes = (itemId: string, bytes: number) => {
  setBytes(itemId, bytes);
  const now = Date.now();
  samples.push({ t: now, bytes: receivedTotal });
  pruneSamples(now);
  notify();
};

export const finalizeBytes = (itemId: string, bytes: number) => {
  if (bytes <= (receivedBytes.get(itemId) ?? 0)) {
    return;
  }
  setBytes(itemId, bytes);
  notify();
};

export const dropProgress = (itemId: string) => {
  const prev = receivedBytes.get(itemId);
  if (prev !== undefined) {
    receivedTotal -= prev;
    receivedBytes.delete(itemId);
    notify();
  }
};

export const getProgress = (): {
  bytesReceived: number;
  bytesPerSecond: number | null;
} => {
  const now = Date.now();
  pruneSamples(now);

  if (samples.length < 2) {
    return { bytesReceived: receivedTotal, bytesPerSecond: null };
  }

  const oldest = samples[0]!;
  const newest = samples[samples.length - 1]!;
  const dt = (newest.t - oldest.t) / 1000;
  if (dt <= 0) {
    return { bytesReceived: receivedTotal, bytesPerSecond: null };
  }
  const db = newest.bytes - oldest.bytes;
  return { bytesReceived: receivedTotal, bytesPerSecond: db / dt };
};

export const resetProgress = () => {
  samples = [];
  receivedBytes.clear();
  receivedTotal = 0;
  notify();
};
