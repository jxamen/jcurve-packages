/**
 * 응답 JSON 의 키 구조를 「경로 : 종류」 줄로 만든다 — 값은 한 글자도 담지 않는다(종류는 string · number · boolean · null · object · array).
 * 서버 구조 기록(receipt-link/probe)이 받는 dom.outline 줄 모양에 맞춘다: 한 줄 200자 이하, 7자리 이상 숫자 · 허용 밖 글자(한글 · 이모지 등)가 든 키 이름은 「~」 로 바꾼다.
 * 배열은 첫 칸만 따라 내려가고 칸 수를 적는다(arrayN). react-native 를 import 하지 않는다.
 */
/** 키 이름 하나를 서버가 받는 글자로 — 긴 숫자 · 허용 밖 글자가 있으면 ~ */
export declare const safeKey: (k: string) => string;
/**
 * value → 줄 목록(최대 maxLines). 같은 이름의 객체 키는 한 번씩만 센다.
 * 예) { orders: [{ orderId: 1, items: [] }] } → ['orders : array1', 'orders[0].orderId : number', 'orders[0].items : array0']
 */
export declare function structureLines(value: unknown, maxLines?: number): string[];
/** 어떤 JSON 안에서 이름이 re 에 맞는 키의 경로만(찾아 쓴 칸을 구조 기록에 함께 남길 때) */
export declare function pathsMatching(value: unknown, re: RegExp, max?: number): string[];
