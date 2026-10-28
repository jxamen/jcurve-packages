import { buildScript } from './common';

/**
 * 네이버 쇼핑 주문/배송 목록 읽기. 증거 등급은 각 항목 옆 주석에 적었다.
 *  - confirmed : 공개 자료에서 실제로 확인한 것
 *  - assumed   : 확인 못 한 추정. 방어용 대체 경로일 뿐이다.
 *
 * 이 파일을 쓸 때 공개 자료 조회는 전부 막혔다(shopping.naver.com · order.pay.naver.com 직접 조회 거부,
 * 웹 검색은 네이버 주문 API 자료를 찾지 못함). 그래서 주소 · 화면 구조 · JSON 응답 모양은 모두 assumed 이다.
 *
 * 개인정보: 여섯 칸(orderNo, orderedAt, amount, seller, title, payment)만 골라 돌려준다.
 * 수령인 · 주소 · 전화 · 카드번호 칸은 읽지도 않는다(클래스 이름에 recei/addr/phone/card 등이 있으면 건너뜀).
 */
export const NAVER_SHOP_URL = 'https://order.pay.naver.com/orderStatus'; // assumed — 주문목록 주소 추정. 실제 확인 못 함

/**
 * 본문. 웹뷰 안에서 `(state, H)` 를 받아 실행된다. 사이트 전용 상수는 여기 안에 둔다.
 *  - 로그인 검사: 주소가 nid.naver.com 이거나 password 입력칸이 있으면 login_needed — assumed(네이버 로그인 페이지 형태 추정)
 *  - 목록 칸: data-order-no / data-orderno, 클래스 이름 부분 일치(OrderItem, orderItem, order_item, OrderList li) — assumed
 *  - 주문번호: data-order-no 속성 또는 본문의 16자리 `20YY…` 숫자 — assumed (16자리 형식은 사용자 설명, 화면 확인 못 함)
 *  - 날짜: 본문의 `20YY.MM.DD` 또는 `20YY-MM-DD` (+ 시각) — assumed
 *  - 금액: `실결제`/`결제금액`/`총 결제` 뒤의 N,NNN원 우선, 없으면 첫 N원 — assumed
 *  - 판매처/상품: 클래스 부분 일치(store·mall·seller / product·goods·name·title) — assumed
 *  - 결제수단: 본문의 짧은 단어(네이버페이·카드·계좌이체 등) — assumed
 *  - 더보기: 글자 「더보기」 버튼을 눌러 다음 묶음 — assumed
 *  - 빈 목록: 「주문 내역이 없」 문구 — assumed
 * JSON 엔드포인트는 확인한 것이 없어서 쓰지 않는다(fetch 없음 → fetch_failed 는 나지 않음).
 */

// 문자열 상수 — 앱 번들러(Hermes)에서는 함수 toString() 이 원문을 주지 않아서, 함수를 문자열로 꺼내 쓰지 않는다.
export const NAVER_SHOP_BODY = String.raw`return (async function naverShopBody(state, H) {
  var host = String(location.hostname || "");
  if (/(^|\.)nid\.naver\.com$/.test(host) || document.querySelector('input[type="password"]')) {
    return { orders: [], done: true, note: "login_needed" };
  }
  var BLOCK = '[data-order-no],[data-orderno],[class*="OrderItem"],[class*="orderItem"],[class*="order_item"],[class*="OrderList"] li';
  var BAD = /recei|recip|addr|phone|tel|mobile|card|mail|account|bank|zip|buyer|user|member/i;
  function countOn(txt) {
    return (txt.match(/20\d{2}\d{12}/g) || []).length;
  }
  function blocksNow(sel) {
    var ok = H.qa(sel).filter(function(c) {
      var t = H.text(c);
      return /20\d{2}/.test(t) && /\d[\d,]*\s*원/.test(t) && countOn(t) <= 1 && t.length < 1500;
    });
    return ok.filter(function(c) {
      return !ok.some(function(o) {
        return o !== c && c.contains(o);
      });
    });
  }
  function pick(root, words) {
    var els = H.qa("[class]", root);
    for (var i = 0; i < els.length; i++) {
      var cls = String(els[i].getAttribute("class") || "");
      if (BAD.test(cls)) continue;
      var low = cls.toLowerCase();
      for (var j = 0; j < words.length; j++) {
        if (low.indexOf(words[j]) >= 0) {
          var t = H.text(els[i]);
          if (t && t.length <= 200 && !/\d[\d,]*\s*원|20\d{2}[.\-]\d/.test(t)) return t;
        }
      }
    }
    return null;
  }
  function parse(el) {
    var txt = H.text(el);
    var dataNo = el.getAttribute && (el.getAttribute("data-order-no") || el.getAttribute("data-orderno")) || "";
    var onm = txt.match(/(^|[^\d])(20\d{2}\d{12})(?!\d)/);
    var orderNo = /^\d{8,40}$/.test(dataNo) ? dataNo : onm ? onm[2] : null;
    if (!orderNo) return null;
    var dm = txt.match(/20\d{2}[.\-]\d{1,2}[.\-]\d{1,2}(?:[^\d]{0,8}\d{1,2}:\d{2})?/);
    var orderedAt = dm ? H.kst(dm[0]) : null;
    var am = txt.match(/(?:실\s*결제|결제\s*금액|총\s*결제)[^\d]{0,12}(\d{1,3}(?:,\d{3})+|\d+)\s*원/) || txt.match(/(\d{1,3}(?:,\d{3})+|\d{4,})\s*원/);
    var amount = am ? H.money(am[1]) : null;
    var pm = txt.match(/네이버\s?페이|카카오\s?페이|토스\s?페이|신용카드|체크카드|카드|계좌이체|휴대폰\s?결제|무통장/);
    var payment = pm ? pm[0].replace(/\s/g, "") : void 0;
    var seller = pick(el, ["store", "mall", "seller", "shop"]) || void 0;
    var title = pick(el, ["product", "goods", "itemname", "item_name", "name", "title"]) || void 0;
    return { orderNo, orderedAt, amount, seller, title, payment };
  }
  function findMore() {
    var btns = H.qa("button,a");
    for (var i = 0; i < btns.length; i++) {
      if (/더\s?보기/.test(H.text(btns[i])) && !btns[i].disabled) return btns[i];
    }
    return null;
  }
  var blocks = blocksNow(BLOCK);
  if (blocks.length === 0) {
    blocks = blocksNow("body *");
  }
  if (blocks.length === 0 && /주문\s?내역이\s?없/.test(H.text(document.body))) {
    return { orders: [], done: true };
  }
  if (blocks.length === 0) {
    await H.waitFor(function() {
      return blocksNow("body *").length > 0;
    }, 2e3);
    blocks = blocksNow("body *");
  }
  if (blocks.length === 0) {
    if (!/naver\.com$/.test(host)) return { orders: [], done: true, note: "wrong_page" };
    return { orders: [], done: true, note: "no_list_found" };
  }
  var rows = blocks.map(parse).filter(Boolean);
  var last = parse(blocks[blocks.length - 1]);
  var lastOld = !!(last && last.orderedAt && !H.recent(last.orderedAt));
  var more = findMore();
  if (more && !lastOld && (state.pages || 0) < 30) {
    state.pages = (state.pages || 0) + 1;
    var before = blocks.length;
    more.click();
    await H.waitFor(function() {
      return blocksNow(BLOCK).length > before || blocksNow("body *").length > before;
    }, 4e3);
    return { orders: rows, done: false };
  }
  return { orders: rows, done: true };
})(state, H);`;

export const NAVER_SHOP_SCRIPT = buildScript('naver_shop', NAVER_SHOP_BODY);
