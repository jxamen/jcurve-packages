/** Metro 가 expo-updates 를 CJS/ESM 어느 쪽으로 주든 채널 이름을 꺼낸다 */
export declare function readUpdateChannel(mod: unknown): string;
/**
 * 구글 테스트 광고 단위를 쓸지.
 *
 * production 채널만 실광고 — 그 외(TestFlight·채널 미확인)는 재고 없는 실광고 대신 테스트 단위다.
 * **빌드 환경변수 단독으로 가르지 않는다**(07 문서 ⑨): OTA 번들은 그 변수 없이 만들어져
 * 업데이트되는 순간 실광고로 뒤집히고, 심사 전 앱은 실광고 재고가 없어 전부 no-fill 이 된다.
 *
 * **등록된 테스트 기기는 실단위를 쓴다**(2026-09-16). 구글 테스트 단위는 SSV 콜백을 보내지
 * 않아서, 그걸로는 서버가 「광고를 봤다」를 확인할 길이 없다 — 수확이 영영 `no_ad` 로 막힌다.
 * 테스트 기기로 등록하면 **실단위를 쓰면서도 화면에는 테스트 광고가 나오고 SSV 는 정상으로
 * 온다.** 심사 전이라 실광고 재고가 없는 문제도 함께 피한다.
 */
export declare function useTestAdUnit(envFlag: string | undefined, channel: string, testDevice?: boolean): boolean;
