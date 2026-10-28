// 사이트별 읽기를 의존 없는 파일 하나(standalone/readers.ts)로 묶는다: node scripts/gen-standalone-readers.cjs <esbuild 경로> [커밋 해시]
const fs = require('fs');
const path = require('path');
const esbuild = require(process.argv[2] || 'esbuild');
const rev = process.argv[3] || 'HEAD';
const root = path.join(__dirname, '..');
const out = path.join(require('os').tmpdir(), 'readers.bundle.cjs');
esbuild.buildSync({ entryPoints: [path.join(root, 'src/readers/readers.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: out, charset: 'utf8', logLevel: 'error' });
const pages = require(out).ORDER_PAGES;
const lines = [
  '/**',
  ` * 영테크 「불러오기」 주문 읽기 — 사이트별 주소와 웹뷰에서 돌리는 스크립트. 자동 생성(packages/receipt-link/scripts/gen-standalone-readers.cjs, ${rev}). 직접 고치지 말고 src/readers 에서 고친다.`,
  ' * script(목록) 는 즉시실행함수(끝에 true;), 외부 의존 없음. postMessage({type:"orders", site, orders:[{orderNo,orderedAt,amount,seller,title,payment,detailUrl?}], done, note?, shape?}) — 한 번에 50건 · 최근 30일 · 같은 script 를 다시 부르면 다음 묶음.',
  ' * detailScript(주문 상세 한 장) 는 detailUrl 을 연 페이지에서 돌린다: postMessage({type:"detail", site, ok, orderNo, orderedAt("YYYY-MM-DD HH:mm:ss"), secKnown, amount, seller?, title?, payment?}) 또는 {ok:false, note, shape?}. 모든 스크립트는 처음에 {type:"hello"} 를 한 번 보낸다(진단).',
  ' * 로그인된 실제 화면은 확인하지 못했다 — 모든 선택자는 가정(첫 실행으로 확인). 목록을 못 읽으면 note(no_list_found · wrong_page · login_needed · error)와, no_list_found/wrong_page/error 일 때 한 번 글자 없는 화면 모양 shape 를 보낸다.',
  ' */',
  "export type OrderSite = 'naver_shop' | 'naver_pay' | 'musinsa' | 'kurly';",
  'export const ORDER_PAGES: Record<OrderSite, { url: string; script: string; detailScript: string }> = {',
];
for (const k of ['naver_shop', 'naver_pay', 'musinsa', 'kurly']) lines.push(`  ${k}: { url: ${JSON.stringify(pages[k].url)}, script: ${JSON.stringify(pages[k].script)}, detailScript: ${JSON.stringify(pages[k].detailScript)} },`);
lines.push('};');
fs.writeFileSync(path.join(root, 'standalone/readers.ts'), lines.join('\n') + '\n');
