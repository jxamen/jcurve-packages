import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { countdown, num, partnerLine, partnerRewardName } from './format';
import { Chips, DisclosureNote, Disclosures, ThemeRow, Notice, ProductCard, ProductGrid, RecentTicker } from './parts';
import { CouponInfoScreen } from './CouponInfo';
import { DEFAULT_THEME, type Category, type Deals, type NoticeSection, type Partner, type PartnerId, type Product, type ShoppingApi, type ShoppingHome, type ShoppingTheme, type ThemeSection } from './types';

export type ShoppingTabProps = {
  api: ShoppingApi;
  theme?: Partial<ShoppingTheme>;
  /** 이동 — 서버가 준 추적 링크를 앱이 연다(외부 브라우저 · 제휴처 앱). 패키지는 직접 열지 않는다 */
  onOpenUrl: (url: string, ctx: { partnerId: PartnerId; productId?: string | null }) => void;
  /** 계측 — 패키지는 아무 데도 보내지 않는다 */
  onEvent?: (name: string, props?: Record<string, unknown>) => void;
  /** 이동 링크를 못 받았을 때 — code: signup_required(로그인 필요) · too_often · provider_not_ready · product_not_found · network. 앱이 로그인 창 · 안내를 띄운다 */
  onLinkError?: (code: string, ctx: { partnerId: PartnerId; productId?: string | null }) => void;
  /** 머리 위 여백(상태 표시줄) — 앱이 safe area 값을 넘긴다 */
  topInset?: number;
};

type TabKey = 'all' | PartnerId;

/** 쇼핑 탭 — ① 머리 · 누적 혜택 · 상단 탭 ② 전체 ③ 포인트형 제휴처 ④ 할인권형 제휴처 ⑤ 할인권 안내 */
export function ShoppingTab({ api, theme: themeIn, onOpenUrl, onEvent, onLinkError, topInset = 0 }: ShoppingTabProps) {
  const theme: ShoppingTheme = { ...DEFAULT_THEME, ...themeIn };
  const [home, setHome] = useState<ShoppingHome | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<TabKey>('all');
  const [couponFor, setCouponFor] = useState<Partner | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    api.home().then(setHome).catch(() => setFailed(true));
  }, [api]);
  useEffect(load, [load]);

  const open = useCallback(async (partnerId: PartnerId, productId?: string | null) => {
    onEvent?.('shopping_open', { partnerId, productId: productId ?? null });
    try {
      const { url } = await api.link({ partnerId, productId });
      if (url) onOpenUrl(url, { partnerId, productId });
    } catch (e) {
      const code = String((e as { code?: string })?.code || 'network');
      onEvent?.('shopping_link_error', { partnerId, code });
      onLinkError?.(code, { partnerId, productId });
    }
  }, [api, onOpenUrl, onEvent, onLinkError]);

  if (couponFor) return <CouponInfoScreen api={api} partner={couponFor} theme={theme} topInset={topInset} onBack={() => setCouponFor(null)} onGo={() => open(couponFor.id)} />;

  const partners = home?.partners ?? [];
  const tabs: Array<{ key: TabKey; name: string }> = [{ key: 'all', name: '전체' }, ...partners.map(p => ({ key: p.id, name: p.name }))];
  const partner = partners.find(p => p.id === tab) ?? null;

  return <View style={[st.wrap, { backgroundColor: theme.bg, paddingTop: topInset }]}>
    <View style={st.head}>
      <Text accessibilityRole="header" style={[st.h1, { color: theme.text }]}>{theme.title ?? '쇼핑'}</Text>
      {partner?.rewardKind !== 'none' && partners.some(p => p.rewardKind !== 'none') ? <View style={[st.benefit, { backgroundColor: theme.primarySoft }]} accessibilityLabel={`누적 혜택 ${num(home?.totalBenefit ?? 0)} ${theme.pointName}`}>
        <Text style={[st.benefitLabel, { color: theme.primary }]}>누적 혜택</Text>
        <Text style={[st.benefitValue, { color: theme.primary }]}>{theme.pointMark ?? 'P'} {num(home?.totalBenefit ?? 0)}</Text>
      </View> : null}
    </View>
    <View style={[st.tabs, { borderBottomColor: theme.line }]}>
      {tabs.map(t => {
        const on = t.key === tab;
        return <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { setTab(t.key); onEvent?.('shopping_tab', { tab: t.key }); }}
          style={[st.tab, on && { borderBottomColor: theme.text }]}>
          <Text style={[st.tabText, { color: on ? theme.text : theme.sub }]}>{t.name}</Text>
        </Pressable>;
      })}
    </View>
    {failed ? <Retry theme={theme} onRetry={load} />
      : !home ? <View style={st.center}><ActivityIndicator color={theme.primary} /></View>
      : tab === 'all' ? <AllView api={api} home={home} theme={theme} onPartner={setTab} onOpen={open} />
      : partner ? <PartnerView key={partner.id} api={api} partner={partner} theme={theme} onProduct={p => open(p.partnerId, p.id)} onCouponInfo={() => setCouponFor(partner)} />
      : null}
    {home && partner?.rewardKind !== 'none' ? <View pointerEvents="none" style={st.tickerAt}><RecentTicker list={home.recent} theme={theme} /></View> : null}
  </View>;
}

function Retry({ theme, onRetry }: { theme: ShoppingTheme; onRetry: () => void }) {
  return <View style={st.center}>
    <Text style={[st.empty, { color: theme.sub }]}>상품을 불러오지 못했어요</Text>
    <Pressable accessibilityRole="button" onPress={onRetry} style={[st.retry, { backgroundColor: theme.primary }]}><Text style={{ color: theme.onPrimary, fontWeight: '700' }}>다시 시도</Text></Pressable>
  </View>;
}

/** 분류 칩 + 2열 목록 — 칩을 바꾸면 그 분류로 다시 받는다(늦게 온 이전 답은 버린다) */
function useProducts(api: ShoppingApi, partnerId: PartnerId | 'all') {
  const [cats, setCats] = useState<Category[]>([]);
  const [cat, setCat] = useState<string | null>(null);
  const [items, setItems] = useState<Product[] | null>(null);
  const seq = useRef(0);
  useEffect(() => {
    let active = true;
    setCats([]);
    setCat(null);
    api.categories(partnerId).then(c => { if (active) { setCats(c); setCat(c[0]?.id ?? null); } }).catch(() => { if (active) setCat(null); });
    return () => { active = false; };
  }, [api, partnerId]);
  useEffect(() => {
    const n = ++seq.current;
    setItems(null);
    api.products({ partnerId, categoryId: cat }).then(r => { if (n === seq.current) setItems(r.items); }).catch(() => { if (n === seq.current) setItems([]); });
    return () => { ++seq.current; };
  }, [api, partnerId, cat]);
  return { cats, cat, setCat, items };
}

function useNotice(api: ShoppingApi, partnerId: PartnerId | 'all') {
  const [n, setN] = useState<NoticeSection[]>([]);
  useEffect(() => {
    let active = true;
    setN([]);
    api.notice(partnerId).then(n => { if (active) setN(n); }).catch(() => { if (active) setN([]); });
    return () => { active = false; };
  }, [api, partnerId]);
  return n;
}

function AllView({ api, home, theme, onPartner, onOpen }: { api: ShoppingApi; home: ShoppingHome; theme: ShoppingTheme; onPartner: (id: PartnerId) => void; onOpen: (partnerId: PartnerId, productId?: string | null) => void }) {
  const onProduct = (p: Product) => onOpen(p.partnerId, p.id);
  const lead = home.partners.find(p => p.rewardKind !== 'none');
  const { cats, cat, setCat, items } = useProducts(api, 'all');
  const notice = useNotice(api, 'all');
  return <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
    {home.hero ? <Pressable accessibilityRole="button" onPress={() => { if (home.hero?.partnerId) onOpen(home.hero.partnerId, home.hero.productId); }}
      style={[st.hero, { backgroundColor: theme.primarySoft }]}>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={[st.heroLabel, { color: theme.danger }]}>{home.hero.label}</Text>
        <Text style={[st.heroTitle, { color: theme.text }]} numberOfLines={2}>{home.hero.title}</Text>
      </View>
      {home.hero.image ? <Image source={{ uri: home.hero.image }} style={st.heroImg} resizeMode="contain" /> : null}
    </Pressable> : null}
    {home.partners.length ? <View style={st.partners}>
      {home.partners.map(p => <Pressable key={p.id} accessibilityRole="button" onPress={() => onPartner(p.id)} style={[st.partner, { backgroundColor: theme.card }]}>
        <View style={[st.logo, { backgroundColor: theme.bg }]}>{p.logo ? <Image source={{ uri: p.logo }} style={st.logoImg} /> : <Text style={[st.logoText, { color: theme.primary }]}>{p.name.slice(0, 1)}</Text>}</View>
        <View style={{ flex: 1 }}>
          <Text style={[st.partnerName, { color: theme.text }]}>{p.name}</Text>
          <Text style={[st.partnerRate, { color: theme.primary }]}>{p.rateText}{p.rewardKind === 'none' ? '' : ' 적립'}</Text>
        </View>
        <Text style={[st.chev, { color: theme.sub }]}>›</Text>
      </Pressable>)}
    </View> : null}
    {lead ? <Text style={[st.h2, { color: theme.text }]}>{lead.name}에서 구매하면 <Text style={{ color: theme.primary }}>{lead.rateText}</Text> 적립</Text> : null}
    <Chips items={cats} value={cat} onChange={setCat} theme={theme} />
    {items ? <ProductGrid items={items} theme={theme} onPress={onProduct} /> : <View style={st.center}><ActivityIndicator color={theme.primary} /></View>}
    <Notice sections={notice} theme={theme} />
    <Disclosures texts={home.partners.map(p => p.disclosure ?? '')} theme={theme} />
  </ScrollView>;
}

function PartnerView({ api, partner, theme, onProduct, onCouponInfo }: { api: ShoppingApi; partner: Partner; theme: ShoppingTheme; onProduct: (p: Product) => void; onCouponInfo: () => void }) {
  const coupon = partner.rewardKind === 'coupon';
  const noReward = partner.rewardKind === 'none';
  const [themeResult, setThemeResult] = useState<{ api: ShoppingApi; partnerId: PartnerId; sections: ThemeSection[] } | null>(null);
  useEffect(() => {
    let active = true;
    setThemeResult(null);
    if (api.themes) {
      Promise.resolve().then(() => api.themes!(partner.id)).then(sections => {
        if (active) setThemeResult({ api, partnerId: partner.id, sections });
      }).catch(() => { if (active) setThemeResult(null); });
    }
    return () => { active = false; };
  }, [api, partner.id]);
  const themes = themeResult?.api === api && themeResult.partnerId === partner.id ? themeResult.sections : [];
  const { cats, cat, setCat, items } = useProducts(api, partner.id);
  const notice = useNotice(api, partner.id);
  const [deals, setDeals] = useState<Deals | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let active = true;
    setDeals(null);
    if (!coupon) api.deals(partner.id).then(d => { if (active) setDeals(d); }).catch(() => { if (active) setDeals(null); });
    return () => { active = false; };
  }, [api, partner.id, coupon]);
  // 할인권 안내 글이 아직 없으면(정책 전 서버는 null) 「할인권이란?」 링크를 숨긴다
  const [hasInfo, setHasInfo] = useState(false);
  useEffect(() => {
    let active = true;
    setHasInfo(false);
    if (coupon) api.couponInfo(partner.id).then(i => { if (active) setHasInfo(!!i); }).catch(() => { if (active) setHasInfo(false); });
    return () => { active = false; };
  }, [api, partner.id, coupon]);
  useEffect(() => { if (!deals) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [deals]);
  const left = deals ? countdown(deals.endsAt, now) : null;
  return <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
    <View style={[st.info, { backgroundColor: theme.card }]}>
      {!noReward ? <Text style={[st.infoMark, { backgroundColor: coupon ? theme.text : theme.primary, color: theme.onPrimary }]}>{coupon ? '할' : (theme.pointMark ?? 'P').slice(0, 1)}</Text> : null}
      <Text style={[st.infoText, { color: theme.text }]}>{partnerLine(partner, theme)}</Text>
      {coupon && hasInfo ? <Pressable accessibilityRole="link" onPress={onCouponInfo} hitSlop={8}><Text style={[st.infoLink, { color: theme.sub }]}>{partnerRewardName(partner, theme)}이란?</Text></Pressable> : null}
    </View>
    {themes.length || noReward ? <DisclosureNote text={partner.disclosure} theme={theme} /> : null}
    {deals && left && deals.items.length ? <View>
      <Text style={[st.h2, { color: theme.text, marginBottom: 2 }]}>{deals.title ?? '오늘만 이 가격에 팔아요'}</Text>
      <Text style={[st.left, { color: theme.danger }]}>{left} 동안만 특가</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.deals}>
        {deals.items.map(p => <ProductCard key={p.id} product={p} theme={theme} onPress={onProduct} width={136} />)}
      </ScrollView>
    </View> : null}
    {themes.length ? themes.map(section => <ThemeRow key={section.id} section={section} theme={theme} onPress={onProduct} />) : <>
    {!noReward ? <Text style={[st.h2, { color: theme.text }]}>{coupon ? '인기 상품 구경하기' : <>구매하면 <Text style={{ color: theme.primary }}>{partnerRewardName(partner, theme)} {partner.rateText}</Text> 드려요</>}</Text> : null}
    <Chips items={cats} value={cat} onChange={setCat} theme={theme} />
    {items ? <ProductGrid items={items} theme={theme} onPress={onProduct} /> : <View style={st.center}><ActivityIndicator color={theme.primary} /></View>}
    </>}
    <Notice sections={notice} theme={theme} />
    <Disclosures texts={[partner.disclosure ?? '']} theme={theme} />
  </ScrollView>;
}

const st = StyleSheet.create({
  wrap: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
  h1: { fontSize: 24, fontWeight: '800' },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  benefitLabel: { fontSize: 13, fontWeight: '600' },
  benefitValue: { fontSize: 14, fontWeight: '800' },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, borderBottomWidth: 1 },
  tab: { paddingHorizontal: 10, paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent', marginBottom: -1 },
  tabText: { fontSize: 18, fontWeight: '700' },
  body: { paddingTop: 16, paddingBottom: 40 },
  center: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center', gap: 12 },
  empty: { fontSize: 15 },
  retry: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  hero: { marginHorizontal: 20, borderRadius: 20, padding: 22, flexDirection: 'row', alignItems: 'center', minHeight: 120 },
  heroLabel: { fontSize: 14, fontWeight: '700' },
  heroTitle: { fontSize: 18, fontWeight: '700', lineHeight: 26 },
  heroImg: { width: 110, height: 90 },
  partners: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 12 },
  partner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 14 },
  logo: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg: { width: 32, height: 32 },
  logoText: { fontSize: 16, fontWeight: '800' },
  partnerName: { fontSize: 15, fontWeight: '700' },
  partnerRate: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  chev: { fontSize: 24 },
  h2: { fontSize: 19, fontWeight: '800', paddingHorizontal: 20, marginTop: 28, marginBottom: 12 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  infoMark: { width: 22, height: 22, borderRadius: 11, textAlign: 'center', lineHeight: 22, fontSize: 12, fontWeight: '800', overflow: 'hidden' },
  infoText: { flex: 1, fontSize: 14 },
  infoLink: { fontSize: 14, textDecorationLine: 'underline' },
  left: { fontSize: 16, fontWeight: '600', paddingHorizontal: 20, marginBottom: 12 },
  deals: { paddingHorizontal: 20, gap: 12 },
  tickerAt: { position: 'absolute', left: 0, right: 0, bottom: 12 },
});
