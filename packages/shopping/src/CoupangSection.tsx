import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Image, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { COUPANG_DISCLOSURE, isCoupangUrl, type CoupangApi, type CoupangConfig, type CoupangProduct, type CoupangProducts } from './coupang';
import { Chips, EmptyProducts, PartnerIntro, ProductGrid, ThemeRow } from './parts';
import { GUTTER, SECTION_GAP } from './layout';
import type { Product, ShoppingTheme } from './types';

export function useCoupangConfig(api?: CoupangApi) {
  const [result, setResult] = useState<{ owner: CoupangApi; config: CoupangConfig } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!api) return;
    const sub = AppState.addEventListener('change', state => { if (state === 'active') setTick(v => v + 1); });
    return () => sub.remove();
  }, [api]);
  useEffect(() => {
    let live = true;
    if (api) api.config().then(config => { if (live) setResult({ owner: api, config }); }).catch(() => { if (live) setResult(null); });
    return () => { live = false; };
  }, [api, tick]);
  return api && result?.owner === api && result.config.enabled ? result.config : null;
}

export function CoupangSection({ api, theme }: { api?: CoupangApi; theme: ShoppingTheme }) {
  const config = useCoupangConfig(api);
  return api && config ? <CoupangProductsView api={api} config={config} theme={theme} /> : null;
}

export function CoupangProductsView({ api, config, theme }: { api: CoupangApi; config: CoupangConfig; theme: ShoppingTheme }) {
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState({ keyword: '', category: '' });
  const [page, setPage] = useState<CoupangProducts | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [opening, setOpening] = useState(false);
  const [linkError, setLinkError] = useState(false);
  useEffect(() => {
    let live = true;
    setPage(null); setFailed(false);
    api.products(query).then(value => { if (live) setPage(value); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [api, query, revision]);
  async function open(product: CoupangProduct) {
    if (opening || !isCoupangUrl(product.deep_link)) return;
    setOpening(true); setLinkError(false);
    try {
      // Do not lose an otherwise usable link when click telemetry fails.
      void api.click(product.product_id).catch(() => {});
      await Linking.openURL(product.deep_link);
    } catch { setLinkError(true); } finally { setOpening(false); }
  }
  const items: Product[] = (page?.products ?? []).map(p => ({ id: p.product_id, partnerId: 'coupang', title: p.name, image: p.image_url, price: p.price, reward: 0, rewardKind: 'none' }));
  const browsing = !query.keyword && !query.category;
  const onProduct = (p: Product) => { const original = page?.products.find(x => x.product_id === p.id); if (original) void open(original); };
  const products = failed ? <Pressable accessibilityRole="button" onPress={() => setRevision(v => v + 1)} style={{ marginHorizontal: GUTTER }}><Text style={{ color: theme.sub }}>상품을 불러오지 못했어요. 다시 시도</Text></Pressable>
    : !page ? <ActivityIndicator color={theme.primary} />
    : !items.length ? <EmptyProducts theme={theme} partner={{ name: '쿠팡' }} />
    : browsing ? <ThemeRow section={{ id: 'coupang', title: '쿠팡 상품 둘러보기', items }} theme={theme} onPress={onProduct} />
    : <ProductGrid items={items} theme={theme} onPress={onProduct} />;
  return <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: SECTION_GAP, paddingBottom: 40, gap: SECTION_GAP }}>
    <PartnerIntro partner={{ id: 'coupang', name: '쿠팡', rateText: '쿠팡 상품 둘러보기', rewardKind: 'none', disclosure: COUPANG_DISCLOSURE }} text="쿠팡 상품 둘러보기" theme={theme} />
    {browsing ? products : null}
    <View style={{ marginHorizontal: GUTTER, height: 44, borderRadius: 12, backgroundColor: theme.chipBg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 8 }}>
      <Text accessible={false} style={{ color: theme.sub }}>⌕</Text>
      <TextInput accessibilityLabel="쿠팡 상품 검색" placeholder="쿠팡에서 찾기" placeholderTextColor={theme.sub} value={keyword} onChangeText={setKeyword}
        maxLength={100} returnKeyType="search" onSubmitEditing={() => setQuery({ keyword: keyword.trim(), category: '' })}
        style={{ flex: 1, height: 44, paddingVertical: 0, color: theme.text }} />
    </View>
    <Chips items={[{ id: '', name: '전체' }, ...(config.categories ?? [])]} value={query.category}
      onChange={category => { setKeyword(''); setQuery({ keyword: '', category }); }} theme={theme} />
    {!browsing ? products : null}
    {linkError ? <Text accessibilityLiveRegion="polite" style={{ marginHorizontal: GUTTER, color: theme.danger }}>쿠팡을 열지 못했어요. 다시 시도해 주세요.</Text> : null}
  </ScrollView>;
}
