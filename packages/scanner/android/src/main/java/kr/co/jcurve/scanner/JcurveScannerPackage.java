package kr.co.jcurve.scanner;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.Collections;
import java.util.List;

public final class JcurveScannerPackage implements ReactPackage {
  @Override public List<NativeModule> createNativeModules(ReactApplicationContext context) {
    return Collections.singletonList(new JcurveScannerModule(context));
  }
  @Override public List<ViewManager> createViewManagers(ReactApplicationContext context) {
    return Collections.emptyList();
  }
}
