# @jcurve/scanner

리워드 앱이 **같이 쓰는 문서 스캐너**. 영수증·서류를 찍으면 **테두리를 잡아 자르고 반듯하게 편**
사진 파일을 준다. 영테크(영수증)와 총무님(회비 영수증)에서 쓰던 호출을 합쳐 떼어 냈다.

| 기기 | 부품 |
|---|---|
| 안드로이드 | 구글 ML Kit 문서 스캐너 — **Play 서비스 화면**이다. 앱 권한이 필요 없고, Play 서비스 업데이트로 좋아진다 |
| 아이폰 | VisionKit — 앱의 카메라 권한이 필요하다 |
| 웹 | 없다 — `scanner_unavailable`. 앱이 일반 카메라를 쓴다 |

화면은 없다. 버튼·안내·일반 촬영 화면은 앱마다 그린다.

---

## 1. ⚠ 네이티브 모듈이다 — 새 스토어 빌드가 있어야 한다

이 패키지 자체는 JS 뿐이지만, 속에서 부르는 `react-native-document-scanner-plugin` 은 **네이티브 모듈**이다.
**OTA 로는 들어가지 않는다.** 처음 붙이는 앱은 새 스토어 빌드를 내야 한다.

- 네이티브가 없는 옛 빌드에 OTA 로 이 코드만 가면 **앱이 죽지 않고** `scanner_unavailable` 을 던진다(지연 `require`).
  그러니 일반 촬영으로 넘어가는 길은 **늘** 둔다.
- 이미 `react-native-document-scanner-plugin` **2.0.4** 가 든 스토어 빌드가 나가 있는 앱(영테크는 1.0.2(vc3) 부터 —
  총무님은 §6 의 확인 1 로 본다)은 이 패키지로 바꾸는 것이 **JS 만의 변경이라 OTA 로 된다.** 플러그인 판을 바꾸면 다시 스토어 빌드다.

## 2. 설치

```bash
npm i https://github.com/jxamen/jcurve-packages/releases/download/scanner-v1.0.0/jcurve-scanner-1.0.0.tgz
npx expo install react-native-document-scanner-plugin@2.0.4 expo-image-picker
```

`app.json` 의 `plugins` 에 넣는다 — 아이폰 카메라 권한 문구(`NSCameraUsageDescription`)를 만든다.

```json
["react-native-document-scanner-plugin", { "cameraPermission": "영수증을 찍고 모양을 바로잡기 위해 카메라를 사용해요." }]
```

`expo-image-picker` 는 아이폰 권한을 먼저 묻는 데 쓴다(없으면 VisionKit 이 스스로 묻지만, 거절하면 검은 화면이 된다).
일반 촬영(스캐너가 안 열릴 때)에도 어차피 필요하다.

## 3. 권한 — 아이폰만 묻는다

패키지가 알아서 한다. **안드로이드에서는 묻지 않는다.** 안드로이드 스캐너는 구글 Play 서비스 화면이라
앱 권한이 필요 없고, 앱이 먼저 물었다가 사용자가 「이번만 허용」을 고르면 **스캐너가 떠 있는 동안 권한이
거둬져 앱이 죽고 찍은 사진을 잃었다**(2026-09-22 총무님, 갤럭시 A32).
**앱에서 스캐너 앞에 카메라 권한을 따로 묻지 마라.** 일반 촬영으로 넘어갈 때만 묻는다.

## 4. 쓰는 법

```ts
import { scanDocument, scannerMessage, ScannerError } from '@jcurve/scanner';

async function scan() {
  try {
    const pages = await scanDocument({ maxPages: 1 });   // 취소하면 null
    if (!pages) return;
    use(pages[0]);                                       // 'file:///…/scan.jpg'
  } catch (e) {
    const err = e as ScannerError;
    say(scannerMessage(err.code));
    if (err.code === 'scanner_permission' && !err.canAskAgain) showOpenSettings();
    if (err.code === 'scanner_unavailable' || err.code === 'scanner_failed') showPlainCameraButton();
  }
}
```

### 옵션

| 이름 | 기본 | 뜻 |
|---|---|---|
| `maxPages` | `1` | 받을 장 수. 안드로이드는 여기서 막는다. **아이폰 VisionKit 은 못 막는다** |
| `quality` | `90` | 잘라 낸 사진의 JPEG 품질(0~100) |
| `extraPages` | `'reject'` | 아이폰에서 `maxPages` 를 넘겼을 때. `'reject'` = `scanner_multiple_pages` 로 다시 찍게 한다(영테크 — 한 장에 한 건). `'keep'` = 다 주고 앱이 잘라 쓰며 「N장까지」를 알린다(총무님 — 찍은 것을 잃지 않게). **어느 쪽도 조용히 버리지 않는다** |

### 돌려주는 것

- 성공: `string[]` — 찍은 순서대로 **파일 주소**(`file://…`, JPEG). 잘리고 원근이 펴진 사진이다.
- 취소: `null`.
- 실패: `ScannerError` 를 던진다. `code` 로 가르고, `message` 도 코드와 같다(`e.message === 'scanner_multiple_pages'` 로 가르던 코드가 그대로 된다).

| `code` | 언제 | 앱이 할 일 |
|---|---|---|
| `scanner_unavailable` | 웹 · 네이티브가 없는 빌드 | 일반 촬영 |
| `scanner_permission` | 아이폰 카메라 거절 (`canAskAgain` 이 거짓이면 설정으로) | 안내 |
| `scanner_multiple_pages` | 아이폰에서 장 수를 넘김(`extraPages: 'reject'`) | 다시 찍게 |
| `scanner_empty` | 성공이라는데 사진이 없음 | 다시 · 일반 촬영 |
| `scanner_failed` | 스캐너가 안 열림 — 구글 모듈을 아직 못 받았거나 기기가 안 된다. 원래 오류는 `cause` | 일반 촬영 |

`scannerMessage(code, maxPages?)` 가 사용자 문구를 준다.

### 안드로이드 처음 한 번

구글 스캐너 모듈은 **처음 열 때 Play 서비스가 내려받는다.** 그동안 잠깐 걸리거나, 네트워크가 없으면 `scanner_failed` 가 난다.
총무님은 안드로이드 첫 사용에 안내 화면을 한 번 띄운다(`cm.scanIntro`) — 필요하면 앱이 그린다.

## 5. OCR 과 잇기 (`@jcurve/ocr`)

스캐너는 사진 파일만 준다. OCR 에 넘기기 전에 **`preparePhoto` 를 거친다** — 1600 으로 줄이고 방향을 굽는다.
스캐너 사진은 크고(기기에 따라 4000px 넘음) 그대로 올리면 서버와 맥이 버티지 못한다.

```ts
import { scanDocument } from '@jcurve/scanner';
import { preparePhoto, verdictMessage } from '@jcurve/ocr';
import { ocr } from '../ocr';   // createOcr({ post, get })

const pages = await scanDocument({ maxPages: 1 });
if (pages) {
  const photo = await preparePhoto({ uri: pages[0] });
  const result = await ocr.read(photo);           // 10~15초 — 화면을 막지 마라(@jcurve/ocr README)
  say(verdictMessage(result));
}
```

## 6. 옮기기 — 이미 플러그인을 직접 쓰는 앱

| 앱 | 지금 | 바꿀 것 |
|---|---|---|
| 영테크 | `src/receipt/scanner.ts` 가 직접 호출, 한 장. **안드로이드에서도 권한을 먼저 묻는다**(`ReceiptSheet.tsx`) | `scanDocument({ maxPages: 1 })` 로 바꾸고, 스캐너 앞의 `requestCameraPermissionsAsync` 를 **아이폰만**으로(§3). 뒤의 `Image.getSize` · `prepareReceiptImage` 는 그대로 |
| 총무님 | `RecordScreen.tsx` 가 직접 호출, 여러 장, 아이폰만 권한 | `scanDocument({ maxPages: maxShots, extraPages: 'keep' })` — 지금처럼 앱의 `take()` 가 잘라 쓴다. 권한 묻는 줄은 지운다(패키지가 한다) |

**옮겨도 되는지 확인**:
1. 그 앱의 **스토어에 나가 있는 빌드**에 `react-native-document-scanner-plugin` **2.0.4** 가 들어 있는가 — `package.json` 과 `app.json` 의 `plugins` 를 그 빌드 커밋에서 본다. 들어 있으면 OTA 로 되고, 없거나 판이 다르면 스토어 빌드가 필요하다.
2. 앱의 스캐너 시험(영테크 `scanner.test.ts`)을 패키지 호출로 바꿔 그대로 통과하는가 — 한 장 · 취소 · 여러 장 거절 · 빈 결과 · 네이티브 오류 · 웹.
3. 실폰: 안드로이드에서 권한 창 **없이** 스캐너가 뜨는가, 아이폰에서 권한 창 → 스캐너가 뜨는가, 취소 · 일반 촬영으로 넘어가기가 되는가.

## 7. 새 판 내기

```
cd packages/scanner && npx tsc -p tsconfig.json && npx vitest run && npm pack
gh release create scanner-v<버전> jcurve-scanner-<버전>.tgz --repo jxamen/jcurve-packages
```

`dist/` 는 커밋한다 — `src/dist.test.ts` 가 소스와 같은지 본다.
