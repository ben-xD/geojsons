export const range = (start: number, end: number) =>
  Array.from({ length: end - start }, (_, i) => i + start);
