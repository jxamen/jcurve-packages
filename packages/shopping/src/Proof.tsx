import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, processColor } from 'react-native';
import { num, proofDday, won } from './format';
import { DisclosureNote, Faq, Notice, StepList } from './parts';
import type { Partner, PickedImage, ProofInfo, ProofItem, ShoppingApi, ShoppingTheme } from './types';

export type ProofScreenProps = {
  api: ShoppingApi; partner: Partner; info: ProofInfo; theme: ShoppingTheme; topInset?: number;
  onBack: () => void; pickImage: () => Promise<PickedImage | null>;
  onSubmitted?: (item: ProofItem) => void; onError?: (code: string) => void;
};
const messages: Record<string, string> = {
  off: '지금은 인증을 받지 않아요', provider_not_ready: '잠시 후 다시 시도해 주세요', ocr_not_enabled: '잠시 후 다시 시도해 주세요',
  signup_required: '가입 후 인증할 수 있어요', too_often: '잠시 후 다시 올려 주세요',
  daily_max: '오늘은 더 인증할 수 없어요', bad_image: '사진을 다시 골라 주세요(jpg · png)', duplicate: '이미 인증한 주문이에요',
};

function primaryBorder(color: string): string {
  const value = processColor(color);
  if (typeof value !== 'number') return 'rgba(47,107,255,0.4)';
  return `rgba(${(value >>> 16) & 255},${(value >>> 8) & 255},${value & 255},0.4)`;
}

export function ProofScreen({ api, partner, info, theme, topInset = 0, onBack, pickImage, onSubmitted, onError }: ProofScreenProps) {
  const [image, setImage] = useState<PickedImage | null>(null);
  const [orderNo, setOrderNo] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [message, setMessage] = useState('');
  const [items, setItems] = useState<ProofItem[]>([]);
  const [listFailed, setListFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setListFailed(false);
    Promise.resolve().then(() => api.proof?.list() ?? []).then(rows => { if (active) setItems(rows); })
      .catch(() => { if (active) setListFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api]);
  const fail = (e: unknown) => {
    const code = String((e as { code?: string })?.code || 'network');
    setMessage(messages[code] ?? '보내지 못했어요. 다시 시도해 주세요');
    onError?.(code);
  };
  const choose = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true);
    try { const picked = await pickImage(); if (picked) { setImage(picked); setMessage(''); } }
    catch (e) { fail(e); }
    finally { locked.current = false; setBusy(false); }
  };
  const submit = async () => {
    if (locked.current || !image || !api.proof) return;
    locked.current = true; setBusy(true); setMessage('');
    let item: ProofItem;
    try {
      item = await api.proof.submit({ partnerId: partner.id, image, orderNo: orderNo.trim() || null, amount: amount ? Number(amount) : null });
    } catch (e) { locked.current = false; setBusy(false); fail(e); return; }
    setImage(null); setOrderNo(''); setAmount('');
    setMessage('접수됐어요. 확인 후 알려 드릴게요');
    setItems(rows => [item, ...rows.filter(row => row.id !== item.id)]);
    try { setItems(await api.proof.list()); setListFailed(false); }
    catch { setListFailed(true); }
    finally { locked.current = false; setBusy(false); }
    onSubmitted?.(item);
  };
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={action} style={[s.button, { backgroundColor: theme.primary, opacity: busy ? 0.5 : 1 }]}><Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '800' }}>{label}</Text></Pressable>;
  return <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: topInset }}>
    <View style={s.bar}><Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={onBack}><Text style={{ color: theme.text, fontSize: 18 }}>‹</Text></Pressable><Text accessibilityRole="header" style={[s.heading, { color: theme.text }]}>구매 인증</Text></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: info.cta ? 120 : 32 }}>
      <View style={[s.section, s.hero, { backgroundColor: theme.chipBg ?? '#F2F4F6' }]}>
        {info.subtitle ? <Text style={{ fontSize: 15, textAlign: 'center', color: theme.sub }}>{info.subtitle}</Text> : null}
        {info.rateText ? <Text style={{ fontSize: 28, textAlign: 'center', fontWeight: '900', color: theme.primary }}>{info.rateText}</Text> : null}
        {info.title ? <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text, textAlign: 'center' }}>{info.title}</Text> : null}
        {info.payoutText ? <Text style={[s.pill, { fontSize: 13, color: theme.primary, backgroundColor: theme.primarySoft }]}>⏱ {info.payoutText}</Text> : null}
      </View>
      {info.steps?.length ? <View style={s.section}>
        <Text style={[s.pill, { color: theme.primary, backgroundColor: theme.primarySoft }]}>이용 방법</Text>
        <Text accessibilityRole="header" style={[s.stepsHeading, { color: theme.text }]}>어떻게 받나요?</Text>
        <StepList steps={info.steps} theme={theme} />
      </View> : null}
      <View style={s.section}>
        {info.guide?.map((line, i) => <Text key={i} style={{ color: theme.sub, lineHeight: 22 }}>• {line}</Text>)}
        {!image ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={choose} style={[s.upload, { borderColor: primaryBorder(theme.primary), opacity: busy ? 0.5 : 1 }]}>
          <Text style={{ fontSize: 32, color: theme.primary }}>＋</Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: theme.primary }}>주문내역 캡처 올리기</Text>
        </Pressable> : null}
        {image ? <>
          <Image source={{ uri: image.uri }} resizeMode="contain" accessibilityLabel="선택한 주문내역 캡처" style={{ width: '100%', height: 220, borderRadius: 16, backgroundColor: theme.thumbBg ?? '#F2F4F6' }} />
          <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} onPress={choose} style={{ alignSelf: 'center' }}><Text style={{ fontSize: 13, fontWeight: '700', color: theme.primary }}>다시 고르기</Text></Pressable>
          <TextInput accessibilityLabel="주문번호(선택)" placeholder="주문번호(선택)" placeholderTextColor={theme.sub} value={orderNo} onChangeText={setOrderNo} editable={!busy} style={[s.input, { color: theme.text, backgroundColor: theme.chipBg ?? '#F2F4F6' }]} />
          <TextInput accessibilityLabel="결제금액(선택)" placeholder="결제금액(선택)" placeholderTextColor={theme.sub} keyboardType="number-pad" value={amount} onChangeText={v => setAmount(v.replace(/[^0-9]/g, ''))} editable={!busy} style={[s.input, { color: theme.text, backgroundColor: theme.chipBg ?? '#F2F4F6' }]} />
          {button(busy ? '보내는 중…' : '인증 보내기', submit)}
        </> : null}
        {message ? <Text accessibilityLiveRegion="polite" style={{ color: theme.text }}>{message}</Text> : null}
      </View>
      <View style={s.section}>
        <Text accessibilityRole="header" style={[s.heading, { color: theme.text }]}>내 인증 내역</Text>
        {loading ? <Text style={{ color: theme.sub }}>불러오는 중…</Text> : listFailed ? <Text style={{ color: theme.sub }}>인증 내역을 불러오지 못했어요</Text> : !items.length ? <Text style={{ color: theme.sub }}>아직 인증한 구매가 없어요</Text> : null}
        {items.map(item => {
          const colors = {
            received: ['#F2F4F6', '#6B7684'], checked: ['#E8F3FF', '#3182F6'], waiting: ['#FFF4E5', '#F59E0B'],
            paid: [theme.primarySoft, theme.primary], rejected: ['#FFEBEE', theme.danger], revoked: ['#FFEBEE', theme.danger],
          }[item.status];
          return <View key={item.id} style={[s.row, { borderColor: theme.line }]}>
            <View style={s.rowLine}>
              <Text style={[s.chip, { backgroundColor: colors[0], color: colors[1] }]}>{item.status === 'waiting' ? `확정 대기${item.confirmAt != null ? ` ${proofDday(item.confirmAt, now)}` : ''}` : { received: '접수', checked: '확인 중', paid: '지급', rejected: '반려', revoked: '회수' }[item.status]}</Text>
              <Text style={{ fontSize: 13, color: theme.sub }}>{new Date(item.createdAt).toLocaleDateString('ko-KR')}</Text>
            </View>
            <View style={s.rowLine}>
              {item.amount != null ? <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{won(item.amount)}</Text> : <View />}
              {item.reward != null ? <Text style={{ fontSize: 15, fontWeight: '800', color: theme.primary }}>{theme.pointMark ?? 'P'} {num(item.reward)}</Text> : null}
            </View>
            {(item.status === 'rejected' || item.status === 'revoked') && item.reason ? <Text style={{ fontSize: 13, color: theme.danger }}>{item.reason}</Text> : null}
          </View>;
        })}
      </View>
      <Faq items={info.faq} />
      <Notice sections={info.notice ?? []} title="유의사항" theme={theme} />
      <DisclosureNote text={partner.disclosure} theme={theme} />
    </ScrollView>
    {info.cta ? <View style={[s.ctaWrap, { backgroundColor: theme.bg }]}>{button(info.cta, choose)}</View> : null}
  </View>;
}
const s = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 32 },
  pill: { alignSelf: 'center', fontSize: 13, fontWeight: '700', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, overflow: 'hidden' },
  stepsHeading: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  ctaWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24 },
  bar: { minHeight: 52, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 24 },
  heading: { fontSize: 20, fontWeight: '800' }, section: { padding: 20, gap: 14 },
  button: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 14 },
  input: { height: 52, borderRadius: 12, padding: 14, fontSize: 16 },
  upload: { height: 140, borderWidth: 2, borderStyle: 'dashed', borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
  rowLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  row: { borderWidth: 1, padding: 16, borderRadius: 14, gap: 8 }, chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, overflow: 'hidden' },
});
