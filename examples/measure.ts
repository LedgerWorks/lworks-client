export async function measureExecutionTime<T>(
  cb: () => Promise<T>
): Promise<{ elapsedTime: number; results: T }> {
  const startedAt = Date.now();
  const results = await cb();
  return {
    elapsedTime: Date.now() - startedAt,
    results,
  };
}
