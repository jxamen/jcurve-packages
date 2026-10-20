/** Only the verified Toss optimizer width is changed; preserve source and quality. */
export function productImage(uri: string, width: number, density: number): string {
  if (!/^https:\/\/resources-fe\.toss\.im\/image-optimize\/width=\d+(?:,|\/)/i.test(uri)) return uri;
  const pixels = Math.ceil(width * Math.min(3, Math.max(2, density)));
  if (!Number.isFinite(pixels) || pixels <= 0) return uri;
  return uri.replace(/(\/image-optimize\/width=)(\d+)/, (_, prefix, current) => prefix + Math.max(Number(current), pixels));
}
