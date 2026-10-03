/**
 * 가짜 앱 화면 — data.ts 의 줄(MockNode)을 막대 · 둥근 카드 · 글자로 그린다.
 *
 * 진짜 앱의 로고 · 그림은 쓰지 않는다. 앱 색(accent)은 탭 밑줄 · 칩 · 채운 버튼에만 옅게 쓴다.
 * 누를 곳(`tap`)은 `Spot` 으로 감싼다 — 재생기가 그 자리를 재어 손가락을 보낸다.
 */
import React, { createContext, useContext, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import type { MockNode, NavItem } from './types';
import { T, row, useGuideTheme } from './ui';

/**
 * 재생기가 내려 주는 것 — 누를 곳 자리 알리기 + 깜빡이는 값.
 * glowOp · glowSc 는 재생기의 장면 진행 값에서 나온다(장면마다 두 번 크게 깜빡). 움직임 줄이기면 숫자(고정).
 */
export type SpotLink = {
  report: (node: View | null) => void;
  glowOp: Animated.AnimatedInterpolation<number> | number;
  glowSc: Animated.AnimatedInterpolation<number> | number;
};
export const SpotCtx = createContext<SpotLink | null>(null);

/**
 * 누를 곳 — **두꺼운 테두리 + 옅은 면이 함께 깜빡이고 살짝 커진다**(대표님 10-03 23:51 「영역 껌벅껌벅, 눈에 잘 띄게」).
 * 테두리는 바깥으로 4px 내서 원래 버튼 테두리와 겹쳐 묻히지 않게 한다.
 */
function Spot({ children, style, r = 10 }: { children: React.ReactNode; style?: ViewStyle; r?: number }) {
  const link = useContext(SpotCtx);
  const theme = useGuideTheme();
  const ref = useRef<View>(null);

  return (
    <View ref={ref} collapsable={false} style={style} onLayout={() => link?.report(ref.current)}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[s.glow, {
          borderRadius: r + 4, borderColor: theme.hot,
          opacity: link?.glowOp ?? 1, transform: [{ scale: link?.glowSc ?? 1 }],
        }]}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.hot, opacity: 0.16 }]} />
      </Animated.View>
    </View>
  );
}

/** 누를 곳이면 Spot, 아니면 그냥 */
function Maybe({ on, children, style, r }: { on: boolean; children: React.ReactNode; style?: ViewStyle; r?: number }) {
  return on ? <Spot style={style} r={r}>{children}</Spot> : <View style={style}>{children}</View>;
}

const GRAY = '#EEF0F4';
const soft = (hex: string) => (/^#[0-9a-f]{6}$/i.test(hex) ? hex + '1F' : GRAY);

export function MockScreen({ nodes, accent, scrolled }: { nodes: MockNode[]; accent: string; scrolled?: boolean }) {
  const theme = useGuideTheme();
  const nav = nodes.find((n): n is Extract<MockNode, { type: 'nav' }> => n.type === 'nav');
  const menu = nodes.find((n): n is Extract<MockNode, { type: 'menu' }> => n.type === 'menu');

  return (
    <View style={{ flex: 1, backgroundColor: theme.card }}>
      {scrolled ? (
        <View style={[s.scrolled, { borderColor: theme.line }]}><T size={13} w={700} color={theme.sub}>⋯ 위에서 이어져요</T></View>
      ) : null}
      <View style={{ flex: 1, paddingBottom: nav ? 58 : 0 }}>
        {nodes.map((n, i) => (n.type === 'nav' || n.type === 'menu' ? null : <Node key={i} node={n} accent={accent} />))}
      </View>
      {nav ? <Nav node={nav} accent={accent} /> : null}
      {menu ? <Menu node={menu} /> : null}
    </View>
  );
}

function Node({ node, accent }: { node: MockNode; accent: string }) {
  const theme = useGuideTheme();
  switch (node.type) {
    case 'header':
      return (
        <View style={[row, s.header, { borderColor: theme.line, gap: 6 }]}>
          {node.back ? <T size={20} w={700} color={theme.sub}>‹</T> : null}
          {node.left ? (
            <Maybe on={node.tap === 'left'} r={8}>
              <T size={15} w={900} color={accent} style={{ paddingHorizontal: 8, paddingVertical: 3 }}>{node.left}</T>
            </Maybe>
          ) : null}
          <T size={15.5} w={900} center lines={1} style={{ flex: 1 }}>{node.title}</T>
          {node.right ? (
            <Maybe on={node.tap === 'right'} r={8}>
              <T size={14} w={800} color={theme.text} style={{ paddingHorizontal: 8, paddingVertical: 3 }}>{node.right}</T>
            </Maybe>
          ) : null}
          {node.close ? <T size={16} w={700} color={theme.sub}>✕</T> : null}
          {!node.back && !node.left ? <View style={{ width: 8 }} /> : null}
        </View>
      );
    case 'tabs':
      return (
        <View style={[row, { borderBottomWidth: 1, borderColor: theme.line }]}>
          {node.items.map((label, i) => (
            <Maybe key={label} on={node.tap === i} style={{ flex: 1 }}>
              <View style={[s.tab, { borderColor: node.on === i ? accent : 'transparent' }]}>
                <T size={14} w={node.on === i ? 900 : 700} color={node.on === i ? theme.text : theme.sub}>{label}</T>
              </View>
            </Maybe>
          ))}
        </View>
      );
    case 'chips':
      return (
        <View style={[row, s.pad, { gap: 8, flexWrap: 'wrap' }]}>
          {node.items.map((label, i) => (
            <Maybe key={label} on={node.tap === i} r={999}>
              <View style={[s.chip, { borderColor: node.on === i ? accent : theme.line, backgroundColor: node.on === i ? soft(accent) : theme.card }]}>
                <T size={13.5} w={node.on === i ? 900 : 700} color={node.on === i ? theme.text : theme.sub}>{label}</T>
              </View>
            </Maybe>
          ))}
        </View>
      );
    case 'section': {
      const title = <T size={15} w={900} lines={1} style={{ flexShrink: 1 }}>{node.title}</T>;
      return (
        <Maybe on={node.tap === 'title'} style={{ marginHorizontal: 8, marginTop: 10 }}>
          <View style={[row, { paddingHorizontal: 6, paddingVertical: 4, gap: 8 }]}>
            {title}
            <View style={{ flex: 1 }} />
            {(node.links ?? []).map((link, i) => (
              <Maybe key={link} on={node.tap === i}>
                <T size={13.5} w={800} color={theme.sub} style={{ paddingHorizontal: 4, paddingVertical: 2 }}>{link}</T>
              </Maybe>
            ))}
          </View>
        </Maybe>
      );
    }
    case 'order':
      return (
        <View style={[s.card, { borderColor: theme.line, opacity: node.dim ? 0.45 : 1 }]}>
          <View style={[row, { gap: 8 }]}>
            <T size={15} w={900} lines={1} style={{ flex: 1 }}>{node.shop}</T>
            {node.corner ? (
              <Maybe on={node.tap === 'corner'}>
                <T size={13.5} w={800} color={theme.sub} style={{ paddingHorizontal: 6, paddingVertical: 3 }}>{node.corner}</T>
              </Maybe>
            ) : null}
          </View>
          <T size={13} w={700} color={theme.sub} style={{ marginTop: 3 }}>{node.meta}</T>
          <View style={[row, { marginTop: 6, gap: 8 }]}>
            {node.amount ? <T size={15} w={900} style={{ flex: 1 }}>{node.amount}</T> : <View style={{ flex: 1 }} />}
            {node.button && node.small ? (
              <Maybe on={node.tap === 'button'} r={8}>
                <View style={[s.smallBtn, { borderColor: theme.line }]}><T size={13} w={800}>{node.button}</T></View>
              </Maybe>
            ) : null}
            {node.more ? (
              <Maybe on={node.tap === 'more'} r={8}>
                <T size={18} w={900} color={theme.sub} style={{ paddingHorizontal: 8 }}>…</T>
              </Maybe>
            ) : null}
          </View>
          {node.button && !node.small ? (
            <Maybe on={node.tap === 'button'} style={{ marginTop: 8 }} r={8}>
              <View style={[s.wideBtn, { borderColor: theme.line }]}><T size={14} w={800}>{node.button}</T></View>
            </Maybe>
          ) : null}
        </View>
      );
    case 'rows':
      return (
        <View style={[s.pad, { gap: 5, marginTop: 6 }]}>
          {node.rows.map(([k, v], i) => {
            const strong = node.strong === i;
            return (
              <Maybe key={k + i} on={node.tap === i} r={6}>
                <View style={[row, { paddingHorizontal: 4, paddingVertical: 1 }, strong && { borderTopWidth: 1, borderColor: theme.line, paddingTop: 6, marginTop: 2 }]}>
                  <T size={strong ? 14.5 : 13.5} w={strong ? 900 : 700} color={strong ? theme.text : theme.sub} style={{ flex: 1 }}>{k}</T>
                  <T size={strong ? 15 : 13.5} w={strong ? 900 : 700} lines={1}>{v}</T>
                </View>
              </Maybe>
            );
          })}
        </View>
      );
    case 'buttons':
      return (
        <View style={[row, s.pad, { gap: 8, marginTop: 12 }]}>
          {node.items.map((label, i) => {
            const solid = node.solid === i;
            return (
              <Maybe key={label} on={node.tap === i} style={{ flex: 1 }} r={10}>
                <View style={[s.wideBtn, { borderColor: solid ? accent : theme.line, backgroundColor: solid ? accent : theme.card }]}>
                  <T size={14} w={900} color={solid ? theme.white : theme.text}>{label}</T>
                </View>
              </Maybe>
            );
          })}
        </View>
      );
    case 'album':
      return <Album pick={node.pick} />;
    case 'bars':
      return (
        <View style={[s.pad, { marginTop: 8 }]}>
          {Array.from({ length: node.n ?? 3 }).map((_, i) => (
            <View key={i} style={{ width: `${[92, 70, 84, 58, 76][i % 5]}%`, height: 10, borderRadius: 5, backgroundColor: GRAY, marginTop: 9 }} />
          ))}
        </View>
      );
    default:
      return null;
  }
}

/** 사진첩 — 고를 사진(영수증)에는 고른 순서 번호 */
function Album({ pick }: { pick: number[] }) {
  const theme = useGuideTheme();

  return (
    <View style={[row, { flexWrap: 'wrap', padding: 4 }]}>
      {Array.from({ length: 12 }).map((_, i) => {
        const order = pick.indexOf(i);
        const tile = order >= 0 ? (
          <View style={[s.photo, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line, padding: 8 }]}>
            {[80, 60, 70, 50, 75].map((w, k) => <View key={k} style={{ width: `${w}%`, height: 5, borderRadius: 3, backgroundColor: GRAY, marginTop: 5 }} />)}
            <View style={[s.badge, { backgroundColor: theme.hot }]}><T size={13} w={900} color={theme.white}>{order + 1}</T></View>
          </View>
        ) : <View style={[s.photo, { backgroundColor: GRAY }]} />;

        return (
          <View key={i} style={{ width: '33.33%', padding: 3 }}>
            {order === 0 ? <Spot r={6}>{tile}</Spot> : tile}
          </View>
        );
      })}
    </View>
  );
}

/** 아래 탭 막대 */
function Nav({ node, accent }: { node: Extract<MockNode, { type: 'nav' }>; accent: string }) {
  const theme = useGuideTheme();

  return (
    <View style={[row, s.nav, { borderColor: theme.line, backgroundColor: theme.card }]}>
      {node.items.map((item: NavItem, i) => {
        const on = node.on === i;
        const color = on ? accent : theme.sub;
        const label = typeof item === 'string' ? item : item.label;
        const icon = typeof item === 'string'
          ? <View style={{ width: 18, height: 18, borderRadius: 5, backgroundColor: on ? accent : GRAY }} />
          : <Person color={on ? accent : theme.sub} />;

        return (
          <Maybe key={label + i} on={node.tap === i} style={{ flex: 1 }}>
            <View style={{ alignItems: 'center', paddingVertical: 6, gap: 3 }}>
              {icon}
              {typeof item === 'string' ? <T size={11.5} w={on ? 900 : 700} color={color} lines={1}>{label}</T> : <View style={{ height: 14 }} />}
            </View>
          </Maybe>
        );
      })}
    </View>
  );
}

/** 사람 모양 — 글자 없이 그림으로만 알아보는 탭(쿠팡 마이쿠팡) */
function Person({ color }: { color: string }) {
  return (
    <View style={{ width: 20, height: 18, alignItems: 'center' }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: color }} />
      <View style={{ width: 16, height: 8, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 2, borderBottomWidth: 0, borderColor: color, marginTop: 1 }} />
    </View>
  );
}

/** 아래에서 올라온 창 — 뒤는 어둡게 */
function Menu({ node }: { node: Extract<MockNode, { type: 'menu' }> }) {
  const theme = useGuideTheme();

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }]}>
      <View style={[s.sheet, { backgroundColor: theme.card }]}>
        <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: GRAY, marginBottom: 8 }} />
        {node.items.map((label, i) => (
          <Maybe key={label} on={node.tap === i} r={8}>
            <View style={{ paddingVertical: 12, paddingHorizontal: 10 }}><T size={15} w={800}>{label}</T></View>
          </Maybe>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  glow: { position: 'absolute', left: -4, right: -4, top: -4, bottom: -4, borderWidth: 4, overflow: 'hidden' },
  pad: { paddingHorizontal: 14 },
  header: { height: 46, paddingHorizontal: 12, borderBottomWidth: 1 },
  scrolled: { height: 26, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderStyle: 'dashed' },
  tab: { alignItems: 'center', paddingVertical: 11, borderBottomWidth: 3 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, marginTop: 10 },
  card: { marginHorizontal: 12, marginTop: 10, borderWidth: 1.5, borderRadius: 14, padding: 12 },
  smallBtn: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 },
  wideBtn: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  photo: { aspectRatio: 1, borderRadius: 6 },
  badge: { position: 'absolute', right: 4, top: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  nav: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 58, borderTopWidth: 1 },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 12, paddingBottom: 18 },
});
