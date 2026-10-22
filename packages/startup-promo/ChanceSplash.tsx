import React, { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { canDismiss, DEFAULT_COPY, type ChancePromoCopy } from './policy';

export interface ChanceSplashProps {
  appName: string;
  colors: { background: string; primary: string; text: string; subtle: string; soft: string };
  character: ImageSourcePropType;
  copy: ChancePromoCopy;
  ready: boolean;
  onDone: () => void;
}

/** Render after the native splash is hidden. Time counts only while visible in foreground. */
export function ChanceSplash({ appName, colors, character, copy, ready, onDone }: ChanceSplashProps) {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [laidOut, setLaidOut] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const skipped = useRef(false);
  const done = useRef(false);
  const live = useRef({ ready, onDone });
  live.current = { ready, onDone };
  const finish = () => {
    if (!done.current && canDismiss(elapsedRef.current, live.current.ready, skipped.current)) {
      done.current = true;
      live.current.onDone();
    }
  };
  useEffect(() => {
    if (!laidOut || !imageReady) return;
    let active = AppState.currentState === 'active' || Platform.OS === 'web';
    let last = performance.now();
    const sub = AppState.addEventListener('change', state => { active = state === 'active'; last = performance.now(); });
    const timer = setInterval(() => {
      const now = performance.now();
      if (active) elapsedRef.current += now - last;
      last = now;
      setElapsed(elapsedRef.current);
      finish();
    }, 50);
    return () => { sub.remove(); clearInterval(timer); };
  }, [laidOut, imageReady]);
  useEffect(() => { finish(); }, [ready]);
  const skip = () => {
    if (elapsedRef.current < 1500) return;
    skipped.current = true;
    finish();
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { skip(); return true; });
    return () => sub.remove();
  }, []);
  const compact = height < 700 || fontScale > 1.3;
  const artSize = Math.min(width * .62, compact ? 170 : 265);
  return (
    <Pressable testID="chance-splash" onLayout={() => setLaidOut(true)} onPress={() => skip()}
      style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}
      accessibilityRole="button" accessibilityLabel="새 찬스 안내" accessibilityHint="1.5초 뒤 화면을 누르면 준비가 끝난 뒤 넘어갑니다">
      <ScrollView contentContainerStyle={[styles.content, { paddingVertical: compact ? 16 : 28 }]} bounces={false}>
        <Text style={[styles.brand, { color: colors.subtle }]}>{appName}</Text>
        <View style={[styles.badge, { backgroundColor: colors.primary }]}><Text style={[styles.badgeText, { color: colors.text }]}>NEW · 찬스</Text></View>
        <Text style={[styles.title, { color: colors.text, fontSize: compact ? 30 : 36, lineHeight: compact ? 40 : 47 }]}>{copy.title === DEFAULT_COPY.title ? '새로운 「찬스」가\n생겼어요!' : copy.title}</Text>
        <View style={[styles.art, { width: artSize + 28, height: artSize + 28, backgroundColor: colors.soft }]}>
          <Image source={character} style={{ width: artSize, height: artSize }} resizeMode="contain" onLoad={() => setImageReady(true)} onError={() => setImageReady(true)} accessible={false} />
        </View>
        <Text style={[styles.subtitle, { color: colors.text }]}>{copy.subtitle === DEFAULT_COPY.subtitle ? '앱 설치 · 가입만 해도\n포인트가 왕창' : copy.subtitle}</Text>
        <Text style={[styles.footer, { color: colors.subtle }]}>{copy.footer}</Text>
        {Platform.OS === 'ios' ? <Text style={[styles.note, { color: colors.subtle }]}>{copy.iosNote}</Text> : null}
        <Text style={[styles.skip, { color: colors.subtle }]}>{elapsed >= 1500 ? (ready ? '화면을 누르면 넘어가요' : '앱을 준비하고 있어요') : '잠시만 읽어 보세요'}</Text>
      </ScrollView>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, zIndex: 10000 },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28, gap: 14 },
  brand: { fontSize: 15, fontWeight: '700' },
  badge: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  badgeText: { fontSize: 15, fontWeight: '800' },
  title: { textAlign: 'center', fontWeight: '900', maxWidth: 440, flexShrink: 1 },
  art: { borderRadius: 180, alignItems: 'center', justifyContent: 'center' },
  subtitle: { fontSize: 23, lineHeight: 33, textAlign: 'center', fontWeight: '800', maxWidth: 400 },
  footer: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  note: { fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 400 },
  skip: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
});
