# @jcurve/naver-rank 1.0.1

기존 React Native WebView 안에서 네이버 플레이스(오가닉 최대 300위), 쇼핑(기존 빌드 6 수집기) 순위를 수집한다. 페이지가 발급한 토큰·쿠키는 WebView 문서 밖으로 보내지 않는다. 캡차는 사용자가 `네이버 화면 보기`로 확인한다.

## 설치·배포

다른 jcurve-packages 패키지와 동일하게 dist를 커밋하고 release tgz를 설치한다.

```json
"@jcurve/naver-rank": "https://github.com/jxamen/jcurve-packages/releases/download/naver-rank-v1.0.1/jcurve-naver-rank-1.0.1.tgz"
```

```sh
npm run build
npm test
npm pack
git tag naver-rank-v1.0.1
# 저장소 branch/tag push 뒤:
gh release create naver-rank-v1.0.1 jcurve-naver-rank-1.0.1.tgz
```

react, react-native, react-native-webview는 peer다. 새 네이티브 모듈은 없다. 빌드 6처럼 WebView와 보안 저장소가 이미 포함된 앱은 JS OTA로 적용할 수 있다.

## 사용

```tsx
import {configure,NaverRankHost,checkPlaceRank,checkShoppingRank} from '@jcurve/naver-rank';
import * as SecureStore from 'expo-secure-store'; // 호스트 앱에 이미 있는 보안 저장소
configure({
 apiKey:process.env.EXPO_PUBLIC_RANKFREE_SDK_API_KEY ?? '',
 appId:'kr.co.jcurve.selfmarketing', // 실제 bundleIdentifier / Android package
 storage:{getItem:SecureStore.getItemAsync,setItem:SecureStore.setItemAsync},
});
// 앱 루트의 화면 위에 한 번 마운트
<NaverRankHost />
const place=await checkPlaceRank('강남 카페','123');
// {rank:number|null,total:number,top:[{id,name,photo:string|null,reviews:number|null}]}
const shopping=await checkShoppingRank('운동화',{productId:'123'});
// {rank:number|null,items:[{rank,productId,link,title,mallName}]}
```

`storage`는 **암호화된 기기 저장소**여야 한다. 라이선스 캐시에 키·앱 결합 정보를 저장하므로 AsyncStorage를 그대로 연결하지 않는다. 키는 소스·테스트에 넣지 않는다. configure는 시작할 때 한 번 호출한다. 앱별 정식 URL 정리·매칭은 normalizeTargetUrl, targetUrlId, validateTargetUrl을 사용한다. 플레이스 상세 정보 보강 API는 호스트 앱의 기존 서버 경로를 사용한다.

공통 큐는 작업 사이 20~40초, 플레이스 페이지 사이는 3초 대기한다. HTTP 429는 두 채널 공통 일일 기록을 남긴 후 30~90초 뒤 한 번만 재시도한다. 405는 3초 뒤 한 번 재시도한다. 앱 백그라운드/Host 해제 시 작업을 중단한다. OS headless에서는 WebView를 사용할 수 없다.

## 오류

CollectorError.code: `license_invalid`(미설정·키/앱/scope/만료 거절), `license_limit`(키 일일 한도), `invalid_input`, `unavailable`, `captcha`, `blocked_login`, `blocked_limit`, `token_timeout`, `timeout`, `network`, `schema`, `graphql`, `repeated_page`, `http_4xx`, `bridge`, `background`, `unmounted`, `cancelled`, `empty`.

라이선스 오류에는 서버 순위 수집으로 우회하지 않는다. 나머지 앱 수집 실패만 앱 정책에 따라 서버 예비 경로를 사용한다. 정상 rank:null은 실패가 아니다.

## 랭크프리 연동 계약 — 서버 구현 필요

현재 rankfree 저장소에는 ApiKey의 활성/만료/허용 IP/scope/일일 호출 제한이 있으나 **sdk_rank, 허용 앱 목록, 아래 API가 없다**. 서버는 수정하지 않았다. API가 배포되고 키가 발급되기 전에는 수집이 license_invalid로 거절된다.

모든 요청은 `https://rankfree.kr/api/v1/sdk`로 POST, `Authorization: Bearer <env key>`, JSON이다. 리다이렉트 없이 이 정식 도메인에서 제공해야 한다.

### /verify

요청 `{appId,scope:"sdk_rank"}`. 서버에서 키·회원 활성/만료, sdk_rank scope와 회원 scope 권한, allowed_app_ids 목록의 실제 iOS bundle ID/Android package를 검사한다. 검증 호출은 수집 횟수로 차감하지 않는다.

성공 200: `{valid:true,appId,scopes:["sdk_rank"],expiresAt:"ISO8601"}`. 무기한 키도 SDK용 expiresAt을 명시한다. 거절 401/403: `{valid:false}`. 서버 장애 5xx.

처음 실행과 KST 날짜가 바뀐 첫 작업에 확인한다. 성공 캐시만 사용한다. 네트워크/5xx 장애 때는 확인 후 48시간 미만(정상 재검증 주기 24시간 + 오프라인 유예 최대 24시간), 키 만료 전까지 허용한다. 401/403·잘못된 응답은 캐시를 즉시 무효화한다. 키 변경 시 이전 키 캐시는 사용할 수 없다.

### /usage

요청 `{appId,installationId,date:"YYYY-MM-DD",place:number,shopping:number}`. 검색어·URL·순위·결과·토큰·쿠키는 전송하지 않는다. 각 횟수는 큐가 수집 시도하기 전 기록하는 당일 누적 시도 횟수다. 같은 날 누적 갱신, 미전송 과거 날짜 재전송을 지원한다. 서버는 `(key,appId,installationId,date)`별 각 채널 최대 누적값으로 upsert하여 재전송/응답 유실을 중복 차감하지 않는다. 키별 KST 일일 합계를 원자적으로 검사한다. 성공 200/204, 키/앱 거절 401/403, 초과 429. 한도 초과 시 해당 수집을 시작하지 않는다. 통신 장애 시 로컬 누적값을 유지하고 다음 작업에서 재시도한다.

클라이언트 앱 ID와 배포된 JS/env 키는 추출·위조할 수 있으므로 이 방식은 정식 SDK의 사용을 제어한다. 복제/변조 앱까지 차단하려면 서버가 플랫폼 앱 무결성 증명을 추가로 검증해야 한다. 오프라인 유예 중 사용량은 사후 집계이므로 서버의 실시간 전역 한도는 보장하지 않는다.

## 1.0.1 수집 제한과 화면 연동

수집 함수 호출부터 큐 대기·키 확인·429 재시도·수동 네이버 화면까지 **최대 90초**다. 초과하면 `timeout` 오류로 종료하고 WebView와 예약 재시도를 제거한다. `blocked_limit`은 「쇼핑 서비스 접속이 일시적으로 제한되었습니다」도 포함한다. 차단 화면은 순위 밖 결과로 기록하지 않는다.

앱 진행 모달이 실패 패널을 덮지 않도록 모달을 닫는다(로딩/중복 요청 방지 상태는 실제 종료까지 유지).

```ts
import { subscribeCollectorFailure } from '@jcurve/naver-rank/dist/webQueue';
// 화면 effect에서 등록하고 반환된 함수를 cleanup으로 사용한다.
const unsubscribe = subscribeCollectorFailure(error => {
  hideProgressSheet();
  showFailureReason(error.message);
});
```

쇼핑은 홈(`shopping.naver.com/ns/home`)을 먼저 방문하고 2.5초 후 검색한다. 이는 랭크프리의 세션 준비 순서만 반영한 것이다. 서버 Chrome 로그인 프로필·기기등록·TLS 지문을 WKWebView로 복제할 수 없으며 쇼핑 수집 성공은 보장하지 않는다. 랭크프리의 2페이지 이후는 페이지가 생성한 일회성 토큰과 버튼 클릭 응답을 사용하므로 임의 토큰 생성·커서 강제 호출은 이식하지 않는다. 현재 앱 수집 범위는 실제 파싱된 결과만이며 서버 400위 수집과 동등하지 않다.
