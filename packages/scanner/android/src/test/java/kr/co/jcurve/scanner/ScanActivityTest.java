package kr.co.jcurve.scanner;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Parcel;
import org.robolectric.RuntimeEnvironment;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.*;
import java.io.File;
import java.nio.file.Files;
import java.util.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28, shadows = ScanActivityTest.ResultShadow.class)
public class ScanActivityTest {
  @Implements(GmsDocumentScanningResult.class)
  public static class ResultShadow {
    static GmsDocumentScanningResult result;
    @Implementation public static GmsDocumentScanningResult fromActivityResultIntent(Intent data) { return result; }
  }

  private ScanActivity restored() {
    Intent intent = new Intent(RuntimeEnvironment.getApplication(), ScanActivity.class).putExtra("scanId", "restored");
    Bundle state = new Bundle(); state.putBoolean("launched", true);
    // No React module and no JS scanDocument call in this process.
    return Robolectric.buildActivity(ScanActivity.class, intent).create(state).start().resume().get();
  }

  @Test public void restoredActivitySavesResultWithoutReactBridge() throws Exception {
    ScanActivity activity = restored();
    File source = File.createTempFile("gms", ".jpg", activity.getCacheDir());
    Files.write(source.toPath(), "recovered image".getBytes("UTF-8"));
    GmsDocumentScanningResult.Page page = new GmsDocumentScanningResult.Page() {
      @Override public Uri getImageUri() { return Uri.fromFile(source); }
      @Override public String zza() { return ""; }
      @Override public int describeContents() { return 0; }
      @Override public void writeToParcel(Parcel dest, int flags) {}
    };
    ResultShadow.result = new GmsDocumentScanningResult() {
      @Override public List<Page> getPages() { return Collections.singletonList(page); }
      @Override public Pdf getPdf() { return null; }
      @Override public int describeContents() { return 0; }
      @Override public void writeToParcel(Parcel dest, int flags) {}
    };
    activity.onActivityResult(ScanActivity.REQUEST_SCAN, Activity.RESULT_OK, new Intent());
    assertTrue(activity.isFinishing());
    source.delete();
    List<String> pending = new PendingScanStore(activity).take(null);
    assertEquals(1, pending.size());
    assertEquals("recovered image", new String(Files.readAllBytes(new File(Uri.parse(pending.get(0)).getPath()).toPath()), "UTF-8"));
    assertTrue(new PendingScanStore(activity).take(null).isEmpty());
  }

  @Test public void restoredCancellationLeavesExistingPendingResultAlone() throws Exception {
    ScanActivity activity = restored();
    File source = File.createTempFile("gms", ".jpg", activity.getCacheDir());
    Files.write(source.toPath(), new byte[] {1});
    List<String> saved = new PendingScanStore(activity).save("older", Collections.singletonList(Uri.fromFile(source)));
    activity.onActivityResult(ScanActivity.REQUEST_SCAN, Activity.RESULT_CANCELED, null);
    assertTrue(activity.isFinishing());
    assertEquals(saved, new PendingScanStore(activity).take(null));
  }

  @Test public void unrelatedActivityResultDoesNotFinishOrConsume() throws Exception {
    ScanActivity activity = restored();
    activity.onActivityResult(100, Activity.RESULT_OK, new Intent());
    assertFalse(activity.isFinishing());
    assertTrue(new PendingScanStore(activity).take(null).isEmpty());
  }
}
