import React, { useEffect, useState } from 'react';
import { AppState, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Requester } from './entry';

export type NewspicItem = { id: string; title: string; source: string; thumbnail: string; url: string };
type Feed = { items: NewspicItem[]; message: string };

export function isNewspicUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\\\x00-\x1f\x7f]/.test(value)) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port
      && (u.hostname === 'newspic.kr' || u.hostname.endsWith('.newspic.kr'));
  } catch { return false; }
}

export function parseNewspicFeed(value: unknown): Feed | null {
  const v = value as Record<string, unknown> | null;
  if (!v || v.ok !== true || v.enabled !== true || v.mode !== 'shared_links' || !Array.isArray(v.items)) return null;
  if (v.status === 'configuration_required' && v.items.length === 0) return { items: [], message: '설정 필요' };
  if (v.status !== 'ok') return null;
  const items = v.items.slice(0, 20).filter((r): r is NewspicItem => r && typeof r.id === 'string'
    && typeof r.title === 'string' && !!r.title.trim() && r.title.length <= 200
    && typeof r.source === 'string' && !!r.source.trim() && r.source.length <= 200
    && (r.thumbnail === '' || isNewspicUrl(r.thumbnail)) && isNewspicUrl(r.url));
  return items.length ? { items, message: '' } : null;
}

/** Metadata only. Articles open exclusively from the user's press in an external browser. */
export function NewspicSection({ fetchJson, refreshKey }: { fetchJson: Requester; refreshKey?: unknown }) {
  const [active, setActive] = useState(AppState.currentState == null || AppState.currentState === 'active');
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState<{ owner: Requester; feed: Feed } | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      setResult(null);
      if (state === 'active') setTick(n => n + 1);
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    let live = true;
    setResult(null);
    if (active) {
      Promise.resolve().then(() => fetchJson('newspic/feed')).then(value => {
        const feed = parseNewspicFeed(value);
        if (live) setResult(feed ? { owner: fetchJson, feed } : null);
      }).catch(() => { if (live) setResult(null); });
    }
    return () => { live = false; };
  }, [fetchJson, refreshKey, active, tick]);
  if (!active || !result || result.owner !== fetchJson) return null;
  return <View testID="newspic-section" style={styles.section}>
    <Text style={styles.disclosure}>광고 · 제휴</Text>
    <Text style={styles.heading}>읽을거리</Text>
    {result.feed.message ? <Text>{result.feed.message}</Text> : null}
    {result.feed.items.map(item => <Pressable key={item.id} accessibilityRole="link" accessibilityLabel={item.title}
      onPress={() => { if (isNewspicUrl(item.url)) void Linking.openURL(item.url).catch(() => {}); }} style={styles.item}>
      {item.thumbnail ? <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} accessible={false} /> : null}
      <View style={styles.copy}><Text style={styles.title}>{item.title}</Text><Text style={styles.source}>{item.source}</Text></View>
    </Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  // Reserve more than a complete benefit row above AND below, including external ad siblings.
  section: { marginVertical: 80, padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', gap: 10 },
  disclosure: { fontSize: 12, lineHeight: 18, color: '#6B5E52' },
  heading: { fontSize: 19, fontWeight: '700', color: '#2B2118' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  thumbnail: { width: 84, height: 64, borderRadius: 8 },
  copy: { flex: 1, gap: 6 }, title: { fontSize: 16, color: '#2B2118' }, source: { fontSize: 12, color: '#6B5E52' },
});
