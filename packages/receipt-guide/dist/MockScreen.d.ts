/**
 * 가짜 앱 화면 — data.ts 의 줄(MockNode)을 막대 · 둥근 카드 · 글자로 그린다.
 *
 * 진짜 앱의 로고 · 그림은 쓰지 않는다. 앱 색(accent)은 탭 밑줄 · 칩 · 채운 버튼에만 옅게 쓴다.
 * 누를 곳(`tap`)은 `Spot` 으로 감싼다 — 재생기가 그 자리를 재어 손가락을 보낸다.
 */
import React from 'react';
import { Animated, View } from 'react-native';
import type { MockNode } from './types';
/**
 * 재생기가 내려 주는 것 — 누를 곳 자리 알리기 + 깜빡이는 값.
 * glowOp · glowSc 는 재생기의 장면 진행 값에서 나온다(장면마다 두 번 크게 깜빡). 움직임 줄이기면 숫자(고정).
 */
export type SpotLink = {
    report: (node: View | null) => void;
    glowOp: Animated.AnimatedInterpolation<number> | number;
    glowSc: Animated.AnimatedInterpolation<number> | number;
};
export declare const SpotCtx: React.Context<SpotLink | null>;
export declare function MockScreen({ nodes, accent, scrolled }: {
    nodes: MockNode[];
    accent: string;
    scrolled?: boolean;
}): React.JSX.Element;
