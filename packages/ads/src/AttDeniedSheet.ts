import React, { useEffect, useRef, useState } from 'react';
import {
  ATT_PRIMER_TEXTS, attSheetTexts, loadRN, loadTracking, readStatus, registerAttHost,
  type AttPrimerTexts, type AttSheetTexts, type AttStorage,
} from './attSheet';

/**
 * ATT 안내 화면 — 앱 루트에 한 번 붙인다(`<AttDeniedSheet appName="…" />`). **붙이는 것만으로는 아무것도 뜨지 않는다.**
 * `ads.requestTracking()` · `ensureTrackingBeforeOfferwall()` 이 부를 때만 두 가지 중 하나가 열린다(1.9.11).
 *
 * ① 중립 안내(`primer`) — 시스템 ATT 창 바로 앞. 상태가 미정일 때만, 한 번, 버튼 「계속」 하나. 누르면 곧바로 시스템 창.
 *    닫기 · 건너뛰기가 없다(건너뛰고 다시 묻지 않는다). 시스템 창을 흉내 내지 않는다.
 * ② 거부 · 제한 단계 시트(`sheet`) — 사용자가 오퍼월/참여형 미션을 눌러 `ensureTrackingBeforeOfferwall` 이 불렸을 때만.
 *    「설정에서 허용하기」 → 설정 앱, 돌아와 허용됐으면 닫는다. 닫아도 오퍼월 진입은 막지 않는다.
 * 앱을 켤 때 · 홈에서 스스로 열리는 일은 없다. iOS 가 아니면 아무것도 그리지 않는다. 안 뜨는 경우에도 던지지 않는다.
 */

export type AttSheetTheme = {
  background?: string;
  text?: string;
  subText?: string;
  /** 번호 동그라미 · 주 버튼(「계속」 · 「설정에서 허용하기」) */
  primary?: string;
  primaryText?: string;
  overlay?: string;
};

export type AttDeniedSheetProps = {
  /** 설정 앱 목록에 보이는 앱 이름 — 단계 시트의 셋째 줄에 들어간다 */
  appName: string;
  theme?: AttSheetTheme;
  /** 1.9.11 부터 쓰이지 않는다(옛 호출 코드가 그대로 컴파일되도록 남김) */
  storage?: AttStorage;
  /** 거부 · 제한 단계 시트 문구 덮어쓰기(선택) — 빠진 항목은 기본 문구 */
  texts?: Partial<AttSheetTexts>;
  /** 시스템 창 앞 중립 안내 문구 덮어쓰기(선택) — 빠진 항목은 `ATT_PRIMER_TEXTS` */
  primerTexts?: Partial<AttPrimerTexts>;
};

const DEFAULT_THEME: Required<AttSheetTheme> = {
  background: '#ffffff',
  text: '#111111',
  subText: '#666666',
  primary: '#2563eb',
  primaryText: '#ffffff',
  overlay: 'rgba(0,0,0,0.4)',
};

/** 안내가 사라지는 동안(페이드 · 슬라이드) — 이 뒤에 시스템 창 · 오퍼월 화면을 올려야 iOS 가 겹쳐서 놓치지 않는다 */
export const DISMISS_MS = 400;

type Mode = 'none' | 'primer' | 'sheet';

export function AttDeniedSheet({ appName, theme, texts, primerTexts }: AttDeniedSheetProps) {
  const [mode, setMode] = useState<Mode>('none');
  // 열려 있는 동안 기다리는 쪽 — 사라지면 풀어 준다
  const pending = useRef<(() => void) | null>(null);
  // 「설정에서 허용하기」를 누르고 설정 앱에 가 있는 동안 — 돌아오면 다시 확인한다
  const awaitingSettings = useRef(false);
  const rn = loadRN();
  const ios = !!rn && String(rn?.Platform?.OS ?? '') === 'ios';
  const th = { ...DEFAULT_THEME, ...(theme ?? {}) };
  const tx = attSheetTexts(appName, texts);
  const pr: AttPrimerTexts = { ...ATT_PRIMER_TEXTS, ...(primerTexts ?? {}) };
  const h = React.createElement;

  const finish = (): void => {
    const f = pending.current;
    pending.current = null;
    try { f?.(); } catch { /* noop */ }
  };

  /** 화면을 내리고, 사라진 뒤에 기다리던 쪽을 푼다 */
  const dismiss = (): void => {
    awaitingSettings.current = false;
    setMode('none');
    setTimeout(finish, DISMISS_MS);
  };

  const open = (next: Mode, done: () => void): void => {
    pending.current = done;
    setMode(next);
  };

  // 호출이 안내를 열 수 있게 등록한다 — 등록만 하고 스스로는 열지 않는다
  useEffect(() => {
    if (!ios) return;
    registerAttHost({ primer: (done) => open('primer', done), sheet: (done) => open('sheet', done) });

    return () => { registerAttHost(null); finish(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ios]);

  // 설정에서 돌아왔을 때 허용됐으면 닫는다(단계 시트)
  useEffect(() => {
    if (!ios) return;
    const AppState = rn?.AppState;
    if (!AppState || typeof AppState.addEventListener !== 'function') return;
    const tracking = loadTracking();
    const sub = AppState.addEventListener('change', (s: string) => {
      if (s !== 'active' || !awaitingSettings.current || !tracking) return;
      void readStatus(tracking).then((st) => { if (st === 'granted') dismiss(); }).catch(() => undefined);
    });

    return () => { try { sub?.remove?.(); } catch { /* noop */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ios]);

  if (!ios) return null;

  const openSettings = (): void => {
    awaitingSettings.current = true;
    try { void Promise.resolve(rn.Linking.openSettings()).catch(() => undefined); } catch { /* noop */ }
  };

  const stepRow = (text: string, i: number) => h(rn.View, { key: String(i), style: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 } },
    h(rn.View, { style: { width: 22, height: 22, borderRadius: 11, backgroundColor: th.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 } },
      h(rn.Text, { style: { color: th.primaryText, fontSize: 12, fontWeight: '700' } }, String(i + 1))),
    h(rn.Text, { style: { flex: 1, color: th.text, fontSize: 15, lineHeight: 21 } }, text));

  // ① 중립 안내 — 가운데 카드, 버튼 하나. 닫기 · 뒤로가기로 건너뛸 수 없다(onRequestClose 는 아무것도 안 한다)
  const primer = h(rn.Modal, { key: 'primer', visible: mode === 'primer', transparent: true, animationType: 'fade', onRequestClose: () => undefined },
    h(rn.View, { style: { flex: 1, backgroundColor: th.overlay, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 } },
      h(rn.View, { style: { width: '100%', maxWidth: 360, backgroundColor: th.background, borderRadius: 16, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16 } },
        h(rn.Text, { style: { color: th.text, fontSize: 17, fontWeight: '700', lineHeight: 24 } }, pr.title),
        h(rn.Text, { style: { color: th.subText, fontSize: 14, marginTop: 10, lineHeight: 20 } }, pr.body),
        h(rn.TouchableOpacity, { onPress: dismiss, accessibilityRole: 'button', style: { marginTop: 18, backgroundColor: th.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' } },
          h(rn.Text, { style: { color: th.primaryText, fontSize: 16, fontWeight: '700' } }, pr.button)))));

  // ② 거부 · 제한 단계 시트
  const sheet = h(rn.Modal, { key: 'sheet', visible: mode === 'sheet', transparent: true, animationType: 'slide', onRequestClose: dismiss },
    h(rn.View, { style: { flex: 1, backgroundColor: th.overlay, justifyContent: 'flex-end' } },
      h(rn.View, { style: { backgroundColor: th.background, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 30 } },
        h(rn.Text, { style: { color: th.text, fontSize: 18, fontWeight: '700', lineHeight: 25 } }, tx.title),
        tx.body ? h(rn.Text, { style: { color: th.subText, fontSize: 14, marginTop: 8, lineHeight: 20 } }, tx.body) : null,
        ...tx.steps.map((s, i) => stepRow(s, i)),
        h(rn.Text, { style: { color: th.text, fontSize: 14, marginTop: 16, lineHeight: 20 } }, tx.guide),
        h(rn.Text, { style: { color: th.subText, fontSize: 12, marginTop: 8, lineHeight: 17 } }, tx.fallback),
        h(rn.TouchableOpacity, { onPress: openSettings, accessibilityRole: 'button', style: { marginTop: 18, backgroundColor: th.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' } },
          h(rn.Text, { style: { color: th.primaryText, fontSize: 16, fontWeight: '700' } }, tx.openSettings)),
        h(rn.TouchableOpacity, { onPress: dismiss, accessibilityRole: 'button', style: { marginTop: 8, paddingVertical: 12, alignItems: 'center' } },
          h(rn.Text, { style: { color: th.subText, fontSize: 15 } }, tx.later)))));

  return h(React.Fragment, null, primer, sheet);
}
