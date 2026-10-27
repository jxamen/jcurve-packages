package kr.co.jcurve.offerwall;

import android.app.Activity;
import android.widget.FrameLayout;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.igaworks.adpopcorn.Adpopcorn;
import com.igaworks.adpopcorn.AdpopcornExtension;
import com.igaworks.adpopcorn.renewal.layout.web.ApRewardWebOfferWallLayout;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class JCurveOfferwallViewManager extends SimpleViewManager<JCurveOfferwallViewManager.Container> {
    @Override public String getName() { return "JCurveOfferwallView"; }
    @Override protected Container createViewInstance(ThemedReactContext context) { return new Container(context); }
    @ReactProp(name = "usn") public void setUsn(Container view, String usn) { view.setUsn(usn); }
    /** Optional: only these campaign keys are listed (SDK setFilterCampaignKeyList). Unset = the whole list, as before. */
    @ReactProp(name = "campaignKeys") public void setCampaignKeys(Container view, ReadableArray keys) {
        List<String> list = null;
        if (keys != null && keys.size() > 0) {
            list = new ArrayList<String>();
            for (int i = 0; i < keys.size(); i++) { String key = keys.getString(i); if (key != null && key.length() > 0) list.add(key); }
            if (list.isEmpty()) list = null;
        }
        view.setFilterKeys(list);
    }
    @Override public void onDropViewInstance(Container view) {
        view.dispose();
        super.onDropViewInstance(view);
    }
    @Override public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
        return MapBuilder.of("topLoaded", MapBuilder.of("registrationName", "onLoaded"));
    }
    static final class Container extends FrameLayout implements LifecycleEventListener {
        private final ThemedReactContext context;
        private ApRewardWebOfferWallLayout wall;
        private String usn;
        private List<String> filterKeys;
        Container(ThemedReactContext context) {
            super(context);
            this.context = context;
            setClipChildren(true);
            context.addLifecycleEventListener(this);
        }
        void setFilterKeys(List<String> keys) {
            if (keys == null ? filterKeys == null : keys.equals(filterKeys)) return;
            filterKeys = keys;
            if (wall != null) { release(); mount(); }
        }
        void setUsn(String value) {
            if (value != null && value.equals(usn)) return;
            release();
            usn = value;
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
            if (wall != null || !isAttachedToWindow() || getWidth() <= 0 || getHeight() <= 0 || activity == null
                || usn == null || !usn.matches("[a-f0-9]{64}")) return;
            Adpopcorn.setUserId(context, usn);
            com.facebook.react.bridge.NativeModule module = context.getNativeModule("RNAdPopcornRewardModule");
            if (module instanceof com.igaworks.adpopcorn.interfaces.IAdPOPcornEventListener) {
                Adpopcorn.setEventListener(context, (com.igaworks.adpopcorn.interfaces.IAdPOPcornEventListener) module);
            }
            wall = new ApRewardWebOfferWallLayout(activity);
            if (filterKeys != null) wall.setFilterCampaignKeyList(filterKeys);
            wall.setViewTypeEventListener(new ApRewardWebOfferWallLayout.IViewTypeEventListener() {
                @Override public void OnLoadedOfferwall() {
                    if (wall == null) return;
                    AdpopcornExtension.setOfferwallImpressions(context);
                    com.facebook.react.uimanager.events.EventDispatcher dispatcher =
                        com.facebook.react.uimanager.UIManagerHelper.getEventDispatcherForReactTag(context, getId());
                    if (dispatcher == null) return;
                    dispatcher.dispatchEvent(new com.facebook.react.uimanager.events.Event(
                            com.facebook.react.uimanager.UIManagerHelper.getSurfaceId(Container.this), getId()) {
                            @Override public String getEventName() { return "topLoaded"; }
                            @Override protected com.facebook.react.bridge.WritableMap getEventData() {
                                return com.facebook.react.bridge.Arguments.createMap();
                            }
                        });
                }
                @Override public void OnMeasuredOfferwallHeight(int height) { /* Parent owns the viewport. */ }
            });
            addView(wall, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT));
            AdpopcornExtension.setCustomWebOfferwallLayout(activity, wall);
            layoutWall();
            post(relayout);
        }
        /*
         | React Native never lays out children that native code adds (the SDK's ApRewardWebOfferWallLayout and
         | its WebView), so on Android the wall stayed 0x0 and the chance tab was blank (2026-10-19 A32 test).
         | Measure and place the wall ourselves on every layout pass and whenever the SDK asks for one.
         */
        private void layoutWall() {
            if (wall == null || getWidth() <= 0 || getHeight() <= 0) return;
            wall.measure(MeasureSpec.makeMeasureSpec(getWidth(), MeasureSpec.EXACTLY),
                    MeasureSpec.makeMeasureSpec(getHeight(), MeasureSpec.EXACTLY));
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
            wall.setViewTypeEventListener(null);
            removeView(wall); // SDK onDetachedFromWindow performs its cleanup.
            wall = null;
        }
        void dispose() { release(); context.removeLifecycleEventListener(this); }
        @Override public void onHostResume() { mount(); if (wall != null) wall.onResume(); }
        @Override public void onHostPause() {}
        @Override public void onHostDestroy() { release(); }
    }
}
