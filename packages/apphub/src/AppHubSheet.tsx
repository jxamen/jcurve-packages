/**
 * 「앱 모아보기」 — 계열 앱을 한 줄씩 보여 주고, 누르면 그 기기의 스토어로 보낸다.
 *
 * **이 화면이 패키지에 들어 있는 이유**: 앱마다 따로 만들면 앱마다 다른 말을 하게 된다
 * (2026-09-20 지시: 「이걸 다른 앱에도 다 넣을 거니까 패키지 형태로 만들어 줘, 누르면
 * 나오는 내용이 같게끔」). 들어가는 입구(하단 버튼)는 앱마다 그 앱답게 따로 달고,
 * **눌러서 나오는 내용은 여기 한 곳에서만 고친다.**
 *
 * 목록의 원본은 어드민 「앱관리」다 — 서버가 `{base}/family` 로 내준다. 그래서 새 앱이
 * 늘어도 어느 앱도 다시 빌드하지 않는다.
 *
 * 색만 앱에서 받는다(`theme`). 문구 · 순서 · 동작은 받지 않는다 — 그걸 열어 두면 앱마다
 * 달라지고, 이 패키지를 만든 이유가 없어진다.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { familyRows, type FamilyApp, type FamilyRow } from './pick';
import { storeLoader, type FamilySection, type Loader } from './load';

export type AppHubTheme = {
  /** 화면 바탕 */
  bg?: string;
  /** 카드 바탕 */
  card?: string;
  /** 가르는 선 */
  line?: string;
  text?: string;
  sub?: string;
  dim?: string;
  /** 「받으러 가기」 알약 */
  accent?: string;
  accentSoft?: string;
};

const DEF: Required<AppHubTheme> = {
  bg: '#F6F7F9',
  card: '#FFFFFF',
  line: '#ECEEF1',
  text: '#191F28',
  sub: '#8B95A1',
  dim: '#C4CBD4',
  accent: '#2C6BE8',
  accentSoft: '#E8F0FF',
};

export type AppHubSheetProps = {
  open: boolean;
  onClose: () => void;
  /** 앱 API 주소 — 슬러그까지 들어간 그대로(예: `https://api.j-curve.co.kr/v1/carrotcash`) */
  base?: string;
  /** 앱 공개 키(`X-App-Token`) — 서버가 어느 앱이 묻는지 알아야 자기 앱을 뺄 수 있다 */
  token?: string;
  /** 앱이 자기 통로로 직접 받아 오고 싶을 때 — 주면 `base` 대신 이것을 쓴다 */
  load?: Loader;
  theme?: AppHubTheme;
  /** `useAppHub` 로 이미 받은 목록 — 주면 다시 부르지 않는다(2026-09-25) */
  items?: FamilyApp[] | null;
  /** 어드민이 정한 제목 · 설명 — null 이면 기존 문구 */
  section?: FamilySection;
  /** 계측 — 앱의 `track()` 을 그대로 넘긴다(패키지는 아무 데도 보내지 않는다) */
  onEvent?: (name: string, props?: Record<string, string | number | boolean | null>) => void;
};

export function AppHubSheet({ open, onClose, base, token, load, theme, items, section, onEvent }: AppHubSheetProps) {
  const t = { ...DEF, ...(theme ?? {}) };
  const s = styles(t);
  const [rows, setRows] = useState<FamilyRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  const fetchRows = useCallback(async () => {
    setFailed(false);
    if (items) { setRows(familyRows(items, Platform.OS)); return; }
    const loader = load ?? (base ? storeLoader({ base, token }) : null);
    if (!loader) { setFailed(true); return; }
    try {
      const items = await loader();
      setRows(familyRows(items, Platform.OS));
    } catch {
      /* 「없다」가 아니라 「못 불러왔다」 — 다시 눌러 볼 수 있게 남긴다 */
      setFailed(true);
    }
  }, [base, token, load, items]);

  useEffect(() => {
    if (!open) return;
    setRows(null);
    void fetchRows();
    onEvent?.('apphub_open');
    // onEvent 는 매번 새 함수로 올 수 있어 의존성에서 뺀다 — 열 때 한 번이면 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fetchRows]);

  const go = useCallback((row: FamilyRow) => {
    if (!row.url) return;
    onEvent?.('apphub_tap', { slug: row.slug });
    void Linking.openURL(row.url).catch(() => { /* 스토어가 없는 기기면 아무 일도 하지 않는다 */ });
  }, [onEvent]);

  if (!open) return null;

  return (
    <Modal animationType="slide" visible onRequestClose={onClose}>
      <View style={s.page}>
        <View style={s.head}>
          <Pressable onPress={onClose} hitSlop={12} style={s.close} accessibilityRole="button" accessibilityLabel="닫기">
            <Text style={s.closeMark}>✕</Text>
          </Pressable>
          <Text style={s.headTitle}>앱 모아보기</Text>
          {/* 제목이 가운데 오도록 오른쪽에 같은 폭을 비워 둔다 */}
          <View style={s.close} />
        </View>

        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          <View style={s.intro}>
            <Text style={s.introTitle}>{section?.title ?? '추천 앱'}</Text>
            <Text style={s.introBody}>{section?.desc ?? '받아서 시작하면 그 앱에서도 포인트를 모을 수 있어요\n포인트는 앱마다 따로 쌓여요'}</Text>
          </View>

          {rows === null && !failed ? (
            <View style={s.center}><ActivityIndicator color={t.accent} /></View>
          ) : failed ? (
            <View style={s.center}>
              <Text style={s.emptyTitle}>목록을 불러오지 못했어요</Text>
              <Pressable onPress={() => { void fetchRows(); }} style={s.retry}>
                <Text style={s.retryText}>다시 시도</Text>
              </Pressable>
            </View>
          ) : rows && rows.length === 0 ? (
            <View style={s.center}>
              <Text style={s.emptyTitle}>아직 보여 드릴 앱이 없어요</Text>
              <Text style={s.emptyBody}>새 앱이 나오면 여기에 나와요</Text>
            </View>
          ) : (
            <View style={s.card}>
              {(rows ?? []).map((r, i) => (
                <View key={r.slug}>
                  {i > 0 ? <View style={s.hr} /> : null}
                  <Pressable
                    onPress={() => go(r)}
                    accessibilityRole="button"
                    accessibilityLabel={r.name + ', 받으러 가기'}
                    style={({ pressed }: { pressed: boolean }) => [s.row, pressed ? s.pressed : null]}
                  >
                    {r.icon
                      ? <Image source={{ uri: r.icon }} style={s.icon} />
                      : (
                        <View style={[s.icon, s.initialBox, { backgroundColor: r.tint }]}>
                          <Text style={s.initial}>{r.initial}</Text>
                        </View>
                      )}
                    <View style={s.texts}>
                      <Text style={s.name} numberOfLines={1}>{r.name}</Text>
                      {r.desc ? <Text style={s.desc} numberOfLines={1}>{r.desc}</Text> : null}
                    </View>
                    {/*
                      버튼을 따로 두지 않는다 — **줄을 누르면 간다**(2026-09-20 지시).
                      알약이 오른쪽 폭을 먹으면 긴 앱 이름이 「행복한 꼬꼬농장 — 알 모으…」처럼 잘린다.
                      누를 수 있다는 것은 화살표로만 알린다. 이 기기 스토어에 없는 앱은
                      `familyRows` 가 아예 빼 놓아서 못 누를 줄이 없다.
                    */}
                    <Text style={s.go}>›</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Text style={s.foot}>스토어로 이동해요. 받는 것은 무료예요</Text>
          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = (t: Required<AppHubTheme>) => StyleSheet.create({
  page: { flex: 1, backgroundColor: t.bg },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, backgroundColor: t.card,
    borderBottomWidth: 1, borderBottomColor: t.line,
  },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closeMark: { fontSize: 20, fontWeight: '700', color: t.text },
  headTitle: { fontSize: 17, fontWeight: '800', color: t.text },

  body: { padding: 16, gap: 12 },
  intro: { gap: 4, paddingHorizontal: 4, paddingTop: 4 },
  introTitle: { fontSize: 18, fontWeight: '900', color: t.text },
  introBody: { fontSize: 13.5, color: t.sub, lineHeight: 20 },

  card: { backgroundColor: t.card, borderRadius: 18, overflow: 'hidden' },
  hr: { height: 1, backgroundColor: t.line, marginLeft: 68 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  pressed: { opacity: 0.7 },
  icon: { width: 40, height: 40, borderRadius: 12 },
  initialBox: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 19, fontWeight: '900', color: '#FFFFFF' },
  /* 이름과 소개를 한 덩어리로 — 오른쪽 알약이 자리를 먼저 가져가고 남은 폭을 글이 쓴다 */
  texts: { flex: 1, gap: 2 },
  name: { fontSize: 15.5, fontWeight: '800', color: t.text },
  desc: { fontSize: 12.5, color: t.sub },
  go: { fontSize: 20, fontWeight: '700', color: t.dim, marginLeft: 4 },

  center: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  emptyTitle: { fontSize: 15.5, fontWeight: '800', color: t.text },
  emptyBody: { fontSize: 13.5, color: t.sub },
  retry: { marginTop: 8, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: t.accentSoft },
  retryText: { fontSize: 13.5, fontWeight: '800', color: t.accent },
  foot: { fontSize: 12, color: t.dim, textAlign: 'center', marginTop: 4 },
});
