package kr.co.jcurve.offerwall;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableMapKeySetIterator;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.igaworks.adpopcorn.Adpopcorn;
import com.igaworks.adpopcorn.AdpopcornExtension;
import com.igaworks.adpopcorn.interfaces.IAPBridgeRewardInfoCallbackListener;
import com.igaworks.adpopcorn.interfaces.IAPCampaignDetailPageEventListener;
import com.igaworks.adpopcorn.interfaces.IAPRewardInfoCallbackListener;
import com.igaworks.adpopcorn.interfaces.IAdPopcornParticipateEventListener;
import com.igaworks.adpopcorn.nativead.custom.AdPopcornRewardCustomNativeAd;
import com.igaworks.adpopcorn.nativead.custom.AdPopcornRewardCustomNativeEventListener;
import com.igaworks.adpopcorn.nativead.custom.ApCustomReward;
import com.igaworks.adpopcorn.nativead.custom.ApCustomRewardCPM;
import com.igaworks.adpopcorn.nativead.custom.ApCustomRewardCPMEventListener;
import com.igaworks.adpopcorn.nativead.custom.ApCustomRewardEventListener;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.List;

/**
 * JS bridge for the AdPopcorn SDK features that react-native-adpopcorn-reward 1.0.0 does not expose (SDK 9.2.6).
 *
 * Two rules keep this safe to write without compiling it here and to run in every app:
 * - SDK callbacks are implemented with java.lang.reflect.Proxy, so the code never depends on the exact method
 *   signatures of the SDK's listener interfaces (it matches on method names and reads arguments by position).
 * - Every call is wrapped: a missing class, a changed SDK or an exception rejects the promise with E_UNSUPPORTED /
 *   E_FAILED instead of crashing. JS treats any rejection as "fall back to the plain list".
 */
public final class JCurveOfferwallModule extends ReactContextBaseJavaModule {
    private static final String EVENT = "JCurveOfferwallEvent";
    private final Handler main = new Handler(Looper.getMainLooper());
    private ApCustomReward customReward;
    private AdPopcornRewardCustomNativeAd customNativeAd;
    private ApCustomRewardCPM customCpm;

    public JCurveOfferwallModule(ReactApplicationContext context) { super(context); }

    @Override public String getName() { return "JCurveOfferwallModule"; }

    /** RN's NativeEventEmitter calls these two; nothing to do. */
    @ReactMethod public void addListener(String eventName) { }
    @ReactMethod public void removeListeners(double count) { }

    // ---- helpers -------------------------------------------------------------------------------------------

    private interface Callback { void call(String method, Object[] args); }
    private interface Task { void run(Activity activity) throws Throwable; }

    /** Settles a promise once; later calls (timeouts, duplicate SDK callbacks) are ignored. */
    private static final class Once {
        private final Promise promise;
        private boolean done;
        Once(Promise promise) { this.promise = promise; }
        synchronized void resolve(Object value) { if (done) return; done = true; promise.resolve(value); }
        synchronized void reject(String code, String message) { if (done) return; done = true; promise.reject(code, message); }
    }

    @SuppressWarnings("unchecked")
    private static <T> T listener(Class<T> type, final Callback callback) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] { type }, new InvocationHandler() {
            @Override public Object invoke(Object proxy, Method method, Object[] args) {
                String name = method.getName();
                if (method.getDeclaringClass() == Object.class) {
                    if ("equals".equals(name)) return args != null && args.length > 0 && proxy == args[0];
                    if ("hashCode".equals(name)) return System.identityHashCode(proxy);
                    return "JCurveOfferwallListener";
                }
                try { callback.call(name, args == null ? new Object[0] : args); } catch (Throwable ignored) { }
                return defaultFor(method.getReturnType());
            }
        });
    }

    private static Object defaultFor(Class<?> type) {
        if (!type.isPrimitive() || type == void.class) return null;
        if (type == boolean.class) return Boolean.FALSE;
        if (type == char.class) return Character.valueOf('\0');
        if (type == byte.class) return Byte.valueOf((byte) 0);
        if (type == short.class) return Short.valueOf((short) 0);
        if (type == int.class) return Integer.valueOf(0);
        if (type == long.class) return Long.valueOf(0L);
        if (type == float.class) return Float.valueOf(0f);
        return Double.valueOf(0d);
    }

    /** Runs on the UI thread with the current Activity; any failure rejects instead of throwing. */
    private void ui(final Once once, final Task task) {
        UiThreadUtil.runOnUiThread(new Runnable() {
            @Override public void run() {
                try {
                    Activity activity = getReactApplicationContext().getCurrentActivity();
                    if (activity == null) { once.reject("E_NO_ACTIVITY", "no foreground activity"); return; }
                    task.run(activity);
                } catch (LinkageError e) {
                    once.reject("E_UNSUPPORTED", "SDK does not provide this: " + e);
                } catch (Throwable t) {
                    once.reject("E_FAILED", String.valueOf(t));
                }
            }
        });
    }

    private void timeout(final Once once, long ms, final Object value) {
        main.postDelayed(new Runnable() { @Override public void run() { once.resolve(value); } }, ms);
    }

    private void emit(String type, WritableMap body) {
        try {
            WritableMap map = body == null ? Arguments.createMap() : body;
            map.putString("type", type);
            getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit(EVENT, map);
        } catch (Throwable ignored) { }
    }

    private static String str(Object[] args, int i) { return args.length > i && args[i] != null ? String.valueOf(args[i]) : ""; }
    private static boolean bool(Object[] args, int i) { return args.length > i && Boolean.TRUE.equals(args[i]); }
    private static int num(Object[] args, int i) { return args.length > i && args[i] instanceof Number ? ((Number) args[i]).intValue() : 0; }

    /** All public no-argument getters of an SDK model as strings / numbers: campaignKey, title, reward ... */
    private static WritableMap dump(Object model) {
        WritableMap map = Arguments.createMap();
        if (model == null) return map;
        for (Method m : model.getClass().getMethods()) {
            String n = m.getName();
            if (m.getParameterTypes().length != 0 || !n.startsWith("get") || n.length() < 4 || "getClass".equals(n)) continue;
            try {
                Object v = m.invoke(model);
                String key = Character.toLowerCase(n.charAt(3)) + n.substring(4);
                if (v == null) map.putNull(key);
                else if (v instanceof Boolean) map.putBoolean(key, ((Boolean) v).booleanValue());
                else if (v instanceof Integer) map.putInt(key, ((Integer) v).intValue());
                else if (v instanceof Number) map.putDouble(key, ((Number) v).doubleValue());
                else map.putString(key, String.valueOf(v));
            } catch (Throwable ignored) { }
        }
        return map;
    }

    private static WritableArray dumpList(Object list) {
        WritableArray out = Arguments.createArray();
        if (list instanceof List) for (Object item : (List<?>) list) out.pushMap(dump(item));
        return out;
    }

    private static String describeError(Object error) {
        WritableMap m = dump(error);
        return error == null ? "unknown" : (m.hasKey("errorCode") ? "code " + m.getInt("errorCode") + ": " : "") + (m.hasKey("errorMessage") ? m.getString("errorMessage") : error.toString());
    }

    // ---- campaign detail / participation ---------------------------------------------------------------------

    /** Opens one campaign's detail page. true = the SDK opened it, false = it refused or nothing happened in 8 s. */
    @ReactMethod public void openCampaignDetail(final String campaignKey, Promise promise) {
        final Once once = new Once(promise);
        if (campaignKey == null || campaignKey.length() == 0) { once.resolve(Boolean.FALSE); return; }
        ui(once, new Task() { @Override public void run(Activity activity) {
            Adpopcorn.openCampaignDetailPage(activity, campaignKey, listener(IAPCampaignDetailPageEventListener.class, new Callback() {
                @Override public void call(String method, Object[] args) {
                    if ("OnOpenSuccess".equals(method)) once.resolve(Boolean.TRUE);
                    else if ("OnOpenFailed".equals(method)) once.resolve(Boolean.FALSE);
                    else if ("OnClosed".equals(method)) emit("detailClosed", null);
                }
            }));
            timeout(once, 8000, Boolean.FALSE);
        } });
    }

    /** SDK-side participation attempt: { success, code, message, landingUrl }. */
    @ReactMethod public void tryParticipateCampaign(final String campaignKey, Promise promise) {
        final Once once = new Once(promise);
        ui(once, new Task() { @Override public void run(Activity activity) {
            AdpopcornExtension.tryParticipateCampaign(activity, campaignKey, listener(IAdPopcornParticipateEventListener.class, new Callback() {
                @Override public void call(String method, Object[] args) {
                    if (!"OnParticipateResult".equals(method)) return;
                    WritableMap map = Arguments.createMap();
                    map.putBoolean("success", bool(args, 0));
                    map.putInt("code", num(args, 1));
                    map.putString("message", str(args, 2));
                    map.putString("landingUrl", str(args, 3));
                    once.resolve(map);
                }
            }));
            timeout(once, 10000, null);
        } });
    }

    // ---- custom reward lists (our own UI) -----------------------------------------------------------------------

    private void destroyCustomReward() { try { if (customReward != null) customReward.destroy(); } catch (Throwable ignored) { } customReward = null; }
    private void destroyCustomNativeAd() { try { if (customNativeAd != null) customNativeAd.destroy(); } catch (Throwable ignored) { } customNativeAd = null; }
    private void destroyCustomCpm() { try { if (customCpm != null) customCpm.destroy(); } catch (Throwable ignored) { } customCpm = null; }

    /** Campaigns the SDK can open right now: [{ campaignKey, title, description, reward, iconImageURL, mainImageURL }]. */
    @ReactMethod public void loadCustomCampaigns(final int max, Promise promise) {
        final Once once = new Once(promise);
        ui(once, new Task() { @Override public void run(Activity activity) {
            destroyCustomReward();
            ApCustomReward reward = new ApCustomReward(activity);
            customReward = reward;
            if (max > 0) reward.setMaxCampaignCount(max);
            reward.setCustomRewardEventListener(listener(ApCustomRewardEventListener.class, new Callback() {
                @Override public void call(String method, Object[] args) {
                    if ("onCustomRewardLoadSuccess".equals(method)) once.resolve(dumpList(args.length > 0 ? args[0] : null));
                    else if ("onCustomRewardLoadFailed".equals(method)) once.reject("E_LOAD_FAILED", describeError(args.length > 0 ? args[0] : null));
                }
            }));
            reward.loadAd();
            timeout(once, 10000, Arguments.createArray());
        } });
    }

    /** Participates in a campaign of the last loaded custom list. */
    @ReactMethod public void clickCustomCampaign(final String campaignKey, Promise promise) {
        final Once once = new Once(promise);
        ui(once, new Task() { @Override public void run(Activity activity) {
            if (customReward == null) { once.resolve(Boolean.FALSE); return; }
            customReward.clickCampaign(campaignKey);
            once.resolve(Boolean.TRUE);
        } });
    }

    @ReactMethod public void destroyCustomCampaigns(Promise promise) {
        final Once once = new Once(promise);
        ui(once, new Task() { @Override public void run(Activity activity) { destroyCustomReward(); once.resolve(Boolean.TRUE); } });
    }

    /** Custom native ad of a placement configured in the AdPopcorn console: [{ nativeCampaignId, title, reward, cta ... }]. */
    @ReactMethod public void loadCustomNativeAds(final String placementId, Promise promise) {
        final Once once = new Once(promise);
        ui(once, new Task() { @Override public void run(Activity activity) {
            destroyCustomNativeAd();
            AdPopcornRewardCustomNativeAd ad = new AdPopcornRewardCustomNativeAd(activity);
            customNativeAd = ad;
            ad.setPlacementId(placementId);
            ad.setCustomWebNativeEventListener(listener(AdPopcornRewardCustomNativeEventListener.class, new Callback() {
                @Override public void call(String method, Object[] args) {
                    if ("onCustomNativeLoadSuccess".equals(method)) once.resolve(dumpList(args.length > 0 ? args[0] : null));
                    else if ("onCustomNativeLoadFailed".equals(method)) once.reject("E_LOAD_FAILED", describeError(args.length > 0 ? args[0] : null));
                    else if ("onCustomNativeClickSuccess".equals(method)) emit("customNativeClickSuccess", null);
                    else if ("onCustomNativeFailedEvent".equals(method)) emit("customNativeFailed", null);
                    else if ("onCustomNativeCompleted".equals(method)) emit("customNativeCompleted", null);
                }
            }));
            ad.loadAd();
            timeout(once, 10000, Arguments.createArray());
        } });
    }

    @ReactMethod public void impressionCustomNativeAd(final String nativeCampaignId, Promise promise) {
        final Once once = new Once(promise);
        ui(once, new Task() { @Override public void run(Activity activity) {
            if (customNativeAd == null) { once.resolve(Boolean.FALSE); return; }
            customNativeAd.impressionCampaign(nativeCampaignId);
            once.resolve(Boolean.TRUE);
        } });
    }

    @ReactMethod public void clickCustomNativeAd(final String nativeCampaignId, Promise promise) {
        final Once once = new Once(promise);
        ui(once, new Task() { @Override public void run(Activity activity) {
            if (customNativeAd == null) { once.resolve(Boolean.FALSE); return; }
            customNativeAd.clickCampaign(nativeCampaignId);
            once.resolve(Boolean.TRUE);
        } });
    }

    @ReactMethod public void completeCustomNativeAd(Promise promise) {
        final Once once = new Once(promise);
        ui(once, new Task() { @Override public void run(Activity activity) {
            if (customNativeAd == null) { once.resolve(Boolean.FALSE); return; }
            customNativeAd.completeSelectedCampaign();
            once.resolve(Boolean.TRUE);
        } });
    }

    /** CPM-type custom list: [{ id, title, description, condition, cta, reward, imageURL }]. */
    @ReactMethod public void loadCustomCpm(final int max, Promise promise) {
        final Once once = new Once(promise);
        ui(once, new Task() { @Override public void run(Activity activity) {
            destroyCustomCpm();
            ApCustomRewardCPM cpm = new ApCustomRewardCPM(activity);
            customCpm = cpm;
            if (max > 0) cpm.setMaxCampaignCount(max);
            cpm.setCustomRewardCPMEventListener(listener(ApCustomRewardCPMEventListener.class, new Callback() {
                @Override public void call(String method, Object[] args) {
                    if ("onCustomRewardCPMLoadSuccess".equals(method)) once.resolve(dumpList(args.length > 0 ? args[0] : null));
                    else if ("onCustomRewardCPMLoadFailed".equals(method)) once.reject("E_LOAD_FAILED", describeError(args.length > 0 ? args[0] : null));
                    else if ("onCustomRewardCPMClickSuccess".equals(method)) emit("customCpmClickSuccess", null);
                    else if ("onCustomRewardCPMClickFailed".equals(method)) emit("customCpmClickFailed", null);
                    else if ("onCustomRewardCPMCompleted".equals(method)) emit("customCpmCompleted", null);
                }
            }));
            cpm.loadAd();
            timeout(once, 10000, Arguments.createArray());
        } });
    }

    @ReactMethod public void impressionCustomCpm(final String id, Promise promise) {
        final Once once = new Once(promise);
        ui(once, new Task() { @Override public void run(Activity activity) {
            if (customCpm == null) { once.resolve(Boolean.FALSE); return; }
            customCpm.impressionCampaign(id);
            once.resolve(Boolean.TRUE);
        } });
    }

    @ReactMethod public void clickCustomCpm(final String id, Promise promise) {
        final Once once = new Once(promise);
        ui(once, new Task() { @Override public void run(Activity activity) {
            if (customCpm == null) { once.resolve(Boolean.FALSE); return; }
            customCpm.clickCampaign(id);
            once.resolve(Boolean.TRUE);
        } });
    }

    // ---- reward totals -----------------------------------------------------------------------------------------

    /** { queryResult, totalCount, totalReward } for the earnable offerwall campaigns. */
    @ReactMethod public void getEarnableTotalRewardInfo(Promise promise) {
        final Once once = new Once(promise);
        ui(once, new Task() { @Override public void run(Activity activity) {
            AdpopcornExtension.getEarnableTotalRewardInfo(activity, listener(IAPRewardInfoCallbackListener.class, new Callback() {
                @Override public void call(String method, Object[] args) {
                    if (!"OnEarnableTotalRewardInfo".equals(method)) return;
                    WritableMap map = Arguments.createMap();
                    map.putBoolean("queryResult", bool(args, 0));
                    map.putInt("totalCount", num(args, 1));
                    map.putString("totalReward", str(args, 2));
                    once.resolve(map);
                }
            }));
            timeout(once, 10000, null);
        } });
    }

    /** { queryResult, totalCount, totalReward, bridgePlacementId } for one bridge placement. */
    @ReactMethod public void getBridgeTotalRewardInfo(final String bridgePlacementId, Promise promise) {
        final Once once = new Once(promise);
        ui(once, new Task() { @Override public void run(Activity activity) {
            AdpopcornExtension.getBridgeTotalRewardInfo(activity, bridgePlacementId, listener(IAPBridgeRewardInfoCallbackListener.class, new Callback() {
                @Override public void call(String method, Object[] args) {
                    if (!"bridgeTotalRewardInfo".equals(method)) return;
                    WritableMap map = Arguments.createMap();
                    map.putBoolean("queryResult", bool(args, 0));
                    map.putInt("totalCount", num(args, 1));
                    map.putString("totalReward", str(args, 2));
                    map.putString("bridgePlacementId", str(args, 3));
                    once.resolve(map);
                }
            }));
            timeout(once, 10000, null);
        } });
    }

    // ---- settings and small helpers --------------------------------------------------------------------------------

    /** Offerwall (full screen) with the user filters set first. Filters are { key: value } strings from the AdPopcorn contract. */
    @ReactMethod public void openOfferwallWithFilter(final ReadableMap filters, Promise promise) {
        final Once once = new Once(promise);
        ui(once, new Task() { @Override public void run(Activity activity) {
            if (filters != null) {
                ReadableMapKeySetIterator it = filters.keySetIterator();
                while (it.hasNextKey()) {
                    String key = it.nextKey();
                    String value = filters.getString(key);
                    if (value != null) AdpopcornExtension.setUserFilter(activity, key, value);
                }
            }
            Adpopcorn.openOfferwall(activity);
            once.resolve(Boolean.TRUE);
        } });
    }

    @ReactMethod public void setUserAgreement(final boolean agreed, Promise promise) {
        final Once once = new Once(promise);
        ui(once, new Task() { @Override public void run(Activity activity) { AdpopcornExtension.setUserAgreement(activity, agreed); once.resolve(Boolean.TRUE); } });
    }

    @ReactMethod public void useFlagShowWhenLocked(final boolean enabled, Promise promise) {
        final Once once = new Once(promise);
        ui(once, new Task() { @Override public void run(Activity activity) { AdpopcornExtension.useFlagShowWhenLocked(activity, enabled); once.resolve(Boolean.TRUE); } });
    }

    /** Puts text on the clipboard (the app has no clipboard module of its own). */
    @ReactMethod public void setClipboard(final String text, Promise promise) {
        final Once once = new Once(promise);
        ui(once, new Task() { @Override public void run(Activity activity) {
            ClipboardManager manager = (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
            if (manager == null) { once.resolve(Boolean.FALSE); return; }
            manager.setPrimaryClip(ClipData.newPlainText("text", text == null ? "" : text));
            once.resolve(Boolean.TRUE);
        } });
    }

    /** What this build can do, so JS can tell a missing feature from a failure. */
    @ReactMethod public void getCapabilities(Promise promise) {
        WritableMap map = Arguments.createMap();
        map.putString("platform", "android");
        map.putString("sdk", "9.2.6");
        map.putInt("bridge", 1);
        WritableArray methods = Arguments.createArray();
        String[] names = {
            "openCampaignDetail", "tryParticipateCampaign", "loadCustomCampaigns", "clickCustomCampaign", "destroyCustomCampaigns",
            "loadCustomNativeAds", "impressionCustomNativeAd", "clickCustomNativeAd", "completeCustomNativeAd",
            "loadCustomCpm", "impressionCustomCpm", "clickCustomCpm", "getEarnableTotalRewardInfo", "getBridgeTotalRewardInfo",
            "openOfferwallWithFilter", "setUserAgreement", "useFlagShowWhenLocked", "setClipboard", "viewFilterCampaignKeys"
        };
        for (String name : names) methods.pushString(name);
        map.putArray("methods", methods);
        promise.resolve(map);
    }
}
