import { useEffect, useMemo, useState } from 'react';
import { AppState, Linking } from 'react-native';
import type { Requester } from './entry';
import { CoupangVisit, coupangVisible, parseCoupangStatus } from './coupang';

export function useCoupangVisit(request: Requester, refreshKey?: unknown) {
  const [result, setResult] = useState<{ owner: CoupangVisit; status: ReturnType<typeof parseCoupangStatus> } | null>(null);
  const [shortVisit, setShortVisit] = useState<{ owner: CoupangVisit; seconds: number; points: number } | null>(null);
  const [toast, setToast] = useState<{ owner: CoupangVisit; message: string } | null>(null);
  const visit = useMemo(() => new CoupangVisit(request, url => Linking.openURL(url),
    status => setResult({ owner: visit, status }), message => setToast({ owner: visit, message }), (seconds, points) => setShortVisit({ owner: visit, seconds, points })), [request]);
  useEffect(() => {
    visit.activate();
    const sub = AppState.addEventListener('change', state => { void visit.appState(state); });
    return () => { sub.remove(); visit.dispose(); };
  }, [visit]);
  useEffect(() => { void visit.refresh(); }, [visit, refreshKey]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  const status = result?.owner === visit ? result.status : parseCoupangStatus(null);
  return { shortVisit: shortVisit?.owner === visit ? shortVisit : null, closeShortVisit: () => setShortVisit(null), status, visible: coupangVisible(status), start: () => { void visit.start(); }, toast: toast?.owner === visit ? toast.message : null };
}
