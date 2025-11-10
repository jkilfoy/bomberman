let current = 0;

export function createEntityId(prefix: string) {
  current += 1;
  return `${prefix}-${current}`;
}
