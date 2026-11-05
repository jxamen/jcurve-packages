/**
 * 영수증 안내 공용 조각 — 색 · 글자 · 버튼 · 말풍선.
 *
 * 이 폴더는 나중에 `@jcurve/receipt-guide` 패키지로 나간다. 그래서 **앱의 다른 파일을 부르지 않는다** —
 * 색은 `theme` 으로, 캐릭터 그림은 `renderCharacter` 로, 기록은 `track` 으로 받는다(README).
 * 모양은 영테크 미션 「따라 하기」(말풍선 + 가운데 가짜 화면 + 반짝이는 누를 곳)를 따른다.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

export type GuideTheme = {
  /** 화면 바탕 */
  bg: string;
  /** 카드 · 가짜 화면 바탕 */
  card: string;
  line: string;
  text: string;
  sub: string;
  /** 주요 버튼 */
  brand: string;
  brandSoft: string;
  /** 손가락 · 누를 곳 테두리 */
  hot: string;
  white: string;
  /** 알아 둘 것 카드 */
  noteBg: string;
  noteText: string;
};

export const DEFAULT_THEME: GuideTheme = {
  bg: '#F4F8FF',
  card: '#FFFFFF',
  line: '#E6EDFA',
  text: '#162343',
  sub: '#7D8598',
  brand: '#6795DC',
  brandSoft: '#E6EFFF',
  hot: '#FF7A2F',
  white: '#FFFFFF',
  noteBg: '#FDF3DF',
  noteText: '#7A5A12',
};

export type CharacterRender = (seed: string, height: number) => React.ReactNode;

type Ctx = { theme: GuideTheme; renderCharacter?: CharacterRender };
const GuideCtx = createContext<Ctx>({ theme: DEFAULT_THEME });
export const GuideProvider = GuideCtx.Provider;
export const useGuideTheme = (): GuideTheme => useContext(GuideCtx).theme;
export const useCharacter = (): CharacterRender | undefined => useContext(GuideCtx).renderCharacter;

/** 움직임 줄이기 — 켜져 있으면 저절로 넘기지 않고 [다음] 으로 넘긴다 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive) setReduced(v); }).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);

    return () => { alive = false; sub.remove(); };
  }, []);

  return reduced;
}

export const row: ViewStyle = { flexDirection: 'row', alignItems: 'center' };

/** 글자 — 가짜 화면은 크기 · 굵기가 줄마다 달라 짧게 쓴다 */
export function T({ children, size = 15, w = 600, color, lh, center, lines, style }: {
  children: React.ReactNode; size?: number; w?: 600 | 700 | 800 | 900; color?: string; lh?: number;
  center?: boolean; lines?: number; style?: StyleProp<TextStyle>;
}) {
  const theme = useGuideTheme();

  return (
    <Text
      numberOfLines={lines}
      style={[
        { fontSize: size, fontWeight: String(w) as TextStyle['fontWeight'], color: color ?? theme.text },
        lh != null && { lineHeight: lh },
        center && { textAlign: 'center' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** 큰 버튼 */
export function BigButton({ label, onPress, tone = 'solid', disabled }: { label: string; onPress: () => void; tone?: 'solid' | 'ghost'; disabled?: boolean }) {
  const theme = useGuideTheme();
  const solid = tone === 'solid';

  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [s.big, {
        backgroundColor: solid ? theme.brand : theme.card,
        borderColor: solid ? theme.brand : theme.line,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      }]}
    >
      <T size={17} w={900} color={solid ? theme.white : theme.text}>{label}</T>
    </Pressable>
  );
}

/** 맨 위 줄 — [닫기] + 제목 */
export function Header({ title, onClose }: { title: string; onClose: () => void }) {
  const theme = useGuideTheme();

  return (
    <View style={[row, s.head, { borderColor: theme.line }]}>
      <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10} style={s.headSide}>
        <T size={16} w={700} color={theme.sub}>닫기</T>
      </Pressable>
      <T size={17} w={900} center lines={1} style={{ flex: 1 }}>{title}</T>
      <View style={s.headSide} />
    </View>
  );
}

/** 「2장」 딱지 — 2장이 꼭 필요한 곳을 눈에 띄게(대표님 10-03 23:53 「확실히 강조」) */
export function TwoBadge({ big }: { big?: boolean }) {
  const theme = useGuideTheme();

  return (
    <View style={[s.two, big && s.twoBig, { backgroundColor: theme.hot }]}>
      <T size={big ? 15 : 12.5} w={900} color={theme.white}>2장</T>
    </View>
  );
}

/** 캐릭터 + 말풍선 */
export function Bubble({ say, sub }: { say: string; sub?: string }) {
  const theme = useGuideTheme();
  const character = useCharacter();

  return (
    <View style={[row, { gap: 8, alignItems: 'flex-end' }]}>
      {character ? character(say, 62) : null}
      <View style={[s.bubble, { backgroundColor: theme.card, borderColor: theme.brandSoft }]}>
        {character ? <View style={[s.tail, { backgroundColor: theme.card, borderColor: theme.brandSoft }]} /> : null}
        <T size={17} w={900} lh={24}>{say}</T>
        {sub ? <T size={14.5} w={700} lh={21} color={theme.sub} style={{ marginTop: 4 }}>{sub}</T> : null}
      </View>
    </View>
  );
}

/** 알아 둘 것 한 줄(네이버페이: 「PDF로 저장」은 사진첩에 안 들어감) */
export function NoteCard({ text }: { text: string }) {
  const theme = useGuideTheme();

  return (
    <View style={[s.note, { backgroundColor: theme.noteBg }]}>
      <T size={14.5} w={800} lh={21} color={theme.noteText}>{text}</T>
    </View>
  );
}

const s = StyleSheet.create({
  big: { borderRadius: 16, borderWidth: 1.5, paddingVertical: 16, alignItems: 'center' },
  head: { height: 52, paddingHorizontal: 16, borderBottomWidth: 1 },
  headSide: { width: 48 },
  note: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'stretch' },
  two: { borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7 },
  twoBig: { paddingVertical: 4, paddingHorizontal: 10 },
  bubble: { flex: 1, borderWidth: 2, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 },
  tail: {
    position: 'absolute', left: -7, bottom: 16, width: 12, height: 12,
    borderLeftWidth: 2, borderBottomWidth: 2, transform: [{ rotate: '45deg' }],
  },
});
