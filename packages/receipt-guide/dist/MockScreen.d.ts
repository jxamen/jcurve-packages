/**
 * 가짜 앱 화면 — data.ts 의 줄(MockNode)을 막대 · 둥근 카드 · 글자로 그린다.
 *
 * 진짜 앱의 로고 · 그림은 쓰지 않는다. 앱 색(accent)은 탭 밑줄 · 칩 · 채운 버튼에만 옅게 쓴다.
 * 누를 곳(`tap`)은 `Spot` 으로 감싼다 — 재생기가 그 자리를 재어 손가락을 보낸다.
 */
import React from 'react';
import { View } from 'react-native';
import type { MockNode } from './types';
/** 누를 곳이 그려지면 재생기에 알린다 */
export declare const SpotCtx: React.Context<((node: View | null) => void) | null>;
export declare function MockScreen({ nodes, accent, scrolled }: {
    nodes: MockNode[];
    accent: string;
    scrolled?: boolean;
}): React.JSX.Element;
