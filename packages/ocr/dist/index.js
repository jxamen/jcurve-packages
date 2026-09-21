"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OcrError = exports.verdictMessage = exports.ocrMessage = exports.preparePhoto = exports.createOcr = void 0;
/**
 * `@jcurve/ocr` — 리워드 앱이 **같이 쓰는 영수증 OCR**.
 *
 * 영수증 사진을 서버에 맡기면, 맥의 워커가 Apple Vision 으로 글자를 읽고 Qwen3-VL 로 항목을
 * 뽑아 판정까지 돌려준다. **유료 OCR API 를 쓰지 않는다.** 앱은 사진을 준비해 맡기고 결과를
 * 받기만 하면 된다.
 *
 * ## 쓰기 전에
 *
 * 통합 어드민 → **앱 관리 → 「영수증 OCR」 스위치**를 켜야 한다. 꺼져 있으면 서버가
 * 403 `ocr_disabled` 를 준다. 기본은 꺼짐이다 — 맥 한 대가 모든 앱의 사진을 받는다.
 *
 * ## 쓰는 법
 *
 * 앱마다 다른 것은 **HTTP 하나뿐**이다. 그 앱의 인증된 호출 함수를 넘긴다.
 *
 * ```ts
 * import { createOcr, preparePhoto, verdictMessage } from '@jcurve/ocr';
 *
 * const ocr = createOcr({
 *   post: (path, form) => api.postForm(path, form),   // {base}/{app}/ + path, 인증 헤더 포함
 *   get: (path) => api.get(path),
 * });
 *
 * const photo = await preparePhoto({ uri: asset.uri });   // 1600 으로 줄이고 방향을 굽는다
 * const result = await ocr.read(photo);                   // 보통 10~15초
 * say(verdictMessage(result));
 * ```
 *
 * ## 이 패키지가 **안 하는** 것
 *
 * - **중복 막기** — 앱마다 기준이 달라서 결과의 `contentKey`·`sha256` 으로 앱이 가른다
 * - **보상** — 포인트·주머니는 앱 몫이다
 * - **카메라 화면** — 영테크는 문서 스캐너로 테두리를 잡는다. 화면은 앱마다 다르다
 */
var ocr_1 = require("./ocr");
Object.defineProperty(exports, "createOcr", { enumerable: true, get: function () { return ocr_1.createOcr; } });
Object.defineProperty(exports, "preparePhoto", { enumerable: true, get: function () { return ocr_1.preparePhoto; } });
Object.defineProperty(exports, "ocrMessage", { enumerable: true, get: function () { return ocr_1.ocrMessage; } });
Object.defineProperty(exports, "verdictMessage", { enumerable: true, get: function () { return ocr_1.verdictMessage; } });
Object.defineProperty(exports, "OcrError", { enumerable: true, get: function () { return ocr_1.OcrError; } });
