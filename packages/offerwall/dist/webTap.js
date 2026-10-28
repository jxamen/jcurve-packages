"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEB_TAP_SCRIPT = exports.WEB_TAP_HOST_PATTERN = exports.WEB_TAP_HANDLER = void 0;
exports.parseTapMessage = parseTapMessage;
exports.startWebTap = startWebTap;
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
const native_1 = require("./native");
const webTapGate_1 = require("./webTapGate");
/** Name of the script message handler the native module registers in the SDK's web view (the page posts nothing to it by itself). */
exports.WEB_TAP_HANDLER = 'JCurveOfferwallTap';
/** Hosts the script (and the native handler) act on: AdPopcorn's offerwall page only. */
exports.WEB_TAP_HOST_PATTERN = '^(?:[a-z0-9-]+\\.)*offerwall\\.adpopcorn\\.com$';
/**
 * The user script (ES5, runs at document start in the main frame of every web view the module sees; inert unless the page is the AdPopcorn offerwall).
 * It wraps `XMLHttpRequest` and `fetch` to read the campaign list / detail responses, and listens to the page's own `NativeEvent`.
 */
exports.WEB_TAP_SCRIPT = `(function () {
  'use strict';
  var HANDLER = '${exports.WEB_TAP_HANDLER}';
  try { if (!new RegExp('${exports.WEB_TAP_HOST_PATTERN.replace(/\\/g, '\\\\')}', 'i').test(String(location.hostname))) return; } catch (e) { return; }
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
  function pick(item) {
    if (!item || typeof item !== 'object') return null;
    var key = str(item.CampaignKey, 128);
    var title = str(item.Title, 255);
    if (!key || !title) return null;
    var out = { campaignKey: key, name: title, reward: reward(item.Reward) };
    var description = str(item.Description, 1000);
    if (description) out.description = description;
    var icon = str(item.IconImage, 500);
    if (/^https:\\/\\//i.test(icon)) out.icon = icon;
    return out;
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
      if (node.length && node[0] && typeof node[0] === 'object' && node[0].CampaignKey !== undefined) { found.push(node); return; }
      for (var i = 0; i < node.length && i < 5; i += 1) findLists(node[i], depth + 1, found);
      return;
    }
    var keys = Object.keys(node);
    for (var k = 0; k < keys.length; k += 1) findLists(node[keys[k]], depth + 1, found);
  }
  function names(obj) {
    var out = [];
    if (obj && typeof obj === 'object') { var keys = Object.keys(obj); for (var i = 0; i < keys.length && i < 30; i += 1) out.push(String(keys[i]).slice(0, 40)); }
    return out;
  }
  function handle(url, text) {
    var path = '';
    try { path = new URL(String(url), location.href).pathname; } catch (e) { path = String(url).split('?')[0]; }
    // 0.4.1: which paths does the page call? (path only — no query, no values) so a list that comes by another path can be found from a device
    if (!netSeen[path] && netCount < 12) { netSeen[path] = 1; netCount += 1; post({ type: 'net', path: path.slice(0, 120) }); }
    if (!/\\/sdk\\/media\\/campaign(s)?\\/?$/i.test(path)) return;
    var data;
    try { data = JSON.parse(text); } catch (e) { return; }
    var lists = [];
    findLists(data, 0, lists);
    if (lists.length) {
      var campaigns = [];
      for (var l = 0; l < lists.length; l += 1) {
        for (var i = 0; i < lists[l].length && campaigns.length < 800; i += 1) { var c = pick(lists[l][i]); if (c) campaigns.push(c); }
      }
      if (campaigns.length) { post({ type: 'list', campaigns: campaigns }); return; }
    }
    var one = pick(data && (data.Campaign || data.Data || data.Result || data));
    if (one) {
      var parts = [];
      infoText(data, 0, parts);
      if (parts.length) one.info = parts.join('\\n').slice(0, 2000);
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
    try { xhr.addEventListener('load', function () { try { if (xhr.responseType === '' || xhr.responseType === 'text') handle(xhr.__jcurveUrl, xhr.responseText); else if (xhr.responseType === 'json') handle(xhr.__jcurveUrl, JSON.stringify(xhr.response)); } catch (e) {} }); } catch (e) {}
    return send.apply(this, arguments);
  };
  if (typeof window.fetch === 'function') {
    var realFetch = window.fetch;
    window.fetch = function (input) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var result = realFetch.apply(this, arguments);
      try { result.then(function (response) { try { response.clone().text().then(function (text) { handle(url, text); }, function () {}); } catch (e) {} }, function () {}); } catch (e) {}
      return result;
    };
  }
  // 0.4.1: the script is alive on this page (host only)
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
const text = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max) : '');
const whole = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(10000000, Math.round(v))) : 0);
function cleanCampaign(raw) {
    const c = raw && typeof raw === 'object' ? raw : null;
    if (!c)
        return null;
    const campaignKey = text(c.campaignKey, 128);
    const name = text(c.name, 255);
    if (!campaignKey || !name)
        return null;
    const description = text(c.description, 1000);
    const icon = text(c.icon, 500);
    const info = text(c.info, 2000);
    // only these keys are ever kept — an `Auth`, `usn`, `ifa`, `appKey` … that slipped through is simply not copied
    return { campaignKey, name, reward: whole(c.reward), ...(description ? { description } : {}), ...(/^https:\/\/\S+$/i.test(icon) ? { icon } : {}), ...(info ? { info } : {}) };
}
/** A message from the native module (a JSON string or an object) → a checked `TapMessage`, or null for anything else. */
function parseTapMessage(raw) {
    let value = raw;
    if (typeof raw === 'string') {
        if (raw.length > 1500000)
            return null;
        try {
            value = JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    const m = value && typeof value === 'object' ? value : null;
    if (!m)
        return null;
    if (m.type === 'list' && Array.isArray(m.campaigns)) {
        const seen = new Set();
        const campaigns = [];
        for (const item of m.campaigns.slice(0, 1200)) {
            const c = cleanCampaign(item);
            if (!c || seen.has(c.campaignKey))
                continue;
            seen.add(c.campaignKey);
            campaigns.push(c);
            if (campaigns.length >= 800)
                break;
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
    if (m.type === 'hello')
        return { type: 'hello', host: text(m.host, 80), ready: text(m.ready, 20) };
    if (m.type === 'net') {
        const path = text(m.path, 120);
        return path ? { type: 'net', path } : null;
    }
    if (m.type === 'shape') {
        const names = (v) => (Array.isArray(v) ? v.slice(0, 30).map(k => text(k, 40)).filter(Boolean) : []);
        return { type: 'shape', path: text(m.path, 120), keys: names(m.keys), itemKeys: names(m.itemKeys) };
    }
    return null;
}
/**
 * Starts the web tap: gives the native module the script, and listens to what it posts. Resolves `{ ok: false }` on a binary without the 0.4.0
 * native module (nothing is hooked) — the caller just goes on without the list reading. `stop()` switches it off again.
 */
async function startWebTap({ onMessage, enabled = true }) {
    const none = (reason) => ({ ok: false, reason, stop: () => { } });
    if (!(0, native_1.hasNativeBridge)())
        return none('no_native');
    try {
        const capabilities = await (0, native_1.getOfferwallNativeCapabilities)();
        if (!capabilities.methods.includes('setWebTap'))
            return none('unsupported');
    }
    catch {
        return none('unsupported');
    }
    const unsubscribe = (0, native_1.addTapListener)(raw => {
        const message = parseTapMessage(raw);
        if (message) {
            try {
                onMessage(message);
            }
            catch { /* the app's handler must not break the page */ }
        }
    });
    try {
        const on = await (0, native_1.setWebTap)(enabled ? { enabled: true, script: exports.WEB_TAP_SCRIPT, handler: exports.WEB_TAP_HANDLER, hostPattern: exports.WEB_TAP_HOST_PATTERN } : { enabled: false });
        if (!on && enabled) {
            unsubscribe();
            return none('failed');
        }
    }
    catch {
        unsubscribe();
        return none('failed');
    }
    if (enabled)
        (0, webTapGate_1.tapGateActivated)();
    return { ok: true, stop: () => { unsubscribe(); (0, webTapGate_1.tapGateDeactivated)(); void (0, native_1.setWebTap)({ enabled: false }).catch(() => { }); } };
}
