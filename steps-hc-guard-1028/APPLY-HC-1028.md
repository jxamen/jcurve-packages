# 헬스 커넥트 권한 창 크래시 보강 — JS(OTA) + 네이티브(다음 빌드) 한 장

**배경**: Play 품질 모니터링(10/28 19:08) 상위 오류 「HealthConnectPermissionDelegate NullPointerException」(머니트리 vc14 = 1.0.9 AAB · 감자밭 vc35 = 1.1.5, Samsung · Android 16/API 36, 걷기 권한 창을 열 때 앱 꺼짐). **스택트레이스(앱관리 전달)로 원인이 확정됐다**: `View.dispatchCancelPendingInputEvents()` on null ← `ViewGroup.dispatchCancelPendingInputEvents` ← `Activity.cancelInputsAndStartExitTransition` ← `startActivityForResult` ← `ActivityResultLauncher.launch` ← **`HealthConnectPermissionDelegate.launchPermissionsDialog(:45)`** ← `HealthConnectManager$requestPermission$1$1.invokeSuspend(:72)` ← `CoroutineScheduler` — 즉 라이브러리(4.1.3)가 권한 창 `launch` 를 **메인이 아닌 IO 코루틴 스레드**에서 불러, 화면 전환 중 뷰 계층(자식이 null 이 되는 순간)과 겹쳐 터진다(우리가 읽은 소스의 :45 `requestPermission.launch(permissions)` 와 :72 호출 줄이 스택의 줄 번호와 일치). JS 호출 순서(`getSdkStatus` → `initialize` → `requestPermission`)는 이미 맞았고, **동시 호출만 막혀 있지 않았다**. 그래서 **본수정은 네이티브(②, 메인 스레드 launch + try/catch)** 이고, ① JS 는 겹칠 기회를 줄이는 보강(OTA 로 먼저)이다.

## ① JS — 요청 한 번에 하나(single-flight), OTA 가능 (`@jcurve/steps` 최소 보강판 2개)
| 앱 | 지금 | 새 판 | sha256 | integrity (sha512) |
|---|---|---|---|---|
| 머니트리 · 감자밭 · 용돈캡슐(iOS 1.0.6 · 안드 1.0.6/1.0.8) — 운영 맨 위가 steps 0.3.0 | 0.3.0 | `jcurve-steps-0.3.0-hc1.tgz` | `5ce4a8aba4894a45491635301e2ebbda6ccef5de2cf2f4400510c7e8b06d73e6` | `sha512-fSvyqYCLBUecXf1GlJ5XGMDtetzu0VZwvEgTK3vNt9uyI86MmwlMc3d10oiQMSAIN69QocuzjU4erV8vOWxBkg==` |
| 영테크 (iOS 2차 a0506b20 기준 steps 0.3.1; 10-28 앱보조5 확인) | 0.3.1 | `jcurve-steps-0.3.1-hc1.tgz` | `b7dcf3a58d42b3f053ee1aa70476c6251da5007ee5015fa566c2fb1d11c18dd1` | `sha512-K4G3nmOpc4/rKVKVNqWfPzuX4KZkooVKbGCawgt4Dp7RLIYLVXe4I/lri7ew0afF/An4cydm0awdIrJtcNZUdw==` |
| (현재 쓰는 줄 없음 — 옛 steps 0.1.1 기준이 남아 있는 줄이 생길 때만) | 0.1.1 | `jcurve-steps-0.1.1-hc1.tgz` | `a940928df297d66109309d49c9c62365beb16c23477f93d817cce2793562ce45` | `sha512-rQg+gfZIDK7d/Oq4ebh3VeQLzH5D05O8/tILRyWzlaPj72IV+JbAytR3S+TI50yvXQPFr70OI4yQTUTioLSUCw==` |

(해시는 파일에서 계산한 값 — 락은 `npm install` 이 만든 값을 쓰고 손으로 적지 말 것.) 두 판 모두 받은 vendored tgz 에서 **`requestStepsPermission` 한 함수만** 바꾼 것(`src/source.ts` · `dist/source.js` · `package.json` 버전 `-hc1`; 정확한 차이는 `steps-0.1.1-hc1.diff` · `steps-0.3.0-hc1.diff`, 각 63줄). 이미 요청이 진행 중이면 뒤에 온 호출은 새 네이티브 요청을 하지 않고 같은 결과를 기다린다(설명 창도 한 번만). 네이티브 권한 창을 부르기 직전에는 **앱이 앞에 올 때까지(최대 0.8초) · 화면 전환(`InteractionManager.runAfterInteractions`)이 끝날 때까지(최대 0.6초) 기다린다**(못 기다려도 요청은 계속). 이 JS 는 스택의 경쟁을 **줄일 뿐 없애지 못한다** — 라이브러리가 다른 스레드에서 launch 하는 한 위험은 남고, 그 줄을 고치는 것이 ②다. 시그니처·반환값·그 밖의 동작은 그대로. 홈 걷기 행 + 걷기 화면 + 미션처럼 여러 곳에서 불러도 앱 코드는 안 바뀐다.
**붙이는 법**: `package.json` 의 `@jcurve/steps` → `file:vendor/jcurve-steps-<새 판>.tgz`, 락 `file:` 주소·버전·integrity, 옛 tgz 삭제(vendorGuard 시험이 있으면 시험도), 그리고 앱 JS 가 바뀌므로 **OTA 로 먼저 나가면 된다**(네이티브 변경 없음; 안드로이드 런타임 기존 버전에 JS 만).
**시험**: `node verify-single-flight.cjs <풀어 둔 package 폴더>` — 가짜 `react-native` · `react-native-health-connect` 로 「동시 3번 → 네이티브 요청 1번, 설명 1번, 끝난 뒤 새 요청은 가능, 앱이 백그라운드면 앞에 올 때까지 네이티브 요청 안 함, 설명 거절은 막히지 않음」 확인. 새 판 두 개 모두 통과, **원래 감자밭 0.3.0 은 같은 시험에서 실패**(요청 3번)해서 시험이 구분함을 확인.

## ② 네이티브 — `react-native-health-connect+4.1.3.patch` (patch-package, 다음 스토어 빌드에 같이)
**무엇을 바꾸나** (Kotlin 2파일, 74줄 — 스택의 :45 가 바로 `launch` 줄이다): `HealthConnectPermissionDelegate.launchPermissionsDialog`/`launchExerciseRouteAccessRequestDialog` — ① 런처가 등록 안 된 상태면 `lateinit` 접근 대신 이유가 있는 `IllegalStateException`(`check(::requestPermission.isInitialized)`), ② `launch` 를 메인 스레드(`withContext(Dispatchers.Main)`; 라이브러리가 이미 `kotlinx-coroutines-android` 를 가지고 있음)에서 호출. `HealthConnectManager.requestPermission`/`requestExerciseRoute` — 코루틴 본문을 try/catch 로 감싸 예외를 `promise.rejectWithException` 으로 돌려준다 → 앱이 죽는 대신 JS 에서 거절로 보이고 위 `requestStepsPermission` 의 기존 catch 가 센서로 넘어간다. (reject 코드: 런처 미등록은 `SERVICE_UNAVAILABLE`.)
**붙이는 법** (앱마다, 10앱 새 빌드 한 번에):
1. `react-native-health-connect` 를 **정확히 4.1.3** 으로(`^4.1.3` → `4.1.3`; 패치 파일 이름이 버전에 묶여 있어 다른 판이 깔리면 안 맞는다).
2. `npm i -D patch-package` 하고 `package.json` scripts 에 `"postinstall": "patch-package"` (이미 `postinstall` 이 있으면 `"기존 명령 && patch-package"` — 이 PC 에서 본 것은 캐시팡팡에 있음).
3. 이 폴더의 `react-native-health-connect+4.1.3.patch` 를 앱 루트 `patches/` 에 복사.
4. `npm ci` 뒤 확인: `grep -c "jcurve patch" node_modules/react-native-health-connect/android/src/main/java/dev/matinzd/healthconnect/permissions/HealthConnectPermissionDelegate.kt` → 2 (패치 적용됨). EAS/로컬 빌드 모두 `npm ci` 의 postinstall 로 적용된다.
**검증 상태(솔직히)**: 패치는 4.1.3 원본에 `git apply --check` 로 깨끗이 적용됨을 확인했다. **Kotlin 컴파일은 이 PC 에 컴파일러가 없어 못 했다** — 첫 안드로이드 빌드가 확인한다. 컴파일이 안 되면 `patches/` 의 파일만 빼면 원래대로 돌아간다. 이 패치는 스택이 가리킨 줄(메인 스레드가 아닌 곳에서의 `launch`)을 직접 고치므로 이 크래시를 없앨 것으로 보지만, **실기기(삼성 Android 16)에서 권한 창을 열어 보기 전에는 고쳐졌다고 말하지 않는다.**

## 고친 뒤 볼 것
삼성 · Android 16 기기에서 홈의 걷기 행을 **빠르게 두 번** 눌러 권한 창이 한 번만 뜨는지, 화면 전환 직후에 눌러도 앱이 안 꺼지는지, Play 의 같은 크래시 클러스터가 다음 빌드 뒤 줄어드는지. (같은 라이브러리를 쓰는 다른 앱도 같은 스레드 문제를 가진다 — 이 PC 의 main 에서는 에그머니가 `react-native-health-connect` 를 직접 쓴다.)


## 정정 기록 (10/28 저녁)
처음 표에는 머니트리를 「steps 0.1.1」로 적었으나 그것은 오래된 체크아웃 기준이었다. 앱보조4·6 이 운영 맨 위를 확인해, 머니트리 · 감자밭 · 용돈캡슐(iOS 1.0.6 · 안드 1.0.6/1.0.8)은 모두 steps **0.3.0** 이라 `0.3.0-hc1` 을 쓴다(머니트리 안드 1.0.9 `fed27657` · 1.0.10 `2c16460c` · 감자밭 안드 1.1.5 `adfb4982` 후보). 용돈캡슐 옛 3줄(iOS 1.0.4 · 안드 1.0.5/1.0.4)은 `react-native-health-connect` 의존 자체가 없어 해당 없음. 네이티브 패치(②)는 안드로이드에서 `react-native-health-connect` 가 들어 있는 줄에만.

## 영테크 (steps 0.3.1) 추가 — 10/28 밤
영테크는 `react-native-health-connect ^4.1.3` + `@jcurve/steps` **0.3.1**(앱보조5 확인)이라 `0.3.1-hc1` 을 따로 만들었다: 영테크가 실제로 vendor 한 `jcurve-steps-0.3.1.tgz`(영테크 `a0506b20` 안의 파일, sha256 `2da6eef4…3b83`)에 0.3.0-hc1 과 **같은 함수 본문**(`requestStepsPermission` 한 곳 — 0.3.0 과 0.3.1 의 이 함수는 글자까지 같았다)을 넣었다. 바뀐 파일 `src/source.ts` · `dist/source.js` · `package.json` 셋(`steps-0.3.1-hc1.diff`). `verify-single-flight.cjs` 통과, 원본 0.3.1 은 같은 시험에서 실패(요청 3번). 네이티브 패치(②)는 영테크도 동일(`react-native-health-connect` 를 정확히 4.1.3 으로 + patch-package).
