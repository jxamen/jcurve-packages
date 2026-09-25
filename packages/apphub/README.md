# @jcurve/apphub

리워드 앱 공용 **「앱 모아보기」** — 계열 앱을 한 줄씩 보여 주고 누르면 그 기기의 스토어로 보낸다.

```
하단 버튼(입구)   앱마다 따로 단다 — 그 앱의 색·말·자리로
눌러서 나오는 것   이 패키지 하나 — 어느 앱에서 열어도 같다
목록의 원본       어드민 「앱관리」 → 서버 GET {API_BASE}/family
```

새 앱이 늘어도 **어느 앱도 다시 빌드하지 않는다.** 어드민에 앱을 추가하면 그 줄이 모든 앱에 나온다.

## 쓰는 법

```tsx
import { AppHubSheet } from '@jcurve/apphub';
import { API_BASE } from './config';
import { track } from './track';

const [hub, setHub] = useState(false);

/* 입구 — 화면 맨 아래에 그 앱답게 */
<Pressable onPress={() => setHub(true)}>…</Pressable>

/* 내용 — 패키지가 그린다 */
<AppHubSheet
  open={hub}
  onClose={() => setHub(false)}
  base={API_BASE}                       // 슬러그까지 들어간 주소 그대로
  theme={{ bg: C.bg, card: C.white, line: C.line, text: C.text, sub: C.sub, dim: C.dim, accent: C.carrot, accentSoft: C.carrotSoft }}
  onEvent={(name, props) => track(name, props)}
/>
```

- `base` 대신 `load`(직접 받아 오는 함수)를 줘도 된다 — 앱 자기 통로(토큰·재시도)를 쓰고 싶을 때.

### 입구 켜기 · 제목 · 설명 (1.1.0, 2026-09-25)

어드민 앱관리에서 앱마다 「추천 포인트 앱 둘러보기」를 켜고 끄고 제목 · 설명을 정한다. 서버가 `/family` 에 `section{on, title, desc}` 로 내준다.

```tsx
import { AppHubSheet, useAppHub } from '@jcurve/apphub';

const hub = useAppHub({ base: API_BASE, token: APP_TOKEN });   // 한 번만 부른다

{hub.section.on ? (
  <Pressable onPress={() => setOpen(true)}>
    <Text>{hub.section.title ?? '추천 포인트 앱 둘러보기'}</Text>
  </Pressable>
) : null}

<AppHubSheet open={open} onClose={() => setOpen(false)} items={hub.items} section={hub.section} … />   // 다시 부르지 않는다
```

- `section.title` · `desc` 가 null 이면 기존 문구. 시트 안 소개(「추천 앱」 · 설명)도 같은 값으로 바뀐다.
- 칸이 없던 옛 서버면 `{on:true, title:null, desc:null}` 이다.
- 1.0 처럼 `base` 만 넘겨도 그대로 동작한다.

- 받는 계측 이름은 `apphub_open` · `apphub_tap`(`{ slug }`) 둘뿐이다. 패키지는 아무 데도 보내지 않는다.
- 색만 받는다. **문구·순서·동작은 받지 않는다** — 열어 두면 앱마다 달라지고, 패키지로 만든 이유가 없어진다.

## 넣는 법 (EAS 클라우드 빌드까지 되게)

비공개 저장소를 그대로 물리면 EAS 가 못 받는 일이 있다. **tgz 를 앱 저장소에 넣는다.**

```bash
cd project/jc-apphub && npm run build && npm pack          # jcurve-apphub-1.0.0.tgz
cp jcurve-apphub-1.0.0.tgz ../app/<앱>/vendor/
cd ../app/<앱> && npm i ./vendor/jcurve-apphub-1.0.0.tgz   # package.json 에 file: 로 박힌다
git add vendor/jcurve-apphub-1.0.0.tgz package.json package-lock.json
```

## ⚠ 다른 기계에서 발행·빌드할 때

`vendor/*.tgz` 를 커밋해 두어도 **그 기계에서 `npm i` 를 돌리지 않으면 번들러가 이 패키지를 못 찾는다**
— 커밋된 것은 압축 파일이지 설치된 패키지가 아니다. 2026-09-20 에 맥에서 용돈캡슐을 발행하다
한 번 실패했다(`@jcurve/apphub` 를 찾을 수 없음). 발행·빌드 전에 `git pull && npm i` 를 먼저 한다.

## 고칠 때

문구·모양을 고치면 **모든 앱이 같이 바뀐다.** 그래서 고친 뒤에는 버전을 올리고(`package.json`),
다시 pack 해서 각 앱에 넣는다. 화면만 바뀌면 각 앱은 `eas update`(OTA)로 나간다 — 빌드는 필요 없다.
