/**
 * 0.4.0 — `<OfferwallCombos>`: 「포인트 빨리 모으기」 whole, for any app. The app gives its server address and auth headers, its ad unit and its colors; everything the
 * apps used to write themselves (the requests, the test-member checks, the diagnostics, the free-trial calls, the notification question, the popup ad, the iPhone list
 * reading and its upload) is here.
 *
 *   <OfferwallCombos placement="chance" usn={usn} memberId={member.id}
 *     serverUrl={API_BASE} getAuthHeaders={() => ({ 'X-App-Token': TOKEN, Authorization: 'Bearer ' + session })}
 *     adUnit={{ ios: '…', android: '…' }} tokens={{ C, R, F, shadow }} popupArt={require('./coin.png')} />
 *
 * Server paths (relative to `serverUrl`): GET `offerwall/combos` · POST `offerwall/campaigns` · POST `offerwall/combos/diag` · GET `offerwall/trials` ·
 * POST `offerwall/trials/consent` · POST `offerwall/trials/{key}/cancelled`.
 *
 * **Nothing turns on by itself.** The chip, the popup and the list reading appear only for what the server's answer switches on: no answer (a server without the
 * endpoint, a failed request) shows nothing, and an answer without an explicit `display.chance` keeps the chip off. Campaign keys differ per app and per OS, so the server
 * says per app and per OS when there is something to show. The iPhone list reading (`display.list_tap: "on"`) is a switch of its own and is off unless the answer says "on".
 */
import type { ReactElement } from 'react';
import type { CampaignInfo } from './campaigns';
import { campaignsBody, createOfferwallClient, detailSignalBody, diagBody, dropAlwaysPopup, hasAlwaysPopup, listTapSwitch, webTapDiagBody, type OfferwallClient, type OfferwallClientOptions, type WebTapSummary } from './connector';
import { ComboEntry, type ComboDetailSignal, type ComboEntryProps, type ComboSheetShown, type ComboTapDiagnostic } from './comboEntry';
import type { ComboStorage } from './comboDone';
import { comboThemeFromTokens, DEFAULT_COMBO_THEME, type ComboTheme } from './combos';
import { OfferwallPopupAd, popupAdAvailable, popupAdUnit, type OfferwallAdUnits } from './popupAd';
import { createTapUploader, type TapUploader } from './tapUpload';
import { defaultTrialNotifyDeps, ensureTrialNotify, type TrialNotifyDeps, type TrialNotifyHooks } from './trialNotify';
import { startWebTap, type WebTapHandle } from './webTap';

/** The app's `C` / `R` / `F` / `shadow` token objects (see `comboThemeFromTokens`). */
export type OfferwallTokens = Parameters<typeof comboThemeFromTokens>[0];

export type OfferwallCombosProps = {
  placement: 'chance' | 'home';
  /** The member's offerwall id (the wall's `usn`). */
  usn: string | null;
  /** Who is signed in. Null = nothing is shown (and nothing is asked of the server). Also the scope of the device-side marks. */
  memberId: number | string | null | undefined;
  /** The app's server address and its auth headers (the package makes the requests) … */
  serverUrl?: string;
  getAuthHeaders?: OfferwallClientOptions['getAuthHeaders'];
  /** … and what to do when the server says 401 (drop the session). */
  onUnauthorized?: () => void;
  /**
   * … or, instead of the three above, the app's own request layer (`{ get(path), post(path, body) }`, paths relative to the app's server such as `offerwall/combos`), when it
   * already handles headers, 401s and retries. When given, `serverUrl` / `getAuthHeaders` are not used.
   */
  client?: OfferwallClient;
  /** Colors and shape: the app's token objects, and/or single values on top (applied in that order over the defaults). */
  tokens?: OfferwallTokens;
  theme?: Partial<ComboTheme>;
  /** The picture on top of the recommendation popup. Without it a coin is drawn. */
  popupArt?: ComboEntryProps['popupArt'];
  /** The ad under 「추천 보기」: the app's native ad unit per OS. No unit (or `popupAd: false`) = no ad and no space for it. */
  adUnit?: OfferwallAdUnits | string;
  adTestMode?: boolean;
  adTestDevices?: string[];
  /** The app's own off switch for that ad (for instance a remote setting). Default true. */
  popupAd?: boolean;
  /**
   * Is this member a test member? Only test members send the SDK campaign list and the per-tap diagnostics (the server accepts them from nobody else), and only
   * test members keep the 「항상」 popup. Without it nobody is one. Asked at most once per member, and only when an answer needs it; answer `null` when it could not
   * be found out (the answer counts as "no" this time and is asked again next time).
   */
  isTestMember?: () => Promise<boolean | null | undefined>;
  /** AsyncStorage-shaped store for the device-side marks. Default: `@react-native-async-storage/async-storage` when the app has it. */
  storage?: ComboStorage;
  /** Free trials: how the phone's notifications and the push token are seen to (see `ensureTrialNotify`). */
  syncPushToken?: TrialNotifyHooks['syncToken'];
  notifyHooks?: Omit<TrialNotifyHooks, 'syncToken'>;
  notifications?: Partial<TrialNotifyDeps>;
  /** Where the log of the sheet's opening time goes (default `console.log('[combos] sheet', …)`). */
  onSheetShown?: (info: ComboSheetShown) => void;
  chipTop?: number;
  chipRight?: number;
  sheetTop?: number;
};

function defaultStorage(): ComboStorage | undefined {
  try {
    const mod = require('@react-native-async-storage/async-storage') as { default?: ComboStorage } & ComboStorage;
    const store = mod.default ?? mod;
    return store && typeof store.getItem === 'function' && typeof store.setItem === 'function' ? store : undefined;
  } catch { return undefined; }
}

function platformOs(): string {
  try { return (require('react-native') as typeof import('react-native')).Platform.OS; } catch { return 'android'; }
}

/**
 * The answer as the connector wants it: a combos document that does not say `display.chance` for itself keeps the chip off (nothing turns on by default),
 * and the `always` popup survives only for test members. The original body is not touched.
 */
export function guardedBody(body: unknown): unknown {
  const b = body as { combos?: Record<string, any>; data?: Record<string, any> } & Record<string, any> | null;
  if (!b || typeof b !== 'object') return body;
  const key = b.combos ? 'combos' : b.data ? 'data' : null;
  const doc = (key ? b[key] : b) as Record<string, any> | undefined;
  if (!doc || typeof doc !== 'object') return body;
  const chance = doc.display?.chance;
  if (chance === 'chip' || chance === 'off') return body;
  const display = { ...(doc.display && typeof doc.display === 'object' ? doc.display : {}), chance: 'off' };
  return key ? { ...b, [key]: { ...doc, display } } : { ...b, display };
}

/** The last explicit "on" the server gave for the iPhone list reading, kept on the device so the tap can start at mount, before the combos answer is back (0.4.1). */
export const LIST_TAP_CACHE_MS = 7 * 24 * 3600_000;
export const listTapCacheKey = (member: string | number): string => `jcurve.offerwall.listtap:${member}`;
/** The cached value ('1700000000000' = when the server last said "on") is still usable. Anything else — nothing stored, "0", garbage, too old — is off. */
export function listTapCached(raw: string | null | undefined, now: number = Date.now()): boolean {
  const at = Number(raw);
  return Number.isFinite(at) && at > 0 && now - at >= 0 && now - at < LIST_TAP_CACHE_MS;
}

export type ComboHandlerDeps = {
  client: () => OfferwallClient;
  memberId: () => number | string | null | undefined;
  /** The app's own answer to "is this member a test member?" (undefined = nobody is). */
  askTestMember?: () => Promise<boolean | null | undefined> | boolean | null | undefined;
  /** Told, on every combos answer, whether the server switched the iPhone list reading on. */
  onListTap?: (on: boolean) => void;
};
/**
 * The calls `<OfferwallCombos>` hands to the entry, with their rules: who may send what, what is never sent, what failing means. Exported so that an app that
 * wants its own screen around `ComboEntry` can still use the same calls.
 */
export function createComboHandlers({ client, memberId, askTestMember, onListTap }: ComboHandlerDeps) {
  // who is a test member: asked once per member, only when needed (an answer that is not a plain yes/no, or a failure, is asked again next time)
  let cached: { id: string; ok: Promise<boolean> } | null = null;
  const isTestMember = (): Promise<boolean> => {
    const member = memberId();
    if (member == null || !askTestMember) return Promise.resolve(false);
    const id = String(member);
    if (cached?.id === id) return cached.ok;
    const ok = Promise.resolve().then(() => askTestMember()).then(
      answer => { if (typeof answer !== 'boolean') cached = null; return answer === true; },
      () => { cached = null; return false; },
    );
    cached = { id, ok };
    return ok;
  };
  return {
    isTestMember,
    /** GET offerwall/combos, the body the entry parses: chip kept off unless the server said so, "always" popup only for test members. */
    async load(): Promise<unknown> {
      let body: unknown;
      try { body = await client().get<unknown>('offerwall/combos'); } catch (error) {
        // the server's own "nothing for this app" (404) also means the list reading is off now; a flaky network says nothing and leaves it as it was
        if ((error as { status?: number })?.status === 404) { try { onListTap?.(false); } catch { /* ignore */ } }
        throw error;
      }
      try { onListTap?.(listTapSwitch(body)); } catch { /* the switch is read again with the next answer */ }
      const guarded = guardedBody(body);
      if (!hasAlwaysPopup(guarded)) return guarded;
      return (await isTestMember()) ? guarded : dropAlwaysPopup(guarded);
    },
    /** The SDK's campaign list (Android, iPhone with the bridge): test members only. */
    async report(list: CampaignInfo[]): Promise<void> {
      if (memberId() == null || list.length === 0) return;
      try {
        if (!(await isTestMember())) return;
        await client().post('offerwall/campaigns', campaignsBody(list));
      } catch { /* sending the list is an extra: the screen stays as it is */ }
    },
    /** One line per 하러 가기 tap: test members only. */
    async diagnose(d: ComboTapDiagnostic): Promise<void> {
      try {
        if (!(await isTestMember())) return;
        await client().post('offerwall/combos/diag', diagBody(d));
      } catch { /* diagnostics are an extra */ }
    },
    /** What the web tap saw (counts and path names only): test members only, quietly. */
    async diagnoseWebTap(summary: WebTapSummary): Promise<void> {
      try {
        if (!(await isTestMember())) return;
        await client().post('offerwall/combos/diag', webTapDiagBody(summary));
      } catch { /* diagnostics are an extra */ }
    },
    /** A detail page that did not open / closed at once: every member, four fields. */
    async signalDetail(s: ComboDetailSignal): Promise<void> {
      try { await client().post('offerwall/combos/diag', detailSignalBody(s)); } catch { /* a hint, nothing more */ }
    },
    /** A failure is thrown on purpose: the entry knows what to do with it (the consent still opens the page, the list says it could not load, a cancel mark reloads the list). */
    async trialConsent(campaignKey: string, agree: boolean): Promise<void> { await client().post('offerwall/trials/consent', { campaignKey, agree }); },
    loadTrials(): Promise<unknown> { return client().get<unknown>('offerwall/trials'); },
    async trialCancelled(campaignKey: string, cancelled: boolean): Promise<void> {
      await client().post(`offerwall/trials/${encodeURIComponent(campaignKey)}/cancelled`, { cancelled });
    },
  };
}

export function OfferwallCombos(props: OfferwallCombosProps): ReactElement | null {
  const React = require('react') as typeof import('react');
  const { placement, usn, memberId, serverUrl = '', tokens, theme: themeOverride, popupArt, adUnit, adTestMode = false, adTestDevices, popupAd: popupAdOn = true, chipTop, chipRight, sheetTop } = props;

  // the latest props for the callbacks below (they are created once; the entry keeps asking them what to do)
  const latest = React.useRef(props);
  latest.current = props;
  const clientRef = React.useRef<OfferwallClient | null>(null);
  const clientKey = serverUrl;
  const clientFor = (): OfferwallClient => {
    if (latest.current.client) return latest.current.client;
    if (!clientRef.current || (clientRef.current as any).__key !== clientKey) {
      const made = createOfferwallClient({ serverUrl: clientKey, getAuthHeaders: () => latest.current.getAuthHeaders?.() ?? {}, onUnauthorized: () => latest.current.onUnauthorized?.() });
      (made as any).__key = clientKey;
      clientRef.current = made;
    }
    return clientRef.current;
  };

  const themeRef = React.useRef<{ tokens: unknown; override: unknown; theme: ComboTheme } | null>(null);
  if (!themeRef.current || themeRef.current.tokens !== tokens || themeRef.current.override !== themeOverride) {
    themeRef.current = { tokens, override: themeOverride, theme: { ...(tokens ? comboThemeFromTokens(tokens) : DEFAULT_COMBO_THEME), ...(themeOverride ?? {}) } as ComboTheme };
  }
  const theme = themeRef.current.theme;

  const storageRef = React.useRef<ComboStorage | undefined | null>(null);
  if (storageRef.current === null) storageRef.current = props.storage ?? defaultStorage();
  const storage = props.storage ?? storageRef.current ?? undefined;

  // the iPhone list reading: on only while the server's answer says so
  const [listTap, setListTap] = React.useState(false);
  const aliveRef = React.useRef(true);
  React.useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);
  const handlersRef = React.useRef<ReturnType<typeof createComboHandlers> | null>(null);
  if (!handlersRef.current) {
    handlersRef.current = createComboHandlers({
      client: clientFor,
      memberId: () => latest.current.memberId,
      askTestMember: () => latest.current.isTestMember?.() ?? false,
      onListTap: on => {
        // remember the server's answer for the next start (an explicit "on" with its time, an explicit "off" as "0")
        try { const store = latest.current.storage ?? storageRef.current ?? undefined; const member = latest.current.memberId; if (store && member != null) void Promise.resolve(store.setItem(listTapCacheKey(member), on ? String(Date.now()) : '0')).catch(() => {}); } catch { /* the cache is an extra */ }
        if (aliveRef.current) setListTap((prev: boolean) => (prev === on ? prev : on));
      },
    });
  }
  const handlers = handlersRef.current;
  const sheetShown = (info: ComboSheetShown) => {
    const custom = latest.current.onSheetShown;
    if (custom) { try { custom(info); } catch { /* the app's log must not break the sheet */ } return; }
    try { console.log('[combos] sheet', info.ms + 'ms', 'tabs', info.tabs, 'rows', info.rows, 'total', info.total); } catch { /* ignore */ }
  };
  const trialNotify = () => ensureTrialNotify({
    ...defaultTrialNotifyDeps({ ...(latest.current.notifyHooks ?? {}), syncToken: latest.current.syncPushToken }),
    ...(latest.current.notifications ?? {}),
  });

  // iPhone: the last explicit "on" from the server starts the tap at mount, before the combos answer is back; the answer then confirms or switches it off
  React.useEffect(() => {
    if (memberId == null || platformOs() !== 'ios' || !storage) return;
    let live = true;
    void Promise.resolve(storage.getItem(listTapCacheKey(memberId))).then(raw => { if (live && listTapCached(raw)) setListTap((prev: boolean) => prev || true); }).catch(() => {});
    return () => { live = false; };
  }, [memberId]);

  // iPhone only, only while the server says "on": watch AdPopcorn's own list page, send what it shows (rarely), stop when the switch goes off
  React.useEffect(() => {
    if (!listTap || memberId == null || platformOs() !== 'ios') return;
    let live = true;
    let handle: WebTapHandle | null = null;
    const seen: WebTapSummary = { started: false, hello: 0, lists: 0, maxList: 0, details: 0, natives: 0, shapes: 0, paths: [] };
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const report = () => { try { void handlers.diagnoseWebTap({ ...seen, paths: [...seen.paths] }); } catch { /* ignore */ } };
    const uploader: TapUploader = createTapUploader({
      upload: body => clientFor().post('offerwall/campaigns', body),
      storage, scope: String(memberId),
    });
    void startWebTap({
      onMessage: message => {
        if (!live) return;
        if (message.type === 'hello') { seen.hello += 1; seen.helloHost = message.host; try { console.log('[combos] tap hello', message.host, message.ready); } catch { /* ignore */ } return; }
        if (message.type === 'net') { if (seen.paths.length < 12 && !seen.paths.includes(message.path)) seen.paths.push(message.path); return; }
        if (message.type === 'shape') {
          seen.shapes += 1;
          // key names only, to see the page's real shape on a device
          try { console.log('[combos] tap shape', message.path, message.keys.join(','), '|', message.itemKeys.join(',')); } catch { /* ignore */ }
          return;
        }
        if (message.type === 'list') {
          seen.lists += 1; seen.maxList = Math.max(seen.maxList, message.campaigns.length);
          try { console.log('[combos] tap list', message.campaigns.length); } catch { /* ignore */ }
        } else if (message.type === 'detail') seen.details += 1;
        else if (message.type === 'native') seen.natives += 1;
        uploader.handle(message);
      },
    }).then(started => {
      if (!live) { started.stop(); return; }
      handle = started;
      seen.started = started.ok;
      if (!started.ok) { seen.reason = started.reason; report(); return; }
      // test members only: a short summary of what the tap saw, after the wall had time to load and again later
      timers.push(setTimeout(report, 25_000), setTimeout(report, 100_000));
    }).catch(() => undefined);
    return () => { live = false; timers.forEach(t => clearTimeout(t)); uploader.stop(); handle?.stop(); };
  }, [listTap, memberId]);

  const adReady = popupAdOn !== false && popupAdAvailable({ adUnit, testMode: adTestMode });
  const popupAd = adReady ? () => React.createElement(OfferwallPopupAd, { key: popupAdUnit(adUnit) || 'test', adUnit, testMode: adTestMode, testDevices: adTestDevices, theme }) : undefined;

  if (memberId == null) return null;
  return React.createElement(ComboEntry, {
    placement, load: handlers.load, loadKey: String(memberId), usn, theme, popupArt, popupAd, storage,
    reportCampaigns: handlers.report, onDiagnostic: handlers.diagnose, onDetailSignal: handlers.signalDetail,
    onTrialConsent: handlers.trialConsent, onTrialNotify: trialNotify, onSheetShown: sheetShown, loadTrials: handlers.loadTrials, onTrialCancelled: handlers.trialCancelled,
    chipTop, chipRight, ...(sheetTop === undefined ? {} : { sheetTop }),
  } as ComboEntryProps);
}

