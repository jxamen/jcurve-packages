export interface ChancePromoCopy { title: string; subtitle: string; footer: string; iosNote: string }
export const DEFAULT_COPY: ChancePromoCopy = {
  title: '새로운 「찬스」가 생겼어요!',
  subtitle: '앱 설치 · 가입만 해도 포인트가 왕창',
  footer: '찬스 탭에서 바로 확인해 보세요',
  iosNote: '아이폰은 「앱 추적 허용」을 눌러야 포인트가 쌓여요',
};
export function readPromo(value: unknown): ChancePromoCopy | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!Object.keys(DEFAULT_COPY).every(k => typeof v[k] === 'string' && (v[k] as string).trim().length > 0)) return null;
  return Object.fromEntries(Object.keys(DEFAULT_COPY).map(k => [k, v[k]])) as unknown as ChancePromoCopy;
}
/** Automatic dismissal: 2.5s. Explicit skip: 1.5s. Neither can bypass loading. */
export function canDismiss(elapsed: number, ready: boolean, skip: boolean): boolean {
  return ready && elapsed >= (skip ? 1500 : 2500);
}
