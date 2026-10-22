import type { ReactElement } from 'react';
import { OfferwallView } from './index';

export type OfferwallScreenProps = {
  usn: string | null;
  onClose: () => void;
  onRetry: () => void;
  loadingColor?: string;
  /** Only pass a top inset when the host has not already applied its safe area. */
  topInset?: number;
};

export const OFFERWALL_SCREEN_MARK = 'jcurve-offerwall-screen:headerless-v1';

/** Tab content: no host header. The host owns status-bar and bottom-tab safe areas. */
export function OfferwallScreen({ usn, onClose, onRetry, loadingColor = '#555', topInset = 0 }: OfferwallScreenProps): ReactElement {
  const React = require('react') as typeof import('react');
  const { View, Text, Pressable, ActivityIndicator, BackHandler, StyleSheet } = require('react-native') as typeof import('react-native');
  const h = React.createElement;
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => { setLoaded(false); setError(false); }, [usn, attempt]);
  React.useEffect(() => {
    if (loaded) return;
    const timer = setTimeout(() => setError(true), 20000);
    return () => clearTimeout(timer);
  }, [loaded, usn, attempt]);
  React.useEffect(() => { if (loaded) setError(false); }, [loaded]);
  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => subscription.remove();
  }, [onClose]);
  const status = { ...StyleSheet.absoluteFill, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 16 };
  return h(View, { style: { flex: 1, backgroundColor: '#fff', paddingTop: Math.max(0, topInset) } },
    h(View, { style: { flex: 1, overflow: 'hidden' } },
      usn && !error ? h(OfferwallView, { key: `${usn}:${attempt}`, usn, onLoaded: () => setLoaded(true), onError: () => setError(true) }) : null,
      error ? h(View, { style: [status, { backgroundColor: '#fff' }] },
        h(Text, null, '찬스를 불러오지 못했어요'),
        h(Pressable, { accessibilityRole: 'button', onPress: () => { setAttempt(n => n + 1); onRetry(); },
          style: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#f1f1f1', borderRadius: 12 } }, h(Text, null, '다시 시도')))
        : !loaded ? h(View, { style: status, pointerEvents: 'none' }, h(ActivityIndicator, { color: loadingColor })) : null));
}
