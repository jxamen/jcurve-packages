/**
 * 영수증 가져오기 줄별 결과 — 흐름(naverReceipt)이 주문 하나마다 알리고, 주문 시트(ReceiptOrdersSheet)가 줄 오른쪽 글자로 쓴다.
 * react-native 를 import 하지 않는다(노드에서 시험한다). 값(쿠키 · 토큰 · 영수증 내용)은 이 파일 어디에도 없다.
 *
 * 줄 잇는 법: 흐름은 16자리 주문번호를 알고, 서버 목록은 앞자리를 별(*)로 가린 주문번호(뒤 4자리만 보임)를 준다.
 * 그래서 두 쪽이 같은 키 「뒤4자리|주문일시(분까지)|금액」 을 만든다(outcomeKey). 주문일시는 한국 시각 「YYYY-MM-DD HH:mm」.
 */

/** 못 가져온 까닭 — 줄에 쉬운 말로 보인다(failText). 영수증이 아예 없는 결제는 실패가 아니라 따로 센다(Outcome none) */
export type FailCode =
  | 'login'       // 로그인이 풀렸다(사이트가 로그인 화면 · 401)
  | 'blocked'     // 사이트가 잠시 막았다(429 · 403 · 확인 화면)
  | 'no-pair'     // 영수증을 부를 주소의 값(payId · tid · paymentId)을 못 찾았다
  | 'not-in-history' // 네이버페이 내역(끝 페이지까지)에서 이 줄의 날짜 · 금액과 같은 결제를 못 찾았다(개별 가져오기, 10-29)
  | 'unreadable'  // 영수증 응답은 왔는데 내용을 읽지 못했다(필수 칸 없음)
  | 'network'     // 요청이 끝내 안 돌아왔다(오류 · 시간 초과)
  | 'stopped';    // 사용자가 중단했다

/** 줄 하나의 가져오기 결과 */
export type Outcome =
  | { state: 'fetching' }
  | { state: 'done' }
  | { state: 'none' }                          // 영수증이 없는 결제(포인트 · 계좌이체 등) — 「영수증 없음」
  | { state: 'failed'; code: FailCode };

/** 흐름이 주문 하나의 결과를 알릴 때 쓰는 한 건 */
export type OutcomeEvent = { key: string; outcome: Outcome };

/** 서버 목록 줄과 흐름의 주문을 잇는 키 — orderNo 는 16자리 그대로이거나 앞이 가려진 값(뒤 4자리만 쓴다), orderedAt 은 「YYYY-MM-DD HH:mm…」(앞 16자만 쓴다) */
export const outcomeKey = (orderNo: string, orderedAt: string, amount: number): string =>
  `${orderNo.slice(-4)}|${orderedAt.slice(0, 16)}|${Math.floor(amount)}`;

const FAIL_TEXT: Record<FailCode, string> = {
  login: '로그인이 풀렸어요',
  blocked: '사이트가 잠시 막았어요',
  'no-pair': '영수증 주소를 못 찾았어요',
  'not-in-history': '네이버페이 내역에서 이 결제를 못 찾았어요',
  unreadable: '영수증 내용을 읽지 못했어요',
  network: '인터넷이 불안정해요',
  stopped: '중단해서 가져오지 않았어요',
};

/** 못 가져옴 줄의 까닭 글자(영문 코드 · 번호는 넣지 않는다) */
export const failText = (code: FailCode): string => FAIL_TEXT[code];

/** 「영수증 없음」 줄의 안내 글자 */
export const NONE_TEXT = '영수증이 없는 결제예요';

/** 줄 오른쪽 큰 글자 — 실패는 「못 가져옴」, 영수증이 없는 결제는 「영수증 없음」 */
export const outcomeLabel = (o: Outcome): string =>
  o.state === 'failed' ? '못 가져옴' : o.state === 'none' ? '영수증 없음' : o.state === 'fetching' ? '가져오는 중…' : '';

/** 줄 오른쪽 작은 까닭 글자 */
export const outcomeReason = (o: Outcome): string =>
  o.state === 'failed' ? failText(o.code) : o.state === 'none' ? NONE_TEXT : '';
