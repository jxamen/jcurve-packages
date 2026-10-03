/**
 * 영수증 올리는 법 재생기 — **저절로 흘러가고, 끝나면 처음부터 다시 돈다**(대표님 10-03 23:17 · 23:51).
 *
 * 미션 「따라 하기」와 같은 틀(캐릭터 말풍선 + 가운데 가짜 화면 + 누를 곳 표시)이다. 직접 누를 필요가 없다:
 * 장면마다 약 2.6초 — 누를 곳이 두껍게 두 번 깜빡이고(껌벅껌벅), 손가락이 가서 톡 누르고(물결),
 * 다음 화면으로 넘어간다. 마지막 장면 뒤에는 첫 장면으로 돌아간다. 아래에는 [지금 올리기] 가 늘 떠 있다.
 * 위에는 작은 장면 막대와 「멈춤/재생」 · 「건너뛰기」(= 바로 올리기)만 둔다. 가짜 화면을 누르면 바로 다음.
 *
 * **움직임 줄이기가 켜져 있어도 저절로 넘어간다** — 대표님 아이폰에서 [다음] 을 계속 눌러야 했다(23:51 「다음다음
 * 내가 눌러야하는거네?」). 그때는 손가락 이동 · 깜빡임 · 물결만 빼고(누를 곳은 굵은 테두리로 고정) 시간만 잰다.
 *
 * 움직임은 **장면 진행 값 p(0 → 1) 하나**로 그린다 — 깜빡임(0~0.58) · 손가락 이동(0.06~0.3) · 누름(0.7~0.84) ·
 * 물결(0.72~0.95) · 알림(0.8~) · 캡처 번쩍(0.62~0.85). 멈추면 p 만 멈추니 화면이 그 순간에 그대로 선다.
 * 투명도 · 이동 · 크기만 쓴다(네이티브 드라이버).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MockScreen, SpotCtx, type SpotLink } from './MockScreen';
import { fillApp, type GuideApp, type GuideCta, type ReceiptGuide } from './types';
import { BigButton, Bubble, Header, NoteCard, T, TwoBadge, row, useGuideTheme, useReducedMotion } from './ui';
import { TWO_SAME_ORDER, needsTwo } from './data';

/** 장면 하나가 머무는 시간 — 캡처 장면은 번쩍이는 것까지 보느라 조금 더 */
const STEP_MS = 2600;
const CAPTURE_MS = 3000;
/** 가짜 화면 높이 */
const SCREEN_H = 420;
/** 움직임 줄이기 — 손가락이 누를 곳에 가 있고 물결 · 알림은 아직인 때 */
const STILL = 0.6;
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';

type Point = { x: number; y: number };

export type PlayerProps = {
  guide: ReceiptGuide;
  /** 글 속 {앱} 자리 — 「영테크 「사진 올리기」」 */
  appName: string;
  onClose: () => void;
  /** [지금 올리기] · 「건너뛰기」 */
  onUpload: () => void;
  /** 처음 한 바퀴를 다 봤다 */
  onDone?: () => void;
  /** 다른 안내로(장면의 link) */
  onSwitch?: (app: GuideApp) => void;
  /** 맨 아래 버튼 — 없으면 [지금 올리기] → onUpload */
  cta?: GuideCta;
};

export function Player({ guide, appName, onClose, onUpload, onDone, onSwitch, cta }: PlayerProps) {
  const theme = useGuideTheme();
  const still = useReducedMotion();
  const steps = guide.steps;
  const [i, setI] = useState(0);
  const [loop, setLoop] = useState(0);
  const [playing, setPlaying] = useState(true);
  const p = useRef(new Animated.Value(0)).current;
  /** 멈춘 자리 — 같은 장면에서 다시 재생하면 거기서 이어 간다 */
  const saved = useRef<{ i: number; v: number } | null>(null);

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
  }, [i, loop, size.w, measure]);

  /* ── 장면 넘기기 — 마지막 다음은 처음 ── */
  const doneOnce = useRef(false);
  const ended = useRef(onDone);
  ended.current = onDone;
  const toRef = useRef(to);
  toRef.current = to;
  const iRef = useRef(i);
  iRef.current = i;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const next = useCallback(() => {
    saved.current = null;
    spot.current = null;
    // 멈춘 채 화면을 눌러 넘기면 그 장면은 「손가락이 누를 곳에 간」 모습으로 세워 둔다
    if (!playingRef.current) p.setValue(STILL);
    const n = iRef.current + 1;
    if (n >= steps.length) {
      if (!doneOnce.current) { doneOnce.current = true; ended.current?.(); }
      setFrom(null); setTo(null);
      setI(0); setLoop((l) => l + 1);
      return;
    }
    setFrom(toRef.current); setTo(null);
    setI(n);
  }, [steps.length, p]);
  const nextRef = useRef(next);
  nextRef.current = next;

  useEffect(() => {
    if (!playing) return undefined;
    if (still) {
      // 움직임 줄이기 — 그림은 멈춘 채, 시간만 재서 넘긴다
      p.setValue(STILL);
      const t = setTimeout(() => nextRef.current(), duration);

      return () => clearTimeout(t);
    }
    const start = saved.current?.i === i ? saved.current.v : 0;
    saved.current = null;
    p.setValue(start);
    const a = Animated.timing(p, { toValue: 1, duration: Math.max(0, duration * (1 - start)), easing: Easing.linear, useNativeDriver: true });
    a.start(({ finished }) => { if (finished) nextRef.current(); });

    return () => a.stop();
  }, [i, loop, playing, still, duration, p]);

  const pause = () => {
    if (!still) p.stopAnimation((v) => { saved.current = { i: iRef.current, v }; });
    setPlaying(false);
  };

  /* 안드로이드 뒤로 — Modal 밖에 얹었을 때(Modal 안이면 부르는 쪽 onRequestClose 가 받는다) */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });

    return () => sub.remove();
  }, [onClose]);

  /* ── 움직임(전부 p 에서) ── */
  const start = from ?? { x: size.w / 2, y: size.h - 30 };
  const dest = to ?? start;
  const clamp = 'clamp' as const;
  const link = useMemo<SpotLink>(() => ({
    report,
    glowOp: still ? 1 : p.interpolate({ inputRange: [0, 0.1, 0.22, 0.34, 0.46, 0.58, 1], outputRange: [0.3, 1, 0.3, 1, 0.3, 1, 1], extrapolate: clamp }),
    glowSc: still ? 1 : p.interpolate({ inputRange: [0, 0.1, 0.22, 0.34, 0.46, 0.58, 1], outputRange: [1, 1.06, 1, 1.06, 1, 1, 1], extrapolate: clamp }),
  }), [report, still, p]);
  const fingerX = p.interpolate({ inputRange: [0, 0.06, 0.3, 1], outputRange: [start.x, start.x, dest.x, dest.x], extrapolate: clamp });
  const fingerY = p.interpolate({ inputRange: [0, 0.06, 0.3, 1], outputRange: [start.y, start.y, dest.y, dest.y], extrapolate: clamp });
  const fingerOp = p.interpolate({ inputRange: [0, 0.06], outputRange: [from ? 1 : 0, 1], extrapolate: clamp });
  const fingerSc = p.interpolate({ inputRange: [0.7, 0.76, 0.84], outputRange: [1, 0.78, 1], extrapolate: clamp });
  const rippleOp = p.interpolate({ inputRange: [0.72, 0.76, 0.95], outputRange: [0, 0.9, 0], extrapolate: clamp });
  const rippleSc = p.interpolate({ inputRange: [0.72, 0.95], outputRange: [0.4, 2], extrapolate: clamp });
  const toastOp = p.interpolate({ inputRange: [0.8, 0.86], outputRange: [0, 1], extrapolate: clamp });
  const flashOp = p.interpolate({ inputRange: [0.62, 0.68, 0.85], outputRange: [0, 0.85, 0], extrapolate: clamp });
  const keyX = p.interpolate({ inputRange: [0.5, 0.62, 0.7], outputRange: [0, -3, 0], extrapolate: clamp });
  const keyOp = p.interpolate({ inputRange: [0, 0.2, 0.75, 0.9], outputRange: [0.35, 1, 1, 0.35], extrapolate: clamp });

  const title = guide.name + ' 영수증 올리는 법';
  /** 맨 아래 버튼 · 「건너뛰기」 — 부르는 앱이 cta 를 주면 그것, 아니면 지금 올리기 */
  const ctaOff = !!cta?.disabled || !!cta?.busy;
  const press = () => { if (ctaOff) return; if (cta?.onPress) cta.onPress(guide.app); else onUpload(); };
  const two = needsTwo(guide.app);
  const say = (CIRCLED[step.no - 1] ?? '') + ' ' + fillApp(step.say, appName);
  const hint = capture
    ? (Platform.OS === 'ios' ? '옆 버튼과 음량 높이기 버튼을 함께 눌러 캡처해요' : '전원 버튼과 음량 낮추기 버튼을 함께 눌러 캡처해요')
    : '반짝이는 곳을 눌러요';

  return (
    <View style={[s.page, { backgroundColor: theme.bg }]}>
      <Header title={title} onClose={onClose} />
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {two ? (
          <View style={[row, s.twoBar, { borderColor: theme.hot }]}>
            <TwoBadge big />
            <View style={{ flex: 1 }}>
              <T size={15} w={900}>이 영수증은 캡처 2장(위 · 아래)을 함께 올려야 해요</T>
              <T size={13.5} w={700} color={theme.sub} style={{ marginTop: 2 }}>{TWO_SAME_ORDER}</T>
            </View>
          </View>
        ) : null}
        <Bubble say={say} sub={step.sub ? fillApp(step.sub, appName) : undefined} />

        {/* 작은 장면 막대 + 「멈춤/재생」 · 「건너뛰기」 */}
        <View style={[row, { gap: 10 }]}>
          <View style={[row, { gap: 3, flex: 1 }]} accessibilityLabel={`${steps.length}장면 중 ${i + 1}번째`}>
            {steps.map((_, k) => (
              <View key={k} style={[s.seg, { backgroundColor: theme.line }]}>
                {k < i ? <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.hot }]} /> : null}
                {k === i ? (
                  <Animated.View style={[StyleSheet.absoluteFill, {
                    backgroundColor: theme.hot, transformOrigin: 'left',
                    transform: [{ scaleX: still ? 1 : p }],
                  }]} />
                ) : null}
              </View>
            ))}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={playing ? '멈추기' : '이어 보기'} hitSlop={8} onPress={playing ? pause : () => setPlaying(true)}>
            <T size={14} w={800} color={theme.sub}>{playing ? '멈춤' : '재생'}</T>
          </Pressable>
          {ctaOff ? null : (
            <Pressable accessibilityRole="button" accessibilityLabel="건너뛰고 바로 올리기" hitSlop={8} onPress={press}>
              <T size={14} w={800} color={theme.sub}>건너뛰기</T>
            </Pressable>
          )}
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
              <SpotCtx.Provider value={link}>
                <SceneIn key={i + ':' + loop}>
                  <MockScreen nodes={step.nodes} accent={guide.accent} scrolled={step.scrolled} />
                </SceneIn>
              </SpotCtx.Provider>

              {capture && !still ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.white, opacity: flashOp }]} /> : null}

              {!capture ? (
                <Animated.View pointerEvents="none" style={[s.finger, { opacity: fingerOp, transform: [{ translateX: fingerX }, { translateY: fingerY }] }]}>
                  {still ? null : <Animated.View style={[s.ripple, { borderColor: theme.hot, opacity: rippleOp, transform: [{ scale: rippleSc }] }]} />}
                  <Animated.View style={[s.dot, { borderColor: theme.hot, transform: [{ scale: fingerSc }] }]}>
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.hot, opacity: 0.25 }]} />
                  </Animated.View>
                </Animated.View>
              ) : null}

              {step.toast && !still ? (
                <Animated.View pointerEvents="none" style={[s.toast, { opacity: toastOp }]}>
                  <T size={14} w={800} color="#FFFFFF">{step.toast}</T>
                </Animated.View>
              ) : null}
            </View>
          </Pressable>
          {/* 캡처 장면 — 휴대폰 옆 버튼이 눌리는 시늉 */}
          {capture ? <>
            <Animated.View pointerEvents="none" style={[s.key, { right: -6, top: 110, height: 52, backgroundColor: theme.hot, opacity: still ? 1 : keyOp, transform: [{ translateX: keyX }] }]} />
            <Animated.View pointerEvents="none" style={[s.key, { left: -6, top: 96, height: 38, backgroundColor: theme.hot, opacity: still ? 1 : keyOp, transform: [{ translateX: Animated.multiply(keyX, -1) }] }]} />
          </> : null}
        </View>

        <T size={14} w={700} center color={theme.sub}>{hint}</T>
        {capture || step.result ? <View style={[s.seller, { backgroundColor: theme.brandSoft }]}><T size={14.5} w={900} center color={theme.brand}>{guide.seller}</T></View> : null}
        {guide.note ? <NoteCard text={guide.note} /> : null}
        {guide.pickHint ? <View style={[s.hint, { backgroundColor: theme.brandSoft }]}><T size={14.5} w={900} center color={theme.brand}>{guide.pickHint}</T></View> : null}
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

      {/* 언제든 바로 올릴 수 있게 — 안내가 도는 동안 내내 떠 있다(캡슐이 없으면 「캡슐 받고 올리기」 등, 부르는 앱의 cta) */}
      <View style={[s.foot, { borderColor: theme.line, backgroundColor: theme.bg }]}>
        {cta?.note
          ? <T size={14.5} w={800} center color={theme.sub} style={{ marginBottom: 8 }}>{cta.note}</T>
          : two
            ? <View style={[row, { justifyContent: 'center', gap: 6, marginBottom: 8 }]}><TwoBadge /><T size={15} w={900} color={theme.hot}>2장 함께 골라요(위 → 아래)</T></View>
            : <T size={14} w={700} center color={theme.sub} style={{ marginBottom: 8 }}>{fillApp(guide.doneSub, appName)}</T>}
        <BigButton label={cta?.label ?? '지금 올리기'} onPress={press} disabled={ctaOff} />
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
  seller: { borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12 },
  twoBar: { gap: 10, borderWidth: 2, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
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
