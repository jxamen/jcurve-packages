# Android native checks

With JDK 17, Android SDK 35 and Gradle 8.13 installed:

```sh
cd packages/scanner/android-test
gradle :scanner:testDebugUnitTest :scanner:assembleRelease
```

The standalone harness pins React Native 0.79.6 for the baseline native bridge compile.
The consumer app supplies its own React Native and Android Gradle plugin versions.
Robolectric tests exercise durable copies, read-once results, ordering, acknowledgment,
concurrent consumers and failed writes. They do not replace a real GMS process-death test.

Device scenario (use a rebuilt Android host with @jcurve/scanner 1.0.1):
1. Launch scanDocument(), take a page, leave GMS DocumentScanningActivity in front.
2. Run `adb shell am kill <host.package>`; verify `adb shell pidof <host.package>` is empty.
3. In GMS tap Apply, then Next/Done. After host restart, call getPendingScan() on startup.
4. Verify every returned file opens, then verify the next call returns null.
5. Verify ordinary scanDocument() and cancel do not leave duplicate pending results.
Use `am kill`, not force-stop. The latter intentionally stops delivery to the application.

## Verified 2026-10-21 (KST)

- TypeScript/Vitest: 23 passed, including committed dist parity.
- Robolectric: 14 passed (storage 7, recreated Activity 3, RN bridge 4).
- Android library release build and standalone fixture debug APK: passed.
- Android 15/API 35 Google Play arm64 emulator, real GMS DocumentScanningActivity:
  host PID 5133 -> am kill -> no PID -> capture -> Apply -> Done -> new PID 5668.
  Result: RECOVERED count=1 readable=true secondEmpty=true. Copied JPEG: 18,253 bytes.
- The device fixture uses the same ScanActivity/PendingScanStore as production;
  JavaScript/React Native result delivery is covered separately by unit tests.
  Galaxy A23/A32 hardware and a rebuilt Saimcash app were not tested or modified.

Build/run the fixture with `gradle :app:assembleDebug`, then install
`app/build/outputs/apk/debug/app-debug.apk`. Package: `kr.co.jcurve.scanner.fixture`.
