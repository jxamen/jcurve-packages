import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { isFiniteNumber, num, realRecent, won } from './format';
import type { Category, NoticeSection, Product, RecentReward, ShoppingTheme, ThemeSection } from './types';

/** 적립 딱지 — 포인트형은 「P 447」, 할인권형은 번개 모양 대신 「할인권 7」(그림은 앱마다 다르니 글로) */
export function RewardBadge({ product, theme }: { product: Product; theme: ShoppingTheme }) {
  if (product.reward <= 0 || product.rewardKind === 'none') return null;
  const coupon = product.rewardKind === 'coupon';
  return <View style={[s.badge, { backgroundColor: coupon ? theme.text : theme.primary }]}>
    <Text style={[s.badgeMark, { color: coupon ? theme.text : theme.primary, backgroundColor: theme.onPrimary }]}>{coupon ? '할' : (theme.pointMark ?? 'P').slice(0, 1)}</Text>
    <Text style={[s.badgeText, { color: theme.onPrimary }]}>약 {num(product.reward)}</Text>
  </View>;
}

function Thumb({ uri, title, theme, style }: { uri?: string | null; title: string; theme: ShoppingTheme; style: object }) {
  return <View style={[style, { backgroundColor: theme.thumbBg ?? '#F2F4F6' }]}>
    {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" accessibilityIgnoresInvertColors />
      : <View style={[s.thumbEmpty, { flex: 1 }]}><Text style={[s.thumbLetter, { color: theme.sub }]}>{title.replace(/^\[[^\]]*\]\s*/, '').slice(0, 1)}</Text></View>}
  </View>;
}

export function ProductCard({ product, theme, onPress, width }: { product: Product; theme: ShoppingTheme; onPress: (p: Product) => void; width: number | `${number}%` }) {
  const hasPrice = isFiniteNumber(product.price);
  return <Pressable accessibilityRole="button" accessibilityLabel={hasPrice ? `${product.title}, ${won(product.price)}` : product.title} onPress={() => onPress(product)}
    style={({ pressed }) => [{ width, opacity: pressed ? 0.85 : 1 }]}>
    <View>
      <Thumb uri={product.image} title={product.title} theme={theme} style={s.thumb} />
      {product.reward > 0 && product.rewardKind !== 'none' ? <View style={s.badgeAt}><RewardBadge product={product} theme={theme} /></View> : null}
    </View>
    {product.tags?.length ? <Text style={[s.tag, { color: theme.primary }]} numberOfLines={1}>{product.tags.join(' · ')}</Text> : null}
    <Text style={[s.title, { color: theme.text }]} numberOfLines={2}>{product.title}</Text>
    {hasPrice ? <View style={s.priceRow}>
      {isFiniteNumber(product.discountRate) && product.discountRate ? <Text style={[s.rate, { color: theme.danger }]}>{product.discountRate}%</Text> : null}
      <Text style={[s.price, { color: theme.text }]} numberOfLines={1}>{won(product.price)}</Text>
    </View> : null}
    {product.rating ? <Text style={[s.rating, { color: theme.sub }]}><Text style={{ color: '#FFB800' }}>★</Text> {product.rating.toFixed(1)}{product.reviews ? ` (${num(product.reviews)})` : ''}</Text> : null}
  </Pressable>;
}

/** 주제 제목과 수동으로 넘기는 상품 줄 */
export function ThemeRow({ section, theme, onPress }: { section: ThemeSection; theme: ShoppingTheme; onPress: (p: Product) => void }) {
  if (!section.items.length) return null;
  return <View style={{ marginTop: 32 }}>
    <Text accessibilityRole="header" style={{ paddingHorizontal: 20, fontSize: 20, fontWeight: '800', color: theme.text }}>{section.title}</Text>
    {section.subtitle ? <Text style={{ paddingHorizontal: 20, marginTop: 4, fontSize: 14, color: theme.sub }}>{section.subtitle}</Text> : null}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingTop: 14 }}>
      {section.items.map(p => <ProductCard key={p.id} product={p} theme={theme} onPress={onPress} width={128} />)}
    </ScrollView>
  </View>;
}

/** 대가성 문구는 원문 그대로 링크 가까이에 펼쳐 표시 */
export function DisclosureNote({ text, theme }: { text?: string | null; theme: ShoppingTheme }) {
  if (!text?.trim()) return null;
  return <View style={{ marginHorizontal: 20, marginTop: 10, flexDirection: 'row', gap: 6 }}>
    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.sub, borderWidth: 1, borderColor: theme.line, borderRadius: 4, paddingHorizontal: 5, height: 18, lineHeight: 16 }}>광고</Text>
    <Text style={{ fontSize: 12.5, lineHeight: 18, color: theme.sub, flex: 1 }}>{text}</Text>
  </View>;
}

/** 2열 상품 목록 */
export function ProductGrid({ items, theme, onPress }: { items: Product[]; theme: ShoppingTheme; onPress: (p: Product) => void }) {
  const { width } = useWindowDimensions();
  return <View style={s.grid}>{items.map(p => <ProductCard key={p.id} product={p} theme={theme} onPress={onPress} width={(width - 52) / 2} />)}</View>;
}

export function Chips({ items, value, onChange, theme }: { items: Category[]; value: string | null; onChange: (id: string) => void; theme: ShoppingTheme }) {
  if (!items.length) return null;
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
    {items.map(c => {
      const on = c.id === value;
      return <Pressable key={c.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(c.id)}
        style={[s.chip, { backgroundColor: on ? theme.primarySoft : (theme.chipBg ?? '#F2F4F6') }]}>
        <Text style={[s.chipText, { color: on ? theme.primary : '#6B7684', fontWeight: on ? '700' : '500' }]}>{c.name}</Text>
      </Pressable>;
    })}
  </ScrollView>;
}

/** 상품 상세 설명 및 유의사항 — 서버 글 그대로(패키지는 정책 글을 박지 않는다) */
export function Notice({ sections, theme, dark, title = '상품 상세 설명 및 유의사항' }: { sections: NoticeSection[]; theme: ShoppingTheme; dark?: boolean; title?: string }) {
  if (!sections.length) return null;
  const head = dark ? '#FFFFFF' : theme.text;
  const body = dark ? '#B0B8C1' : theme.sub;
  return <View style={[s.notice, { backgroundColor: dark ? '#191F28' : theme.card }]}>
    <Text accessibilityRole="header" style={[s.noticeHead, { color: head }]}>{title}</Text>
    {sections.map(sec => <View key={sec.title} style={s.noticeSec}>
      <Text style={[s.noticeTitle, { color: head }]}>{sec.title}</Text>
      {sec.items.map((it, i) => typeof it === 'string'
        ? <Text key={i} style={[s.noticeItem, { color: body }]}>•  {it}</Text>
        : <View key={i}>
          <Text style={[s.noticeItem, { color: body }]}>•  {it.text}</Text>
          {it.sub?.map((x, j) => <Text key={j} style={[s.noticeSub, { color: body }]}>•  {x}</Text>)}
        </View>)}
    </View>)}
  </View>;
}

/** 실제 적립 기록 띠 — 서버가 준 실제 기록이 있을 때만, 4초마다 다음 것. 없으면 아무것도 안 그린다 */
export function RecentTicker({ list, theme }: { list?: RecentReward[] | null; theme: ShoppingTheme }) {
  const rows = realRecent(list);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (rows.length < 2) return;
    const t = setInterval(() => setI(v => (v + 1) % rows.length), 4000);
    return () => clearInterval(t);
  }, [rows.length]);
  if (!rows.length) return null;
  const r = rows[i % rows.length];
  return <View style={[s.ticker, { backgroundColor: theme.bg, borderColor: theme.line }]} accessibilityLiveRegion="polite">
    <Text style={[s.tickerText, { color: theme.text }]} numberOfLines={1}>
      {r.maskedName}님이 <Text style={{ color: theme.primary, fontWeight: '700' }}>{num(r.amount)}{r.unit}</Text> 받았어요
    </Text>
  </View>;
}

/** 제휴 활동 고지 — 서버가 준 제휴처별 글을 모두 그린다 */
export function Disclosures({ texts, theme }: { texts: string[]; theme: ShoppingTheme }) {
  const rows = texts.map(t => (t ?? '').trim()).filter(Boolean);
  if (!rows.length) return null;
  return <View style={s.disc}>{rows.map(t => <Text key={t} style={[s.discText, { color: theme.sub }]}>{t}</Text>)}</View>;
}

/** 서버 질문과 답변 — 두 안내 화면이 같은 어두운 띠를 쓴다. */
export function Faq({ items }: { items?: Array<{ q: string; a: string }> }) {
  if (!items?.length) return null;
  return <View style={s.faq}>
    <Text accessibilityRole="header" style={s.faqHead}>자주 묻는 질문</Text>
    {items.map((f, i) => <View key={i} style={s.faqCard}>
      <Text style={s.faqQ}>Q. {f.q}</Text>
      <Text style={s.faqA}>{f.a}</Text>
    </View>)}
  </View>;
}

/** 안내 화면이 함께 쓰는 단계 카드와 번호 원. */
export function StepList({ steps, theme }: { steps: Array<{ title: string; desc?: string | null }>; theme: ShoppingTheme }) {
  return <View style={{ gap: 10 }}>{steps.map((step, i) => <View key={i} style={{ flexDirection: 'row', gap: 14, padding: 16, borderWidth: 1, borderColor: theme.line, borderRadius: 16, backgroundColor: '#FFFFFF' }}>
    <Text style={{ width: 32, height: 32, borderRadius: 16, lineHeight: 32, textAlign: 'center', overflow: 'hidden', backgroundColor: theme.primary, color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>{i + 1}</Text>
    <View style={{ flex: 1 }}><Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{step.title}</Text>
      {step.desc ? <Text style={{ marginTop: 4, fontSize: 14, color: theme.sub }}>{step.desc}</Text> : null}</View>
  </View>)}</View>;
}

export const s = StyleSheet.create({
  faq: { backgroundColor: '#191F28', paddingHorizontal: 20, paddingVertical: 28, marginTop: 36, gap: 12 },
  faqHead: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  faqCard: { backgroundColor: '#2B3440', borderRadius: 16, padding: 18, gap: 8 },
  faqQ: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  faqA: { color: '#D1D6DB', fontSize: 15, lineHeight: 22 },

  disc: { paddingHorizontal: 20, paddingVertical: 16, gap: 6 },
  discText: { fontSize: 12, lineHeight: 18 },
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 8, height: 24, gap: 4 },
  badgeMark: { width: 16, height: 16, borderRadius: 8, textAlign: 'center', fontSize: 10, lineHeight: 16, fontWeight: '800', overflow: 'hidden' },
  badgeText: { fontSize: 13, fontWeight: '800' },
  badgeAt: { position: 'absolute', left: 8, bottom: 8 },
  thumb: { width: '100%', aspectRatio: 1, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', overflow: 'hidden', padding: 6 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  thumbLetter: { fontSize: 28, fontWeight: '700' },
  tag: { fontSize: 12, fontWeight: '700', marginTop: 8 },
  title: { fontSize: 14, lineHeight: 20, marginTop: 10, fontWeight: '400' },
  priceRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  rate: { fontSize: 16, fontWeight: '800' },
  price: { fontSize: 16, fontWeight: '800', flexShrink: 1 },
  rating: { fontSize: 12, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 24, paddingHorizontal: 20 },
  chips: { paddingHorizontal: 20, gap: 8, paddingBottom: 16 },
  chip: { paddingHorizontal: 16, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 15 },
  notice: { paddingHorizontal: 20, paddingVertical: 24, marginTop: 28, gap: 20 },
  noticeHead: { fontSize: 20, fontWeight: '800' },
  noticeSec: { gap: 8 },
  noticeTitle: { fontSize: 15, fontWeight: '700' },
  noticeItem: { fontSize: 14, lineHeight: 21 },
  noticeSub: { fontSize: 14, lineHeight: 21, paddingLeft: 16 },
  ticker: { alignSelf: 'center', borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, marginVertical: 8 },
  tickerText: { fontSize: 13 },
});
