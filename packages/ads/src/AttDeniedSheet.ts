import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ATT_DENIED_TEXTS, ATT_PRIMER_TEXTS, loadRN, registerAttHost, waitForReturn,
  type AttDeniedTexts, type AttPrimerTexts, type AttSheetTexts, type AttStorage,
} from './attSheet';

/**
 * ATT 안내 화면 — 앱 루트에 한 번 붙인다(`<AttDeniedSheet storage={AsyncStorage} />`). **붙이는 것만으로는 아무것도 뜨지 않는다.**
 * `ads.requestTracking()` · `ensureTrackingBeforeOfferwall()` 이 부를 때만 두 가지 중 하나가 열린다. 둘 다 화면 가운데 카드다.
 *
 * ① 중립 안내(`primer`) — 시스템 ATT 창 바로 앞. 상태가 미정일 때만, 한 번, 버튼 「계속」 하나. 누르면 곧바로 시스템 창.
 *    닫기 · 건너뛰기가 없다(건너뛰고 다시 묻지 않는다). 시스템 창을 흉내 내지 않는다.
 * ② 추적이 꺼져 있을 때의 팝업(`denied`, 1.9.13) — 사용자가 오퍼월/참여형 미션을 눌러 `ensureTrackingBeforeOfferwall` 이 불렸을 때만,
 *    하루 한 번. 「설정 열기」(설정 앱, 돌아오면 이어서) · 「그냥 보기」(바로 이어서) — **둘 다 오퍼월 진입을 막지 않는다.**
 * 앱을 켤 때 · 홈에서 스스로 열리는 일은 없다. iOS 가 아니면 아무것도 그리지 않는다. 안 뜨는 경우에도 던지지 않는다.
 */

export type AttSheetTheme = {
  background?: string;
  text?: string;
  subText?: string;
  /** 「계속」 버튼 */
  primary?: string;
  primaryText?: string;
  overlay?: string;
};

/**
 * (1.9.14) 앱이 자기 팝업 모양으로 그릴 때 받는 값. 문구 · 버튼 · 동작(하루 한 번 · 진입 안 막음)은 패키지가 정하고 **모양만** 앱 것이다.
 * - `primer`: 시스템 창 앞 중립 안내 — 버튼 하나(「계속」). 닫기 · 건너뛰기 버튼을 만들지 않는다.
 * - `denied`: 추적이 꺼져 있을 때 — 버튼 둘(「그냥 보기」 · 「설정 열기」, 이 순서). 같은 비중으로 그린다.
 * 버튼의 `onPress` 를 그대로 부르면 된다(안내를 닫고 이어서 간다).
 */
export type AttPopupRenderProps = {
  kind: 'primer' | 'denied';
  title: string;
  body: string;
  buttons: Array<{ label: string; onPress: () => void }>;
};

export type AttDeniedSheetProps = {
  /** 1.9.13 부터 쓰이지 않는다(단계 시트에서 앱 이름을 넣던 자리 — 옛 호출 코드가 그대로 컴파일되도록 남김) */
  appName?: string;
  theme?: AttSheetTheme;
  /** 가운데 팝업을 띄운 날을 적어 둘 곳(예 AsyncStorage) — 넘기면 「하루 한 번」이 앱을 껐다 켜도 지켜진다. 없으면 메모리(껐다 켜면 잊는다) */
  storage?: AttStorage;
  /** 1.9.13 부터 쓰이지 않는다(옛 단계 시트 문구 덮어쓰기) */
  texts?: Partial<AttSheetTexts>;
  /** 시스템 창 앞 중립 안내 문구 덮어쓰기(선택) — 빠진 항목은 `ATT_PRIMER_TEXTS` */
  primerTexts?: Partial<AttPrimerTexts>;
  /** 추적이 꺼져 있을 때의 팝업 문구 덮어쓰기(선택) — 빠진 항목은 `ATT_DENIED_TEXTS` */
  deniedTexts?: Partial<AttDeniedTexts>;
  /**
   * (1.9.14) 앱이 자기 팝업으로 그린다(선택) — 안내가 열려 있는 동안에만 불리고, 돌려준 요소(보통 앱의 Modal 팝업)를 그린다. 안 주면 기본 카드.
   * 훅을 쓰려면 함수 안에서 직접 쓰지 말고 컴포넌트를 돌려준다: `renderPopup={(p) => <AppPopup {...p} />}`.
   */
  renderPopup?: (p: AttPopupRenderProps) => ReactNode;
};

const DEFAULT_THEME: Required<AttSheetTheme> = {
  background: '#ffffff',
  text: '#111111',
  subText: '#666666',
  primary: '#2563eb',
  primaryText: '#ffffff',
  overlay: 'rgba(0,0,0,0.4)',
};

/** 안내가 사라지는 동안(페이드) — 이 뒤에 시스템 창 · 오퍼월 화면을 올려야 iOS 가 겹쳐서 놓치지 않는다 */
export const DISMISS_MS = 400;

type Mode = 'none' | 'primer' | 'denied';

export function AttDeniedSheet({ theme, storage, primerTexts, deniedTexts, renderPopup }: AttDeniedSheetProps) {
  const [mode, setMode] = useState<Mode>('none');
  // 열려 있는 동안 기다리는 쪽 — 사라지면 풀어 준다
  const pending = useRef<(() => void) | null>(null);
  const rn = loadRN();
  const ios = !!rn && String(rn?.Platform?.OS ?? '') === 'ios';
  const th = { ...DEFAULT_THEME, ...(theme ?? {}) };
  const pr: AttPrimerTexts = { ...ATT_PRIMER_TEXTS, ...(primerTexts ?? {}) };
  const dn: AttDeniedTexts = { ...ATT_DENIED_TEXTS, ...(deniedTexts ?? {}) };
  const h = React.createElement;

  const finish = (): void => {
    const f = pending.current;
    pending.current = null;
    try { f?.(); } catch { /* noop */ }
  };

  /** 화면을 내리고, 사라진 뒤에 기다리던 쪽을 푼다 */
  const dismiss = (): void => {
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
    registerAttHost({ primer: (done) => open('primer', done), denied: (done) => open('denied', done), storage });

    return () => { registerAttHost(null); finish(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ios, storage]);

  if (!ios) return null;

  /** 설정 앱으로 간다 — 앱이 다시 앞으로 오면(또는 설정 앱으로 못 갔으면 잠시 뒤) 이어서 간다 */
  const openSettings = (): void => {
    setMode('none');
    try { void Promise.resolve(rn.Linking.openSettings()).catch(() => undefined); } catch { /* noop */ }
    void waitForReturn(rn.AppState).then(finish);
  };

  // 가운데 카드 — 중립 안내와 같은 틀
  const card = (key: Mode, onRequestClose: () => void, ...children: any[]) => h(rn.Modal, { key, visible: mode === key, transparent: true, animationType: 'fade', onRequestClose },
    h(rn.View, { style: { flex: 1, backgroundColor: th.overlay, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 } },
      h(rn.View, { style: { width: '100%', maxWidth: 360, backgroundColor: th.background, borderRadius: 16, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16 } }, ...children)));
  const title = (text: string) => h(rn.Text, { style: { color: th.text, fontSize: 17, fontWeight: '700', lineHeight: 24 } }, text);
  const body = (text: string) => h(rn.Text, { style: { color: th.subText, fontSize: 14, marginTop: 10, lineHeight: 20 } }, text);

  // ① 중립 안내 — 버튼 하나. 닫기 · 뒤로가기로 건너뛸 수 없다(onRequestClose 는 아무것도 안 한다)
  const primer = card('primer', () => undefined,
    title(pr.title), body(pr.body),
    h(rn.TouchableOpacity, { onPress: dismiss, accessibilityRole: 'button', style: { marginTop: 18, backgroundColor: th.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' } },
      h(rn.Text, { style: { color: th.primaryText, fontSize: 16, fontWeight: '700' } }, pr.button)));

  // ② 추적이 꺼져 있을 때 — 두 버튼은 같은 모양 · 같은 크기(한쪽으로 몰아가지 않는다)
  const choice = (label: string, onPress: () => void) => h(rn.TouchableOpacity, { key: label, onPress, accessibilityRole: 'button',
    style: { flex: 1, borderWidth: 1, borderColor: th.subText, borderRadius: 10, paddingVertical: 13, alignItems: 'center' } },
    h(rn.Text, { style: { color: th.text, fontSize: 15, fontWeight: '700' } }, label));
  const denied = card('denied', dismiss,
    title(dn.title), body(dn.body),
    h(rn.View, { style: { flexDirection: 'row', gap: 10, marginTop: 18 } }, choice(dn.proceed, dismiss), choice(dn.openSettings, openSettings)));

  // (1.9.14) 앱이 자기 팝업으로 그린다 — 열려 있는 동안만 부른다. 문구 · 버튼 순서 · 동작은 위 기본 카드와 같다
  if (renderPopup) {
    const custom: AttPopupRenderProps | null = mode === 'primer'
      ? { kind: 'primer', title: pr.title, body: pr.body, buttons: [{ label: pr.button, onPress: dismiss }] }
      : mode === 'denied'
        ? { kind: 'denied', title: dn.title, body: dn.body, buttons: [{ label: dn.proceed, onPress: dismiss }, { label: dn.openSettings, onPress: openSettings }] }
        : null;

    return h(React.Fragment, null, custom ? renderPopup(custom) : null);
  }

  return h(React.Fragment, null, primer, denied);
}
