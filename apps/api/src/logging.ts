export function errorForLogging(error: unknown): Error {
  const source = error instanceof Error ? error : new Error(String(error));
  const safeError = new Error(source.message);
  Object.defineProperty(safeError, "name", {
    configurable: true,
    value: source.name,
    writable: true,
  });
  safeError.stack = source.stack;
  return safeError;
}
