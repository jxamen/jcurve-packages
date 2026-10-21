package kr.co.jcurve.scanner;

import android.content.Context;
import android.net.Uri;
import android.util.AtomicFile;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Durable journal. Metadata is consumed; returned image files remain usable by the app. */
final class PendingScanStore {
  private final Context context;
  private final File directory;
  private final AtomicFile journal;

  PendingScanStore(Context context) {
    this.context = context.getApplicationContext();
    directory = new File(context.getFilesDir(), "jcurve-scanner");
    journal = new AtomicFile(new File(directory, "pending.json"));
  }

  synchronized List<String> save(String id, List<Uri> sources) throws Exception {
    // All store instances share the class lock, including Activity and RN bridge.
    synchronized (PendingScanStore.class) {
      JSONArray records = read();
      for (int i = 0; i < records.length(); i++) {
        JSONObject record = records.getJSONObject(i);
        if (id.equals(record.getString("id"))) return strings(record.getJSONArray("uris"));
      }
      if (sources.isEmpty()) throw new IOException("Scanner returned no images");
      ensureDirectory();
      List<File> created = new ArrayList<>();
      JSONArray uris = new JSONArray();
      try {
        for (Uri source : sources) {
          File file = File.createTempFile("scan-", ".jpg", directory);
          created.add(file);
          try (InputStream input = context.getContentResolver().openInputStream(source);
               FileOutputStream output = new FileOutputStream(file)) {
            if (input == null) throw new IOException("Cannot open scanned image");
            byte[] buffer = new byte[32768];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            output.getFD().sync();
          }
          uris.put(Uri.fromFile(file).toString());
        }
        JSONObject record = new JSONObject();
        record.put("id", id);
        record.put("uris", uris);
        records.put(record);
        write(records);
        return strings(uris);
      } catch (Exception error) {
        for (File file : created) file.delete();
        throw error;
      }
    }
  }

  List<String> take(String excludedId) throws Exception {
    synchronized (PendingScanStore.class) {
      JSONArray records = read();
      JSONArray remaining = new JSONArray();
      List<String> result = new ArrayList<>();
      for (int i = 0; i < records.length(); i++) {
        JSONObject record = records.getJSONObject(i);
        if (record.getString("id").equals(excludedId)) remaining.put(record);
        else result.addAll(strings(record.getJSONArray("uris")));
      }
      if (!result.isEmpty()) write(remaining);
      return result;
    }
  }

  void acknowledge(String id) throws Exception {
    synchronized (PendingScanStore.class) {
      JSONArray records = read();
      JSONArray remaining = new JSONArray();
      for (int i = 0; i < records.length(); i++) {
        JSONObject record = records.getJSONObject(i);
        if (!id.equals(record.getString("id"))) remaining.put(record);
      }
      write(remaining);
    }
  }

  private JSONArray read() throws Exception {
    try (InputStream input = journal.openRead(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      byte[] buffer = new byte[8192];
      int count;
      while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
      return new JSONArray(new String(output.toByteArray(), StandardCharsets.UTF_8));
    } catch (FileNotFoundException missing) {
      return new JSONArray();
    }
  }

  private void ensureDirectory() throws IOException {
    if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Cannot create scan storage");
  }

  private void write(JSONArray records) throws Exception {
    ensureDirectory();
    FileOutputStream output = journal.startWrite();
    try {
      output.write(records.toString().getBytes(StandardCharsets.UTF_8));
      journal.finishWrite(output);
    } catch (Exception error) {
      journal.failWrite(output);
      throw error;
    }
  }

  private static List<String> strings(JSONArray array) throws Exception {
    List<String> result = new ArrayList<>();
    for (int i = 0; i < array.length(); i++) result.add(array.getString(i));
    return result;
  }
}
