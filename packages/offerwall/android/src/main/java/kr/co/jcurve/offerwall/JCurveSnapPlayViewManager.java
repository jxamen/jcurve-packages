package kr.co.jcurve.offerwall;

import android.app.Activity;
import android.widget.FrameLayout;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.uimanager.events.Event;
import com.facebook.react.uimanager.events.EventDispatcher;
import java.util.Map;
import s2.adapi.sdk.offerwall.S2Offerwall;
import s2.adapi.sdk.offerwall.S2OfferwallView;

/**
 * 0.6.0 — SnapPlay's own offerwall screen (`S2OfferwallView`) as a React Native view, so the 「찬스2」 tab can show it inside the tab instead of the full-screen modal
 * `react-native-s2offerwall` opens. Registered by JCurveOfferwallPackage only when the SnapPlay SDK classes are in the app (compileOnly dependency).
 * The JS side initializes the SDK and sets the user first (snapPlay.ts `prepare`); this view only loads the placement.
 */
public final class JCurveSnapPlayViewManager extends SimpleViewManager<JCurveSnapPlayViewManager.Container> {
    private static final int PERMISSION_REQUEST = 4721;

    @Override public String getName() { return "JCurveSnapPlayView"; }
    @Override protected Container createViewInstance(ThemedReactContext context) { return new Container(context); }
    @ReactProp(name = "placement") public void setPlacement(Container view, String placement) { view.setPlacement(placement); }
    @Override public void onDropViewInstance(Container view) {
        view.dispose();
        super.onDropViewInstance(view);
    }
    @Override public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
        return MapBuilder.<String, Object>builder()
            .put("topLoginRequested", MapBuilder.of("registrationName", "onLoginRequested"))
            .put("topCloseRequested", MapBuilder.of("registrationName", "onCloseRequested"))
            .build();
    }

    static final class Container extends FrameLayout {
        private final ThemedReactContext context;
        private S2OfferwallView wall;
        private String placement;
        Container(ThemedReactContext context) {
            super(context);
            this.context = context;
            setClipChildren(true);
        }
        void setPlacement(String value) {
            if (value == null || value.length() == 0 || value.equals(placement)) return;
            release();
            placement = value;
            mount();
        }
        @Override protected void onAttachedToWindow() { super.onAttachedToWindow(); mount(); }
        @Override protected void onDetachedFromWindow() { release(); super.onDetachedFromWindow(); }
        @Override protected void onSizeChanged(int w, int h, int oldw, int oldh) {
            super.onSizeChanged(w, h, oldw, oldh);
            mount();
        }
        private void mount() {
            Activity activity = context.getCurrentActivity();
            if (wall != null || !isAttachedToWindow() || getWidth() <= 0 || getHeight() <= 0 || activity == null || placement == null) return;
            S2OfferwallView view = new S2OfferwallView(activity, null);
            view.setEventListener(new S2Offerwall.EventListener() {
                @Override public void onLoginRequested(String param) { emit("topLoginRequested"); }
                @Override public void onCloseRequested(String param) { emit("topCloseRequested"); }
                @Override public void onPermissionRequested(String permission) {
                    Activity current = context.getCurrentActivity();
                    if (current != null && permission != null) current.requestPermissions(new String[] { permission }, PERMISSION_REQUEST);
                }
            });
            wall = view;
            addView(view, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT));
            view.load(placement);
            layoutWall();
            post(relayout);
        }
        // raw Event on purpose: the same shape as JCurveOfferwallViewManager's onLoaded event, which is known to compile against the app's React Native
        @SuppressWarnings({"rawtypes", "unchecked"})
        private void emit(final String name) {
            EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag(context, getId());
            if (dispatcher == null) return;
            dispatcher.dispatchEvent(new Event(UIManagerHelper.getSurfaceId(Container.this), getId()) {
                @Override public String getEventName() { return name; }
                @Override protected WritableMap getEventData() { return Arguments.createMap(); }
            });
        }
        /*
         | React Native never lays out children that native code adds (the same thing that left the AdPopcorn wall 0x0 on Android, 2026-10-19):
         | measure and place the SDK view ourselves on every layout pass.
         */
        private void layoutWall() {
            if (wall == null || getWidth() <= 0 || getHeight() <= 0) return;
            wall.measure(MeasureSpec.makeMeasureSpec(getWidth(), MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(getHeight(), MeasureSpec.EXACTLY));
            wall.layout(0, 0, getWidth(), getHeight());
        }
        @Override protected void onLayout(boolean changed, int l, int t, int r, int b) {
            super.onLayout(changed, l, t, r, b);
            layoutWall();
        }
        private final Runnable relayout = this::layoutWall;
        @Override public void requestLayout() {
            super.requestLayout();
            removeCallbacks(relayout);
            post(relayout);
        }
        private void release() {
            if (wall == null) return;
            removeAllViews();
            wall = null;
        }
        void dispose() { release(); }
    }
}
