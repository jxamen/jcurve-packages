# @jcurve/offerwall-buzzvil

로컬 준비용 BuzzBenefit v6 어댑터. Android BOM **6.9.3**, iOS BuzzvilSDK **6.8.0** 고정. 공식 네이티브 SDK를 감싼 JCurve RN 브리지이며 공식 RN 패키지가 아니다. **앱에는 아직 설치하지 않았고 네이티브 컴파일·실기기 검증 전**이다.

```sh
npm run build --workspace @jcurve/offerwall-buzzvil
npm pack --workspace @jcurve/offerwall-buzzvil --pack-destination /tmp
# 다음 스토어 빌드 대상에서만:
npm install /tmp/jcurve-offerwall-buzzvil-0.1.0.tgz
```

Expo plugins에 `"@jcurve/offerwall-buzzvil"` 추가 → prebuild → pods/Gradle → 새 바이너리. 플러그인은 Android 저장소 4개와 iOS ATT 설명을 추가한다. 네이티브 모듈은 RN autolinking으로 연결한다. Expo Go와 OTA로 설치 불가. Kotlin DSL/settings.gradle 저장소 제한 프로젝트는 수동 검토가 필요하다.

```ts
import { initializeOfferwall, openOfferwall, resetOfferwall } from '@jcurve/offerwall-buzzvil';
const ready = await initializeOfferwall({configUrl, headers});
if (ready.ok) await openOfferwall({usn});
// 로그아웃/회원 전환
resetOfferwall();
```

설정 응답 계약: `{ok:true,config:{android:{appId:"",unitId:""},ios:{appId:"",unitId:""}}}`. 서버 응답 계약만 준비했으며 설정 API·회원 별칭 API·지급 처리는 후속 연동이다. AdPopcorn usn을 재사용하지 않는다. 빈 키/네이티브 모듈 없음은 `not_ready`와 「준비 중」. unitId는 서버 지면 매핑 확인용이며 v6 Hub는 App ID의 서버 지면 설정을 사용한다. 키/응답을 로그에 남기지 않는다. App ID가 실행 중 바뀌면 프로세스 재시작이 필요하다.

닫힘/적립 가능량 API는 아직 제공하지 않는다. 화면 복귀 시 앱 잔액을 재조회하며 SDK 이벤트로 지급하지 않는다. 성별·출생연도는 임의 생성하지 않는다. 타겟팅 재고 제약은 매체 담당자와 확인한다.

서버 `POST /v1/offerwall/buzzvil/callback/{app}`는 **항상 거절하는 골격**이다. 매체 checksum 합의·검증, 회원 별칭, 트랜잭션/중복 지급/원장 구현 및 실콜백 시험 전에는 트래픽을 열지 않는다. SDK를 미리 바이너리에 포함해도 이 서버 작업이 끝나야 활성화 가능하다.

공식 근거: [무료 도입](https://www.buzzvil.com/en/monetize/buzzbenefit), [Android](https://docs.buzzvil.com/docs/buzzbenefit-android/v6/getting-started), [iOS](https://docs.buzzvil.com/docs/buzzbenefit-ios/v6/getting-started), [Hub](https://docs.buzzvil.com/docs/buzzbenefit-android/v6/benefithub), [포스트백](https://buzzvil.atlassian.net/wiki/spaces/BDG/pages/1756004654/API). RN 이용은 가능하나 공급자의 기술 지원 대상이 아니다.
