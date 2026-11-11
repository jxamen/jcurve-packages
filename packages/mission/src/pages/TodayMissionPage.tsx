/**
 * 오늘의 미션 — 여러 미션에 참여하면 보너스 (0.4.0, carrot TodayMissionScreen 그대로).
 * 완료 표시는 앱이 아는 값(done)으로 정한다. 줄 어디를 눌러도 onGo 로 간다.
 * 전부 끝나면 「모두 완료하고 {bonus}P 받기」 — onClaim 이 보너스를 주고, 실패하면 다시 누르라고 적는다.
 */
import React, { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PageFrame, PageButton, resolvePageTheme, PAGE_BUTTON, type MissionPageTheme } from './PageFrame';
import { bonusButtonLabel, missionProgress, type MissionDone } from './logic';

/** 오늘 미션 한 줄 — done: true 완료 · false 아직 · null 앱이 모름(완료로 세지 않는다) */
export type TodayMissionRow = MissionDone & {
  key: string;
  title: string;
  sub: string;
  /** 줄 그림 — 기본 ⭐ */
  icon?: ReactNode;
  hidden?: boolean;
  /** 「하러 가기」 — 줄 어디를 눌러도 같다 */
  onGo: () => void;
};

export type TodayMissionPageProps = {
  rows: readonly TodayMissionRow[];
  /** 전부 완료 보너스 P — 0 이면 보너스 단추를 그리지 않는다 */
  bonus: number;
  /** 이미 받았는지(서버 값) — 받았으면 「보너스를 받았어요」 */
  claimed?: boolean;
  /** 보너스 받기 — 실패하면 reject 하거나 false 를 준다(「보너스를 받지 못했어요」) */
  onClaim: () => Promise<void | boolean> | void | boolean;
  onBack: () => void;
  title?: string;
  theme?: Partial<MissionPageTheme>;
  footer?: ReactNode;
  buttonWidth?: number;
  buttonHeight?: number;
};

export function TodayMissionPage({ rows, bonus, claimed = false, onClaim, onBack, title = '오늘의 미션', theme: themeIn, footer, buttonWidth = PAGE_BUTTON.width, buttonHeight = PAGE_BUTTON.height }: TodayMissionPageProps) {
  const theme = resolvePageTheme(themeIn);
  const shown = rows.filter(r => !r.hidden);
  const progress = missionProgress(shown);
  const [claimedNow, setClaimedNow] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [failed, setFailed] = useState(false);
  const done = claimed || claimedNow;
  const locked = claiming || !progress.allDone;

  const claim = async () => {
    if (claiming || done || !progress.allDone) return;
    setClaiming(true);
    setFailed(false);
    try {
      const ok = await onClaim();
      if (ok === false) setFailed(true); else setClaimedNow(true);
    } catch {
      setFailed(true);
    } finally {
      setClaiming(false);
    }
  };

  return <PageFrame title={title} onBack={onBack} theme={theme} footer={footer}>
    <View style={[s.sheet, { backgroundColor: theme.card }]}>
      <Text style={[s.sub, { color: theme.sub }]}>{bonus > 0 ? `미션 ${progress.total}개 모두 완료하면 ${bonus.toLocaleString()}P를 드려요` : '여러 미션에 참여하면 추가 포인트를 드려요'}</Text>
      <View style={s.progressRow}>
        <View style={[s.track, { backgroundColor: theme.line }]}><View style={[s.fill, { width: `${progress.percent}%`, backgroundColor: theme.accent }]} /></View>
        <Text style={[s.progressText, { color: theme.sub }]}>{`${progress.done}/${progress.total} 완료`}</Text>
      </View>
      {shown.map(r => <Pressable key={r.key} accessible={false} disabled={r.done === true} onPress={() => { if (r.done !== true) r.onGo(); }}
        style={({ pressed }) => [s.row, pressed && r.done !== true && { opacity: 0.85 }]}>
        <View style={[s.icon, { backgroundColor: theme.accentSoft }]}><Text style={s.iconText}>{r.icon ?? '⭐'}</Text></View>
        <View style={s.rowText}>
          <Text style={[s.rowTitle, { color: theme.text }]}>{r.title}</Text>
          <Text style={[s.rowSub, { color: theme.sub }]} numberOfLines={1}>{r.sub}</Text>
        </View>
        <PageButton label={r.done === true ? '완료' : '하러 가기'} theme={theme} width={buttonWidth} height={buttonHeight}
          disabled={r.done === true} on onPress={() => r.onGo()} />
      </Pressable>)}
      {bonus > 0 ? (done ? <Text style={[s.bonusDone, { color: theme.sub }]}>보너스를 받았어요</Text> : <>
        <PageButton big label={claiming ? '…' : bonusButtonLabel(bonus)} theme={theme} disabled={locked} on onPress={() => { void claim(); }} />
        {failed ? <Text style={[s.error, { color: theme.accent }]}>보너스를 받지 못했어요. 다시 눌러 주세요</Text> : null}
      </>) : null}
    </View>
  </PageFrame>;
}

const s = StyleSheet.create({
  sheet: { borderRadius: 22, padding: 20 },
  sub: { fontSize: 13 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  progressText: { fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 18 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSub: { fontSize: 12 },
  bonusDone: { fontSize: 13, marginTop: 16, textAlign: 'center' },
  error: { fontSize: 12, marginTop: 8, textAlign: 'center' },
});
