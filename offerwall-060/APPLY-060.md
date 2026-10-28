# @jcurve/offerwall 0.6.0 — 스냅플레이 화면을 찬스2 탭 안에 그대로 (새 스토어 빌드 필요)

파일: `jcurve-offerwall-0.6.0.tgz` (sha256 · integrity 는 같은 폴더 `INTEGRITY-0.6.0.txt` 에 파일에서 계산해 둠 — 손으로 옮기지 말고 락은 `npm install` 값). 소스: jcurve-packages `feat/offerwall-050` @ `9a39302`. 시험 357개(JS · 네이티브 소스 3면 일치 검사 포함). 0.5.1(칩 고침)을 포함한다.

## 대표님이 보시게 될 것
찬스 탭 → 위 「찬스1 | 찬스2」 → 찬스2 를 누르면 스냅플레이 화면(「혜택받기」…)이 **탭 줄 아래 · 앱 메뉴 위 영역 안에** 그대로 뜬다(전체 화면 모달 아님). 「포인트 빨리 모으기」 칩은 탭마다 화면 안 위쪽에 하나씩(탭 줄을 가리지 않음). 뷰 안 스냅플레이 화면이 로그인을 요청하면 앱이 답하고, 닫기를 요청하면 찬스1 로 돌아간다.

## 앱에서 할 일 (0.5.0 을 이미 붙인 앱: 에그머니)
1. `package.json` · 락: `@jcurve/offerwall` → `file:vendor/jcurve-offerwall-0.6.0.tgz` (옛 0.5.x tgz 삭제, 못 박힌 시험의 vendor 이름 갱신). `react-native-s2offerwall` 1.0.38 · `snapPlay: true` · `resolveSnapPlayConfig` 호출은 그대로 — **앱 화면 코드 변경 없음**.
2. 새 네이티브라 앱 버전 올림 → **새 스토어 빌드(맥북16)**. 이 빌드에서 Android 는 `compileOnly io.snapplay:s2offerwall-aos-sdk:1.0.38` 로 컴파일되고(SDK 는 react-native-s2offerwall 이 가져옴), iOS 는 `JCurveOfferwall` 포드가 `s2offerwall ~> 1.0.38` 에 의존한다 → `pod install` 이 한 번 더 도는 것이 정상.
3. 나머지 앱: 0.5.0 을 건너뛰고 바로 0.6.0 을 붙이면 된다(APPLY-050.md 의 1~3번 + 이 문서).

## 이 PC 에서 확인하지 못한 것 — 첫 빌드가 확인한다
- **컴파일**: Android `JCurveSnapPlayViewManager.java`(S2OfferwallView · S2Offerwall.EventListener 3개 메서드 · raw Event — AdPopcorn 뷰와 같은 모양) / iOS `JCurveSnapPlayViewManager.m`(`<s2offerwall/s2offerwall-Swift.h>` import 가 `useFrameworks: static` 에서 잡히는지). 컴파일 오류가 나면 이 두 파일뿐이다 — **오류 한 줄을 그대로 회신**해 주면 바로 고친다.
- **실기기**: 뷰 안 스냅플레이 화면의 높이 · 스크롤 · 검색 · 사진 권한, 칩 줄이 스냅플레이 화면 오른쪽 위 아이콘과 겹치는지(겹치면 위치만 조정), Android 뒤로 가기.
- **서버 스위치**: `content/config/snapplay` 응답에 `"embed": false` 를 주면 뷰 대신 예전 전체 화면(모달)으로 열린다 — 실기기에서 뷰가 문제면 앱 업데이트 없이 끌 수 있다.
- 뷰가 없는 빌드(0.5.x 등)에서는 JS 가 알아서 전체 화면(모달)으로 열린다(OTA 로 0.6.0 JS 가 옛 빌드에 가도 안전).
