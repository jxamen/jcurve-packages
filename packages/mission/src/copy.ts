/**
 * 상태 화면(오류 · 점검 · 마감 등) 문구 — react-native 없이 읽히게 화면 파일에서 뗐다(시험이 문구만 본다, 0.2.1).
 */
import { t, type Lang } from './i18n';

export type StateKind = 'error' | 'maintenance' | 'maintenanceDaily' | 'session' | 'soldOut' | 'off' | 'notReady';

// 문구는 피그마 「리워드 선착순 마감, 에러 화면」(2026-10-12 읽은 노트) 그대로. 모양(아이콘 · 그라데이션)은 시안이 정해지면 바꾼다
const COPY: Record<StateKind, { title: string; body: string; button?: string; windowLabel?: string }> = {
  error: { title: '불러오지 못했어요', body: '네트워크를 확인하고 다시 시도해 주세요.', button: '다시 시도' },
  maintenance: { title: '지금은 시스템 점검 중이에요', body: '잠시 후 다시 이용해주세요!', windowLabel: '점검 예정 시간' },
  maintenanceDaily: { title: '지금은 잠깐 점검 중이에요', body: '곧 다시 열리니 조금만 기다려 주세요!', windowLabel: '점검 시간' },
  session: { title: '잘못된 접근이거나 세션이 만료됐어요', body: '잠시 후 다시 이용해주세요!' },
  soldOut: { title: '캠페인 선착순 마감', body: '회원분들의 많은 참여로 인해 캠페인이 마감되었습니다.', button: '다른 미션 보러가기' },
  off: { title: '지금은 참여할 수 없어요', body: '일주일 방문 미션이 준비되면 알려 드릴게요.' },
  notReady: { title: '곧 열려요', body: '미션을 준비하고 있어요. 조금만 기다려 주세요.' },
};

/** (0.2.1) 상태 화면 문구 — lang 이 없거나 'ko' 면 원문(피그마 문구) 그대로 */
export function stateCopy(kind: StateKind, lang?: Lang): { title: string; body: string; button?: string; windowLabel?: string } {
  const c = COPY[kind];
  if (!lang) return c;

  return {
    title: t(c.title, lang),
    body: t(c.body, lang),
    ...(c.button !== undefined ? { button: t(c.button, lang) } : {}),
    ...(c.windowLabel !== undefined ? { windowLabel: t(c.windowLabel, lang) } : {}),
  };
}

