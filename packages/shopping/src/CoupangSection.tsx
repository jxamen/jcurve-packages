import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Image, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { COUPANG_DISCLOSURE, isCoupangUrl, type CoupangApi, type CoupangConfig, type CoupangProduct, type CoupangProducts } from './coupang';
import type { ShoppingTheme } from './types';

export function CoupangSection({ api, theme }: { api?: CoupangApi; theme: ShoppingTheme }) {
  const [result, setResult] = useState<{ owner: CoupangApi; config: CoupangConfig } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!api) return;
    const sub = AppState.addEventListener('change', state => { if (state === 'active') setTick(v => v + 1); });
    return () => sub.remove();
  }, [api]);
  useEffect(() => {
    let live = true;
    setResult(null);
    if (api) api.config().then(config => { if (live) setResult({ owner: api, config }); }).catch(() => {});
    return () => { live = false; };
  }, [api, tick]);
  if (!api || result?.owner !== api || !result.config.enabled) return null;
  return <CoupangProductsView api={api} config={result.config} theme={theme} />;
}

function CoupangProductsView({ api, config, theme }: { api: CoupangApi; config: CoupangConfig; theme: ShoppingTheme }) {
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState({ keyword: '', category: config.categories?.[0]?.id ?? '' });
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
  return <View style={{ gap: 12, paddingVertical: 16 }}>
    <Text style={{ color: theme.sub, fontSize: 12, lineHeight: 18 }}>{COUPANG_DISCLOSURE}</Text>
    <Text accessibilityRole="header" style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>쿠팡 상품</Text>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <TextInput accessibilityLabel="쿠팡 상품 검색" placeholder="상품 검색" value={keyword} onChangeText={setKeyword}
        maxLength={100} returnKeyType="search" onSubmitEditing={() => setQuery({ keyword: keyword.trim(), category: '' })}
        style={{ flex: 1, borderWidth: 1, borderColor: theme.line, borderRadius: 8, padding: 10, color: theme.text }} />
      <Pressable accessibilityRole="button" onPress={() => setQuery({ keyword: keyword.trim(), category: '' })} style={{ padding: 12 }}><Text style={{ color: theme.primary }}>검색</Text></Pressable>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {[{ id: '', name: '전체' }, ...(config.categories ?? [])].map(c => <Pressable key={c.id} accessibilityRole="button"
        accessibilityState={{ selected: query.category === c.id }} onPress={() => { setKeyword(''); setQuery({ keyword: '', category: c.id }); }}
        style={{ padding: 10, marginRight: 8, borderRadius: 8, backgroundColor: query.category === c.id ? theme.primarySoft : theme.card }}>
        <Text style={{ color: theme.text }}>{c.name}</Text></Pressable>)}
    </ScrollView>
    {failed ? <Pressable accessibilityRole="button" onPress={() => setRevision(v => v + 1)}><Text style={{ color: theme.sub }}>상품을 불러오지 못했어요. 다시 시도</Text></Pressable>
      : !page ? <ActivityIndicator color={theme.primary} />
      : <>
        {page.message ? <Text style={{ color: theme.sub }}>{page.message}</Text> : null}
        {!page.products.length && !page.message ? <Text style={{ color: theme.sub }}>상품이 없어요</Text> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {page.products.map(p => <Pressable key={p.product_id} accessibilityRole="link" disabled={opening} onPress={() => { void open(p); }} style={{ width: '47%', gap: 6 }}>
            {p.image_url ? <Image source={{ uri: p.image_url }} style={{ width: '100%', aspectRatio: 1, borderRadius: 8 }} /> : null}
            <Text style={{ color: theme.text }} numberOfLines={2}>{p.name}</Text>
            {typeof p.price === 'number' ? <Text style={{ color: theme.text, fontWeight: '700' }}>{p.price.toLocaleString('ko-KR')}원</Text> : null}
          </Pressable>)}
        </View>
      </>}
    {linkError ? <Text accessibilityLiveRegion="polite" style={{ color: theme.danger }}>쿠팡을 열지 못했어요. 다시 시도해 주세요.</Text> : null}
  </View>;
}
