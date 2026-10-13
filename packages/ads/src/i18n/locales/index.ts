/**
 * 언어 표 모음 — 한국어 원문이 열쇠, 값이 그 언어 문구.
 * 언어를 더할 때: 같은 모양으로 `ja.ts` 를 만들고 아래에 `ja,` 한 줄만 더한다.
 */
import en from './en';

export type Table = Readonly<Record<string, string>>;

export const LOCALES: Readonly<Record<string, Table | undefined>> = {
  en,
};
