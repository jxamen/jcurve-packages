package kr.co.jcurve.scanner;

import android.content.Context;
import android.net.Uri;
import org.robolectric.RuntimeEnvironment;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
public class PendingScanStoreTest {
  private Context context;
  private Uri source(String value) throws Exception {
    File file = File.createTempFile("input", ".jpg", context.getCacheDir());
    Files.write(file.toPath(), value.getBytes("UTF-8"));
    return Uri.fromFile(file);
  }
  @Before public void setup() { context = RuntimeEnvironment.getApplication(); }

  @Test public void survivesNewStoreAndConsumesOnceWithoutDeletingImages() throws Exception {
    Uri input = source("jpeg bytes");
    List<String> saved = new PendingScanStore(context).save("one", Collections.singletonList(input));
    new File(input.getPath()).delete(); // GMS temp URI is gone.
    List<String> recovered = new PendingScanStore(context).take(null);
    assertEquals(saved, recovered);
    assertEquals("jpeg bytes", new String(Files.readAllBytes(new File(Uri.parse(recovered.get(0)).getPath()).toPath()), "UTF-8"));
    assertTrue(new PendingScanStore(context).take(null).isEmpty());
  }

  @Test public void keepsPageOrderAndUnconsumedOlderScans() throws Exception {
    PendingScanStore store = new PendingScanStore(context);
    List<String> first = store.save("first", Arrays.asList(source("1"), source("2")));
    List<String> second = store.save("second", Collections.singletonList(source("3")));
    List<String> expected = new ArrayList<>(first); expected.addAll(second);
    assertEquals(expected, store.take(null));
  }

  @Test public void liveResultIsExcludedAndAcknowledgmentOnlyRemovesItsRecord() throws Exception {
    PendingScanStore store = new PendingScanStore(context);
    List<String> old = store.save("old", Collections.singletonList(source("old")));
    store.save("active", Collections.singletonList(source("active")));
    assertEquals(old, store.take("active"));
    store.acknowledge("active");
    assertTrue(store.take(null).isEmpty());
  }

  @Test public void failedCopyDoesNotEraseExistingPendingResult() throws Exception {
    PendingScanStore store = new PendingScanStore(context);
    List<String> old = store.save("old", Collections.singletonList(source("old")));
    try {
      store.save("bad", Arrays.asList(source("partial"), Uri.fromFile(new File(context.getCacheDir(), "missing.jpg"))));
      fail("copy must fail");
    } catch (FileNotFoundException expected) {}
    assertEquals(old, store.take(null));
    File[] images = new File(context.getFilesDir(), "jcurve-scanner").listFiles((dir, name) -> name.endsWith(".jpg"));
    assertEquals(1, images.length);
  }

  @Test public void repeatedResultDoesNotDuplicateImages() throws Exception {
    PendingScanStore store = new PendingScanStore(context);
    Uri input = source("one");
    List<String> saved = store.save("same", Collections.singletonList(input));
    assertEquals(saved, store.save("same", Collections.singletonList(input)));
    assertEquals(saved, store.take(null));
  }

  @Test public void concurrentConsumersReturnResultExactlyOnce() throws Exception {
    new PendingScanStore(context).save("one", Collections.singletonList(source("one")));
    ExecutorService executor = Executors.newFixedThreadPool(2);
    try {
      Future<List<String>> a = executor.submit(() -> new PendingScanStore(context).take(null));
      Future<List<String>> b = executor.submit(() -> new PendingScanStore(context).take(null));
      assertEquals(1, a.get().size() + b.get().size());
    } finally { executor.shutdownNow(); }
  }

  @Test public void corruptJournalIsNotSilentlyDiscarded() throws Exception {
    File dir = new File(context.getFilesDir(), "jcurve-scanner"); dir.mkdirs();
    File file = new File(dir, "pending.json"); Files.write(file.toPath(), "broken".getBytes("UTF-8"));
    try { new PendingScanStore(context).take(null); fail("must report corruption"); }
    catch (org.json.JSONException expected) {}
    assertEquals("broken", new String(Files.readAllBytes(file.toPath()), "UTF-8"));
  }
}
