import {it,expect,vi,beforeEach,afterEach} from 'vitest';
const harness=vi.hoisted(()=>({slots:[] as any[],cursor:0,effects:0,dispatch:undefined as any,navigations:[] as string[],resolve:vi.fn(),reject:vi.fn()}));
vi.mock('react',()=>({useState:(initial:any)=>{const i=harness.cursor++;if(!(i in harness.slots))harness.slots[i]=initial;return [harness.slots[i],(v:any)=>{harness.slots[i]=v;}];},useRef:(initial:any)=>{const i=harness.cursor++;return harness.slots[i]??(harness.slots[i]={current:initial});},useEffect:(fn:any)=>{if(harness.effects++<3)fn();}}));
vi.mock('react-native',()=>({AppState:{currentState:'active',addEventListener:()=>({remove(){}})},View:'View',Text:'Text',Pressable:'Pressable'}));
vi.mock('react-native-webview',()=>({WebView:'WebView'}));
vi.mock('./placeWebView',()=>({PlaceWebView:'PlaceWebView'}));
vi.mock('./webQueue',async()=>{const real=await vi.importActual<any>('./webQueue');return {...real,attachCollector:(handler:any)=>{harness.dispatch=handler;return ()=>{};}};});
vi.mock('./license',()=>({storage:()=>({getItem:async()=>null,setItem:async()=>{}})}));
beforeEach(()=>{harness.slots=[];harness.cursor=0;harness.effects=0;harness.navigations=[];harness.resolve.mockReset();harness.reject.mockReset();vi.resetModules();vi.useFakeTimers();});
afterEach(()=>vi.useRealTimers());
async function setup(target='123'){
 const {NaverRankHost}=await import('./webCollector');NaverRankHost();
 harness.dispatch({channel:'shopping',keyword:'검색',signal:new AbortController().signal,shoppingMatch:(rows:any[])=>rows.some(x=>x.id===target),resolve:harness.resolve,reject:harness.reject});
 harness.cursor=0;const tree=NaverRankHost() as any;
 const find=(node:any):any=>{if(!node)return;if(node.type==='WebView')return node;for(const child of [node.props?.children].flat(Infinity)){const found=find(child);if(found)return found;}};
 const view=find(tree);view.props.ref.current={injectJavaScript:(js:string)=>{if(js.startsWith('location.href='))harness.navigations.push(js);},stopLoading(){}};
 harness.navigations.push(view.props.source.uri);
 const message=(ids:string[])=>view.props.onMessage({nativeEvent:{data:JSON.stringify({html:'<script id="__NEXT_DATA__">'+JSON.stringify({props:{pageProps:{shoppingResult:{products:ids.map(id=>({productId:id,productTitle:'상품'}))}}}})+'</script>',text:'검색 결과',url:'https://m.search.naver.com',title:'검색'})}});
 return {view,message};
}
it('makes one navigation for a page-one match, with no home preparation',async()=>{
 const {message}=await setup();message(['123']);await vi.runAllTimersAsync();
 expect(harness.navigations).toHaveLength(1);expect(harness.navigations[0]).toContain('where=m_shop');expect(harness.resolve).toHaveBeenCalledOnce();
});
it('waits between pages, stops at page three, and never visits another route for a miss',async()=>{
 const {view,message}=await setup('missing');message(['1']);
 await vi.advanceTimersByTimeAsync(2999);expect(harness.navigations).toHaveLength(1);
 await vi.advanceTimersByTimeAsync(3001);expect(harness.navigations).toHaveLength(2);
 view.props.onLoadStart();message(['2']);await vi.advanceTimersByTimeAsync(6000);
 expect(harness.navigations).toHaveLength(3);view.props.onLoadStart();message(['3']);await vi.runAllTimersAsync();
 expect(harness.navigations).toHaveLength(3);expect(harness.resolve).toHaveBeenCalledOnce();
 expect(harness.resolve.mock.calls[0][0].map((x:any)=>x.rank)).toEqual([1,41,81]);
});
it('ends immediately on HTTP 429 without retry or route switching',async()=>{
 const {view}=await setup();view.props.onHttpError({nativeEvent:{statusCode:429}});await vi.runAllTimersAsync();
 expect(harness.navigations).toHaveLength(1);expect(harness.reject).toHaveBeenCalledWith(expect.objectContaining({code:'blocked_limit'}));
});
it('switches once after a clear network failure',async()=>{
 const {view,message}=await setup();view.props.onError();await vi.advanceTimersByTimeAsync(10000);
 expect(harness.navigations).toHaveLength(2);expect(harness.navigations[1]).toContain('msearch.shopping.naver.com');
 view.props.onLoadStart();message(['123']);expect(harness.resolve).toHaveBeenCalledOnce();
});
