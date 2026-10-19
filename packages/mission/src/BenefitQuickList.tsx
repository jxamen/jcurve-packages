import React, { type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export type BenefitQuickIcon = 'calendar' | 'bag' | 'pin' | 'star' | 'ticket' | 'friend';
export type BenefitQuickItem = {
  key: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  icon: BenefitQuickIcon | ReactNode;
  tint: string;
  onPress: () => void;
  done?: boolean;
  hidden?: boolean;
};
export type BenefitQuickListProps = {
  title?: string;
  seeAllLabel?: string;
  onSeeAll?: () => void;
  accentColor?: string;
  items: readonly BenefitQuickItem[];
  footer?: ReactNode;
};

const colors: Record<BenefitQuickIcon, string> = {
  calendar: '#2F6FD6', bag: '#D2551E', pin: '#2E8B57',
  star: '#B7791F', ticket: '#7A4FD0', friend: '#C2410C',
};
/** Pure RN shapes: no additional native dependency. Supply a ReactNode for branded icons. */
function Icon({ icon }: { icon: BenefitQuickItem['icon'] }) {
  if (typeof icon !== 'string' || !(icon in colors)) return <>{icon}</>;
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

export function BenefitQuickList({ title = '바로 받는 혜택', seeAllLabel, onSeeAll, accentColor = '#EE7A33', items, footer }: BenefitQuickListProps) {
  const visible = items.filter(item => !item.hidden);
  return <View style={s.root}>
    <View style={s.header}>
      <Text style={s.title}>{title}</Text>
      {seeAllLabel && onSeeAll ? <Pressable accessibilityRole="button" onPress={onSeeAll} hitSlop={8}><Text style={[s.seeAll, { color: accentColor }]}>{seeAllLabel}</Text></Pressable> : null}
    </View>
    <View style={s.card}>
      {visible.map((item, index) => <View key={item.key} style={[s.row, index < visible.length - 1 && s.border]}>
        <View style={[s.icon, { backgroundColor: item.tint }]}><Icon icon={item.icon} /></View>
        <View style={s.copy}><Text style={s.name}>{item.title}</Text><Text style={s.subtitle} numberOfLines={1} adjustsFontSizeToFit>{item.subtitle}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={item.title + ', ' + (item.done ? '완료' : item.ctaLabel)} accessibilityState={{ disabled: !!item.done }} disabled={item.done}
          onPress={() => { if (!item.done) item.onPress(); }}
          style={({ pressed }) => [s.button, { backgroundColor: item.done ? '#D3D7DD' : accentColor }, pressed && !item.done && { opacity: 0.8 }]}>
          <Text style={s.cta}>{item.done ? '완료' : item.ctaLabel}</Text>
        </Pressable>
      </View>)}
    </View>
    {footer != null ? <View style={s.footer}>{footer}</View> : null}
  </View>;
}
const s = StyleSheet.create({
  root: { gap: 10 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  title: { fontSize: 19, fontWeight: '700', color: '#2B2118', flexShrink: 1 }, seeAll: { fontSize: 13 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, border: { borderBottomWidth: 1, borderBottomColor: '#F3EBE1' },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 2 }, name: { fontSize: 16, fontWeight: '700', color: '#2B2118' }, subtitle: { fontSize: 13, color: '#6B5E52' },
  button: { minWidth: 84, height: 40, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, cta: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' }, footer: { marginTop: 4 },
  iconDrawing: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  calendar: { width: 18, height: 17, borderRadius: 3 }, calendarLine: { height: 2, marginTop: 3 }, check: { width: 8, height: 5, borderLeftWidth: 2, borderBottomWidth: 2, transform: [{ rotate: '-45deg' }], marginLeft: 4, marginTop: 2 },
  bag: { width: 16, height: 14, borderRadius: 2, marginTop: 5 }, handle: { position: 'absolute', top: 1, width: 8, height: 9, borderRadius: 5 },
  pin: { width: 16, height: 19, borderRadius: 9, borderBottomRightRadius: 1, transform: [{ rotate: '45deg' }], alignItems: 'center', justifyContent: 'center' }, dot: { width: 6, height: 6, borderRadius: 3 },
  diamond: { position: 'absolute', width: 13, height: 13, transform: [{ rotate: '45deg' }] }, ticket: { width: 20, height: 14, borderRadius: 3 }, ticketLine: { height: 10, borderLeftWidth: 1, borderStyle: 'dashed', marginLeft: 6 },
  head: { position: 'absolute', top: 1, left: 4, width: 8, height: 8, borderRadius: 4 }, shoulders: { position: 'absolute', bottom: 1, left: 1, width: 15, height: 9, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderBottomWidth: 0 }, plusH: { position: 'absolute', right: 0, top: 9, width: 7, height: 2 }, plusV: { position: 'absolute', right: 2.5, top: 6.5, height: 7, width: 2 },
});
