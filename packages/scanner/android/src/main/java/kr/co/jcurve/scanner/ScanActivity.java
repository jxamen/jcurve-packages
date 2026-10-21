package kr.co.jcurve.scanner;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import com.google.mlkit.vision.documentscanner.*;
import java.util.ArrayList;
import java.util.List;

/**
 * Android restores this Activity as the result recipient after process death.
 * Its onActivityResult never depends on a JS call, React bridge or a dynamic registry key.
 */
public final class ScanActivity extends Activity {
  static final int REQUEST_SCAN = 41873;
  private boolean launched;
  private String scanId;

  @Override protected void onCreate(Bundle state) {
    super.onCreate(state);
    scanId = getIntent().getStringExtra("scanId");
    if (scanId == null) { finish(); return; }
    launched = state != null && state.getBoolean("launched");
    if (launched) return;
    GmsDocumentScannerOptions options = new GmsDocumentScannerOptions.Builder()
      .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
      .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
      .setPageLimit(Math.max(1, getIntent().getIntExtra("maxPages", 1)))
      .build();
    GmsDocumentScanning.getClient(options).getStartScanIntent(this)
      .addOnSuccessListener(this, sender -> {
        try {
          launched = true;
          startIntentSenderForResult(sender, REQUEST_SCAN, null, 0, 0, 0);
        } catch (Exception error) { fail(error); }
      })
      .addOnFailureListener(this, this::fail);
  }

  @Override protected void onSaveInstanceState(Bundle state) {
    state.putBoolean("launched", launched);
    super.onSaveInstanceState(state);
  }

  @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode != REQUEST_SCAN) return;
    try {
      if (resultCode == RESULT_OK) {
        GmsDocumentScanningResult result = GmsDocumentScanningResult.fromActivityResultIntent(data);
        if (result == null || result.getPages() == null) throw new IllegalStateException("Scanner returned no images");
        List<Uri> sources = new ArrayList<>();
        for (GmsDocumentScanningResult.Page page : result.getPages()) sources.add(page.getImageUri());
        // Commit images and metadata BEFORE finishing/resuming the host or resolving JS.
        List<String> uris = new PendingScanStore(this).save(scanId, sources);
        JcurveScannerModule.completed(scanId, uris);
      } else if (resultCode == RESULT_CANCELED) {
        JcurveScannerModule.cancelled(scanId);
      } else {
        throw new IllegalStateException("Unexpected scanner result: " + resultCode);
      }
    } catch (Exception error) {
      Log.e("JcurveScanner", "Could not preserve scan result", error);
      JcurveScannerModule.failed(scanId, error);
    } finally { finish(); }
  }

  private void fail(Exception error) {
    Log.e("JcurveScanner", "Could not open scanner", error);
    JcurveScannerModule.failed(scanId, error);
    finish();
  }
}
