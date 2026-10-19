import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

export type FloatingRewardChipProps = {
  visible: boolean;
  icon?: ReactNode;
  label: string;
  onPress: () => void;
  /** Distance from the bottom of the containing view, in points. */
  bottomOffset: number;
};

/** Place inside a positioned content view above the tab bar. */
export function FloatingRewardChip({ visible, icon, label, onPress, bottomOffset }: FloatingRewardChipProps) {
  const y = useRef(new Animated.Value(0)).current;
  // Stay still until the accessibility setting has been read.
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      changed = true;
      setReduceMotion(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active && !changed) setReduceMotion(value);
    }).catch(() => {});
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    y.setValue(0);
    if (!visible || reduceMotion) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: -4, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    animation.start();
    return () => { animation.stop(); y.setValue(0); };
  }, [visible, reduceMotion, y]);
  if (!visible) return null;
  return <View pointerEvents="box-none" style={[s.anchor, { bottom: bottomOffset }]}>
    <Animated.View style={{ maxWidth: '100%', transform: [{ translateY: y }] }}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
        style={({ pressed }) => [s.chip, pressed && { opacity: 0.8 }]}>
        <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {icon ?? <View style={s.ticket}><View style={s.ticketLine} /></View>}
        </View>
        <Text style={s.label}>{label}</Text>
        <Text accessible={false} style={s.arrow}>›</Text>
      </Pressable>
    </Animated.View>
  </View>;
}
const s = StyleSheet.create({
  anchor: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 10 },
  chip: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 999, backgroundColor: '#FFFFFF', shadowColor: '#17212E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 8, elevation: 6 },
  label: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: '#26333D' },
  arrow: { fontSize: 24, lineHeight: 24, color: '#77818B' },
  ticket: { width: 22, height: 16, borderWidth: 2, borderColor: '#7A4FD0', borderRadius: 4, transform: [{ rotate: '-12deg' }] },
  ticketLine: { height: 10, marginLeft: 11, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: '#7A4FD0' },
});
