import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { dealEndsAt, num, partnerLine, partnerRewardName } from './format';
import { Chips, DisclosureNote, Disclosures, DealRow, ThemeRow, Notice, ProductGrid, RecentTicker } from './parts';
import { ProductPager } from './products';
import { ProofScreen } from './Proof';
import { CouponInfoScreen } from './CouponInfo';
import { CoupangSection } from './CoupangSection';
import { headCenterStyle, ShoppingHeaderTitle, shoppingTitleText, type ShoppingTitleAlign } from './Title';
import { DEFAULT_THEME, type PickedImage, type ProofInfo, type Category, type Deals, type NoticeSection, type Partner, type PartnerId, type Product, type ShoppingApi, type ShoppingHome, type ShoppingTheme, type ThemeSection } from './types';

export type ShoppingTabProps = {
  api: ShoppingApi;
  pickImage?: () => Promise<PickedImage | null>;
  theme?: Partial<ShoppingTheme>;
  /** 이동 — 서버가 준 추적 링크를 앱이 연다(외부 브라우저 · 제휴처 앱). 패키지는 직접 열지 않는다 */
  onOpenUrl: (url: string, ctx: { partnerId: PartnerId; productId?: string | null }) => void;
  /** 계측 — 패키지는 아무 데도 보내지 않는다 */
  onEvent?: (name: string, props?: Record<string, unknown>) => void;
  /** 이동 링크를 못 받았을 때 — code: signup_required(로그인 필요) · too_often · provider_not_ready · product_not_found · network. 앱이 로그인 창 · 안내를 띄운다 */
  onLinkError?: (code: string, ctx: { partnerId: PartnerId; productId?: string | null }) => void;
  /** 머리 위 여백(상태 표시줄) — 앱이 safe area 값을 넘긴다 */
  topInset?: number;
  /** (0.1.11) 머리 제목 글자 — 앱이 정한다. 없으면 `theme.title` → 「쇼핑」 */
  title?: string;
  /** (0.1.11) 머리 제목 맞춤 — 기본 'left'(예전 그대로), 'center' 면 가운데 */
  titleAlign?: ShoppingTitleAlign;
  /** (0.1.11) 머리 제목 글자 모양(fontSize · fontWeight · color …) — 기본 위에 덮는다. 없으면 예전 그대로 26 · 800 */
  titleStyle?: TextStyle;
};

type TabKey = 'all' | PartnerId;

/** 쇼핑 탭 — ① 머리 · 누적 혜택 · 상단 탭 ② 전체 ③ 포인트형 제휴처 ④ 할인권형 제휴처 ⑤ 할인권 안내 */
export function ShoppingTab({ api, theme: themeIn, onOpenUrl, onEvent, onLinkError, pickImage, topInset = 0, title, titleAlign, titleStyle }: ShoppingTabProps) {
  const theme: ShoppingTheme = { ...DEFAULT_THEME, ...themeIn };
  const [home, setHome] = useState<ShoppingHome | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<TabKey>('all');
  const [proofFor, setProofFor] = useState<{ partner: Partner; info: ProofInfo } | null>(null);
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

  if (proofFor && pickImage && api.proof) return <ProofScreen api={api} partner={proofFor.partner} info={proofFor.info} theme={theme} topInset={topInset} pickImage={pickImage} onBack={() => setProofFor(null)} onSubmitted={() => onEvent?.('shop_proof_submit', { partner: proofFor.partner.id })} onError={code => onEvent?.('shop_proof_error', { code })} />;

  if (couponFor) return <CouponInfoScreen api={api} partner={couponFor} theme={theme} topInset={topInset} onBack={() => setCouponFor(null)} onGo={() => open(couponFor.id)} />;

  const partners = home?.partners ?? [];
  const tabs: Array<{ key: TabKey; name: string }> = [{ key: 'all', name: '전체' }, ...partners.map(p => ({ key: p.id, name: p.name }))];
  const partner = partners.find(p => p.id === tab) ?? null;

  return <View style={[st.wrap, { backgroundColor: theme.bg, paddingTop: topInset }]}>
    <View style={titleAlign === 'center' ? [st.head, headCenterStyle] : st.head}>
      <ShoppingHeaderTitle text={shoppingTitleText(title, theme.title)} color={theme.text} align={titleAlign} style={titleStyle} />
      {partner?.rewardKind !== 'none' && partners.some(p => p.rewardKind !== 'none') ? <View style={[st.benefit, { backgroundColor: theme.primarySoft }]} accessibilityLabel={`누적 혜택 ${num(home?.totalBenefit ?? 0)} ${theme.pointName}`}>
        <Text style={[st.benefitLabel, { color: theme.primary }]}>누적 혜택</Text>
        <Text style={[st.benefitValue, { color: theme.primary }]}>{theme.pointMark ?? 'P'} {num(home?.totalBenefit ?? 0)}</Text>
      </View> : null}
    </View>
    <View style={[st.tabs, { borderBottomColor: theme.line }]}>
      {tabs.map(t => {
        const on = t.key === tab;
        return <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { setTab(t.key); onEvent?.('shopping_tab', { tab: t.key }); }}
          style={st.tab}>
          <Text style={[st.tabText, { color: on ? theme.text : '#B0B8C1', fontWeight: on ? '800' : '600' }]}>{t.name}</Text>
          {on ? <View style={[st.tabLine, { backgroundColor: theme.text }]} /> : null}
        </Pressable>;
      })}
    </View>
    {failed ? <Retry theme={theme} onRetry={load} />
      : !home ? <View style={st.center}><ActivityIndicator color={theme.primary} /></View>
      : tab === 'all' ? <AllView api={api} home={home} theme={theme} onPartner={setTab} onOpen={open} />
      : partner ? <PartnerView key={partner.id} api={api} partner={partner} theme={theme} onProduct={p => open(p.partnerId, p.id)} onCouponInfo={() => setCouponFor(partner)} pickImage={pickImage} onProof={info => { setProofFor({ partner, info }); onEvent?.('shop_proof_open', { partner: partner.id }); }} />
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
  const [page, setPage] = useState<{ items: Product[] | null; loadingMore: boolean }>({ items: null, loadingMore: false });
  const pager = React.useMemo(() => new ProductPager(api.products.bind(api), setPage), [api]);
  useEffect(() => {
    let active = true;
    setCats([]);
    setCat(null);
    api.categories(partnerId).then(c => { if (active) { setCats(c); setCat(c[0]?.id ?? null); } }).catch(() => {});
    return () => { active = false; };
  }, [api, partnerId]);
  useEffect(() => {
    void pager.reset({ partnerId, categoryId: cat });
    return () => pager.cancel();
  }, [pager, partnerId, cat]);
  const onScroll = useCallback(({ nativeEvent: e }: { nativeEvent: { layoutMeasurement: { height: number }; contentOffset: { y: number }; contentSize: { height: number } } }) => {
    if (e.layoutMeasurement.height + e.contentOffset.y >= e.contentSize.height - 400) void pager.more();
  }, [pager]);
  return { cats, cat, setCat, ...page, onScroll };
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

/** 화면이 마운트된 동안만 조회 · 타이머를 유지한다. 첫 유효한 제휴처 순서를 따른다. */
function useDeals(api: ShoppingApi, partnerIds: PartnerId[]) {
  const ids = JSON.stringify(partnerIds);
  const [result, setResult] = useState<{ deals: Deals; partnerId: PartnerId } | null>(null);
  const [now, setNow] = useState(Date.now);
  const [revision, setRevision] = useState(0);
  const onExpired = useCallback(() => { setResult(null); setRevision(v => v + 1); }, []);
  useEffect(() => {
    let active = true;
    setResult(null);
    async function load() {
      for (const partnerId of JSON.parse(ids) as PartnerId[]) {
        let deals: Deals | null;
        try { deals = await api.deals(partnerId); } catch { deals = null; }
        if (!active) return;
        if (deals?.items.length) {
          const receivedAt = Date.now();
          setNow(receivedAt);
          setResult({ partnerId, deals: { ...deals, endsAt: dealEndsAt(deals.endsAt, receivedAt) } });
          return;
        }
      }
    }
    void load();
    return () => { active = false; };
  }, [api, ids, revision]);
  useEffect(() => {
    if (!result) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [result]);
  return { result, now, onExpired };
}

function AllView({ api, home, theme, onPartner, onOpen }: { api: ShoppingApi; home: ShoppingHome; theme: ShoppingTheme; onPartner: (id: PartnerId) => void; onOpen: (partnerId: PartnerId, productId?: string | null) => void }) {
  const onProduct = (p: Product) => onOpen(p.partnerId, p.id);
  const lead = home.partners.find(p => p.rewardKind !== 'none');
  const { cats, cat, setCat, items, loadingMore, onScroll } = useProducts(api, 'all');
  const notice = useNotice(api, 'all');
  const { result, now, onExpired } = useDeals(api, home.partners.map(p => p.id));
  return <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={100}>
    <CoupangSection api={api.coupang} theme={theme} />
    {result ? <>
      <DisclosureNote text={home.partners.find(p => p.id === result.partnerId)?.disclosure} theme={theme} />
      <DealRow deals={result.deals} theme={theme} now={now} onPress={onProduct} onExpired={onExpired} />
    </> : null}
    {home.hero ? <Pressable accessibilityRole="button" onPress={() => { if (home.hero?.partnerId) onOpen(home.hero.partnerId, home.hero.productId); }}
      style={[st.hero, { backgroundColor: theme.primarySoft }]}>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={[st.heroLabel, { color: theme.danger }]}>{home.hero.label}</Text>
        <Text style={[st.heroTitle, { color: theme.text }]} numberOfLines={2}>{home.hero.title}</Text>
      </View>
      {home.hero.image ? <Image source={{ uri: home.hero.image }} style={st.heroImg} resizeMode="contain" /> : null}
    </Pressable> : null}
    {home.partners.length ? <View style={st.partners}>
      {home.partners.map(p => <Pressable key={p.id} accessibilityRole="button" onPress={() => onPartner(p.id)} style={[st.partner, { backgroundColor: theme.chipBg ?? '#F2F4F6' }]}>
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
    {loadingMore ? <ActivityIndicator size="small" color={theme.primary} /> : null}
    <Notice sections={notice} theme={theme} />
    <Disclosures texts={home.partners.map(p => p.disclosure ?? '')} theme={theme} />
  </ScrollView>;
}

function PartnerView({ api, partner, theme, onProduct, onCouponInfo, pickImage, onProof }: { pickImage?: () => Promise<PickedImage | null>; onProof: (info: ProofInfo) => void; api: ShoppingApi; partner: Partner; theme: ShoppingTheme; onProduct: (p: Product) => void; onCouponInfo: () => void }) {
  const [proofResult, setProofResult] = useState<{ api: ShoppingApi; partnerId: PartnerId; info: ProofInfo } | null>(null);
  useEffect(() => {
    let active = true;
    setProofResult(null);
    if (api.proof && pickImage) Promise.resolve().then(() => api.proof!.info(partner.id)).then(info => {
      if (active && info?.rateText.trim()) setProofResult({ api, partnerId: partner.id, info });
    }).catch(() => {});
    return () => { active = false; };
  }, [api, partner.id, pickImage]);
  const proofInfo = proofResult?.api === api && proofResult.partnerId === partner.id && pickImage ? proofResult.info : null;
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
  const { cats, cat, setCat, items, loadingMore, onScroll } = useProducts(api, partner.id);
  const notice = useNotice(api, partner.id);
  const { result, now, onExpired } = useDeals(api, [partner.id]);
  // 할인권 안내 글이 아직 없으면(정책 전 서버는 null) 「할인권이란?」 링크를 숨긴다
  const [hasInfo, setHasInfo] = useState(false);
  useEffect(() => {
    let active = true;
    setHasInfo(false);
    if (coupon) api.couponInfo(partner.id).then(i => { if (active) setHasInfo(!!i); }).catch(() => { if (active) setHasInfo(false); });
    return () => { active = false; };
  }, [api, partner.id, coupon]);
  return <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false} onScroll={themes.length ? undefined : onScroll} scrollEventThrottle={100}>
    <View style={[st.info, { backgroundColor: theme.chipBg ?? '#F2F4F6' }]}>
      <View style={[st.infoMark, { backgroundColor: theme.primary }]}>{partner.logo ? <Image source={{ uri: partner.logo }} resizeMode="contain" style={{ width: 22, height: 22 }} /> : <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>{partner.name.slice(0, 1)}</Text>}</View>
      <Text style={[st.infoText, { color: theme.text }]}>{partnerLine(partner, theme)}</Text>
      {coupon && hasInfo ? <Pressable accessibilityRole="link" onPress={onCouponInfo} hitSlop={8}><Text style={[st.infoLink, { color: theme.sub }]}>{partnerRewardName(partner, theme)}이란?</Text></Pressable> : null}
    </View>
    <DisclosureNote text={partner.disclosure} theme={theme} />
    {result ? <DealRow deals={result.deals} theme={theme} now={now} onPress={onProduct} onExpired={onExpired} /> : null}
    {proofInfo ? <Pressable accessibilityRole="button" onPress={() => onProof(proofInfo)} style={[st.info, { backgroundColor: theme.primarySoft }]}><Text style={{ color: theme.primary, fontWeight: '700' }}>구매했다면 인증하고 포인트 받기 ›</Text></Pressable> : null}
    {themes.length ? themes.map(section => <ThemeRow key={section.id} section={section} theme={theme} onPress={onProduct} />) : <>
    {!noReward ? <Text style={[st.h2, { color: theme.text }]}>{coupon ? '인기 상품 구경하기' : <>구매하면 <Text style={{ color: theme.primary }}>{partnerRewardName(partner, theme)} {partner.rateText}</Text> 드려요</>}</Text> : null}
    <Chips items={cats} value={cat} onChange={setCat} theme={theme} />
    {items ? <ProductGrid items={items} theme={theme} onPress={onProduct} /> : <View style={st.center}><ActivityIndicator color={theme.primary} /></View>}
    </>}
    {!themes.length && loadingMore ? <ActivityIndicator size="small" color={theme.primary} /> : null}
    <Notice sections={notice} theme={theme} />
    <Disclosures texts={[partner.disclosure ?? '']} theme={theme} />
  </ScrollView>;
}

const st = StyleSheet.create({
  wrap: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  benefitLabel: { fontSize: 13, fontWeight: '600' },
  benefitValue: { fontSize: 14, fontWeight: '800' },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 24, borderBottomWidth: 1 },
  tab: { height: 48, justifyContent: 'center' },
  tabText: { fontSize: 18 },
  tabLine: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, borderRadius: 2 },
  body: { paddingTop: 16, paddingBottom: 40, gap: 16 },
  center: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center', gap: 12 },
  empty: { fontSize: 15 },
  retry: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  hero: { marginHorizontal: 20, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', height: 150 },
  heroLabel: { fontSize: 14, fontWeight: '700' },
  heroTitle: { fontSize: 19, fontWeight: '800', lineHeight: 26 },
  heroImg: { width: 110, height: 110 },
  partners: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  partner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingHorizontal: 14, height: 64 },
  logo: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg: { width: 32, height: 32 },
  logoText: { fontSize: 16, fontWeight: '800' },
  partnerName: { fontSize: 15, fontWeight: '700' },
  partnerRate: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  chev: { fontSize: 24 },
  h2: { fontSize: 19, fontWeight: '800', paddingHorizontal: 20 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, minHeight: 52, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  infoMark: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  infoText: { flex: 1, fontSize: 15, fontWeight: '500' },
  infoLink: { fontSize: 14, textDecorationLine: 'underline' },
  tickerAt: { position: 'absolute', left: 0, right: 0, bottom: 12 },
});
