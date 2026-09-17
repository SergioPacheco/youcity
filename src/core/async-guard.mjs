export function createRequestGuard() {
  let current = 0;

  return {
    next() {
      current += 1;
      return current;
    },
    isCurrent(token) {
      return token === current;
    }
  };
}
