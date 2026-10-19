import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState, FlatList, Pressable, Text, View } from 'react-native';
import { createInboxStore, isMissingRoute, defaultStrings, defaultTheme, relativeTime, type InboxApi, type InboxItem, type InboxStrings, type InboxTheme } from './core';
export * from './core';
export type InboxScreenProps = { api: InboxApi; theme?: Partial<InboxTheme>; strings?: Partial<InboxStrings>; onOpen: (item: InboxItem) => void; onBack?: () => void; topInset?: number; isFocused?: boolean };
export function InboxScreen({ api, theme, strings, onOpen, onBack, topInset = 0, isFocused = true }: InboxScreenProps) {
  const t = { ...defaultTheme, ...theme }, s = { ...defaultStrings, ...strings };
  const store = useMemo(() => createInboxStore(api), [api]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => { void store.load(); }, [store]);
  useEffect(() => () => store.leave(), [store]);
  useEffect(() => { if (!isFocused) store.leave(); }, [store, isFocused]);
  const retry = <Pressable accessibilityRole="button" onPress={() => void store.load()} style={{ padding: 24, alignItems: 'center' }}><Text style={{ color: t.sub }}>{s.error}</Text><Text style={{ color: t.primary, marginTop: 8 }}>{s.retry}</Text></Pressable>;
  return <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: topInset }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: t.line, padding: 16 }}>
      <Pressable accessibilityRole="button" onPress={() => { store.leave(); onBack?.(); }} hitSlop={8}><Text style={{ color: t.primary }}>{s.back}</Text></Pressable>
      <Text accessibilityRole="header" style={{ flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700', color: t.text }}>{s.title}</Text>
      <View style={{ width: 28 }} />
    </View>
    <FlatList data={state.items} keyExtractor={item => String(item.id)} refreshing={state.loading && state.items.length > 0} onRefresh={() => void store.load()} onEndReached={() => void store.load(true)} onEndReachedThreshold={0.3}
      ListEmptyComponent={state.error ? retry : !state.loading ? <Text style={{ color: t.sub, textAlign: 'center', padding: 48 }}>{s.empty}</Text> : <Text style={{ color: t.sub, padding: 24 }}>…</Text>}
      ListFooterComponent={state.error && state.items.length > 0 ? retry : null}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityState={{ expanded: state.expanded.includes(item.id) }} onPress={() => store.press(item, onOpen)} style={{ marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: t.radius, backgroundColor: t.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ flex: 1, color: t.text, fontWeight: '700', fontSize: 16 }}>{item.title}</Text>
          {item.kind === 'ad' && <Text style={{ backgroundColor: t.adBadgeBg, color: t.adBadgeText, fontSize: 11, paddingHorizontal: 5, borderRadius: 3 }}>{s.ad}</Text>}
        </View>
        <Text numberOfLines={state.expanded.includes(item.id) ? undefined : 2} style={{ color: t.sub, marginTop: 8, lineHeight: 20 }}>{item.body}</Text>
        <Text style={{ color: t.sub, fontSize: 12, marginTop: 10 }}>{relativeTime(item.sentAt, new Date(), s)}</Text>
      </Pressable>} />
  </View>;
}
export function BellDot({ count }: { count: number }) {
  return count > 0 ? <View accessibilityLabel={String(count)} style={{ position: 'absolute', top: 0, right: 0, width: 6, height: 6, borderRadius: 3, backgroundColor: defaultTheme.unreadDot }} /> : null;
}
export function useInboxUnread(api: InboxApi, { refreshKey }: { refreshKey?: unknown } = {}): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let disposed = false, request = 0;
    const refresh = async () => { const id = ++request; try { const next = await api.unread(); if (!disposed && id === request) setCount(next); } catch (err) { if (!disposed && id === request && isMissingRoute(err)) setCount(0); /* Other failures keep previous count (initially 0). */ } };
    void refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { disposed = true; subscription.remove(); };
  }, [api, refreshKey]);
  return count;
}
