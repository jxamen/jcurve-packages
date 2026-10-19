# @jcurve/steps 0.1.0

에그머니 source.ts/days.ts와 Android 권한 설명 플러그인에서 추출. iOS CMPedometer, Android Health Connect + 실행 중 센서 대체. 백그라운드 수집 없음. Health Connect 기록 공급 앱이 없으면 센서 증가분만 보일 수 있음.

`configureStepsStorage(adapter, accountNamespace)` 후 `readToday`, `watchSteps`, `syncToday`를 연결한다. 계정 전환 전 구독을 해제한다. `requestStepsPermission(explain)`은 앱이 목적 설명을 확인한 뒤에만 OS 권한을 요청한다. ready/unknown/denied/unavailable/error를 0과 구분한다.

`StepsStageCard`는 서버 StepsState만 표시한다. onWatchAd는 광고 성공 여부, onClaim은 SSV 확인·단계 수령·상태 갱신을 주입한다. 금액은 서버가 결정한다.

Expo plugins에 expo-sensors(motionPermission), @jcurve/steps를 추가한다. extra.stepsPrivacyUrl은 공개 개인정보처리방침 HTTPS 주소. Android ACTIVITY_RECOGNITION 및 health.READ_STEPS 필요. SDK 57: https://docs.expo.dev/versions/v57.0.0/sdk/pedometer/
