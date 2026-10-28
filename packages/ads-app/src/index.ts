/**
 * @jcurve/ads-app — 앱 층 광고 접착의 공용 부분(JS 전용, 네이티브 파일 없음).
 * 0.1.0 은 머니트리(12eeee8f)의 순수 모듈을 코드 변경 없이 옮긴 것이다: 앱 오프닝 판단 규칙 · 가드, 테스트 광고 단위 판정.
 * 0.2.0 은 열린 광고 복구(recovery) — 캐시팡팡 기준, 접두 일치 · 선언 · 조용한 삭제 금지.
 * 설계: ADS-GLUE-DESIGN.md (보상 흐름 · 열린 광고 복구 · 대기 청구는 0.2.0).
 */
export * from './appOpenRules';
export * from './appOpenGuard';
export * from './adMode';
export * from './recovery';
