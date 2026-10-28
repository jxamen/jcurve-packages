"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultStepsTheme = void 0;
exports.StepsScreen = StepsScreen;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const stages_1 = require("./stages");
const days_1 = require("./days");
const heal_1 = require("./heal");
const StepsYesterdayCard_1 = require("./StepsYesterdayCard");
const source_1 = require("./source");
const sync_1 = require("./sync");
exports.defaultStepsTheme = { bg: '#FFF6EC', card: '#FFFFFF', text: '#2B2118', sub: '#8A7A6B', line: '#F6EEE6', dim: '#C4B7A9', primary: '#F5A3B8', primarySoft: '#FFEDF2', primaryDeep: '#D9738E', bgSoft: '#FFFBF5', onPrimary: '#fff', radius: 20 };
const errorCopy = {
    no_ad: '광고 시청이 아직 확인되지 않았어요. 잠시 후 다시 시도해 주세요', ssv_pending: '광고 시청이 아직 확인되지 않았어요. 잠시 후 다시 시도해 주세요',
    daily_max: '오늘은 여기까지예요. 내일 다시 만나요', basket_full: '바구니가 가득 찼어요. 포인트로 바꾸고 다시 심어요', not_full: '바구니를 다 채워야 포인트로 바꿀 수 있어요', empty: '바구니에 당근이 없어요', top: '이미 가장 좋은 당근이에요', disabled: '지금은 당근을 바꿀 수 없어요', incomplete: '일주일을 채우면 받을 수 있어요', already: '이미 받았어요', insufficient: '포인트가 모자라요', session_not_found: '', unauthorized: '', timeout: '응답이 너무 늦어요. 연결을 확인하고 다시 시도해 주세요', network: '연결이 끊겼어요. 잠시 후 다시 시도해 주세요',
};
const allowVersion = async () => true;
const isApiError = (e) => typeof e === 'object' && e !== null && 'code' in e;
const StringsContext = (0, react_1.createContext)(undefined);
function Copy({ children, ...props }) { const strings = (0, react_1.useContext)(StringsContext); return (0, jsx_runtime_1.jsx)(react_native_1.Text, { ...props, children: react_1.default.Children.map(children, child => typeof child === 'string' ? strings?.[child] ?? child : child) }); }
function StepsScreen({ api, showRewardedAd, onPendingClaim, onBalance, theme, strings, header, adSlot, onClose, ensureVersion = allowVersion, memberId }) {
    const C = { ...exports.defaultStepsTheme, ...theme, carrot: theme?.primary ?? exports.defaultStepsTheme.primary };
    const st = makeStyles(C);
    const t = (value) => strings?.[value] ?? value;
    const fetchStepsStages = api.fetchStages;
    const claimStepsStage = api.claimStage;
    const syncSteps = api.sync;
    const ensureStepsVersion = ensureVersion;
    const refresh = async () => { await onBalance?.(); };
    const holdClaim = (_kind, purpose, key, body, earned) => onPendingClaim?.({ purpose, key, ...body, earned });
    const member = memberId == null ? null : { id: memberId };
    const [state, setState] = (0, react_1.useState)(null);
    const [yState, setYState] = (0, react_1.useState)(null);
    const [reading, setReading] = (0, react_1.useState)(null);
    const [message, setMessage] = (0, react_1.useState)('');
    const [pending, setPending] = (0, react_1.useState)(null);
    const active = (0, react_1.useRef)(true);
    const loading = (0, react_1.useRef)(false);
    const healed = (0, react_1.useRef)(new Map());
    const healing = (0, react_1.useRef)(false); // 0.3.2: 단계마다 한 번(모르면 최대 3번) 묻는다 — `heal.ts`
    const stop = (0, react_1.useRef)(() => { });
    const error = (e) => { if (active.current)
        setMessage(isApiError(e) && e.code === 'day_changed' ? '날짜가 바뀌었어요. 오늘 단계를 다시 확인해 주세요.' : isApiError(e) ? t(errorCopy[e.code] ?? '잠시 후 다시 시도해 주세요') : '걸음 수를 읽지 못했어요. 다시 시도해 주세요.'); };
    // 어제 걸음(0.3.0) — 어제 상태는 서버 응답(steps/stages?day=어제)을 그대로 본다. 실패해도 오늘 화면은 그대로 둔다(어제 카드만 안 보인다)
    const loadYesterday = (0, react_1.useCallback)(async () => {
        if (!api.fetchStagesOn)
            return;
        try {
            const y = await api.fetchStagesOn((0, days_1.yesterdayKst)());
            if (active.current)
                setYState(y);
        }
        catch {
            if (active.current)
                setYState(null);
        }
    }, [api]);
    const load = (0, react_1.useCallback)(async () => {
        if (loading.current)
            return;
        loading.current = true;
        try {
            // 상자 목록을 먼저 그린다 — 걸음 센서가 늦거나 없어도 「불러오는 중」에 멈추지 않게(10-19 시뮬 점검)
            const first = await fetchStepsStages();
            if (!active.current)
                return;
            setState(first);
            void loadYesterday();
            const r = await (0, source_1.readToday)();
            if (!active.current)
                return;
            setReading(r);
            if (r.status === 'ready') {
                await (0, sync_1.syncToday)(r.days, syncSteps);
                const next = await fetchStepsStages();
                if (active.current) {
                    setState(next);
                    setMessage('');
                }
                await loadYesterday(); // 어제 걸음도 방금 올렸으니 서버 상태를 다시 본다
            }
        }
        catch (e) {
            error(e);
        }
        finally {
            loading.current = false;
        }
    }, [api, memberId, loadYesterday]);
    // 다른 길(알림 등)로 들어와도 옛 빌드면 업데이트 창을 띄우고 닫는다
    (0, react_1.useEffect)(() => { void ensureStepsVersion().then((ok) => { if (active.current && !ok)
        onClose(); }).catch(error); }, [ensureVersion, onClose]);
    (0, react_1.useEffect)(() => {
        active.current = true;
        const start = async () => { stop.current(); await load(); if (active.current)
            stop.current = (0, source_1.watchSteps)(() => { void load(); }); };
        void start();
        const app = react_native_1.AppState.addEventListener('change', st => { if (st === 'active')
            void start();
        else
            stop.current(); });
        const back = react_native_1.BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
        const timer = setInterval(() => { if (react_native_1.AppState.currentState === 'active')
            void load(); }, 15000);
        return () => { active.current = false; stop.current(); app.remove(); back.remove(); clearInterval(timer); };
    }, [load, member?.id, onClose]);
    async function enable() {
        try {
            // 화면에 이미 설명이 있어 바로 기기 권한 창을 띄운다(대표님 10-19 「내 걸음 수 가져오는 것도 안 되고」)
            await (0, source_1.requestStepsPermission)(async () => true);
            await load();
            stop.current();
            if (active.current)
                stop.current = (0, source_1.watchSteps)(() => { void load(); });
        }
        catch (e) {
            error(e);
        }
    }
    async function claim(id, day, purpose, earned) {
        const next = await claimStepsStage(id, day, earned);
        if (active.current) {
            // 어제 몫을 받았으면 어제 카드가, 오늘 몫이면 오늘 카드가 새 상태를 받는다(청구 응답의 day 가 기준)
            if (next.day === yState?.day && next.day !== state?.day)
                setYState(next);
            else
                setState(next);
            setPending(null);
            setMessage(next.gained ? `${next.gained}P 받았어요` : '이미 받은 단계예요');
        }
        await refresh();
    }
    /** 'ok' 받을 수 있다(`earned` 는 앱이 보상 콜백을 받은 것) · 'hold' 확인을 기다려 적어 둔다 · false 멈춘다 */
    async function watch(stage) {
        if (!member)
            return false;
        const purpose = stage.ad_purpose;
        const result = await showRewardedAd(purpose);
        // 다 본 것(앱 신호 또는 서버 확인)만 청구한다. 「확인이 늦어지고 있어요」는 청구가 실제로 실패했을 때만(대표님 10-19 20:48 「2초 있다가 지급이 늦어지고 있다고 떠」)
        if (result.earned)
            return 'earned';
        // 열렸는데 보상 신호가 없다 — `showAd` 가 확인을 20초 남짓 물었다. 「안 봤다」고 단정하지 않고 적어 둔다
        if (result.opened && !result.noAd)
            return 'hold';
        setMessage(result.message ?? '광고를 끝까지 봐 주세요.');
        return false;
    }
    const [busy, setBusy] = (0, react_1.useState)(null);
    const [refreshing, setRefreshing] = (0, react_1.useState)(false);
    const lock = (0, react_1.useRef)(false);
    /**
     * 0.3.2 — 놓친 광고 보상 되찾기. 받을 수 있는 단계마다 서버에 「이 단계 광고의 구글 확인이 와 있나(아직 청구 안 된 것)」를 한 번 묻고, 있으면 받는다.
     * 서버는 확인(SSV) 한 줄을 한 번만 쓰고(`consumeAd` 의 claimed_at 비교 갱신) 같은 단계를 두 번 주지 않는다(단계 청구 유일 키 · 원장 유일 키) → 중복 지급 0.
     * `adSeen` 이 없으면 아무것도 안 한다. 이미 받은 단계 · 날짜가 지난 단계 · 실패는 조용히 건너뛴다(사용자에게 아무 안내도 안 한다, 받았을 때만 한 줄).
     */
    const latest = (0, react_1.useRef)({ sources: [], pending: false });
    latest.current = { sources: [state, yState], pending: !!pending };
    const again = (0, react_1.useRef)(false);
    const heal = (0, react_1.useCallback)(async () => {
        if (!api.adSeen)
            return;
        if (healing.current) {
            again.current = true;
            return;
        } // 도는 중에 새 상태가 오면 끝난 뒤 한 번 더(건너뛰지 않는다)
        healing.current = true;
        try {
            await (0, heal_1.healUnclaimedStages)({ adSeen: api.adSeen, claimStage: claimStepsStage }, latest.current.sources, {
                memory: healed.current,
                canRun: () => active.current && !lock.current && !latest.current.pending,
                onClaimed: async (next) => {
                    if (!active.current)
                        return;
                    if (next.day === latest.current.sources[1]?.day && next.day !== latest.current.sources[0]?.day)
                        setYState(next);
                    else
                        setState(next);
                    if (next.gained)
                        setMessage(`지난 광고 보상 ${next.gained}P 받았어요`);
                    await refresh();
                },
            });
        }
        finally {
            healing.current = false;
            if (again.current) {
                again.current = false;
                void heal();
            }
        }
    }, [api]);
    (0, react_1.useEffect)(() => { void heal(); }, [state, yState, pending, heal]);
    async function open(stage, which = 'today') {
        const src = which === 'today' ? state : yState;
        // 오늘 몫은 걸음 센서가 읽힐 때만, 어제 몫은 서버가 이미 아는 걸음이라 센서 상태와 무관하다
        if (!src || lock.current || (which === 'today' && reading?.status !== 'ready') || pending || !(0, stages_1.canClaimStage)(src, stage))
            return;
        lock.current = true;
        setBusy(stage.stage_id);
        // 옛 빌드(걸음 센서 없음)는 받기 전에 업데이트 창(대표님 10-19 22:30 「걸음 수 보상 받을려고 하면 버전 체크」)
        const day = src.day;
        const purpose = stage.ad_purpose;
        const hold = (earned) => {
            holdClaim('steps', purpose, purpose + ':' + day, { stage_id: stage.stage_id, day }, earned);
            setPending({ id: stage.stage_id, day, purpose });
        };
        try {
            if (!(await ensureStepsVersion()))
                return;
            const w = await watch(stage);
            if (w === 'hold')
                hold(false);
            else if (w) {
                const earned = w === 'earned';
                try {
                    await claim(stage.stage_id, day, purpose, earned);
                }
                catch (e) {
                    // 다 봤는데 구글 확인이 아직 없다 — 실패로 끝내지 않고 적어 둔다(앱이 다시 열릴 때 · 켜져 있는 동안 다시 청구)
                    if (isApiError(e) && (e.code === 'no_ad' || e.code === 'ssv_pending')) {
                        hold(earned);
                        return;
                    }
                    setPending({ id: stage.stage_id, day, purpose });
                    throw e;
                }
            }
        }
        catch (e) {
            error(e);
        }
        finally {
            lock.current = false;
            setBusy(null);
        }
    }
    const steps = state?.today_steps ?? 0;
    const stages = state?.stages ?? [];
    const next = stages.find(x => !x.claimed && steps < x.threshold);
    const ready = reading?.status === 'ready';
    // 상자 대신 「남은 횟수 + 광고 보고 받기」 하나(대표님 10-19 19:25 「꼭 상자로 하지 않아도 돼 · 남은 횟수 표기하고 광고 보고 포인트 받기」)
    const claimable = state && ready && !pending ? stages.filter(x => (0, stages_1.canClaimStage)(state, x)) : [];
    const first = claimable[0];
    const points = stages[0]?.points ?? 5;
    /* 참고(대표님 10-19 15:30 「참고해」 만보기 화면): 큰 걸음 수 · 말풍선 · 신발 · P 단계 줄 · 3칸 상자 · 네이티브 · 안내사항 */
    /* 참고 화면(대표님 10-19 18:35)처럼 상태 표시줄 바로 아래 「‹ 만보기」 — 앱 바깥 틀이 이미 위 안전영역을 잡아 여기선 더하지 않는다 */
    return (0, jsx_runtime_1.jsx)(StringsContext.Provider, { value: strings, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: st.root, children: [header ?? (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: st.header, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: t('뒤로'), hitSlop: 12, onPress: onClose, style: st.back, children: (0, jsx_runtime_1.jsx)(Copy, { style: st.backText, children: "\u2039" }) }), (0, jsx_runtime_1.jsx)(Copy, { style: [st.headerTitle, { flex: 1, textAlign: 'center' }], children: t('만보기') }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: st.back })] }), (0, jsx_runtime_1.jsxs)(react_native_1.ScrollView, { contentContainerStyle: st.content, refreshControl: (0, jsx_runtime_1.jsx)(react_native_1.RefreshControl, { refreshing: refreshing, onRefresh: () => { setRefreshing(true); void load().finally(() => setRefreshing(false)); } }), children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: st.top, children: [(0, jsx_runtime_1.jsxs)(Copy, { style: st.count, children: [steps.toLocaleString(), (0, jsx_runtime_1.jsx)(Copy, { style: st.countUnit, children: " \uAC78\uC74C" })] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: st.bubble, children: (0, jsx_runtime_1.jsx)(Copy, { style: st.bubbleText, children: !ready ? '걸음 수를 켜면 포인트를 받을 수 있어요' : claimable.length > 0 ? `포인트를 ${claimable.length}번 받을 수 있어요` : next ? `${(next.threshold - steps).toLocaleString()}걸음 더 걸으면 ${points}P` : '오늘 걸음 포인트를 다 받았어요' }) })] }), reading && reading.status !== 'ready' ? (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: st.notice, children: [(0, jsx_runtime_1.jsx)(Copy, { style: st.noticeTitle, children: reading.status === 'unavailable' ? '이 기기에서는 걸음 수를 읽을 수 없어요' : reading.status === 'denied' ? '걸음 수 권한이 꺼져 있어요' : reading.status === 'error' ? '걸음 수를 읽지 못했어요' : '걸음 수를 켜 주세요' }), reading.status === 'denied' ? (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => { void react_native_1.Linking.openSettings(); }, style: st.noticeBtn, children: (0, jsx_runtime_1.jsx)(Copy, { style: st.noticeBtnText, children: "\uC124\uC815\uC5D0\uC11C \uCF1C\uAE30" }) })
                                    : reading.status === 'unknown' ? (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => { void enable(); }, style: st.noticeBtn, children: (0, jsx_runtime_1.jsx)(Copy, { style: st.noticeBtnText, children: "\uAC78\uC74C \uC218 \uCF1C\uAE30" }) })
                                        : reading.status === 'error' ? (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => { void load(); }, style: st.noticeBtn, children: (0, jsx_runtime_1.jsx)(Copy, { style: st.noticeBtnText, children: "\uB2E4\uC2DC \uBD88\uB7EC\uC624\uAE30" }) }) : null] }) : null, message ? (0, jsx_runtime_1.jsx)(Copy, { accessibilityLiveRegion: "polite", style: st.message, children: message }) : null, pending ? (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: st.notice, children: [(0, jsx_runtime_1.jsx)(Copy, { style: st.noticeTitle, children: "\uAD11\uACE0 \uD655\uC778\uC744 \uAE30\uB2E4\uB9AC\uACE0 \uC788\uC5B4\uC694. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uD655\uC778\uD560\uAC8C\uC694" }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => { void claim(pending.id, pending.day, pending.purpose).catch(error); }, style: st.noticeBtn, children: (0, jsx_runtime_1.jsx)(Copy, { style: st.noticeBtnText, children: "\uBCF4\uC0C1 \uB2E4\uC2DC \uBC1B\uAE30" }) }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => setPending(null), hitSlop: 8, children: (0, jsx_runtime_1.jsx)(Copy, { style: st.link, children: "\uB2EB\uAE30" }) })] }) : null, (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: st.claimCard, children: [(0, jsx_runtime_1.jsxs)(Copy, { style: st.claimLeft, children: ["\uB0A8\uC740 \uD69F\uC218 ", (0, jsx_runtime_1.jsxs)(Copy, { style: st.claimLeftNum, children: [claimable.length, "\uBC88"] })] }), (0, jsx_runtime_1.jsxs)(Copy, { style: st.claimSub, children: ["1,000\uAC78\uC74C\uB9C8\uB2E4 \uAD11\uACE0 \uBCF4\uACE0 ", points, "P \u00B7 \uC624\uB298 \uBC1B\uC740 \uD3EC\uC778\uD2B8 ", state?.earned_today ?? 0, "P"] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { children: (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: t(busy ? '확인 중…' : `광고 보고 ${points}P 받기`) + t(', 광고가 열려요'), accessibilityState: { disabled: !first || busy !== null }, disabled: !first || busy !== null, onPress: () => { if (first)
                                            void open(first); }, style: ({ pressed }) => [st.claimBtn, (!first || busy !== null) && st.boxBtnOff, pressed && first && busy === null ? { opacity: 0.85, transform: [{ scale: 0.99 }] } : null], children: (0, jsx_runtime_1.jsx)(Copy, { style: [st.claimBtnText, (!first || busy !== null) && { color: C.primaryDeep ?? C.primary }], children: busy ? '확인 중…' : `광고 보고 ${points}P 받기` }) }) })] }), (0, jsx_runtime_1.jsx)(StepsYesterdayCard_1.StepsYesterdayCard, { state: yState, busy: busy !== null || !!pending, theme: C, onClaim: (stage) => { void open(stage, 'yesterday'); } }), !state ? (0, jsx_runtime_1.jsx)(Copy, { style: st.message, children: "\uBD88\uB7EC\uC624\uB294 \uC911\uC774\uC5D0\uC694" }) : null, adSlot, (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: st.guide, children: [(0, jsx_runtime_1.jsx)(Copy, { style: st.guideTitle, children: "\uB9CC\uBCF4\uAE30 \uC548\uB0B4\uC0AC\uD56D" }), ['꿀꿀캐시 만보기는 1,000걸음마다 광고 보기를 완료하면 포인트를 받아요.',
                                    '걸음 수와 남은 횟수는 매일 자정(한국 시간)에 새로 시작해요. 받지 못한 어제 몫은 오늘 자정까지 「어제 걸음」에서 받을 수 있고, 그 뒤에는 사라져요.',
                                    'Android 는 앱이 켜진 동안의 걸음을 기록하고, Health Connect 기록이 있으면 오늘 걸음도 불러와요. iPhone 은 동작 및 피트니스 기록에서 불러와요.',
                                    '배터리 절약 모드 등에서는 걸음 수가 정확하지 않을 수 있어요.',
                                    '만보기 보상과 조건은 사정에 따라 바뀔 수 있어요.'].map(line => (0, jsx_runtime_1.jsxs)(Copy, { style: st.guideLine, children: ["\u00B7 ", line] }, line))] })] })] }) });
}
const makeStyles = (C) => react_native_1.StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    header: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
    back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    backText: { fontSize: 32, color: C.text, marginTop: -4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: C.text },
    content: { paddingBottom: 40 },
    top: { alignItems: 'center', paddingTop: 12 },
    count: { fontSize: 44, fontWeight: '800', color: C.text },
    countUnit: { fontSize: 18, fontWeight: '600', color: C.sub },
    bubble: { marginTop: 14, backgroundColor: C.card, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18 },
    bubbleText: { fontSize: 15, color: C.text },
    bubbleTail: { width: 12, height: 12, backgroundColor: C.card, transform: [{ rotate: '45deg' }], marginTop: -6 },
    shoe: { fontSize: 96, marginTop: 4 },
    track: { marginTop: 8, marginHorizontal: 28, height: 22, justifyContent: 'center' },
    trackBase: { position: 'absolute', left: 10, right: 10, height: 8, borderRadius: 4, backgroundColor: C.line },
    trackFill: { position: 'absolute', left: 10, height: 8, borderRadius: 4, backgroundColor: C.carrot, maxWidth: '96%' },
    trackDots: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dot: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.card, borderWidth: 2, borderColor: C.dim, alignItems: 'center', justifyContent: 'center' },
    dotOn: { borderColor: C.carrot, backgroundColor: C.carrot },
    dotText: { fontSize: 10, fontWeight: '800', color: C.dim },
    dotTextOn: { color: C.onPrimary },
    notice: { marginTop: 16, marginHorizontal: 16, padding: 16, borderRadius: 16, backgroundColor: C.card, alignItems: 'center', gap: 8 },
    noticeTitle: { fontSize: 16, fontWeight: '700', color: C.text },
    noticeBtn: { paddingHorizontal: 16, paddingVertical: 8, minHeight: 48, borderRadius: 16, backgroundColor: C.carrot, alignItems: 'center', justifyContent: 'center' },
    noticeBtnText: { color: C.onPrimary, fontSize: 19, fontWeight: '800', textAlign: 'center' },
    link: { color: C.sub, fontSize: 14, textDecorationLine: 'underline' },
    message: { marginTop: 12, marginHorizontal: 16, textAlign: 'center', color: C.sub, fontSize: 14 },
    claimCard: { marginTop: 20, marginHorizontal: 16, padding: 20, borderRadius: C.radius, backgroundColor: C.card, alignItems: 'center', gap: 8 },
    claimLeft: { fontSize: 18, fontWeight: '700', color: C.text },
    claimLeftNum: { color: C.primaryDeep ?? C.primary, fontSize: 22, fontWeight: '800' },
    claimSub: { fontSize: 13, color: C.sub },
    claimBtn: { minHeight: 48, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16, backgroundColor: C.carrot, alignItems: 'center', justifyContent: 'center' },
    claimBtnText: { color: C.onPrimary, fontSize: 19, fontWeight: '800', textAlign: 'center' },
    grid: { marginTop: 20, paddingHorizontal: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
    box: { width: '31%', backgroundColor: C.card, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', gap: 6 },
    gift: { fontSize: 30 },
    giftDim: { opacity: 0.35 },
    boxLabel: { fontSize: 14, fontWeight: '700', color: C.text },
    boxLabelDim: { color: C.dim },
    boxBtn: { alignSelf: 'stretch', minHeight: 36, paddingVertical: 4, borderRadius: 10, backgroundColor: C.carrot, alignItems: 'center', justifyContent: 'center' },
    boxBtnOff: { backgroundColor: C.primarySoft },
    boxBtnDone: { backgroundColor: '#D3D7DD' },
    boxBtnText: { color: C.onPrimary, fontSize: 14, fontWeight: '700' },
    boxPoint: { fontSize: 12, color: C.sub },
    today: { marginTop: 12, marginHorizontal: 16, textAlign: 'center', color: C.sub, fontSize: 14 },
    guide: { marginTop: 20, padding: 20, backgroundColor: C.bgSoft ?? C.bg, gap: 6 },
    guideTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 4 },
    guideLine: { fontSize: 13.5, color: C.sub, lineHeight: 20 },
});
