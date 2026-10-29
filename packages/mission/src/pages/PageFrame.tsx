import React, { useEffect, useRef, type ReactNode } from 'react';
import { BackHandler, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { edgeBackHandlers } from '../missionNav';

/**
 * 페이지 색 · 글자 · 캐릭터(0.4.0) — 색과 이름만 앱이 넘긴다. 모양은 패키지가 정한다(carrot 화면 그대로).
 * 기본값은 당근 홈 「바로 받는 혜택」 줄의 색(주황 #EE7A33).
 */
export type MissionPageTheme = {
  bg: string;
  card: string;
  text: string;
  sub: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  line: string;
  /** 끝난 줄 버튼 바탕(「완료」「받았어요」) */
  done: string;
  /** 캐릭터 그림(ReactNode) — 친구 초대 머리에 쓴다. 없으면 그리지 않는다 */
  character?: ReactNode;
  /** 아이템 이름 — 양분 · 캡슐 · 열매 · 먹이 (2026-10-19 대표님 「이름만 앱마다」). 기본 「아이템」(0.4.1 — 앱 말이 박히지 않게) */
  itemName?: string;
  /** 아이템 그림(ReactNode, 예 🌱) — 없으면 글자만 */
  itemIcon?: ReactNode;
};

export const DEFAULT_PAGE_THEME: MissionPageTheme = {
  bg: '#FBF7F2', card: '#FFFFFF', text: '#2B2118', sub: '#6B5E52', accent: '#EE7A33', accentText: '#FFFFFF',
  accentSoft: '#FDE6D6', line: '#F3EBE1', done: '#D3D7DD', itemName: '아이템',
};

/** 앱이 일부만 넘기면 나머지는 기본값 — `character` · `itemIcon` 은 기본이 없다 */
export function resolvePageTheme(theme?: Partial<MissionPageTheme>): MissionPageTheme {
  return { ...DEFAULT_PAGE_THEME, ...(theme ?? {}) };
}

/** 줄 버튼 기본 크기 72x34(2026-10-19 당근 대표님 「버튼 사이즈 좀 더 작게」「가로 줄이라니까」) */
export const PAGE_BUTTON = { width: 72, height: 34 } as const;

/**
 * 독립 페이지 공통 틀 — 상단 「‹ 제목」 한 줄 · 안드로이드 뒤로 가기 → onBack · 본문 스크롤 · 맨 아래 광고 자리(footer).
 * 상태 표시줄 안전영역은 앱 바깥 틀이 잡는다(carrot PageHeader 와 같은 규칙).
 */
export function PageFrame({ title, onBack, swipeBack = true, theme, footer, topGap, children }: {
  title: string;
  onBack: () => void;
  /**
   * (0.4.13) iOS 왼쪽 가장자리를 오른쪽으로 밀면 onBack(기본 true, `false` 일 때만 끔). 안드로이드는 그대로(뒤로 키). 이미 앱 바깥에서 밀기를 감싼 화면은 false.
   * 새 네이티브 의존 없음(PanResponder) — 가장자리에서 시작한 가로 밀기만 가로채서 안쪽 탭 · 스크롤은 그대로다
   */
  swipeBack?: boolean;
  theme: MissionPageTheme;
  /** 맨 아래 광고 자리 — 앱이 네이티브 광고를 넣는다(패키지는 광고를 모른다) */
  footer?: ReactNode;
  /**
   * (-mc3) 머리 줄 아래 ~ 본문 첫 내용 위 간격(pt). 안 주면 16(지금 그대로 — 다른 페이지 불변). 만보기 합친 카드가 머리 줄 바로 밑에 12pt 로 붙도록 StepsPage 만 4 를 준다.
   * 0 이상의 숫자일 때만 쓴다(NaN · 음수는 무시하고 16)
   */
  topGap?: number;
  children: ReactNode;
}) {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => sub.remove();
  }, [onBack]);
  const backRef = useRef(onBack);
  backRef.current = onBack;
  const edge = useRef(PanResponder.create(edgeBackHandlers(() => backRef.current()))).current;
  const swipe = swipeBack !== false && Platform.OS === 'ios';
  return <View style={[s.root, { backgroundColor: theme.bg }]} {...(swipe ? edge.panHandlers : {})}>
    <View style={s.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={12} onPress={onBack} style={s.side}>
        <Text style={[s.back, { color: theme.text }]}>‹</Text>
      </Pressable>
      <Text style={[s.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
      <View style={s.side} />
    </View>
    <ScrollView contentContainerStyle={typeof topGap === 'number' && topGap >= 0 ? [s.content, { paddingTop: topGap }] : s.content}>
      {children}
      {footer != null ? <View style={s.footer}>{footer}</View> : null}
    </ScrollView>
  </View>;
}

/** 줄 · 카드 안의 작은 버튼 — 기본 72x34, 끝난 상태는 `done` 바탕 */
export function PageButton({ label, onPress, disabled, theme, width = PAGE_BUTTON.width, height, on = true, big = false, fontSize, radius }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  theme: MissionPageTheme;
  width?: number;
  /** 높이 — 안 주면 줄 버튼 34 · 큰 단추 52(0.4.14: 큰 단추도 준 높이를 따른다) */
  height?: number;
  /** (0.4.14) 글자 크기 — 안 주면 줄 버튼 14 · 큰 단추 16 */
  fontSize?: number;
  /** (0.4.14) 모서리 — 안 주면 줄 버튼 12 · 큰 단추 14 */
  radius?: number;
  /** 끄면 바탕이 연한 주황 · 글자는 흐리게(받을 수 없는 칸) */
  on?: boolean;
  /** 큰 단추(가로 전체) — `width` 무시 */
  big?: boolean;
}) {
  const bg = disabled ? theme.done : on ? theme.accent : theme.accentSoft;
  const fg = disabled ? theme.sub : on ? theme.accentText : theme.sub;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.button, big ? s.big : { width, height: height ?? PAGE_BUTTON.height }, big && height != null && { height }, radius != null && { borderRadius: radius }, { backgroundColor: bg }, pressed && !disabled && { opacity: 0.8 }]}>
    <Text style={[big ? s.bigText : s.buttonText, fontSize != null && { fontSize }, { color: fg }]} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
  </Pressable>;
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  side: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { fontSize: 32, marginTop: -4 },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  footer: { marginTop: 16 },
  button: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  buttonText: { fontSize: 14, fontWeight: '700' },
  big: { alignSelf: 'stretch', height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bigText: { fontSize: 16, fontWeight: '800' },
});
