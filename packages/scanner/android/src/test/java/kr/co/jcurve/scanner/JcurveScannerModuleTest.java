package kr.co.jcurve.scanner;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import com.facebook.react.bridge.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import java.io.File;
import java.lang.reflect.Proxy;
import java.nio.file.Files;
import java.util.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28, shadows = JcurveScannerModuleTest.ArgumentsShadow.class)
public class JcurveScannerModuleTest {
  @Implements(Arguments.class)
  public static class ArgumentsShadow {
    @Implementation public static WritableMap createMap() { return new JavaOnlyMap(); }
    @Implementation public static WritableArray createArray() { return new JavaOnlyArray(); }
  }
  private JcurveScannerModule module;
  private ReactApplicationContext context;
  private Activity activity;
  private static class Result {
    Object value;
    boolean resolved;
    boolean rejected;
    Promise promise() {
      return (Promise) Proxy.newProxyInstance(Promise.class.getClassLoader(), new Class<?>[]{Promise.class},
        (proxy, method, args) -> {
          if (method.getName().equals("resolve")) { value = args[0]; resolved = true; }
          if (method.getName().equals("reject")) rejected = true;
          return null;
        });
    }
  }
  @Before public void setup() {
    activity = Robolectric.buildActivity(Activity.class).setup().get();
    context = new BridgeReactContext(RuntimeEnvironment.getApplication());
    context.onHostResume(activity);
    module = new JcurveScannerModule(context);
  }
  @After public void teardown() { module.invalidate(); }
  private String launch(Result result) {
    module.scanDocument(JavaOnlyMap.of("maxNumDocuments", 1), result.promise());
    Intent intent = Shadows.shadowOf(activity).getNextStartedActivity();
    assertNotNull(intent);
    return intent.getStringExtra("scanId");
  }
  private List<String> save(String id) throws Exception {
    File source = File.createTempFile("bridge", ".jpg", context.getCacheDir());
    Files.write(source.toPath(), new byte[]{1, 2, 3});
    return new PendingScanStore(context).save(id, Collections.singletonList(Uri.fromFile(source)));
  }
  @Test public void liveResultResolvesAndAckPreventsDuplicatePending() throws Exception {
    Result scan = new Result(); String id = launch(scan);
    List<String> uris = save(id);
    JcurveScannerModule.completed(id, uris);
    assertTrue(scan.resolved); assertFalse(scan.rejected);
    assertEquals("success", ((ReadableMap) scan.value).getString("status"));
    Result during = new Result(); module.getPendingScan(during.promise());
    assertTrue(during.resolved); assertNull(during.value);
    Result ack = new Result(); module.acknowledgeScan(id, ack.promise()); assertTrue(ack.resolved);
    Result after = new Result(); module.getPendingScan(after.promise());
    assertNull(after.value); assertTrue(after.resolved);
  }
  @Test public void bridgeRecreationRecoversExactlyOnce() throws Exception {
    Result scan = new Result(); String id = launch(scan); save(id);
    module.invalidate();
    module = new JcurveScannerModule(context);
    Result first = new Result(); module.getPendingScan(first.promise());
    assertTrue(first.resolved); assertFalse(first.rejected);
    assertEquals(1, ((ReadableMap) first.value).getArray("uris").size());
    Result second = new Result(); module.getPendingScan(second.promise());
    assertTrue(second.resolved); assertNull(second.value);
  }
  @Test public void cancellationResolvesNullStatusAndAllowsAnotherScan() {
    Result scan = new Result(); String id = launch(scan);
    JcurveScannerModule.cancelled(id);
    assertEquals("cancel", ((ReadableMap) scan.value).getString("status"));
    launch(new Result());
  }
  @Test public void releaseKeepsResultAvailableForRecovery() throws Exception {
    Result scan = new Result(); String id = launch(scan); save(id);
    module.releaseScan(id, new Result().promise());
    Result pending = new Result(); module.getPendingScan(pending.promise());
    assertEquals(1, ((ReadableMap) pending.value).getArray("uris").size());
    launch(new Result());
  }
}
