/** Loads images in memory so swapping `img.src` does not flash empty. */
export async function preloadImageUrls(urls: readonly string[]): Promise<boolean> {
  if (urls.length === 0) return true;

  const results = await Promise.all(
    urls.map(
      (url) =>
        new Promise<boolean>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = url;
        }),
    ),
  );

  return results.every(Boolean);
}
