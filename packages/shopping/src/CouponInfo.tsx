import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { partnerRewardName } from './format';
import { Disclosures, Notice } from './parts';
import type { CouponInfo, Partner, ShoppingApi, ShoppingTheme } from './types';

/** ⑤ 할인권 안내 — 글은 모두 서버(couponInfo). 아래 고정 버튼은 제휴처로 이동(적립 추적 링크) */
export function CouponInfoScreen({ api, partner, theme, topInset = 0, onBack, onGo }: { api: ShoppingApi; partner: Partner; theme: ShoppingTheme; topInset?: number; onBack: () => void; onGo: () => void }) {
  const [info, setInfo] = useState<CouponInfo | null | undefined>(undefined);
  useEffect(() => { api.couponInfo(partner.id).then(setInfo).catch(() => setInfo(null)); }, [api, partner.id]);
  const name = partnerRewardName(partner, theme);
  const cta = info?.cta || `${partner.name} 쇼핑하고 ${partner.rateText} ${name} 받기`;
  return <View style={[cs.wrap, { backgroundColor: theme.bg, paddingTop: topInset }]}>
    <View style={cs.bar}>
      <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={onBack} hitSlop={12} style={cs.back}><Text style={[cs.backText, { color: theme.text }]}>‹</Text></Pressable>
      <Text accessibilityRole="header" style={[cs.barTitle, { color: theme.text }]}>{name} 안내</Text>
      <View style={cs.back} />
    </View>
    {info === undefined ? <View style={cs.center}><ActivityIndicator color={theme.primary} /></View>
      : !info ? <View style={cs.center}><Text style={{ color: theme.sub }}>안내를 불러오지 못했어요</Text></View>
      : <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={[cs.hero, { backgroundColor: theme.card }]}>
          {info.subtitle ? <Text style={[cs.heroSub, { color: theme.sub }]}>{info.subtitle}</Text> : null}
          <Text style={[cs.heroTitle, { color: theme.text }]}>{info.title}</Text>
          {info.compare?.length ? <View style={[cs.compare, { backgroundColor: theme.bg }]}>
            {info.compare.map((c, i) => <React.Fragment key={c.label}>
              {i > 0 ? <Text style={[cs.arrow, { color: theme.primary }]}>→</Text> : null}
              <View style={cs.compareCell}>
                <Text style={[cs.compareLabel, { color: theme.sub }]}>{c.label}</Text>
                <Text style={[cs.compareValue, { color: theme.primary }]}>{c.value}</Text>
              </View>
            </React.Fragment>)}
          </View> : null}
        </View>
        {info.tiers?.length ? <View style={cs.sec}>
          <Text style={[cs.pill, { backgroundColor: theme.primarySoft, color: theme.primary }]}>{name}별 할인 가격</Text>
          {info.tiers.map(t => <View key={t.name} style={[cs.tier, { backgroundColor: theme.card }]}>
            <Text style={[cs.tierName, { color: theme.text }]}>{t.name}</Text>
            <Text style={[cs.tierRange, { color: theme.sub }]}>{t.range}</Text>
          </View>)}
        </View> : null}
        {info.steps?.length ? <View style={cs.sec}>
          <Text style={[cs.pill, { backgroundColor: theme.primarySoft, color: theme.primary }]}>이용 방법</Text>
          <Text style={[cs.secTitle, { color: theme.text }]}>어떻게 쓰나요?</Text>
          {info.steps.map((st, i) => <View key={st.title} style={cs.step}>
            <Text style={[cs.stepNo, { backgroundColor: theme.card, color: theme.text }]}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[cs.stepTitle, { color: theme.text }]}>{st.title}</Text>
              <Text style={[cs.stepDesc, { color: theme.sub }]}>{st.desc ?? (i === 0 ? `${theme.appName}에서 이동해야 적립돼요` : '')}</Text>
            </View>
          </View>)}
        </View> : null}
        {info.faq?.length ? <View style={cs.faq}>
          <Text style={cs.faqHead}>자주 묻는 질문</Text>
          {info.faq.map(f => <View key={f.q} style={cs.faqCard}>
            <Text style={cs.faqQ}>Q. {f.q}</Text>
            <Text style={cs.faqA}>{f.a}</Text>
          </View>)}
        </View> : null}
        <Notice sections={info.notice ?? []} theme={theme} />
        <Disclosures texts={[partner.disclosure ?? '']} theme={theme} />
      </ScrollView>}
    <View style={[cs.ctaWrap, { backgroundColor: theme.bg }]}>
      <Pressable accessibilityRole="button" onPress={onGo} style={[cs.cta, { backgroundColor: theme.primary }]}><Text style={[cs.ctaText, { color: theme.onPrimary }]}>{cta}</Text></Pressable>
    </View>
  </View>;
}

const cs = StyleSheet.create({
  wrap: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 52 },
  back: { width: 40, alignItems: 'center' },
  backText: { fontSize: 32, lineHeight: 34 },
  barTitle: { fontSize: 17, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', paddingTop: 40, paddingBottom: 24, paddingHorizontal: 20, gap: 8 },
  heroSub: { fontSize: 16 },
  heroTitle: { fontSize: 30, fontWeight: '900' },
  compare: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', borderRadius: 18, padding: 18, marginTop: 20 },
  compareCell: { flex: 1, alignItems: 'center', gap: 6 },
  compareLabel: { fontSize: 14 },
  compareValue: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  arrow: { fontSize: 18, fontWeight: '800', paddingHorizontal: 6 },
  sec: { paddingHorizontal: 20, paddingTop: 32, gap: 12, alignItems: 'stretch' },
  pill: { alignSelf: 'center', fontSize: 13, fontWeight: '700', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, overflow: 'hidden' },
  secTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  tier: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16 },
  tierName: { fontSize: 16, fontWeight: '700' },
  tierRange: { fontSize: 14 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNo: { width: 28, height: 28, borderRadius: 14, textAlign: 'center', lineHeight: 28, fontWeight: '800', overflow: 'hidden' },
  stepTitle: { fontSize: 17, fontWeight: '700' },
  stepDesc: { fontSize: 14, marginTop: 4 },
  faq: { backgroundColor: '#191F28', paddingHorizontal: 20, paddingVertical: 28, marginTop: 36, gap: 12 },
  faqHead: { color: '#FFFFFF', fontSize: 19, fontWeight: '800', marginBottom: 4 },
  faqCard: { backgroundColor: '#2B3440', borderRadius: 16, padding: 18, gap: 8 },
  faqQ: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  faqA: { color: '#D1D6DB', fontSize: 15, lineHeight: 22 },
  ctaWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24 },
  cta: { minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 17, fontWeight: '800' },
});
