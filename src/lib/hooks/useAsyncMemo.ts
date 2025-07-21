import { useEffect, useState } from "react";

export function useAsyncMemo<T>(
  factory: () => Promise<T>,
  deps: any[]
): T | undefined {
  const [value, setValue] = useState<T>();

  useEffect(() => {
    let cancelled = false;
    factory().then((result) => {
      if (!cancelled) setValue(result);
    });
    return () => {
      cancelled = true;
    };
  }, deps);

  return value;
}
