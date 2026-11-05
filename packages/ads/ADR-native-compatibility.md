# Android compiler and fullscreen compatibility — 2026-10-13

Status: 1.10.0 release preparation. This package, local commits and candidate tgz are not an official release or store submission.

## Observed failures and authority

The native verifier's RN 0.86.3 / RNGMA 16.5.0 stage pins Android GMA 25.4.0. Its GMA jar contains Kotlin metadata 2.3.0.
The RN Gradle plugin's version catalog pins KGP 2.1.20. Setting only `android.kotlinVersion=2.3.20` showed 2.3.20 in
ExpoRootProject and the GMA subproject buildEnvironment, but actual GMA `compileReleaseKotlin` still expected metadata 2.1.0 and failed.
The third diagnostic Release build added an explicit root KGP 2.3.20 dependency as well as the property and completed:
`BUILD SUCCESSFUL in 2m 9s`, 585 tasks. Gradle 9.3.1, AGP 8.12.0 and Expo-selected KSP 2.3.7 stayed unchanged.
No SDK source, metadata validation, native dependency version or original app was modified for that experiment.

Source evidence under Arcana's `.work/ads-live-20261013/native-verifier/`:

- `stage/withKotlinClasspath.cjs`, `stage/android/build.gradle`, `stage/android/gradle.properties`.
- `reports/gradle-android-kotlin2320.log` (property-only failure), `reports/gradle-android-kotlin-classpath.log` (Release success).
- `reports/gradle-kotlin-classpath.log`, `reports/sources-toolchain.md`.

`src/fixtures/native-root-gradle.groovy` and `native-gradle.properties` are verbatim copies of the successful third stage files.
The root fixture intentionally includes both its diagnostic explicit dependency and the template's unversioned dependency, so deduplication is tested.
Its derived baseline removes only the diagnostic explicit dependency/property and reproduces the original generated input.

The same native test-ad run showed an actual Google interstitial with `com.google.android.gms.ads.AdActivity` as top resumed Activity.
There was no explicit `cancel()` call. At 13:47:49.042Z AppState became background; at 13:47:49.047Z normal.play returned
`opened:false, noAd:false, cancelled:true`, and the public onOpened callback never ran. The SDK event's exact native timestamp was not instrumented;
the proven failure is a cancelled JS result during an actual native presentation.
Evidence: `reports/events-android-final.json`, `android-runtime-logcat-final.log`, `android-top-activity.txt`, `test.md` and `android-startup.png`.

[React Native AppState](https://reactnative.dev/docs/appstate) explicitly includes another Android Activity in background,
even when the app launched that Activity. This state cannot distinguish Google AdActivity from Home after `show()`.
RNGMA 16.5.0's Android `ReactNativeGoogleMobileAdsFullScreenAdModule.kt` maps `onAdShowedFullScreenContent` to OPENED
and `onAdDismissedFullScreenContent` to CLOSED. Its show Promise resolves immediately after `adHelper.show`, not on dismissal.
This version's Android delegate does not override `onAdFailedToShowFullScreenContent`; ERROR is emitted for load/null-Activity errors.
The JS layer cannot fabricate a native dismissal or repair missing SDK callbacks by releasing a possibly displayed ad.

## Central plugin decision

`app.plugin.js` always registers `kotlin.plugin.js`, including `mediation:false`.
It registers only an Android finalized mod. Expo runs finalized after the standard native file mods;
the plugin reads the final root Gradle and properties, validates both into a pure plan, then writes that pair.
It does not write iOS or introspection results and it does not rely on the app's build-properties plugin order.

Only the exact installed RNGMA **16.5.0** / Android GMA **25.4.0** combination is automatically handled.
Absent/unreadable SDK metadata or any other pair leaves Kotlin files untouched; no other 1.9 consumer's compiler is assumed.
Unrelated SDKs return before requiring the new finalized-mod API at registration, preserving older Expo consumers' existing plugin path.
The verified baseline is **2.3.20**. A stable explicit higher property, literal KGP dependency or literal kotlinVersion assignment
is preserved by selecting the highest value and aligning all supported selectors with it.
Only the observed lower **2.1.20** is automatically elevated. Other lower versions, beta/RC, dynamic ranges, references,
escaped/continued Kotlin property syntax, custom dependency closures, plugin aliases/Kotlin DSL and unknown root layouts require manual proof.
The plugin errors before changing either Kotlin file for unsupported inputs; it never silently substitutes a guessed compiler.

Root KGP duplicates become one explicit dependency; an existing unversioned dependency is replaced and other dependencies/comments remain.
Repeated plans are byte-identical. The pure helper is exported from the native plugin for tests only and is not a public runtime API.
Validation occurs before either write. A second-write failure attempts to restore the original property file; this is not a filesystem-wide transaction.
The no-mutation guarantee covers this compatibility step's two-file plan; it does not roll back unrelated Expo mods that ran earlier.

[Expo build-properties](https://docs.expo.dev/versions/latest/sdk/build-properties/) exposes `android.kotlinVersion` as a Kotlin override.
[Kotlin's table](https://kotlinlang.org/docs/gradle-configure-project.html) lists KGP 2.3.20–2.3.21 as fully supporting
Gradle 7.6.3–9.3.0 and AGP 8.2.2–9.0.0, while allowing newer versions with possible warnings/limitations.
The stage's Gradle 9.3.1 is beyond that fully supported maximum patch. The diagnostic success is empirical proof for that stage, not a wider compatibility claim.
Preserving a higher explicit compiler also does not assert support for the consumer's whole toolchain.

## Fullscreen and banner decision

Before native `show()`, both platforms still cancel genuine background transitions during consent, initialization or loading.
Once Android `show()` has started, background/inactive and active are not terminal authority: OPENED may reach JS after the Activity transition.
The shared normal/rewarded/rewarded-interstitial lease remains held until SDK CLOSED or an authoritative failure before OPENED.
Explicit JS cancel and the existing 15-second missing-OPENED timeout may settle UI feedback, but retain the pending native lease.
Late OPENED only tracks an already-settled native lifecycle; late/duplicate earned and close events cannot settle or grant again.
If the SDK never sends a terminal event, the unresolved native lease remains busy rather than allowing an overlapping fullscreen.

iOS keeps its existing AppState foreground-recovery policy as a compatibility decision, with separate regression coverage.
The Android test-ad evidence does not establish a changed iOS recovery rule. The default native environment reads RN Platform.OS;
only Android takes the new presentation rule, and unsupported runtimes remain unavailable through the existing public factories.

An internal SDK-wide lease observer collapses an enabled banner and invalidates its pending generation whenever a fullscreen lease starts.
Active before native close cannot recreate that banner. An actual ad lease release restores only a currently enabled, mounted foreground slot.
Unmount removes the observer; stale native banner callbacks cannot publish height.
Privacy uses a distinct lease reason: its form completion must not automatically request a banner. Privacy screens should continue setting banner enabled:false.
No full-screen ad is preloaded after close. Earned remains UI evidence; the server's SSV is the sole grant authority.

## Required evidence after this change

Producer tests/build, packed native plugin/fixtures/types and temporary mutant controls are local implementation evidence.
The separate verifier must check the final artifact using real Expo finalized ordering and an Android native test-ad run:
one OPENED callback, a completed result, concurrent rewarded busy, no premature banner request, and banner restoration after native close.
The old source `e9c5e3` and tgz SHA256 `e655763d5bea51dc39ffc7bdfb7ce9fa46771e88da350fe8d2c29124a4cbfbaa` remain historical artifacts.
The new candidate is packed under `nativecompat/candidate`; its exact source commit and hash are reported in the handoff.
Independent approval, official repository release, app installation, live ads, SSV and store review/public availability are distinct gates.
