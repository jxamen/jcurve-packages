const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, texts, walk, byLabel, tick} = require('./harness.cjs');
const api = require('../dist');

const TODAY = () => api.kstDate();
const mission = (id, points, extra = {}) => ({id, name: `일 ${id}`, points, todo: '하나 하기', level: 'easy', ...extra});
// what the server sends (앱보조5 10/27 23:01): the order of the array is the order of the tabs
const item = (key, name, points, extra = {}) => ({campaignKey: key, name, points, line: '가입하기', done: false, cost: null, icon: `https://static.example.com/${key}.png`, ...extra});
const cat = (key, title, total, items, extra = {}) => ({key, title, total_points: total, count: items.length, items, ...extra});
const serverCategories = () => [
  cat('signup', '회원가입', 3564, [item('1889588848', 'Body Healty 리포트', 4680, {cost: '유료 (결제 필요)'}), item('11', '알바천국', 806), item('12', '아이부자', 576), item('13', 'STO Network', 432)]),
  cat('trial', '무료체험', null, [
    item('517758719', '로맨스 판타지 웹툰 굿툰', 1440, {line: '무료체험 신청하기', cost: '체험 뒤 자동 결제', trial_days: 7}),
    item('1781115240', '집핏', 1080, {line: '무료체험 신청하기', cost: '체험 뒤 월 29,900원', trial_days: 7, charge_amount: 29900}),
  ]),
  cat('game', '게임', 4234308, [item('2083390082', '황야의 생존자', 226930, {line: '멀티미션 달성하기 · 30일 안'})]),
  cat('insurance', '보험', 5112, [item('1327680129', 'AXA 다이렉트 자동차 보험 연 보험료 30만원이상', 9360, {line: '신규 가입하기', cost: '보험료 납입 필요'})]),
  cat('shop', '쇼핑', null, [item('777000', '메디필', 2592, {line: '3만원 이상 구매하기', cost: '3만원 이상 구매'})]),
  cat('etc', '그 밖', 120, [item('9001', '설문 하나', 120, {line: '참여하기'})]),
];
const norm = (over = {}) => api.normalizeTodayCombos({date: TODAY(), bundles: [{goal: 1000, missions: [mission('b1', 1000)]}], categories: serverCategories(), ...over});

test('categories (server): tabs in the server\'s order with their titles, totals (null = none), items; the old fields stay as they were', () => {
  const data = norm();
  assert.deepEqual(data.categories.map(c => [c.key, c.title]), [['signup', '회원가입'], ['trial', '무료체험'], ['game', '게임'], ['insurance', '보험'], ['shop', '쇼핑'], ['etc', '그 밖']]);
  assert.deepEqual(data.categories.map(c => c.totalPoints), [3564, null, 4234308, 5112, null, 120]);
  assert.deepEqual(data.categories[0].items[0], {
    campaignKey: '1889588848', name: 'Body Healty 리포트', points: 4680, icon: 'https://static.example.com/1889588848.png', line: '가입하기', cost: '유료 (결제 필요)',
  });
  assert.deepEqual(data.categories[0].items[1], {campaignKey: '11', name: '알바천국', points: 806, icon: 'https://static.example.com/11.png', line: '가입하기'}, 'cost null = none, done false = none');
  assert.deepEqual(data.categories[1].items[1].trialDays, 7);
  assert.equal(data.categories[1].items[1].chargeAmount, 29900);
  assert.equal(data.categories[2].items[0].line, '멀티미션 달성하기 · 30일 안', 'a game: goal and time limit on the line');
  assert.equal(data.bundles[0].total, 1000, 'the steps are as they were');
  assert.equal(norm({categories: undefined}).categories, undefined);
});

test('categories: a tab needs a key, a title (or a known key) and one usable item; rows need key, name and points; junk is dropped, never guessed', () => {
  const data = norm({categories: [
    cat('signup', '회원가입', 100, [item('1', 'a', 100), item('1', '같은 키', 100), item('2', '', 50), item('', 'x', 5), item('3', 'p', 0), null, 5, item(4, '숫자 키', 40), item('5', 'n', 10, {icon: 'http://x.example.com/i.png', cost: '', line: ''})]),
    {key: 'follow', items: [item('6', '제목 없이 키만', 10)]},
    {key: 'zzz', items: [item('7', '모르는 키', 10)]},
    cat('signup', '또 회원가입', 5, [item('8', '같은 탭', 5)]),
    cat('empty', '빈 탭', 0, []),
    cat('allbad', '전부 이상', 0, [item('', 'x', 1)]),
    {key: 'noitems', title: '배열 아님', items: 'x'},
    null, 3, 'x',
  ]});
  assert.deepEqual(data.categories.map(c => c.key), ['signup', 'follow']);
  assert.deepEqual(data.categories[0].items.map(i => i.campaignKey), ['1', '4', '5']);
  assert.equal(data.categories[1].title, '팔로우·구독', 'the known name of the key');
  assert.equal('icon' in data.categories[0].items[2], false, 'an http icon is dropped');
  assert.equal('cost' in data.categories[0].items[2], false, 'an empty cost is none');
  for (const bad of [undefined, null, [], 'x', 5, {}]) assert.equal(norm({categories: bad}).categories, undefined, JSON.stringify(bad));
  assert.deepEqual(api.normalizeTodayCombos(norm()), norm(), 'normalizing twice is the same');
});

test('categories: sold-out keys leave the tab (unless paid today or marked done); the done flag is kept; a tab with nothing left disappears', () => {
  const data = norm({categories: [cat('signup', '회원가입', 10, [item('1', 'a', 5), item('2', 'b', 5), item('3', 'c', 5, {done: true})]), cat('game', '게임', 5, [item('9', 'g', 5)])], soldout: ['1', '3', '9']});
  assert.deepEqual(data.categories.map(c => c.key), ['signup']);
  assert.deepEqual(data.categories[0].items.map(i => i.campaignKey), ['2', '3']);
  assert.equal(data.categories[0].items[1].done, true);
  assert.deepEqual([...api.autoDoneIds(data)], ['3'], 'the server\'s own done mark counts as paid today');
});

test('categories: lots of items are kept (a game tab has hundreds), up to a sanity limit', () => {
  const many = Array.from({length: 700}, (_, i) => item(String(10000 + i), `게임 ${i}`, 100 + i));
  const data = norm({categories: [cat('game', '게임', 1, many, {count: 700})]});
  assert.equal(data.categories[0].items.length, 600);
  assert.equal(data.categories[0].count, 700, 'the server\'s own count is kept as it came');
});

// ---- the screen ----
const props = (extra = {}) => ({onClose() {}, onPressMission() {}, ...extra});
const tabLabels = tree => walk(tree).filter(n => n.type === 'Pressable' && n.props.accessibilityState && 'selected' in n.props.accessibilityState).map(n => n.props.accessibilityLabel);
const tabState = tree => walk(tree).filter(n => n.type === 'Pressable' && n.props.accessibilityState && 'selected' in n.props.accessibilityState).map(n => n.props.accessibilityState.selected);
const open = (host, combos, extra = {}) => host.render(() => api.ComboGuideScreen(props({combos, ...extra})));
const rowNumbers = tree => walk(tree).filter(n => n.type === 'View' && n.props.style && n.props.style.width === 30 && n.props.style.borderRadius === 15).map(n => texts(n)[0]);

test('category screen: one tab per category in the server\'s order (the row scrolls sideways), the first is open; without categories it is the steps screen', () => withReact(({host, make}) => {
  const tree = open(host, norm());
  assert.deepEqual(tabLabels(tree), ['회원가입', '무료체험', '게임', '보험', '쇼핑', '그 밖']);
  assert.deepEqual(tabState(tree), [true, false, false, false, false, false]);
  assert.ok(walk(tree).find(n => n.type === 'ScrollView' && n.props.horizontal === true), 'many tabs: a sideways scrolling row');
  // a fresh host (the harness keeps hook slots per host; a real app remounts when the screen type changes)
  const steps = open(make(), norm({categories: undefined, easy: {missions: [mission('e1', 100)]}}));
  assert.deepEqual(tabLabels(steps), ['쉽게 모으기', '1단계 1천P'], 'no categories: the steps screen, as it always was');
}));

test('category screen: the total line is the server\'s total (「다 하면 +N P」); rows are numbered with the condition line, +P, and a pill only for what costs money', () => withReact(({host}) => {
  const tree = open(host, norm());
  const all = texts(tree);
  assert.ok(all.includes('다 하면') && all.includes('+3,564P'), 'the server total, as it is');
  assert.deepEqual(rowNumbers(tree), ['1', '2', '3', '4']);
  assert.ok(all.includes('Body Healty 리포트') && all.includes('알바천국'));
  assert.equal(all.filter(x => x === '가입하기').length, 4, 'the condition line of each row');
  assert.ok(all.includes('+4,680P') && all.includes('+806P'));
  assert.deepEqual(all.filter(x => x === '유료 (결제 필요)'), ['유료 (결제 필요)'], 'a pill for the paid one only');
  assert.equal(all.some(x => x.includes('돈이 드는 항목')), false);
}));

test('category screen: 무료체험 has no total, just the cancel note, rows with their cost pills; 쇼핑 says there is no total; 게임 shows goal and time limit', () => withReact(({host}) => {
  const combos = norm();
  byLabel(open(host, combos), '무료체험').props.onPress();
  const trial = texts(open(host, combos));
  assert.ok(trial.includes('끝나기 전에 해지하면 무료 · 해지 안내를 받을 수 있어요'), 'the old note, as it was');
  assert.equal(trial.includes('다 하면'), false, 'no total');
  assert.ok(trial.includes('체험 뒤 월 29,900원') && trial.includes('체험 뒤 자동 결제'), 'the pills');
  assert.ok(trial.some(x => x.includes('기간이 끝나면 자동으로 결제돼요')), 'the trial footer');
  byLabel(open(host, combos), '쇼핑').props.onPress();
  const shop = texts(open(host, combos));
  assert.ok(shop.includes('돈이 드는 항목이라 합계에는 넣지 않았어요') && shop.includes('3만원 이상 구매'));
  byLabel(open(host, combos), '게임').props.onPress();
  const game = texts(open(host, combos));
  assert.ok(game.includes('다 하면') && game.includes('+4,234,308P'));
  assert.ok(game.includes('멀티미션 달성하기 · 30일 안'));
}));

test('category screen: a tap gives the row as a mission (id and campaignKey = the key); rows the server marked done are ✓ at the bottom and leave the remaining sum', () => withReact(({host}) => {
  const tapped = [];
  const combos = norm({categories: [cat('signup', '회원가입', 1000, [item('1', 'a', 600), item('2', 'b', 300, {done: true}), item('3', 'c', 100, {cost: '월 1,100원'})])]});
  const tree = open(host, combos, {onPressMission: (m, b) => tapped.push([m, b])});
  assert.deepEqual(rowNumbers(tree), ['1', '2', '✓'], 'open rows first, numbers again, the done one last');
  const all = texts(tree);
  assert.ok(all.includes('남은 합계') && all.includes('+700P'), '1000 − the done 300 (c costs money, it was never in the total)');
  byLabel(tree, '1번 a', true).props.onPress();
  assert.equal(tapped[0][0].id, '1');
  assert.equal(tapped[0][0].campaignKey, '1');
  assert.equal(tapped[0][0].name, 'a');
  assert.equal(tapped[0][1].goal, 0);
  assert.equal(byLabel(tree, 'b, 완료').props.disabled, true, 'a done row cannot be tapped');
}));

test('category screen: hand ticks work by campaign key; everything done says so', () => withReact(({host}) => {
  const ticks = [];
  const combos = norm({categories: [cat('signup', '회원가입', 900, [item('1', 'a', 600), item('2', 'b', 300)])]});
  const tree = open(host, combos, {onToggleDone: id => ticks.push(id)});
  byLabel(tree, 'a 완료 표시').props.onPress();
  assert.deepEqual(ticks, ['1']);
  const some = open(host, combos, {done: new Set(['1'])});
  assert.ok(texts(some).includes('남은 합계') && texts(some).includes('+300P'));
  const all = open(host, combos, {done: new Set(['1', '2'])});
  assert.ok(texts(all).includes('모두 마쳤어요'));
}));

test('category screen: a long tab shows 40 rows and 「더 보기」 adds 40 more; each tab remembers its own count', () => withReact(({host}) => {
  const many = Array.from({length: 130}, (_, i) => item(String(5000 + i), `게임 ${i}`, 1000 - i));
  const combos = norm({categories: [cat('game', '게임', 99999, many), cat('shop', '쇼핑', null, [item('9', '메디필', 100, {cost: '3만원 이상 구매'})])]});
  const names = tree => texts(tree).filter(x => /^게임 \d+$/.test(x));
  const tree = open(host, combos);
  assert.equal(names(tree).length, api.COMBO_CATEGORY_PAGE);
  assert.equal(api.COMBO_CATEGORY_PAGE, 40);
  assert.ok(texts(tree).includes('더 보기 (90개 남음)'));
  byLabel(tree, '더 보기, 90개 남음').props.onPress();
  const more = open(host, combos);
  assert.equal(names(more).length, 80);
  assert.ok(texts(more).includes('더 보기 (50개 남음)'));
  byLabel(more, '더 보기, 50개 남음').props.onPress(); byLabel(open(host, combos), '더 보기, 10개 남음').props.onPress();
  const all = open(host, combos);
  assert.equal(names(all).length, 130);
  assert.equal(texts(all).some(x => x.startsWith('더 보기')), false, 'nothing left to add');
  assert.deepEqual(rowNumbers(all).slice(0, 3), ['1', '2', '3']);
}));

// ---- the entry: a trial row asks first, saying what the trial costs ----
const NATIVE = {nativeModules: {JCurveOfferwallModule: {}}};
