/**
 * 0.4.0, iOS: reads what AdPopcorn's own offerwall web page shows (the 「전체 미션」 list) — a user script the native module
 * injects into the SDK's web view. The page is AdPopcorn's, the app only *watches* it: the campaign list it fetches and the events the SDK hands to it.
 *
 * What leaves the web view is only a short whitelist: campaign key · title · reward · one-line description · icon address (and, for a detail
 * response, the participation text). **Never**: the campaign `Auth` token, `getParameter` (it carries the app key, member and advertising ids),
 * `EventBody` / `EventParam`, cookies, headers. The script drops them before anything is posted, and `parseTapMessage` below checks the same again.
 *
 * Needs a binary with the 0.4.0 native module (`webTap` in its capabilities). Without it every function here does nothing and says so
 * (`startWebTap` returns `{ ok: false }`) — nothing breaks on a 0.2.x / 0.3.0 binary.
 */
import { addTapListener, getOfferwallNativeCapabilities, hasNativeBridge, setWebTap as setNativeWebTap } from './native';
import { tapGateActivated, tapGateDeactivated } from './webTapGate';

/** Name of the script message handler the native module registers in the SDK's web view (the page posts nothing to it by itself). */
export const WEB_TAP_HANDLER = 'JCurveOfferwallTap';
/** Hosts the script (and the native handler) act on: AdPopcorn's offerwall page only. */
export const WEB_TAP_HOST_PATTERN = '^(?:[a-z0-9-]+\\.)*offerwall\\.adpopcorn\\.com$';

/**
 * The user script (ES5, runs at document start in the main frame of every web view the module sees; inert unless the page is the AdPopcorn offerwall).
 * It wraps `XMLHttpRequest` and `fetch` to read the campaign list / detail responses, and listens to the page's own `NativeEvent`.
 *
 * The response shape (0.4.2, read from the wall page's own public code — `offerwall.adpopcorn.com/assets/*.js` — and checked against its card
 * components): the list is `POST …/v3/sdk/media/campaigns` → `{ CampaignList: [ { Key, Title, Description, IconImage, MainImage, Reward: { Quantity, Unit }, … } ], … }`
 * (a `CPMCampaignList` may sit beside it), the detail `…/v3/sdk/media/campaign` → `{ Campaign: { Key, … } }`. The page's live-commerce rows are different
 * (`CampaignKey`, `IconUrl`, a plain-number `Reward`, `PartiTypeCode`, broadcast times) and are not missions. 0.4.0 / 0.4.1 looked for `CampaignKey` only
 * and so found no mission list at all on a device (diag: lists 0, shapes 1).
 */
export const WEB_TAP_SCRIPT = `(function () {
  'use strict';
  var HANDLER = '${WEB_TAP_HANDLER}';
  try { if (!new RegExp('${WEB_TAP_HOST_PATTERN.replace(/\\/g, '\\\\')}', 'i').test(String(location.hostname))) return; } catch (e) { return; }
  if (window.__jcurveWebTap) return;
  window.__jcurveWebTap = 1;
  var NATIVE_EVENTS = /^(normalDialog|showDetailPage|requestJoinCampaign|refreshCampaignList|campaignCompleted|cpmCampaignCompleted|rcpcCampaignCompleted|newsCampaignCompleted|webtoonCampaignCompleted|executeAppAndReward|rewardSuccess|checkCampaignPackageTargetList)$/;
  var INFO_KEY = /(Step|Condition|Guide|Caution|Notice|Info|Description)$/;
  var shapes = {};
  var netSeen = {};
  var netCount = 0;
  function post(obj) {
    try { window.webkit.messageHandlers[HANDLER].postMessage(JSON.stringify(obj)); } catch (e) {}
  }
  function str(value, max) {
    if (typeof value === 'string') return value.slice(0, max);
    if (typeof value === 'number' && isFinite(value)) return String(value);
    return '';
  }
  function reward(value) {
    if (typeof value === 'number' && isFinite(value)) return Math.round(value);
    var digits = typeof value === 'string' ? value.replace(/[^0-9.]/g, '') : '';
    return digits ? Math.round(Number(digits)) || 0 : 0;
  }
  function keyOf(item) {
    var key = str(item.Key, 128);
    if (key) return key;
    if (item.PartiTypeCode !== undefined || item.BroadcastStartTime !== undefined) return '';
    return str(item.CampaignKey, 128);
  }
  function pick(item) {
    if (!item || typeof item !== 'object') return null;
    var key = keyOf(item);
    var title = str(item.Title, 255);
    if (!key || !title) return null;
    var out = { campaignKey: key, name: title, reward: reward(item.Reward && typeof item.Reward === 'object' ? item.Reward.Quantity : item.Reward) };
    var description = str(item.Description, 400);
    if (description) out.description = description;
    var icon = str(item.IconImage, 500) || str(item.IconUrl, 500) || str(item.MainImage, 500);
    if (/^https:\\/\\//i.test(icon)) out.icon = icon;
    var steps = [];
    var texts = [item.ParticipationStep, item.RewardCondition];
    for (var t = 0; t < texts.length; t += 1) {
      if (!Array.isArray(texts[t])) continue;
      for (var s = 0; s < texts[t].length && steps.length < 12; s += 1) { var line = str(texts[t][s], 300); if (line) steps.push(line); }
    }
    if (steps.length) out.info = steps.join('\\n').slice(0, 1500);
    return out;
  }
  function postList(campaigns) {
    var batch = [];
    var size = 0;
    for (var i = 0; i < campaigns.length; i += 1) {
      var length = JSON.stringify(campaigns[i]).length;
      if (batch.length && size + length > 600000) { post({ type: 'list', campaigns: batch }); batch = []; size = 0; }
      batch.push(campaigns[i]);
      size += length;
    }
    if (batch.length) post({ type: 'list', campaigns: batch });
  }
  function campaignLike(row) {
    return !!row && typeof row === 'object' && !Array.isArray(row) && !!keyOf(row) && typeof row.Title === 'string';
  }
  function infoText(node, depth, parts) {
    if (!node || typeof node !== 'object' || depth > 3 || parts.length > 40) return;
    var keys = Object.keys(node);
    for (var i = 0; i < keys.length; i += 1) {
      var value = node[keys[i]];
      if (typeof value === 'string' && INFO_KEY.test(keys[i])) parts.push(value.slice(0, 600));
      else if (value && typeof value === 'object') infoText(value, depth + 1, parts);
    }
  }
  function findLists(node, depth, found) {
    if (!node || typeof node !== 'object' || depth > 4) return;
    if (Array.isArray(node)) {
      if (campaignLike(node[0]) || campaignLike(node[1]) || campaignLike(node[2])) { found.push(node); return; }
      for (var i = 0; i < node.length && i < 5; i += 1) findLists(node[i], depth + 1, found);
      return;
    }
    var keys = Object.keys(node);
    for (var k = 0; k < keys.length; k += 1) { if (!/^CPM/i.test(keys[k])) findLists(node[keys[k]], depth + 1, found); }
  }
  function names(obj) {
    var out = [];
    if (obj && typeof obj === 'object') { var keys = Object.keys(obj); for (var i = 0; i < keys.length && i < 30; i += 1) out.push(String(keys[i]).slice(0, 40)); }
    return out;
  }
  function describe(text) {
    var out = { kind: 'empty', len: 0 };
    if (typeof text !== 'string') { out.kind = 'other'; return out; }
    out.len = text.length;
    if (!text.length) return out;
    if (text.length > 3000000) { out.kind = 'big'; return out; }
    var data;
    try { data = JSON.parse(text); } catch (e) {
      var head = text.replace(/^\\s+/, '').slice(0, 80);
      out.kind = head.charAt(0) === '<' ? 'html' : (/^[A-Za-z_$][\\w$.]*\\(/.test(head) ? 'jsonp' : 'text');
      return out;
    }
    out.kind = 'json';
    if (Array.isArray(data)) { out.top = 'array'; out.n = data.length; out.item = names(data[0]); return out; }
    if (!data || typeof data !== 'object') { out.top = typeof data; return out; }
    out.top = 'object';
    out.keys = names(data);
    var arrays = [];
    var ks = Object.keys(data);
    for (var i = 0; i < ks.length && arrays.length < 6; i += 1) {
      var value = data[ks[i]];
      if (!Array.isArray(value)) continue;
      var first = value[0];
      var sub = [];
      if (first && typeof first === 'object') {
        var fk = Object.keys(first);
        for (var j = 0; j < fk.length && sub.length < 4; j += 1) {
          var inner = first[fk[j]];
          if (inner && typeof inner === 'object' && !Array.isArray(inner)) sub.push([String(fk[j]).slice(0, 30), names(inner)]);
        }
      }
      arrays.push({ k: String(ks[i]).slice(0, 30), n: value.length, item: names(first), sub: sub });
    }
    out.arrays = arrays;
    return out;
  }
  var respCount = 0;
  var respByPath = {};
  function reportResp(path, text, status, mission) {
    var seenForPath = respByPath[path] || 0;
    if (mission ? seenForPath >= 6 : (respCount >= 16 || seenForPath >= 3)) return;
    respByPath[path] = seenForPath + 1;
    if (!mission) respCount += 1;
    var shape = describe(text);
    shape.type = 'resp';
    shape.path = path.slice(0, 120);
    shape.status = typeof status === 'number' ? status : 0;
    post(shape);
  }
  function handle(url, text, status) {
    var path = '';
    try { path = new URL(String(url), location.href).pathname; } catch (e) { path = String(url).split('?')[0]; }
    if (!netSeen[path] && netCount < 12) { netSeen[path] = 1; netCount += 1; post({ type: 'net', path: path.slice(0, 120) }); }
    var mission = /\\/sdk\\/media\\/campaign(s)?\\/?$/i.test(path);
    try { reportResp(path, text, status, mission); } catch (e) {}
    if (!mission) return;
    var data;
    try { data = JSON.parse(text); } catch (e) { return; }
    var lists = [];
    findLists(data, 0, lists);
    if (lists.length) {
      var campaigns = [];
      for (var l = 0; l < lists.length; l += 1) {
        for (var i = 0; i < lists[l].length && campaigns.length < 800; i += 1) { var c = pick(lists[l][i]); if (c) campaigns.push(c); }
      }
      if (campaigns.length) { postList(campaigns); return; }
    }
    var one = pick(data && (data.Campaign || data.Data || data.Result || data));
    if (one) {
      var parts = [];
      infoText(data, 0, parts);
      if (parts.length && !one.info) one.info = parts.join('\\n').slice(0, 2000);
      post({ type: 'detail', campaign: one });
      return;
    }
    if (!shapes[path]) { shapes[path] = 1; post({ type: 'shape', path: path.slice(0, 120), keys: names(data), itemKeys: names(data && (data.CampaignList || data.Campaign || data.Data)) }); }
  }
  var open = XMLHttpRequest.prototype.open;
  var send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) { this.__jcurveUrl = url; return open.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    var xhr = this;
    try { xhr.addEventListener('load', function () { try { if (xhr.responseType === '' || xhr.responseType === 'text') handle(xhr.__jcurveUrl, xhr.responseText, xhr.status); else if (xhr.responseType === 'json') handle(xhr.__jcurveUrl, JSON.stringify(xhr.response), xhr.status); } catch (e) {} }); } catch (e) {}
    return send.apply(this, arguments);
  };
  if (typeof window.fetch === 'function') {
    var realFetch = window.fetch;
    window.fetch = function (input) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var result = realFetch.apply(this, arguments);
      try { result.then(function (response) { try { response.clone().text().then(function (text) { handle(url, text, response.status); }, function () {}); } catch (e) {} }, function () {}); } catch (e) {}
      return result;
    };
  }
  var ready = '';
  try { ready = String(document.readyState).slice(0, 20); } catch (e) {}
  post({ type: 'hello', host: String(location.hostname).slice(0, 80), ready: ready });
  window.addEventListener('NativeEvent', function (event) {
    try {
      var data = event && event.detail && event.detail.data;
      if (!data || typeof data.EventName !== 'string' || !NATIVE_EVENTS.test(data.EventName)) return;
      post({ type: 'native', event: data.EventName, ok: data.Result === true || data.Result === 'true', message: str(data.ResultMessage, 200) });
    } catch (e) {}
  });
})();`;

/** One campaign read from the web page. `reward` is a whole number; `icon` is https only. */
export type TapCampaign = { campaignKey: string; name: string; reward: number; description?: string; icon?: string; info?: string };
export type TapMessage =
  | { type: 'list'; campaigns: TapCampaign[] }
  | { type: 'detail'; campaign: TapCampaign }
  /** an event the SDK handed to the page: normalDialog (its message is the dialog text, e.g. a campaign that is full), showDetailPage, requestJoinCampaign … */
  | { type: 'native'; event: string; ok: boolean; message: string }
  /** the key names (never values) of a response the script could not read, to learn its shape */
  | { type: 'shape'; path: string; keys: string[]; itemKeys: string[] }
  /** 0.4.1: the script started on the wall page */
  | { type: 'hello'; host: string; ready: string }
  /** 0.4.1: a path the page requested (no query) */
  | { type: 'net'; path: string }
  /** 0.4.2: the shape of one response (kind · length · key names · array lengths and row key names — never a value), so the next device run shows the real format */
  | ({ type: 'resp' } & TapResp);

/** What one response looked like: only names and numbers. */
export type TapResp = {
  path: string; status: number; kind: string; len: number; top?: string; n?: number;
  keys: string[]; item: string[];
  arrays: Array<{ k: string; n: number; item: string[]; sub: Array<[string, string[]]> }>;
};

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max) : '');
const whole = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(10_000_000, Math.round(v))) : 0);

function cleanCampaign(raw: unknown): TapCampaign | null {
  const c = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!c) return null;
  const campaignKey = text(c.campaignKey, 128);
  const name = text(c.name, 255);
  if (!campaignKey || !name) return null;
  const description = text(c.description, 1000);
  const icon = text(c.icon, 500);
  const info = text(c.info, 2000);
  // only these keys are ever kept — an `Auth`, `usn`, `ifa`, `appKey` … that slipped through is simply not copied
  return { campaignKey, name, reward: whole(c.reward), ...(description ? { description } : {}), ...(/^https:\/\/\S+$/i.test(icon) ? { icon } : {}), ...(info ? { info } : {}) };
}

const nameList = (v: unknown, max: number): string[] => (Array.isArray(v) ? v.slice(0, max).map(k => text(k, 30)).filter(Boolean) : []);
const smallInt = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100_000_000, Math.round(v))) : 0);

/** Names and numbers only: a value that is not a short key name never survives this (`text` cuts to 30 characters, arrays and lists are capped). */
export function cleanResp(raw: unknown): TapResp | null {
  const m = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!m) return null;
  const path = text(m.path, 120).replace(/[?#].*$/, '');
  if (!path) return null;
  const arrays = Array.isArray(m.arrays) ? m.arrays.slice(0, 6).map((a): TapResp['arrays'][number] | null => {
    const entry = a && typeof a === 'object' ? (a as Record<string, unknown>) : null;
    if (!entry) return null;
    const sub = Array.isArray(entry.sub) ? entry.sub.slice(0, 4).map((pair): [string, string[]] | null => (Array.isArray(pair) && pair.length === 2 ? [text(pair[0], 30), nameList(pair[1], 12)] : null)).filter((p): p is [string, string[]] => !!p && !!p[0]) : [];
    return { k: text(entry.k, 30), n: smallInt(entry.n), item: nameList(entry.item, 20), sub };
  }).filter((a): a is TapResp['arrays'][number] => !!a && !!a.k) : [];
  const out: TapResp = { path, status: smallInt(m.status), kind: text(m.kind, 10), len: smallInt(m.len), keys: nameList(m.keys, 20), item: nameList(m.item, 20), arrays };
  const top = text(m.top, 10);
  if (top) out.top = top;
  if (typeof m.n === 'number') out.n = smallInt(m.n);
  return out;
}

/** A message from the native module (a JSON string or an object) → a checked `TapMessage`, or null for anything else. */
export function parseTapMessage(raw: unknown): TapMessage | null {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.length > 1_500_000) return null;
    try { value = JSON.parse(raw); } catch { return null; }
  }
  const m = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  if (!m) return null;
  if (m.type === 'list' && Array.isArray(m.campaigns)) {
    const seen = new Set<string>();
    const campaigns: TapCampaign[] = [];
    for (const item of m.campaigns.slice(0, 1200)) {
      const c = cleanCampaign(item);
      if (!c || seen.has(c.campaignKey)) continue;
      seen.add(c.campaignKey);
      campaigns.push(c);
      if (campaigns.length >= 800) break;
    }
    return { type: 'list', campaigns };
  }
  if (m.type === 'detail') {
    const campaign = cleanCampaign(m.campaign);
    return campaign ? { type: 'detail', campaign } : null;
  }
  if (m.type === 'native') {
    const event = text(m.event, 60);
    return event ? { type: 'native', event, ok: m.ok === true, message: text(m.message, 200) } : null;
  }
  if (m.type === 'hello') return { type: 'hello', host: text(m.host, 80), ready: text(m.ready, 20) };
  if (m.type === 'net') { const path = text(m.path, 120); return path ? { type: 'net', path } : null; }
  if (m.type === 'resp') { const resp = cleanResp(m); return resp ? { type: 'resp', ...resp } : null; }
  if (m.type === 'shape') {
    const names = (v: unknown): string[] => (Array.isArray(v) ? v.slice(0, 30).map(k => text(k, 40)).filter(Boolean) : []);
    return { type: 'shape', path: text(m.path, 120), keys: names(m.keys), itemKeys: names(m.itemKeys) };
  }
  return null;
}

export type WebTapOptions = {
  /** Called with every checked message. */
  onMessage: (message: TapMessage) => void;
  /** Off (false) = the native side removes the script for web views created from now on. Default true. */
  enabled?: boolean;
};
export type WebTapHandle = { ok: boolean; reason?: 'no_native' | 'unsupported' | 'failed'; stop: () => void };

/**
 * Starts the web tap: gives the native module the script, and listens to what it posts. Resolves `{ ok: false }` on a binary without the 0.4.0
 * native module (nothing is hooked) — the caller just goes on without the list reading. `stop()` switches it off again.
 */
export async function startWebTap({ onMessage, enabled = true }: WebTapOptions): Promise<WebTapHandle> {
  const none = (reason: 'no_native' | 'unsupported' | 'failed'): WebTapHandle => ({ ok: false, reason, stop: () => {} });
  if (!hasNativeBridge()) return none('no_native');
  try {
    const capabilities = await getOfferwallNativeCapabilities();
    if (!capabilities.methods.includes('setWebTap')) return none('unsupported');
  } catch { return none('unsupported'); }
  const unsubscribe = addTapListener(raw => {
    const message = parseTapMessage(raw);
    if (message) { try { onMessage(message); } catch { /* the app's handler must not break the page */ } }
  });
  try {
    const on = await setNativeWebTap(enabled ? { enabled: true, script: WEB_TAP_SCRIPT, handler: WEB_TAP_HANDLER, hostPattern: WEB_TAP_HOST_PATTERN } : { enabled: false });
    if (!on && enabled) { unsubscribe(); return none('failed'); }
  } catch { unsubscribe(); return none('failed'); }
  if (enabled) tapGateActivated();
  return { ok: true, stop: () => { unsubscribe(); tapGateDeactivated(); void setNativeWebTap({ enabled: false }).catch(() => {}); } };
}
