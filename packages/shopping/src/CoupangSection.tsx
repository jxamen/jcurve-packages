import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Image, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { COUPANG_CATEGORIES, COUPANG_DISCLOSURE, isCoupangUrl, type CoupangApi, type CoupangConfig, type CoupangProduct, type CoupangProducts } from './coupang';
import { Chips, EmptyProducts, PartnerIntro, ProductGrid, ThemeRow } from './parts';
import { GUTTER, SECTION_GAP } from './layout';
import type { Product, ShoppingTheme } from './types';

type AvailableCoupangConfig = CoupangConfig & { initialProducts?: CoupangProducts };

export function useCoupangConfig(api?: CoupangApi) {
  const [result, setResult] = useState<{ owner: CoupangApi; config: AvailableCoupangConfig } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!api) return;
    const sub = AppState.addEventListener('change', state => { if (state === 'active') setTick(v => v + 1); });
    return () => sub.remove();
  }, [api]);
  useEffect(() => {
    let live = true;
    setResult(null);
    async function load() {
      if (!api) return;
      try {
        const config = await api.config();
        if (!live || !config.enabled) return;
        const initialProducts = await api.products({ keyword: '', category: config.categories?.[0]?.id || COUPANG_CATEGORIES[0].id });
        // Configuration may be enabled before credentials/catalog are ready.
        if (live && initialProducts.status !== 'configuration_required' && initialProducts.products.length > 0) {
          setResult({ owner: api, config: { ...config, initialProducts } });
        }
      } catch { if (live) setResult(null); }
    }
    void load();
    return () => { live = false; };
  }, [api, tick]);
  return api && result?.owner === api && result.config.enabled ? result.config : null;
}

export function CoupangSection({ api, theme }: { api?: CoupangApi; theme: ShoppingTheme }) {
  const config = useCoupangConfig(api);
  return api && config ? <CoupangProductsView api={api} config={config} theme={theme} /> : null;
}

export function CoupangProductsView({ api, config, theme }: { api: CoupangApi; config: AvailableCoupangConfig; theme: ShoppingTheme }) {
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState({ keyword: '', category: '' });
  const defaultCategory = config.categories?.[0]?.id || COUPANG_CATEGORIES[0].id;
  const [page, setPage] = useState<CoupangProducts | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [opening, setOpening] = useState(false);
  const [linkError, setLinkError] = useState(false);
  useEffect(() => {
    let live = true;
    setPage(null); setFailed(false);
    const request = !query.keyword && !query.category && revision === 0 && config.initialProducts
      ? Promise.resolve(config.initialProducts)
      : api.products({ ...query, category: query.category || (query.keyword ? '' : defaultCategory) });
    request.then(value => { if (live) setPage(value); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [api, query, revision, defaultCategory, config.initialProducts]);
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
  if (!config.enabled || failed || !page || page.status === 'configuration_required' || !items.length) return null;
  return <ScrollView testID="coupang-products-section" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: SECTION_GAP, paddingBottom: 40, gap: SECTION_GAP }}>
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
