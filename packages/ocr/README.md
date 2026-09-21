# @jcurve/ocr

리워드 앱이 **같이 쓰는 영수증 OCR**. 사진을 서버에 맡기면 맥의 워커가 읽고 판정까지 돌려준다.
**유료 OCR API 를 쓰지 않는다** — Apple Vision(맥 내장)으로 글자를 읽고 Qwen3-VL 로 항목을 뽑는다.

영테크에서 먼저 만들어 운영하며 다듬은 것을 떼어 냈다. 아래 규칙 하나하나가 실제 영수증에서
한 번씩 밟은 것이다.

---

## 1. 쓰기 전에 — 앱 관리 스위치

통합 어드민 → **앱 관리 → 그 앱의 「영수증 OCR」 스위치를 켠다.**

꺼져 있으면 서버가 403 `ocr_disabled` 를 준다. **기본은 꺼짐**이다 — 맥 한 대가 모든 앱의
사진을 한 줄로 받으므로, 등록하자마자 누구나 쓰게 두면 한 앱이 큐를 다 먹는다.

---

## 2. 설치

```bash
npm i ./vendor/jcurve-ocr-1.0.0.tgz
```

tgz 는 이 패키지 폴더에서 만든다(§6). `@jcurve/auth` 와 같이 **앱 저장소의 `vendor/` 에 두고
`file:` 로 받는다** — 받는 기계에 GitHub 인증이 없어도 되고, EAS 클라우드 빌드도 그대로 된다.

사진을 줄이는 데 `expo-image-manipulator` 를 쓴다(대부분의 앱에 이미 있다).

```bash
npx expo install expo-image-manipulator
```

없어도 앱은 죽지 않는다 — 지연 `require` 로 집어서, 없으면 사진을 그대로 보낸다.
**다만 그러면 원본이 올라가 서버와 맥이 버티지 못한다.** 넣어 두는 것이 맞다.

---

## 3. 쓰는 법

앱마다 다른 것은 **HTTP 하나뿐**이다. 인증 헤더(`X-App-Token` + 회원 세션)와 오류 모양이
앱마다 달라서, 패키지가 직접 부르지 않고 앱의 호출 함수를 받는다.

```ts
// src/ocr.ts
import { createOcr } from '@jcurve/ocr';
import { api } from './api';

export const ocr = createOcr({
  // path 는 'ocr/jobs' 처럼 온다. 앱이 자기 {base}/{app}/ 를 앞에 붙이고 인증 헤더를 넣는다.
  post: (path, form) => api.postForm(path, form),
  get: (path) => api.get(path),
});
```

```ts
// 화면에서
import { preparePhoto, verdictMessage, ocrMessage } from '@jcurve/ocr';
import { ocr } from '../ocr';

try {
  const photo = await preparePhoto({ uri: asset.uri });   // 1600 으로 줄이고 방향을 굽는다
  const result = await ocr.read(photo);                   // 보통 10~15초
  say(verdictMessage(result));
  if (result.verdict === 'confirmed') save(result.fields, result.contentKey);
} catch (e) {
  say(ocrMessage((e as { code?: string }).code ?? ''));
}
```

**기다리는 동안 화면을 막지 마라.** 10~15초다. 영테크는 「접수됐어요, 화면을 닫아도 괜찮아요」를
띄우고 결과는 푸시로 알린다. 계속 보여 줄 거면 `submit` 으로 번호만 받고 `status` 를 따로 물어라.

```ts
const id = await ocr.submit(photo);        // 번호를 저장해 두면
const { status, result } = await ocr.status(id);   // 앱을 껐다 켜도 다시 물을 수 있다
```

---

## 4. 받는 것

```ts
{
  verdict: 'confirmed' | 'review' | 'rejected',
  fields: {
    store, paidAt, date, time, total, businessNumber, approval,
    items: [{ name, unitPrice, price, count }],
    evidenceSource, rotation,
  },
  checks: [{ name, passed, blocking, detail }],
  contentKey,   // 결제일 + 시:분 + 총액 지문
  sha256,       // 파일 해시
}
```

| 판정 | 뜻 | 앱이 할 일 |
|---|---|---|
| `confirmed` | 값이 종이에 있다 | 받아서 쓴다 |
| `review` | 값은 있는데 자리가 안 맞거나 못 가렸다 | 사람이 본다 |
| `rejected` | 영수증이 아니거나, 읽을 것이 없거나, 돌아갔다 | 다시 찍게 한다 |

**믿어도 되는 칸과 아닌 칸이 있다.**

- `total`·`paidAt` — 종이에 대조해서 통과한 것이다
- `businessNumber` — 검증번호까지 통과한 것만 온다. 앞 세 자리 101 미만은 버린다
- `approval` — 여덟 자리만. 별표 섞인 카드번호(`5289-3600-****-****`)는 안 온다
- **`store` — 믿지 마라.** 밴사 로고(`KICC`), 카드 이름, 영수증 위 손글씨를 상호로 읽는다.
  작은 모델·큰 모델·Apple Vision 이 **셋 다 같은 자리에서 틀린다.** 고칠 수 있는 문제가 아니다

**카드사 앱의 「카드영수증」 캡처**에는 사업자번호도 상호도 없다. 그 건의 빈 칸은
못 읽은 것이 아니라 **없는 것을 안 지어낸 것**이다.

---

## 5. 이 패키지가 **안 하는** 것

- **중복 막기** — 앱마다 기준이 달라서다. `contentKey` 와 `sha256` 으로 직접 가른다.
  **`contentKey` 에 UNIQUE 를 걸지 마라** — 같은 분에 같은 금액을 낸 남이 실제로 있다.
  겹치면 승인번호로 한 번 더 가르는 것이 영테크가 쓰는 방법이다
- **보상** — 포인트·주머니는 앱 몫이다
- **카메라 화면** — 영테크는 문서 스캐너로 테두리를 잡는다. 화면은 앱마다 다르다
- **회전 버튼** — 캡처처럼 EXIF 가 없는 사진은 앱이 자동으로 못 세운다. 필요하면 앱이 둔다

---

## 6. 고칠 때

```bash
npm run build     # dist/ 다시 만들기
npm test          # 동작 + dist 가 소스와 같은지
npm pack          # jcurve-ocr-<버전>.tgz — 앱의 vendor/ 에 넣는다
```

**`dist/` 를 꼭 같이 커밋하라.** 설치할 때 빌드하지 않으므로, 소스만 고치고 `dist/` 를
안 만들면 **앱들이 옛 코드를 받는다** — 고쳤다고 믿는데 안 고쳐져 있고 아무 오류도 안 난다.
`npm test` 가 그걸 잡는다(지금 빌드한 것과 글자까지 비교한다).

고친 뒤에는 **쓰는 앱 모두** tgz 를 갈아 넣어야 한다. 한 곳만 올리면 같은 버그를 한 앱만 갖게 된다.
