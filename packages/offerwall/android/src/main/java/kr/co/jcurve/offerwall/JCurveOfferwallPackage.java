package kr.co.jcurve.offerwall;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class JCurveOfferwallPackage implements ReactPackage {
    @Override public List<NativeModule> createNativeModules(ReactApplicationContext context) {
        return Collections.<NativeModule>singletonList(new JCurveOfferwallModule(context));
    }
    @Override public List<ViewManager> createViewManagers(ReactApplicationContext context) {
        List<ViewManager> managers = new ArrayList<ViewManager>();
        managers.add(new JCurveOfferwallViewManager());
        // 0.6.0: the SnapPlay screen as a view — only when the app has the SnapPlay SDK (react-native-s2offerwall); otherwise the JS side falls back to the modal.
        if (snapPlaySdkPresent()) managers.add(new JCurveSnapPlayViewManager());
        return managers;
    }
    private static boolean snapPlaySdkPresent() {
        try { Class.forName("s2.adapi.sdk.offerwall.S2OfferwallView"); return true; } catch (Throwable ignored) { return false; }
    }
}
