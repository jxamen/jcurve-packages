const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, texts, walk, byLabel} = require('./harness.cjs');
const api = require('../dist');

const TODAY = () => api.kstDate();
const mission = (id, points, extra = {}) => ({id, name: `일 ${id}`, points, todo: '하나 하기', level: 'easy', ...extra});
const combos = (over = {}) => api.normalizeTodayCombos({date: TODAY(), bundles: [{goal: 1000, missions: [mission('b1', 1000)]}, {goal: 5000, missions: [mission('b5', 5000)]}], ...over});
const props = (extra = {}) => ({onClose() {}, onPressMission() {}, ...extra});
const withImage = ({rn}) => { rn.Image = 'Image'; };

test('icon: only an https address is kept (aliases icon_url / iconUrl too); anything else is dropped', () => {
  const out = combos({easy: {missions: [
    mission('a', 100, {icon: 'https://cdn.example.com/a.png'}),
    mission('b', 100, {icon_url: 'https://cdn.example.com/b.png'}),
    mission('c', 100, {iconUrl: 'https://cdn.example.com/c.png'}),
    mission('d', 100, {icon: 'http://cdn.example.com/d.png'}),
    mission('e', 100, {icon: 'data:image/png;base64,AAAA'}),
    mission('f', 100, {icon: 'javascript:alert(1)'}),
    mission('g', 100, {icon: 'https://has space.com/x.png'}),
    mission('h', 100),
  ]}});
  assert.deepEqual(out.easy.missions.map(m => m.icon), ['https://cdn.example.com/a.png', 'https://cdn.example.com/b.png', 'https://cdn.example.com/c.png', undefined, undefined, undefined, undefined, undefined]);
});

test('icon: a picture when there is one, else the first letter (whole character, emoji too); a picture that fails to load falls back', () => withReact(async ctx => {
  withImage(ctx);
  const {host} = ctx;
  const mount = props => host.render(() => api.ComboMissionIcon(props));
  const pic = mount({name: '삼성생명', uri: 'https://cdn.example.com/a.png'});
  assert.equal(pic.type, 'Image');
  assert.equal(pic.props.source.uri, 'https://cdn.example.com/a.png');
  assert.equal(pic.props.style.width, 44);
  assert.equal(pic.props.style.borderRadius, 10, 'square with rounded corners');
  pic.props.onError();
  const fallback = mount({name: '삼성생명', uri: 'https://cdn.example.com/a.png'});
  assert.equal(fallback.type, 'View', 'the letter circle after an error');
  assert.deepEqual(texts(fallback), ['삼']);
  const letter = mount({name: '  VIA SHINSEGAE'});
  assert.deepEqual(texts(letter), ['V']);
  assert.equal(letter.props.style.borderRadius, 22, 'a circle');
  assert.deepEqual(texts(mount({name: '😀 이모지'})), ['😀']);
  assert.deepEqual(texts(mount({name: '   '})), ['·']);
}));

test('row: the whole row is the button; a number circle first; name and what-to-do are one line each; points right; a small check last; no big button, no picture', () => withReact(({host, rn}) => {
  rn.Image = 'Image';
  const picked = [];
  const data = combos({easy: {missions: [mission('e1', 102, {name: '리아버거가게 유튜브', todo: '구독하기', minutes: 3, icon: 'https://cdn.example.com/e1.png'})]}});
  const tree = host.render(() => api.ComboGuideScreen(props({combos: data, onPressMission: m => picked.push(m.id), onToggleDone() {}})));
  const row = byLabel(tree, '1번 리아버거가게 유튜브', true);
  row.props.onPress();
  assert.deepEqual(picked, ['e1'], 'tapping the row reports the mission');
  const rowStyle = row.props.style({pressed: false});
  assert.equal(rowStyle.flexDirection, 'row');
  assert.equal(rowStyle.paddingVertical, 12);
  const inside = walk(row);
  assert.equal(inside.some(n => n.type === 'Image'), false, 'no campaign picture in the row (numbers instead)');
  const badge = inside.find(n => n.type === 'View' && n.props.style && n.props.style.width === 30 && n.props.style.borderRadius === 15);
  assert.ok(badge, 'a 30 px number circle on the left');
  assert.deepEqual(texts(badge), ['1']);
  assert.equal(badge.props.style.backgroundColor, '#F2F4F6', 'shopping-tab grey');
  assert.equal(inside.indexOf(badge) < inside.indexOf(inside.find(n => n.type === 'Text' && n.children[0] === '리아버거가게 유튜브')), true, 'number comes before the name');
  const name = inside.find(n => n.type === 'Text' && n.children[0] === '리아버거가게 유튜브');
  assert.equal(name.props.numberOfLines, 1);
  assert.equal(name.props.ellipsizeMode, 'tail');
  const todoText = inside.find(n => n.type === 'Text' && n.children[0] === '구독하기');
  assert.equal(todoText.props.numberOfLines, 1);
  assert.ok(texts(row).includes('+102P'));
  const texted = texts(row);
  assert.equal(texted.includes('하러 가기 ›'), false);
  assert.equal(texted.some(t => /쉬움|약 3분/.test(t)), false, 'no level / time chip');
  assert.equal(texted.includes('1'), true, 'the number');
  const check = inside.find(n => n.type === 'Pressable' && n.props.accessibilityRole === 'checkbox');
  assert.equal(check.props.style.width, 22, 'a small check');
  assert.equal(inside.indexOf(check) > inside.indexOf(name), true, 'check comes after the text, at the right');
}));

test('row: ticking works from the small check; a ticked row dims, strikes the name and shows ✓; points keep showing', () => withReact(({host, rn}) => {
  rn.Image = 'Image';
  const ticks = [];
  const data = combos({easy: {missions: [mission('e1', 102), mission('e2', 150)]}});
  const tree = host.render(() => api.ComboGuideScreen(props({combos: data, done: new Set(['e1']), onToggleDone: id => ticks.push(id)})));
  byLabel(tree, '일 e2 완료 표시').props.onPress();
  assert.deepEqual(ticks, ['e2']);
  const doneRow = byLabel(tree, '일 e1, 완료');
  assert.equal(doneRow.props.disabled, true);
  assert.equal(doneRow.props.style({pressed: false}).opacity, 0.5);
  const strike = walk(doneRow).find(n => n.type === 'Text' && n.children[0] === '일 e1');
  assert.equal(strike.props.style.textDecorationLine, 'line-through');
  assert.ok(texts(doneRow).includes('✓') && texts(doneRow).includes('+102P'));
  assert.equal(byLabel(tree, '일 e1 완료 표시').props.accessibilityState.checked, true);
}));

test('look: white sheet header is thin (title + 닫기), tabs are small flat chips (34 high), the selected one is soft-coloured, the sum is one line', () => withReact(({host, rn}) => {
  rn.Image = 'Image';
  const theme = {...api.DEFAULT_COMBO_THEME, bg: '#FFFFFF', chipBg: '#F2F4F6'};
  const data = combos({easy: {missions: [mission('e1', 102), mission('e2', 150)]}});
  const tree = host.render(() => api.ComboGuideScreen(props({combos: data, variant: 'sheet', theme})));
  const root = tree;
  assert.equal(root.props.style.backgroundColor, '#FFFFFF');
  const header = walk(root).find(n => n.type === 'View' && n.props.style && n.props.style.height === 52);
  assert.ok(header, 'thin 52 header');
  assert.deepEqual(texts(header), ['포인트 빨리 모으기', '닫기']);
  const easyChip = byLabel(tree, '쉽게 모으기');
  const stepChip = byLabel(tree, '1단계 1천P');
  assert.equal(easyChip.props.style.height, 34);
  assert.equal(easyChip.props.style.borderRadius, 17);
  assert.equal(easyChip.props.style.backgroundColor, theme.accentSoft, 'selected: soft colour');
  assert.equal(stepChip.props.style.backgroundColor, '#F2F4F6', 'not selected: flat grey');
  assert.deepEqual(texts(stepChip), ['1천P']);
  // the sum: one short line, label + amount
  const sumLine = walk(root).find(n => n.type === 'View' && texts(n).join('|') === '다 하면|+252P');
  assert.ok(sumLine, 'one line: 다 하면 +252P');
  // no cards: nothing with a border-radius card + shadow wraps the list any more
  assert.equal(walk(root).some(n => n.props?.style && n.props.style.shadowOpacity !== undefined), false, 'no shadowed cards');
}));

test('look: without the chipBg token the unselected chip is still the shopping grey; the loading and empty states still read', () => withReact(({host, rn}) => {
  rn.Image = 'Image';
  const tree = host.render(() => api.ComboGuideScreen(props({combos: combos()})));
  assert.equal(byLabel(tree, '2단계 5천P').props.style.backgroundColor, '#F2F4F6');
  assert.ok(texts(host.render(() => api.ComboGuideScreen(props({combos: null, loading: true})))).includes('불러오고 있어요'));
  assert.ok(texts(host.render(() => api.ComboGuideScreen(props({combos: null})))).some(t => t.includes('준비하고 있어요')));
}));

test('numbers: only the rows not done get a number, counted again from 1; done rows show ✓ and sink', () => withReact(({host}) => {
  const data = combos({easy: {missions: [mission('e1', 10), mission('e2', 20), mission('e3', 30), mission('e4', 40)]}});
  const tree = host.render(() => api.ComboGuideScreen(props({combos: data, done: new Set(['e2']), onToggleDone() {}})));
  const circles = walk(tree).filter(n => n.type === 'View' && n.props.style && n.props.style.width === 30 && n.props.style.borderRadius === 15).map(n => texts(n)[0]);
  assert.deepEqual(circles, ['1', '2', '3', '✓'], 'e1 e3 e4 are 1 2 3, the done e2 is last with ✓');
  assert.ok(byLabel(tree, '1번 일 e1', true) && byLabel(tree, '2번 일 e3', true) && byLabel(tree, '3번 일 e4', true));
  const doneBadge = walk(byLabel(tree, '일 e2, 완료')).find(n => n.type === 'View' && n.props.style && n.props.style.width === 30);
  assert.deepEqual(texts(doneBadge), ['✓']);
}));

test('numbers: the 「한 번에 끝내기」 list counts on its own from 1; the server icon is parsed but not drawn in rows', () => withReact(({host}) => {
  const data = combos({singles: [{goal: 1000, missions: [mission('s1', 1008, {icon: 'https://cdn.example.com/s1.png'}), mission('s2', 2592)]}]});
  assert.equal(data.singles[0].missions[0].icon, 'https://cdn.example.com/s1.png', 'still parsed');
  const tree = host.render(() => api.ComboGuideScreen(props({combos: data})));
  const circles = walk(tree).filter(n => n.type === 'View' && n.props.style && n.props.style.width === 30 && n.props.style.borderRadius === 15).map(n => texts(n)[0]);
  assert.deepEqual(circles, ['1', '1', '2'], 'the step list (1 row) and then the singles list (1, 2)');
  assert.equal(walk(tree).some(n => n.type === 'Image'), false);
}));
