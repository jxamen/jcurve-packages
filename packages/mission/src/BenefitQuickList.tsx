import React, { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, View, Text, Pressable, StyleSheet } from 'react-native';
import type { Requester } from './entry';
import { composeHomeRows, resolveHomeKeys, withFreeItemRow, type HomeRowKey, type HomeStorage } from './home';
import { useHomeConfig } from './useHomeConfig';
import { useCoupangVisit } from './useCoupangVisit';
import { COUPANG_DISCLOSURE } from './coupang';
import { buildHomeItems, type HomeActions, type HomeContext, type RemoteValues } from './homeDefs';

export type BenefitQuickIcon = 'calendar' | 'bag' | 'pin' | 'star' | 'ticket' | 'friend';
export type BenefitQuickItem = {
  key: string;
  title: string;
  subtitle: string;
  badge?: string;
  ctaLabel: string;
  icon: BenefitQuickIcon | ReactNode;
  tint: string;
  onPress: () => void;
  done?: boolean;
  hidden?: boolean;
  /** 부제 대신 칸 막대로 몇 개 했는지 보여 준다(2026-10-19 당근 대표님 「여기처럼 몇 개 있는지 표기」) */
  progress?: { done: number; total: number };
  /** 칸 막대 옆 한 줄(예: 「3개 남았어요」, 대표님 10-19 「아래 줄 남은 횟수 표기」) */
  progressLabel?: string;
  /** (0.7.4) 완료(done) 줄의 버튼 글자 — 이 줄만. 안 주면 목록의 `doneLabel` */
  doneLabel?: string;
  /** Always visible, wrapping disclosure below the row. */
  disclosure?: string;
};
export type BenefitQuickListProps = {
  title?: string;
  doneLabel?: string;
  buttonWidth?: number;
  /** 버튼 높이(기본 40) — 당근 대표님 10-19 「버튼 사이즈 좀 더 작게」 */
  buttonHeight?: number;
  seeAllLabel?: string;
  onSeeAll?: () => void;
  accentColor?: string;
  /** 앱이 직접 만든 줄(예전 방식). `homeActions` 를 주면 이 값은 쓰지 않는다 */
  items?: readonly BenefitQuickItem[];
  /**
   * (0.7.5) **줄 정의 전체를 패키지가 가진다**(당근 기준 9줄 — 제목 · 부제 · 버튼 · 아이콘 · 바탕색 · 순서): 앱은 줄마다 누르기 동작만 넘기면 그 줄이 그려지고,
   * **줄은 앱에서 빠지지 않는다**(0.7.13 — 동작은 전 줄 필수, 숨기는 길은 `remoteValues` 의 `home.row.<줄id>` · 걸음 줄 `steps.on` · 서버 home_rows visible:false 뿐). 서버 home_rows 는 이 위에 제목 · 설명 · 버튼 · 배지 · 보임 · 순서만 얹고 아이콘 · 바탕색은 늘 패키지 정의다. 앱이 아이콘 · 부제 · 숨김을 덮어쓸 수 없다.
   * 이 prop 을 주면 `items` · `homeKeys` · `itemName` · `onFreeItem` · `onRow` 는 쓰지 않는다(서버에만 있고 동작이 없는 줄은 그리지 않는다)
   */
  homeActions?: HomeActions;
  /** (0.7.5) `homeActions` 와 함께 — 아이템 이름 · 포인트 이름 · 걸음 수 · 무료 받은/남은 횟수 같은 값(글자 일부만 앱 값) */
  homeContext?: HomeContext;
  /** (0.7.13) `homeActions` 와 함께 — 어드민 앱 설정 값 맵(예 `values`). `home.row.<줄id>` 가 '0' / 'false' 면 그 줄을 숨기고 값이 없으면 켜짐, 걸음 줄은 `steps.on` 이 '1' / 'true' 일 때만 보임. 안 넘기면 원격 규칙은 적용하지 않는다 */
  remoteValues?: RemoteValues;
  footer?: ReactNode;
  /**
   * (0.4.4) 앱의 요청 함수 — 있으면 서버 `GET mission/home` 의 home_rows(어드민 mission.home_rows)를 **스스로 읽어** items 에 적용한다(제목 · 설명 · 버튼 · 배지 · 보임 · 순서).
   * 실패하면 앱 기본 그대로, 60초 캐시, 앱이 앞으로 돌아올 때 · `refreshKey` 가 바뀔 때 다시. 없으면 예전 그대로(적용 없음).
   */
  fetchJson?: Requester;
  /** (0.4.4) 앱 줄 key → 서버 줄 key(9개 고정) 맞춤표. 안 적은 줄은 key 가 서버 key 와 같으면 그대로. 예: { bag: 'quiz1', pin: 'quiz2', ticket: 'lucky_chance' } */
  homeKeys?: Readonly<Record<string, HomeRowKey>>;
  /** (0.4.4) 기본 free_item 줄(「무료 ○○ 받기 · 하루 3번 들르면 ○○ 받기」)의 ○○ — 앱 아이템 이름. 없으면 「아이템」 */
  itemName?: string;
  /** (0.4.4) 기본 free_item 줄을 눌렀을 때. **없으면 그 줄을 만들지 않는다**. 앱 items 에 이미 free_item(맞춤표 기준)이 있으면 겹치지 않는다 */
  onFreeItem?: () => void;
  /** (0.4.4) 서버 home_rows 에 있는데 앱 items 에 짝이 없는 줄(퀴즈 · 출석 · 만보기 · 오늘 미션 · 행운 찬스 · 초대 · 추천 앱 …)을 누르면. **없으면 그 줄은 그리지 않는다** */
  onRow?: (key: HomeRowKey) => void;
  /** (0.4.4) 홈으로 돌아올 때마다 바꿔 주면(예: tab === 'home') 서버 목록을 다시 읽는다 */
  refreshKey?: unknown;
  /**
   * (0.4.6) 앱이 넘기는 저장소(`get`/`set` 또는 `getItem`/`setItem`(0.7.3~) — 순정 AsyncStorage 를 그대로 넘기면 된다, 새 네이티브 의존 없음). 있으면 마지막으로 받은 서버 목록을 저장해 두고 **앱을 켤 때 그 값으로 먼저** 그린 뒤
   * 서버 응답으로 갱신한다(앱 기본 순서로 그렸다가 서버 순서로 바뀌지 않게, 대표님 10-20 18:54). 저장값을 읽는 동안(최대 300ms)은 목록을 그리지 않는다. 없으면 예전과 같다. `fetchJson` 이 있을 때만 쓴다.
   */
  storage?: HomeStorage;
  /** (0.4.6) 저장 키 — 기본 'jcurve.mission.home.v1'. 서버 · 계정마다 다른 목록을 쓰는 앱만 바꾼다 */
  storageKey?: string;
};

const colors: Record<BenefitQuickIcon, string> = {
  calendar: '#2F6FD6', bag: '#D2551E', pin: '#2E8B57',
  star: '#B7791F', ticket: '#7A4FD0', friend: '#C2410C',
};
/**
 * 아이콘 종류(0.7.9) — 'palette' 는 위 기본 그림 이름, 'text' 는 그 밖의 글자(이모지 👟 🌱 등), 'node' 는 앱이 넘긴 ReactNode.
 * RN 은 `<View>` 안의 글자를 그리지 않는다(iOS 빈 칸 · Android 오류) — 0.7.5~0.7.8 감자밭 「오늘 N걸음」 줄 아이콘이 빈 칸이던 원인(대표님 20:5x 캡처). 'text' 는 `<Text>` 로 감싼다
 */
export function iconKind(icon: BenefitQuickItem['icon']): 'palette' | 'text' | 'node' {
  if (typeof icon === 'string') return Object.prototype.hasOwnProperty.call(colors, icon) ? 'palette' : 'text';
  return typeof icon === 'number' ? 'text' : 'node';
}
/** Pure RN shapes: no additional native dependency. Supply a ReactNode for branded icons. */
function Icon({ icon }: { icon: BenefitQuickItem['icon'] }) {
  const kind = iconKind(icon);
  if (kind === 'text') return <Text style={s.iconText}>{icon as string | number}</Text>;
  if (kind === 'node') return <>{icon}</>;
  const name = icon as BenefitQuickIcon;
  const color = colors[name];
  const line = { borderColor: color, borderWidth: 2 };
  return <View accessible={false} style={s.iconDrawing}>
    {name === 'calendar' ? <View style={[line, s.calendar]}><View style={[s.calendarLine, { backgroundColor: color }]} /><View style={[s.check, { borderColor: color }]} /></View> : null}
    {name === 'bag' ? <><View style={[line, s.handle]} /><View style={[line, s.bag]} /></> : null}
    {name === 'pin' ? <View style={[line, s.pin]}><View style={[line, s.dot]} /></View> : null}
    {name === 'star' ? <><View style={[line, s.diamond]} /><View style={[line, s.diamond, { transform: [{ rotate: '0deg' }] }]} /></> : null}
    {name === 'ticket' ? <View style={[line, s.ticket]}><View style={[s.ticketLine, { borderColor: color }]} /></View> : null}
    {name === 'friend' ? <><View style={[line, s.head]} /><View style={[line, s.shoulders]} /><View style={[s.plusH, { backgroundColor: color }]} /><View style={[s.plusV, { backgroundColor: color }]} /></> : null}
  </View>;
}

/** 빠른 두 번 누름을 막는 시간(0.4.3) — 잠금 상태가 없어 영영 남을 수 없다. 이 시간이 지나면 다음 누름은 늘 들어간다 */
export const TAP_GUARD_MS = 700;
let lastTap = 0;
/** 줄 누름 — 직전 누름에서 TAP_GUARD_MS 안이면 무시. 처리 함수가 던져도 다음 누름은 막히지 않는다 */
export function pressOnce(run: () => void, now: number = Date.now()): boolean {
  if (now - lastTap >= 0 && now - lastTap < TAP_GUARD_MS) return false;
  lastTap = now;
  run();
  return true;
}
/** 시험용 — 누름 기록을 지운다 */
export function resetTapGuard(): void { lastTap = 0; }

/** (0.4.4) 앱이 앞으로 돌아올 때마다 올라가는 숫자 — 서버 목록을 다시 읽는 신호 */
function useActiveTick(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: string) => { if (s === 'active') setN(v => v + 1); });

    return () => sub.remove();
  }, []);

  return n;
}

type ViewProps = Omit<BenefitQuickListProps, 'items' | 'fetchJson' | 'homeKeys' | 'itemName' | 'onFreeItem' | 'onRow' | 'refreshKey' | 'storage' | 'storageKey' | 'homeActions' | 'homeContext' | 'remoteValues'> & { items: readonly BenefitQuickItem[] };

/** 서버 home_rows 를 얹는 층 — 훅이 있어 `fetchJson` 이 있을 때만 쓴다(없으면 BenefitQuickList 가 그림만 바로 그린다) */
function ServerRowsList({ fetchJson, homeKeys, onRow, refreshKey, storage, storageKey, items, view, keepUnlisted }: { keepUnlisted?: boolean; fetchJson: Requester; homeKeys?: Readonly<Record<string, HomeRowKey>>; onRow?: (key: HomeRowKey) => void; refreshKey?: unknown; storage?: HomeStorage; storageKey?: string; items: readonly BenefitQuickItem[]; view: Omit<ViewProps, 'items'> }) {
  const coupang = useCoupangVisit(fetchJson, refreshKey);
  const tick = useActiveTick();
  const key = useMemo(() => [refreshKey, tick], [refreshKey, tick]);
  const { config, ready } = useHomeConfig(fetchJson, key, storage, storageKey);
  // The server gate and the existing home-row toggle must both allow the row.
  const showCoupang = coupang.visible && (config.rows === null || config.rows.some(r => r.key === 'coupang_visit' && r.visible));
  const base = useMemo(() => {
    const next = items.filter(item => item.key !== 'coupang' && item.key !== 'coupang_visit');
    if (showCoupang) next.push({ key: 'coupang_visit', title: `쿠팡 방문하고 ${coupang.status.visit_point}P 받기`, subtitle: '',
      ctaLabel: '방문하기', doneLabel: '오늘 받음', done: coupang.status.today_done, icon: 'bag', tint: '#FDE6D6',
      onPress: coupang.start, disclosure: COUPANG_DISCLOSURE });
    return next;
  }, [items, showCoupang, coupang.status.visit_point, coupang.status.today_done, coupang.start]);
  const keys = useMemo(() => ({ ...resolveHomeKeys(base, homeKeys), coupang_visit: 'coupang_visit' as const }), [base, homeKeys]);
  // Never let onRow synthesize a Coupang action for an unauthorized member.
  const configured = useMemo(() => config.rows?.filter(r => r.key !== 'coupang_visit' || showCoupang) ?? null, [config.rows, showCoupang]);
  const merged = useMemo(() => composeHomeRows(base, configured, keys, { onRow, keepUnlisted }), [base, configured, keys, onRow, keepUnlisted]);
  // (0.4.6) 저장소를 쓰면 저장값을 읽을 때까지(최대 300ms) 그리지 않는다 — 앱 기본 순서를 잠깐 그렸다가 서버 순서로 바꾸지 않으려고. 저장소가 없으면 ready 는 늘 true
  if (!ready) return null;

  return <View><QuickListView {...view} items={merged} />
    {coupang.toast ? <View style={s.toast} accessibilityLiveRegion="polite"><Text style={s.toastText}>{coupang.toast}</Text></View> : null}
  </View>;
}

/**
 * 「바로 받는 혜택」 목록. (0.4.4) `fetchJson` 을 주면 서버 home_rows 를 스스로 적용하고, `onFreeItem` 을 주면 free_item 기본 줄이 생긴다 — 둘 다 없으면 0.4.3 과 똑같이 그린다.
 */
export function BenefitQuickList(props: BenefitQuickListProps) {
  const { fetchJson, homeKeys, itemName, onFreeItem, onRow, refreshKey, storage, storageKey, items, homeActions, homeContext, remoteValues, ...view } = props;
  // (0.7.5) homeActions 가 있으면 줄 정의는 패키지 것 — 서버에만 있는 줄은 동작이 없으니 그리지 않는다(onRow 안 씀)
  const base = homeActions ? buildHomeItems(homeContext ?? {}, homeActions, remoteValues) : withFreeItemRow(items ?? [], homeKeys, itemName, onFreeItem);
  if (!fetchJson) return QuickListView({ ...view, items: base });

  return <ServerRowsList fetchJson={fetchJson} homeKeys={homeActions ? undefined : homeKeys} onRow={homeActions ? undefined : onRow} refreshKey={refreshKey} storage={storage} storageKey={storageKey} items={base} view={view} keepUnlisted={!!homeActions} />;
}

function QuickListView({ title = '바로 받는 혜택', seeAllLabel, onSeeAll, accentColor = '#EE7A33', items, footer, doneLabel = '완료', buttonWidth = 100, buttonHeight = 40 }: ViewProps) {
  const visible = items.filter(item => !item.hidden);
  return <View style={s.root}>
    {/* 제목도 「전체보기」도 없으면 머리 줄을 그리지 않는다(2026-10-19 당근 대표님 「바로 받는 혜택 · 혜택 전체보기 제거」) */}
    {title || (seeAllLabel && onSeeAll) ? <View style={s.header}>
      {title ? <Text style={s.title}>{title}</Text> : <View />}
      {seeAllLabel && onSeeAll ? <Pressable accessibilityRole="button" onPress={onSeeAll} hitSlop={8}><Text style={[s.seeAll, { color: accentColor }]}>{seeAllLabel}</Text></Pressable> : null}
    </View> : null}
    <View style={s.card}>
      {/*
        줄 하나 = Pressable 하나(0.4.3). 0.4.0 은 줄 Pressable 안에 버튼 Pressable 을 또 넣어(당근 대표님 10-19 20:55 「줄을 눌러도 이동」)
        누름이 두 겹으로 갈렸다 — 대표님 10-20 11:42 「행운 찬스 눌렸다 안눌렸다」. 이제 버튼은 그림(View)이고 줄 전체가 한 단추다.
        빠른 두 번 누름은 TAP_GUARD_MS 동안만 무시한다 — 시간이 지나면 반드시 풀린다(화면 이동 · 실패 · 취소를 기다리지 않는다)
      */}
      {visible.map((item, index) => <React.Fragment key={item.key}><Pressable accessibilityRole="button" accessibilityLabel={item.title + ', ' + (item.done ? (item.doneLabel ?? doneLabel) : item.ctaLabel)}
        accessibilityState={{ disabled: !!item.done }} disabled={item.done} onPress={() => { if (!item.done) pressOnce(item.onPress); }}
        style={({ pressed }) => [s.row, index < visible.length - 1 && s.border, pressed && !item.done && { opacity: 0.85 }]}>
        <View style={[s.icon, { backgroundColor: item.tint }]}><Icon icon={item.icon} /></View>
        <View style={s.copy}><View style={s.nameRow}><Text style={s.name}>{item.title}</Text>{item.badge ? <View style={s.badge}><Text style={s.badgeText}>{item.badge}</Text></View> : null}</View>{item.progress && item.progress.total > 0
          ? <View accessibilityLabel={item.progress.done + '/' + item.progress.total} style={s.steps}>{Array.from({ length: item.progress.total }, (_, i) => <View key={i} style={[s.step, { backgroundColor: i < item.progress!.done ? accentColor : '#ECE6DE' }]} />)}{item.progressLabel ? <Text style={s.stepsLabel} numberOfLines={1}>{item.progressLabel}</Text> : null}</View>
          : <Text style={s.subtitle} numberOfLines={1} adjustsFontSizeToFit>{item.subtitle}</Text>}</View>
        <View pointerEvents="none" style={[s.button, { width: buttonWidth, height: buttonHeight, backgroundColor: item.done ? '#D3D7DD' : accentColor }]}>
          <Text style={s.cta} numberOfLines={1} adjustsFontSizeToFit>{item.done ? (item.doneLabel ?? doneLabel) : item.ctaLabel}</Text>
        </View>
      </Pressable>{item.disclosure ? <Text style={s.disclosure}>{item.disclosure}</Text> : null}</React.Fragment>)}
    </View>
    {footer != null ? <View style={s.footer}>{footer}</View> : null}
  </View>;
}
const s = StyleSheet.create({
  disclosure: { fontSize: 12, color: '#6B5E52', lineHeight: 18, paddingBottom: 12 },
  toast: { backgroundColor: '#2B2118', borderRadius: 12, padding: 12, marginTop: 8 },
  toastText: { color: '#FFFFFF', textAlign: 'center' },
  root: { gap: 10 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  title: { fontSize: 19, fontWeight: '700', color: '#2B2118', flexShrink: 1 }, seeAll: { fontSize: 13 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, border: { borderBottomWidth: 1, borderBottomColor: '#F3EBE1' },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 2 }, nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }, /* 광고 배지 — 글자만 떠 보이지 않게 색 바탕 배지로 조금 크게(당근 대표님 10-19 19:33 「배지로 조금 더 크게」) */
  badge: { backgroundColor: '#FDE6D6', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }, badgeText: { fontSize: 11, fontWeight: '800', color: '#E2600F' }, name: { flexShrink: 1, fontSize: 16, fontWeight: '700', color: '#2B2118' }, subtitle: { fontSize: 13, color: '#6B5E52' },
  steps: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }, step: { flex: 1, maxWidth: 26, height: 6, borderRadius: 3 }, stepsLabel: { marginLeft: 4, fontSize: 12, color: '#6B5E52' },
  button: { flexShrink: 0, height: 40, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, cta: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' }, footer: { marginTop: 4 },
  iconDrawing: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 22, lineHeight: 26, textAlign: 'center' },
  calendar: { width: 18, height: 17, borderRadius: 3 }, calendarLine: { height: 2, marginTop: 3 }, check: { width: 8, height: 5, borderLeftWidth: 2, borderBottomWidth: 2, transform: [{ rotate: '-45deg' }], marginLeft: 4, marginTop: 2 },
  bag: { width: 16, height: 14, borderRadius: 2, marginTop: 5 }, handle: { position: 'absolute', top: 1, width: 8, height: 9, borderRadius: 5 },
  pin: { width: 16, height: 19, borderRadius: 9, borderBottomRightRadius: 1, transform: [{ rotate: '45deg' }], alignItems: 'center', justifyContent: 'center' }, dot: { width: 6, height: 6, borderRadius: 3 },
  diamond: { position: 'absolute', width: 13, height: 13, transform: [{ rotate: '45deg' }] }, ticket: { width: 20, height: 14, borderRadius: 3 }, ticketLine: { height: 10, borderLeftWidth: 1, borderStyle: 'dashed', marginLeft: 6 },
  head: { position: 'absolute', top: 1, left: 4, width: 8, height: 8, borderRadius: 4 }, shoulders: { position: 'absolute', bottom: 1, left: 1, width: 15, height: 9, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderBottomWidth: 0 }, plusH: { position: 'absolute', right: 0, top: 9, width: 7, height: 2 }, plusV: { position: 'absolute', right: 2.5, top: 6.5, height: 7, width: 2 },
});
