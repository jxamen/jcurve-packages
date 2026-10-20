import React, { useEffect, useRef, useState } from 'react';
import {
  attSheetTexts, launchCheck, loadRN, loadTracking, localDay, memoryStorage, readStatus, setAttSheetOpener,
  type AttSheetTexts, type AttStorage,
} from './attSheet';

/**
 * ATT 거부 안내 시트 화면 — 앱 루트에 한 번 붙인다(`<AttDeniedSheet appName="…" />`).
 *
 * - 켤 때: 거부·제한이고 오늘 아직 안 보였으면 띄운다. 미정이면 시스템 창(시트 아님).
 * - 오퍼월 전: `ensureTrackingBeforeOfferwall()` 이 이 시트를 연다(매번).
 * - 「설정에서 허용하기」 → 설정 앱. 앱으로 돌아와 허용됐으면 시트를 닫는다.
 * iOS 가 아니면 아무것도 그리지 않는다. 시트가 안 뜨는 경우에도 던지지 않는다.
 */

export type AttSheetTheme = {
  background?: string;
  text?: string;
  subText?: string;
  /** 번호 동그라미 · 「설정에서 허용하기」 버튼 */
  primary?: string;
  primaryText?: string;
  overlay?: string;
};

export type AttDeniedSheetProps = {
  /** 설정 앱 목록에 보이는 앱 이름 — 셋째 줄에 들어간다 */
  appName: string;
  theme?: AttSheetTheme;
  /** 마지막으로 띄운 날을 적어 둘 곳(선택) — 없으면 메모리(앱을 끄면 잊는다) */
  storage?: AttStorage;
  /** 문구 덮어쓰기(선택) — 빠진 항목은 기본 문구 */
  texts?: Partial<AttSheetTexts>;
};

const DEFAULT_THEME: Required<AttSheetTheme> = {
  background: '#ffffff',
  text: '#111111',
  subText: '#666666',
  primary: '#2563eb',
  primaryText: '#ffffff',
  overlay: 'rgba(0,0,0,0.4)',
};

/** 앱이 앞에 올라온 뒤 잠깐 — 첫 화면이 그려지기 전에 시스템 창이 뜨면 뒤가 빈 화면이다(ads.ts 와 같은 0.6초) */
const SETTLE_MS = 600;

function whenActive(rn: any): Promise<void> {
  return new Promise<void>((resolve) => {
    const st = rn?.AppState;
    if (!st || st.currentState === 'active') { resolve(); return; }
    let sub: { remove: () => void } | null = null;
    try {
      sub = st.addEventListener('change', (s: string) => {
        if (s !== 'active') return;
        try { sub?.remove(); } catch { /* noop */ }
        resolve();
      });
    } catch { resolve(); }
  }).then(() => new Promise<void>((r) => setTimeout(r, SETTLE_MS)));
}

export function AttDeniedSheet({ appName, theme, storage, texts }: AttDeniedSheetProps) {
  const [visible, setVisible] = useState(false);
  // 시트가 열린 동안 기다리는 오퍼월 호출들 — 닫히면 한꺼번에 풀린다
  const waiters = useRef<Array<() => void>>([]);
  // 「설정에서 허용하기」를 누르고 설정 앱에 가 있는 동안 — 돌아오면 다시 확인한다
  const awaitingSettings = useRef(false);
  const rn = loadRN();
  const ios = !!rn && String(rn?.Platform?.OS ?? '') === 'ios';
  const th = { ...DEFAULT_THEME, ...(theme ?? {}) };
  const tx = attSheetTexts(appName, texts);
  const h = React.createElement;

  const close = (): void => {
    awaitingSettings.current = false;
    setVisible(false);
    const ws = waiters.current;
    waiters.current = [];
    ws.forEach((f) => { try { f(); } catch { /* noop */ } });
  };

  const open = (done?: () => void): void => {
    if (done) waiters.current.push(done);
    setVisible(true);
  };

  // 켤 때 한 번 — 거부·제한이면 시트(하루 한 번), 미정이면 시스템 창
  useEffect(() => {
    if (!ios) return;
    let alive = true;
    void launchCheck({
      os: 'ios',
      tracking: loadTracking(),
      storage: storage ?? memoryStorage,
      today: () => localDay(new Date()),
      beforeRequest: () => whenActive(rn),
    }).then((action) => { if (alive && action === 'show') open(); }).catch(() => undefined);

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ios]);

  // 오퍼월 호출이 시트를 열 수 있게 등록한다
  useEffect(() => {
    if (!ios) return;
    setAttSheetOpener((done) => open(done));

    return () => { setAttSheetOpener(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ios]);

  // 설정에서 돌아왔을 때 허용됐으면 닫는다
  useEffect(() => {
    if (!ios) return;
    const AppState = rn?.AppState;
    if (!AppState || typeof AppState.addEventListener !== 'function') return;
    const tracking = loadTracking();
    const sub = AppState.addEventListener('change', (s: string) => {
      if (s !== 'active' || !awaitingSettings.current || !tracking) return;
      void readStatus(tracking).then((st) => { if (st === 'granted') close(); }).catch(() => undefined);
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

  return h(rn.Modal, { visible, transparent: true, animationType: 'slide', onRequestClose: close },
    h(rn.View, { style: { flex: 1, backgroundColor: th.overlay, justifyContent: 'flex-end' } },
      h(rn.View, { style: { backgroundColor: th.background, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 30 } },
        h(rn.Text, { style: { color: th.text, fontSize: 18, fontWeight: '700' } }, tx.title),
        h(rn.Text, { style: { color: th.subText, fontSize: 14, marginTop: 8, lineHeight: 20 } }, tx.body),
        ...tx.steps.map((s, i) => stepRow(s, i)),
        h(rn.Text, { style: { color: th.text, fontSize: 14, marginTop: 16, lineHeight: 20 } }, tx.guide),
        h(rn.Text, { style: { color: th.subText, fontSize: 12, marginTop: 8, lineHeight: 17 } }, tx.fallback),
        h(rn.TouchableOpacity, { onPress: openSettings, accessibilityRole: 'button', style: { marginTop: 18, backgroundColor: th.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' } },
          h(rn.Text, { style: { color: th.primaryText, fontSize: 16, fontWeight: '700' } }, tx.openSettings)),
        h(rn.TouchableOpacity, { onPress: close, accessibilityRole: 'button', style: { marginTop: 8, paddingVertical: 12, alignItems: 'center' } },
          h(rn.Text, { style: { color: th.subText, fontSize: 15 } }, tx.later)))));
}
