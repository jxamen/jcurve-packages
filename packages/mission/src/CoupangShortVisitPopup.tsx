import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

export type CoupangShortVisitPopupProps = { seconds: number; points: number; onRetry: () => void; onClose: () => void };
/** Apps can render these actions with their existing common popup. */
export function CoupangShortVisitPopup({ seconds, points, onRetry, onClose }: CoupangShortVisitPopupProps) {
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 340, padding: 24, borderRadius: 20, backgroundColor: '#FFFFFF', gap: 16 }}>
        <Text accessibilityRole="header" style={{ fontSize: 19, fontWeight: '700', textAlign: 'center' }}>조금만 더 둘러봐 주세요</Text>
        <Text style={{ fontSize: 15, lineHeight: 22, color: '#6B7684', textAlign: 'center' }}>쿠팡에서 {seconds}초 이상 둘러보면 {points}P 를 받아요.</Text>
        <Pressable accessibilityRole="button" onPress={onRetry} style={{ padding: 16, backgroundColor: '#2F6BFF', borderRadius: 16 }}><Text style={{ color: '#FFFFFF', textAlign: 'center', fontWeight: '700' }}>다시 방문하기</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={onClose} style={{ padding: 12 }}><Text style={{ textAlign: 'center' }}>닫기</Text></Pressable>
      </View>
    </View>
  </Modal>;
}
