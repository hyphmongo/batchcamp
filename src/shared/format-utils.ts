export const formatSizeMb = (sizeMb: number): string =>
  sizeMb >= 1024
    ? `${(sizeMb / 1024).toFixed(1)} gb`
    : `${Math.round(sizeMb)} mb`;
