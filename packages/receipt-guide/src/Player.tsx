/**
 * 영수증 올리는 법 재생기 — **저절로 흘러간다**(대표님 10-03 23:17).
 *
 * 미션 「따라 하기」와 같은 틀(캐릭터 말풍선 + 가운데 가짜 화면 + 누를 곳 표시)이다. 다른 점은
 * 직접 누르지 않아도 된다는 것: 장면마다 약 3초 동안 손가락이 누를 곳으로 가서 톡 누르고(물결),
 * 다음 화면으로 넘어간다. 위에 몇 번째 장면인지 막대가 차오른다. [멈춤] · [이전] · [다음] 이 있고,
 * 가짜 화면을 누르면 바로 다음으로 간다.
 *
 * 모든 움직임은 **장면 진행 값 p(0 → 1) 하나**로 그린다 — 손가락 이동(0.12~0.38) · 누름(0.42~0.56) ·
 * 물결(0.44~0.66) · 알림(0.55~) · 캡처 번쩍(0.4~0.6). 멈추면 p 만 멈추니 화면이 그 순간에 그대로 선다.
 * 투명도 · 이동 · 크기만 쓴다(네이티브 드라이버).
 *
 * 움직임 줄이기가 켜져 있으면 저절로 넘기지 않는다 — 손가락이 누를 곳에 멈춘 장면을 보여 주고 [다음] 으로 넘긴다.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MockScreen, SpotCtx } from './MockScreen';
import { fillApp, type GuideApp, type ReceiptGuide } from './types';
import { BigButton, Bubble, Header, NoteCard, SmallButton, T, row, useGuideTheme, useReducedMotion } from './ui';

/** 장면 하나가 머무는 시간 — 캡처 장면은 번쩍이는 것까지 보느라 조금 더 */
const STEP_MS = 3000;
const CAPTURE_MS = 3400;
/** 가짜 화면 높이 */
const SCREEN_H = 440;
/** 움직임 줄이기 · 멈춘 뒤 넘긴 장면 — 손가락이 누를 곳에 도착해 있고 물결은 지난 때 */
const STILL = 0.8;
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';

type Point = { x: number; y: number };

export type PlayerProps = {
  guide: ReceiptGuide;
  /** 글 속 {앱} 자리 — 「영테크 「사진 올리기」」 */
  appName: string;
  onClose: () => void;
  /** 끝 카드 「지금 올리기」 */
  onUpload: () => void;
  /** 끝 카드에 닿았다(한 번 볼 때마다) */
  onDone?: () => void;
  /** 다른 안내로(장면의 link) */
  onSwitch?: (app: GuideApp) => void;
  /** 지금은 못 올리는 까닭(캡슐 없음 · 바구니 가득) — 있으면 「지금 올리기」 대신 [닫기] */
  blockedNote?: string;
};

export function Player({ guide, appName, onClose, onUpload, onDone, onSwitch, blockedNote }: PlayerProps) {
  const theme = useGuideTheme();
  const manual = useReducedMotion();
  const steps = guide.steps;
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<'play' | 'end'>('play');
  const [playing, setPlaying] = useState(true);
  const [round, setRound] = useState(0);
  const p = useRef(new Animated.Value(0)).current;
  /** 멈춘 자리 — 같은 장면에서 다시 누르면 거기서 이어 간다 */
  const saved = useRef<{ i: number; v: number } | null>(null);
  const pausedAt = useRef(-1);

  const step = steps[Math.min(i, steps.length - 1)];
  const capture = step.action === 'capture';
  const duration = step.ms ?? (capture ? CAPTURE_MS : STEP_MS);

  /* ── 손가락 자리 ── */
  const frame = useRef<View>(null);
  const spot = useRef<View | null>(null);
  const [size, setSize] = useState({ w: 320, h: SCREEN_H });
  const [to, setTo] = useState<Point | null>(null);
  const [from, setFrom] = useState<Point | null>(null);
  const measure = useCallback(() => {
    const node = spot.current, base = frame.current;
    if (!node || !base) return;
    node.measureLayout(base, (x, y, w, h) => setTo({ x: x + w / 2, y: y + h / 2 }), () => undefined);
  }, []);
  const report = useCallback((node: View | null) => { spot.current = node; measure(); }, [measure]);
  useEffect(() => {
    // 위쪽 줄이 늦게 자리 잡으면 누를 곳의 onLayout 이 다시 안 불린다 — 조금 뒤에 한 번 더 잰다
    const t = setTimeout(measure, 120);

    return () => clearTimeout(t);
  }, [i, size.w, measure]);

  /* ── 장면 넘기기 ── */
  const ended = useRef(onDone);
  ended.current = onDone;
  const goTo = useCallback((n: number) => {
    saved.current = null;
    setFrom(to);
    setTo(null); spot.current = null;
    if (n >= steps.length) { setPhase('end'); ended.current?.(); return; }
    setI(Math.max(0, n));
  }, [steps.length, to]);
  const iRef = useRef(i);
  iRef.current = i;
  const next = useCallback(() => goTo(iRef.current + 1), [goTo]);
  const nextRef = useRef(next);
  nextRef.current = next;

  useEffect(() => {
    if (phase !== 'play') return undefined;
    if (manual) { p.setValue(STILL); return undefined; }
    if (!playing) {
      // 멈춘 채 다른 장면으로 넘겼으면 그 장면은 「누를 곳에 손가락이 간」 모습으로 보여 준다
      if (pausedAt.current !== i) p.setValue(STILL);
      return undefined;
    }
    const start = saved.current?.i === i ? saved.current.v : 0;
    saved.current = null;
    p.setValue(start);
    const a = Animated.timing(p, { toValue: 1, duration: Math.max(0, duration * (1 - start)), easing: Easing.linear, useNativeDriver: true });
    a.start(({ finished }) => { if (finished) nextRef.current(); });

    return () => a.stop();
  }, [i, phase, playing, manual, round, duration, p]);

  const pause = () => {
    pausedAt.current = i;
    p.stopAnimation((v) => { saved.current = { i: iRef.current, v }; });
    setPlaying(false);
  };
  const resume = () => { pausedAt.current = -1; setPlaying(true); };
  const replay = () => {
    saved.current = null; pausedAt.current = -1;
    setFrom(null); setTo(null); spot.current = null;
    setI(0); setPhase('play'); setPlaying(true); setRound((r) => r + 1);
  };

  /* 안드로이드 뒤로 — Modal 밖에 얹었을 때(Modal 안이면 부르는 쪽 onRequestClose 가 받는다) */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });

    return () => sub.remove();
  }, [onClose]);

  const title = guide.name + ' 영수증 올리는 법';

  /* ── 끝 카드 ── */
  if (phase === 'end') {
    return (
      <View style={[s.page, { backgroundColor: theme.bg }]}>
        <Header title={title} onClose={onClose} />
        <ScrollView contentContainerStyle={s.body}>
          <Bubble say="이제 직접 올려 볼까요?" sub={guide.doneSub} />
          <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <T size={17} w={900}>순서 다시 보기</T>
            <View style={{ marginTop: 10, gap: 8 }}>
              {guide.summary.map((line, k) => (
                <View key={k} style={[row, { gap: 8, alignItems: 'flex-start' }]}>
                  <T size={15} w={900} color={theme.hot}>{CIRCLED[k] ?? k + 1 + '.'}</T>
                  <T size={15} w={700} lh={21} style={{ flex: 1 }}>{fillApp(line, appName)}</T>
                </View>
              ))}
            </View>
          </View>
          {guide.note ? <NoteCard text={guide.note} /> : null}
          {guide.pickHint ? <View style={[s.hint, { backgroundColor: theme.brandSoft }]}><T size={15.5} w={900} center color={theme.brand}>{guide.pickHint}</T></View> : null}
          {blockedNote ? <T size={14.5} w={700} center color={theme.sub}>{blockedNote}</T> : null}
        </ScrollView>
        <View style={[s.foot, { borderColor: theme.line, backgroundColor: theme.bg }]}>
          {blockedNote ? <BigButton label="닫기" onPress={onClose} /> : <BigButton label="지금 올리기" onPress={onUpload} />}
          <Pressable accessibilityRole="button" onPress={replay} style={{ alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 }}>
            <T size={15} w={800} color={theme.sub} style={{ textDecorationLine: 'underline' }}>처음부터 다시 보기</T>
          </Pressable>
        </View>
      </View>
    );
  }

  /* ── 움직임(전부 p 에서) ── */
  const start = from ?? { x: size.w / 2, y: size.h - 30 };
  const dest = to ?? start;
  const fingerX = p.interpolate({ inputRange: [0, 0.12, 0.38, 1], outputRange: [start.x, start.x, dest.x, dest.x], extrapolate: 'clamp' });
  const fingerY = p.interpolate({ inputRange: [0, 0.12, 0.38, 1], outputRange: [start.y, start.y, dest.y, dest.y], extrapolate: 'clamp' });
  const fingerOp = p.interpolate({ inputRange: [0, 0.08, 0.9, 1], outputRange: [from ? 1 : 0, 1, 1, 0.6], extrapolate: 'clamp' });
  const fingerSc = p.interpolate({ inputRange: [0.42, 0.48, 0.56], outputRange: [1, 0.8, 1], extrapolate: 'clamp' });
  const rippleOp = p.interpolate({ inputRange: [0.44, 0.48, 0.66], outputRange: [0, 0.9, 0], extrapolate: 'clamp' });
  const rippleSc = p.interpolate({ inputRange: [0.44, 0.66], outputRange: [0.4, 1.9], extrapolate: 'clamp' });
  const toastOp = p.interpolate({ inputRange: [0.55, 0.62], outputRange: [0, 1], extrapolate: 'clamp' });
  const flashOp = p.interpolate({ inputRange: [0.4, 0.45, 0.6], outputRange: [0, 0.85, 0], extrapolate: 'clamp' });
  const keyX = p.interpolate({ inputRange: [0.28, 0.38, 0.46], outputRange: [0, -3, 0], extrapolate: 'clamp' });
  const keyOp = p.interpolate({ inputRange: [0, 0.2, 0.5, 0.7], outputRange: [0.35, 1, 1, 0.35], extrapolate: 'clamp' });

  const say = (CIRCLED[step.no - 1] ?? '') + ' ' + fillApp(step.say, appName);
  const hint = capture
    ? (Platform.OS === 'ios' ? '옆 버튼과 음량 높이기 버튼을 함께 눌러 캡처해요' : '전원 버튼과 음량 낮추기 버튼을 함께 눌러 캡처해요')
    : manual ? '아래 [다음] 으로 넘겨요' : playing ? '저절로 넘어가요 · 화면을 누르면 바로 다음' : '멈췄어요 · 화면을 누르면 다음';

  return (
    <View style={[s.page, { backgroundColor: theme.bg }]}>
      <Header title={title} onClose={onClose} />
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {step.branch ? <View style={[s.branch, { backgroundColor: theme.brandSoft }]}><T size={14} w={900} color={theme.brand}>{step.branch}</T></View> : null}
        <Bubble say={say} sub={step.sub ? fillApp(step.sub, appName) : undefined} />

        {/* 몇 번째 장면인지 — 지난 장면은 꽉, 지금 장면은 p 만큼 차오른다 */}
        <View style={[row, { gap: 4 }]} accessibilityLabel={`${steps.length}장면 중 ${i + 1}번째`}>
          {steps.map((_, k) => (
            <View key={k} style={[s.seg, { backgroundColor: theme.line }]}>
              {k < i ? <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.hot }]} /> : null}
              {k === i ? (
                <Animated.View style={[StyleSheet.absoluteFill, {
                  backgroundColor: theme.hot, transformOrigin: 'left',
                  transform: [{ scaleX: manual ? 1 : p }],
                }]} />
              ) : null}
            </View>
          ))}
        </View>

        <View style={{ alignSelf: 'center', width: '100%', maxWidth: 360 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="다음 장면" onPress={next}>
            <View
              ref={frame}
              collapsable={false}
              onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
              style={[s.frame, { borderColor: theme.line, backgroundColor: theme.card }]}
            >
              <View style={[s.notch, { backgroundColor: theme.line }]} />
              <SpotCtx.Provider value={report}>
                <SceneIn key={i + ':' + round}>
                  <MockScreen nodes={step.nodes} accent={guide.accent} scrolled={step.scrolled} />
                </SceneIn>
              </SpotCtx.Provider>

              {capture ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.white, opacity: manual ? 0 : flashOp }]} /> : null}

              {!capture ? (
                <Animated.View pointerEvents="none" style={[s.finger, { opacity: fingerOp, transform: [{ translateX: fingerX }, { translateY: fingerY }] }]}>
                  <Animated.View style={[s.ripple, { borderColor: theme.hot, opacity: rippleOp, transform: [{ scale: rippleSc }] }]} />
                  <Animated.View style={[s.dot, { borderColor: theme.hot, transform: [{ scale: fingerSc }] }]}>
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.hot, opacity: 0.25 }]} />
                  </Animated.View>
                </Animated.View>
              ) : null}

              {step.toast ? (
                <Animated.View pointerEvents="none" style={[s.toast, { opacity: toastOp }]}>
                  <T size={14} w={800} color="#FFFFFF">{step.toast}</T>
                </Animated.View>
              ) : null}
            </View>
          </Pressable>
          {/* 캡처 장면 — 휴대폰 옆 버튼이 눌리는 시늉 */}
          {capture ? <>
            <Animated.View pointerEvents="none" style={[s.key, { right: -6, top: 110, height: 52, backgroundColor: theme.hot, opacity: keyOp, transform: [{ translateX: keyX }] }]} />
            <Animated.View pointerEvents="none" style={[s.key, { left: -6, top: 96, height: 38, backgroundColor: theme.hot, opacity: keyOp, transform: [{ translateX: Animated.multiply(keyX, -1) }] }]} />
          </> : null}
        </View>

        <T size={14} w={700} center color={theme.sub}>{hint}</T>
        {guide.note ? <NoteCard text={guide.note} /> : null}
        {step.link && onSwitch ? (
          <Pressable
            accessibilityRole="button" accessibilityLabel={step.link.label}
            onPress={() => onSwitch(step.link!.app)}
            style={({ pressed }) => [s.link, { borderColor: theme.line, backgroundColor: theme.card, opacity: pressed ? 0.8 : 1 }]}
          >
            <T size={14.5} w={700} color={theme.sub} style={{ flex: 1 }}>{step.link.text}</T>
            <T size={14.5} w={900} color={theme.brand}>{step.link.label} ›</T>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={[s.foot, { borderColor: theme.line, backgroundColor: theme.bg }]}>
        <View style={[row, { justifyContent: 'space-between', gap: 8 }]}>
          <SmallButton label="‹ 이전" a11y="이전 장면" onPress={() => goTo(i - 1)} />
          {manual ? null : playing
            ? <SmallButton label="❚❚ 멈춤" a11y="멈추기" onPress={pause} />
            : <SmallButton label="▶ 계속" a11y="이어 보기" on onPress={resume} />}
          <SmallButton label="다음 ›" a11y="다음 장면" on={manual} onPress={next} />
        </View>
        <Pressable accessibilityRole="button" onPress={() => goTo(steps.length)} style={{ alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16 }}>
          <T size={14.5} w={800} color={theme.sub} style={{ textDecorationLine: 'underline' }}>건너뛰기</T>
        </Pressable>
      </View>
    </View>
  );
}

/** 장면이 바뀔 때 오른쪽에서 살짝 밀려 들어온다(움직임 줄이기면 바로) */
function SceneIn({ children }: { children: React.ReactNode }) {
  const manual = useReducedMotion();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (manual) { a.setValue(1); return; }
    Animated.timing(a, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [a, manual]);

  return (
    <Animated.View style={{ flex: 1, opacity: a, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1 },
  body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 12 },
  card: { borderWidth: 1.5, borderRadius: 20, padding: 16 },
  branch: { alignSelf: 'flex-start', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12, marginBottom: -4 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  hint: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  foot: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, borderTopWidth: 1 },
  seg: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  frame: { height: SCREEN_H, borderWidth: 1.5, borderRadius: 24, overflow: 'hidden' },
  notch: { alignSelf: 'center', width: 64, height: 5, borderRadius: 3, marginVertical: 6 },
  finger: { position: 'absolute', left: -24, top: -24, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, overflow: 'hidden' },
  ripple: { position: 'absolute', width: 48, height: 48, borderRadius: 24, borderWidth: 3 },
  toast: {
    position: 'absolute', alignSelf: 'center', bottom: 70,
    backgroundColor: 'rgba(47,47,51,0.92)', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 18,
  },
  key: { position: 'absolute', width: 5, borderRadius: 3 },
});
