import {nextData,record} from './naver';
export function parsePlacePage(html:string,page:number):{id:string;rank:number}[]{
 const props=record(record(nextData(html)).props);const data=record(props.pageProps);
 const rows=record(data.placeList).items;
 if(!Array.isArray(rows))throw Error('네이버 플레이스 검색 응답 형식을 확인할 수 없어요');
 return rows.map((row,index)=>{const id=record(row).id;if(!/^\d+$/.test(String(id)))throw Error('플레이스 번호를 확인할 수 없어요');return {id:String(id),rank:(page-1)*30+index+1};});
}
