package kr.co.jcurve.scanner;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.widget.*;
import java.io.File;
import java.util.*;

public class FixtureActivity extends Activity {
  private TextView status;
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    LinearLayout layout = new LinearLayout(this); layout.setOrientation(LinearLayout.VERTICAL); layout.setPadding(0, 180, 0, 0);
    Button button = new Button(this); button.setText("Start scan");
    status = new TextView(this); status.setText("Ready");
    button.setOnClickListener(v -> startActivity(new Intent(this, ScanActivity.class)
      .putExtra("scanId", UUID.randomUUID().toString()).putExtra("maxPages", 3)));
    layout.addView(button); layout.addView(status); setContentView(layout);
  }
  @Override public void onResume() {
    super.onResume();
    try {
      List<String> uris = new PendingScanStore(this).take(null);
      if (!uris.isEmpty()) {
        boolean readable = true;
        for (String uri : uris) readable &= new File(Uri.parse(uri).getPath()).length() > 0;
        boolean consumed = new PendingScanStore(this).take(null).isEmpty();
        String result = "RECOVERED count=" + uris.size() + " readable=" + readable + " secondEmpty=" + consumed;
        status.setText(result);
        Log.i("ScannerRecoveryTest", result);
      }
    } catch (Exception error) { status.setText(error.toString()); Log.e("ScannerRecoveryTest", "failed", error); }
  }
}
