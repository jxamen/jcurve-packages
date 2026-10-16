import {it,expect} from 'vitest';
import {shoppingNextPage,shoppingFallback,shoppingPageDelay,SHOPPING_MAX_PAGES} from './shoppingPolicy';
it('stops on the first match and covers at most 100 ranks in three pages',()=>{
 expect(shoppingNextPage(1,true)).toBeUndefined();
 expect(shoppingNextPage(1,false)).toBe(2);
 expect(shoppingNextPage(2,false)).toBe(3);
 expect(shoppingNextPage(3,false)).toBeUndefined();
 expect(SHOPPING_MAX_PAGES).toBe(3);
 expect(shoppingPageDelay(()=>0)).toBe(3000);
 expect(shoppingPageDelay(()=>1)).toBe(6000);
});
it('only switches route once on explicit first-page transport/HTTP failure',()=>{
 for(const code of ['empty','blocked_limit','captcha','blocked_login','timeout'])expect(shoppingFallback(code,1,1,false)).toBe(false);
 expect(shoppingFallback('network',1,1,false)).toBe(true);
 expect(shoppingFallback('http_4xx',1,1,false)).toBe(true);
 expect(shoppingFallback('network',2,1,false)).toBe(false);
 expect(shoppingFallback('network',1,2,false)).toBe(false);
 expect(shoppingFallback('network',1,1,true)).toBe(false);
});
