import { expect,it,vi } from 'vitest';
vi.mock('../api/mock',()=>({USE_ANALYSIS_MOCK:false}));
import { blockReason,collectWeb,attachCollector,CollectorError } from './webQueue';
import { parseCollectorHtml } from './webParser';
it('parses shopping HTML preserving canonical product links and page offsets',()=>{
 const data={props:{pageProps:{shoppingResult:{products:[{productId:'999',productTitle:'상품',productUrl:'https://smartstore.naver.com/store/products/123'}]}}}};
 expect(parseCollectorHtml('<script id="__NEXT_DATA__">'+JSON.stringify(data)+'</script>','shopping',2)[0]).toMatchObject({id:'999',rank:41,link:'https://smartstore.naver.com/store/products/123'});
});
it('parses place HTML and rejects unknown result schemas',()=>{
 const data={props:{pageProps:{placeList:{items:[{id:'123'}]}}}};
 expect(parseCollectorHtml('<script id="__NEXT_DATA__">'+JSON.stringify(data)+'</script>','place',2)[0]).toMatchObject({id:'123',rank:31});
 expect(()=>parseCollectorHtml('<html>unknown</html>','place',1)).toThrow();
});
it('classifies CAPTCHA, login and limits separately from normal results',()=>{
 expect(blockReason('접속이 제한되었습니다','')).toBe('blocked_limit');
 expect(blockReason('쇼핑 서비스 접속이 일시적으로 제한되었습니다','')).toBe('blocked_limit');
 expect(blockReason('쇼핑 서비스 접속이 일시적으로 제한되었습니다. 로그인','')).toBe('blocked_limit');
 expect(blockReason('','https://nid.naver.com/nidlogin.login')).toBe('blocked_login');
 expect(blockReason('보안문자 입력','')).toBe('captcha');
 expect(blockReason('검색 결과','https://m.place.naver.com')).toBeUndefined();
 expect(new CollectorError('captcha').message).toBe('네이버가 잠시 막았어요 [captcha]');
});


import {safeEvidence,shoppingUrl} from './webDiagnostics';
it.each([0,1,2])('parses product IDs and store links for shopping route %i',route=>{
 const url=shoppingUrl('보조배터리',1,route);
 expect(url).toContain(['m.search.naver.com/search.naver?where=m_shop','msearch.shopping.naver.com/search/all','search.shopping.naver.com/ns/search'][route]);
 const fixture=route===0?'<li class="shopping_item"><a href="https://smartstore.naver.com/test/products/123">배터리</a></li>':route===1?'<div data-product-id="999"><a href="https://smartstore.naver.com/test/products/123">배터리</a></div>':'<div class="product_item"><a href="https://smartstore.naver.com/test/products/123">배터리</a></div>';
 expect(parseCollectorHtml(fixture,'shopping',1)).toMatchObject([{id:route===1?'999':'123',link:'https://smartstore.naver.com/test/products/123',rank:1}]);
});
it('ignores menu links and deduplicates product cards',()=>{
 const card='<div class="product_item"><a href="https://smartstore.naver.com/test/products/123">상품</a></div>';
 expect(parseCollectorHtml('<a href="https://smartstore.naver.com/test/products/456">메뉴</a>'+card+card,'shopping',2)).toHaveLength(1);
 expect(parseCollectorHtml(card,'shopping',2)[0].rank).toBe(41);
});
it('only retains provider diagnostic phrases from first 120 characters',()=>{
 const evidence=safeEvidence('홍길동 test@example.com 네이버','010-1234-5678 접속이 제한되었습니다. '+ 'x'.repeat(120)+' 보안문자');
 expect(evidence).toContain('접속이 제한');expect(evidence).not.toMatch(/홍길동|example|010|보안문자/);
});

it('parses observed integrated search bridge anchors without counting the shopping tab',()=>{
 const html='<a href="https://msearch.shopping.naver.com/search/all?query=x">쇼핑</a><a href="https://cr3.shopping.naver.com/v2/bridge/searchGate?nv_mid=53901522023&amp;query=x" data-nlog-area="shp_tli.none.item"><span>상품</span></a>';
 expect(parseCollectorHtml(html,'shopping',1)).toMatchObject([{id:'53901522023',rank:1}]);
});
