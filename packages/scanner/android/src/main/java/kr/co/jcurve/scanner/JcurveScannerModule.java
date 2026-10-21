package kr.co.jcurve.scanner;

import android.app.Activity;
import android.content.Intent;
import com.facebook.react.bridge.*;
import java.util.List;
import java.util.UUID;

/** Android-only module. ScanActivity receives results even when this bridge does not exist. */
public final class JcurveScannerModule extends ReactContextBaseJavaModule {
  private static Call active;
  private static final class Call {
    final String id;
    final Promise promise;
    final JcurveScannerModule owner;
    Call(String id, Promise promise, JcurveScannerModule owner) {
      this.id = id; this.promise = promise; this.owner = owner;
    }
  }
  public JcurveScannerModule(ReactApplicationContext context) { super(context); }
  @Override public String getName() { return "JcurveScanner"; }

  @ReactMethod public void scanDocument(ReadableMap options, Promise promise) {
    Activity activity = getReactApplicationContext().getCurrentActivity();
    if (activity == null) { promise.reject("scanner_failed", "No foreground activity"); return; }
    final String id = UUID.randomUUID().toString();
    synchronized (JcurveScannerModule.class) {
      if (active != null) { promise.reject("scanner_failed", "A scan is already in progress"); return; }
      active = new Call(id, promise, this);
    }
    Intent intent = new Intent(activity, ScanActivity.class);
    intent.putExtra("scanId", id);
    intent.putExtra("maxPages", options.hasKey("maxNumDocuments") ? options.getInt("maxNumDocuments") : 1);
    // The upstream Android file-path mode also returns ML Kit JPEGs without recompression.
    activity.runOnUiThread(() -> {
      try { activity.startActivity(intent); }
      catch (Exception error) { failed(id, error); }
    });
  }

  @ReactMethod public void getPendingScan(Promise promise) {
    try {
      synchronized (JcurveScannerModule.class) {
        List<String> uris = new PendingScanStore(getReactApplicationContext()).take(active == null ? null : active.id);
        if (uris.isEmpty()) promise.resolve(null);
        else {
          WritableMap result = Arguments.createMap();
          result.putArray("uris", array(uris));
          promise.resolve(result);
        }
      }
    } catch (Exception error) { promise.reject("scanner_failed", error); }
  }

  private static WritableArray array(List<String> uris) {
    WritableArray result = Arguments.createArray();
    for (String uri : uris) result.pushString(uri);
    return result;
  }

  @ReactMethod public void releaseScan(String id, Promise promise) {
    synchronized (JcurveScannerModule.class) {
      if (active != null && active.id.equals(id)) active = null;
    }
    promise.resolve(null);
  }

  @ReactMethod public void acknowledgeScan(String id, Promise promise) {
    try {
      synchronized (JcurveScannerModule.class) {
        new PendingScanStore(getReactApplicationContext()).acknowledge(id);
        if (active != null && active.id.equals(id)) active = null;
      }
      promise.resolve(null);
    } catch (Exception error) {
      synchronized (JcurveScannerModule.class) {
        if (active != null && active.id.equals(id)) active = null;
      }
      promise.reject("scanner_failed", error);
    }
  }

  static synchronized void completed(String id, List<String> uris) {
    if (active == null || !active.id.equals(id)) return;
    WritableMap result = Arguments.createMap();
    result.putString("status", "success");
    result.putString("_pendingScanId", id);
    result.putArray("scannedImages", array(uris));
    active.promise.resolve(result);
    // Keep the journal until JS has actually received and validated this result.
  }

  static synchronized void cancelled(String id) {
    if (active == null || !active.id.equals(id)) return;
    WritableMap result = Arguments.createMap();
    result.putString("status", "cancel");
    active.promise.resolve(result);
    active = null;
  }

  static synchronized void failed(String id, Exception error) {
    if (active == null || !active.id.equals(id)) return;
    active.promise.reject("scanner_failed", error);
    active = null;
  }

  @Override public void invalidate() {
    synchronized (JcurveScannerModule.class) {
      if (active != null && active.owner == this) active = null;
    }
    super.invalidate();
  }
}
