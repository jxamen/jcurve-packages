export function nextData(html:string):unknown {
 const raw=html.match(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
 if(!raw)throw Error('네이버 검색 응답 형식이 바뀌었거나 직접 조회가 제한됐어요');
 try{return JSON.parse(raw);}catch{throw Error('네이버 검색 결과를 해석하지 못했어요');}
}
export const record=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'?v as Record<string,unknown>:{};
