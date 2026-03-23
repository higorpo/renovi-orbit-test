import { useEffect, useState } from "react";
import { getQuestionResponseImageUrl } from "../api/clientBudgets.api";

export function useQuestionResponseImageUrls(
  paths: string[] | null | undefined
): { urls: string[]; isLoading: boolean } {
  const [urls, setUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(paths?.length));

  useEffect(() => {
    if (!paths || paths.length === 0) {
      setUrls([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    Promise.all(paths.map((path) => getQuestionResponseImageUrl(path))).then((result) => {
      if (!cancelled) {
        setUrls(result.filter(Boolean));
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [paths?.join(",") ?? ""]);

  return { urls, isLoading };
}
