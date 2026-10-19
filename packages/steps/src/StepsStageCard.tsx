import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { canClaimStage, type StepsStage, type StepsState } from './stages';
export function StepsStageCard({ state, disabled = false, onWatchAd, onClaim, onError }: {
  state: StepsState; disabled?: boolean; onWatchAd: (stage: StepsStage) => Promise<boolean>;
  onClaim: (stage: StepsStage, day: string) => Promise<void>; onError: (error: unknown) => void;
}) {
  const lock = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);
  async function claim(stage: StepsStage) {
    if (lock.current || disabled || !canClaimStage(state, stage)) return;
    lock.current = true; setBusy(stage.stage_id);
    try { if (await onWatchAd(stage)) await onClaim(stage, state.day); } catch (error) { onError(error); }
    finally { lock.current = false; setBusy(null); }
  }
  return <View style={{ gap: 12, padding: 16 }}>
    <Text style={{ fontSize: 28, fontWeight: '700' }}>오늘 {state.today_steps.toLocaleString()}걸음</Text>
    <Text>오늘 {state.earned_today} / {state.daily_max}P · 한국시간 자정 초기화 · 미수령 이월 없음</Text>
    {state.stages.map(stage => <View key={stage.stage_id} style={{ padding: 16, borderRadius: 16, backgroundColor: stage.claimed ? '#eee' : '#fff4e8', gap: 8 }}>
      <Text>{stage.threshold === 1 ? '첫걸음' : stage.threshold.toLocaleString() + '걸음'} 상자 · {stage.points}</Text>
      <Pressable accessibilityRole="button" disabled={disabled || busy !== null || !canClaimStage(state, stage)}
        onPress={() => { void claim(stage); }} style={{ padding: 12, borderRadius: 10, backgroundColor: stage.claimed || !canClaimStage(state, stage) || disabled ? '#ddd' : '#ff922e' }}>
        <Text>{stage.claimed ? '완료' : busy === stage.stage_id ? '확인 중…' : `광고 보고 ${stage.points}P`}</Text>
      </Pressable>
    </View>)}
  </View>;
}
