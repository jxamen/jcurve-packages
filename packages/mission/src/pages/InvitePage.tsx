/**
 * 친구 초대 — 코드를 나누고, 받은 코드를 넣는다 (0.4.0, carrot InviteCard · InviteScreen 그대로).
 *
 * 문자 인증이 아니라 **간편 인증**이다(대표님 10-19 22:47 「문자 인증이 아니라 간편 인증이야」).
 * 자격이 없으면 코드를 내주지 않고 「간편 인증하기」 를 보인다 — 누르면 앱의 `onVerify` 가 간편 인증 창을 연다.
 * 지급 · 자격 판정은 서버 · 앱이 한다. 패키지는 값을 그리고 누름을 넘긴다.
 */
import React, { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PageFrame, PageButton, resolvePageTheme, type MissionPageTheme } from './PageFrame';
import { inviteHeadline, normalizeInviteCode, settleWithin } from './logic';

export type InvitePageProps = {
  /** 내 초대 코드 — 자격이 없으면 안 그린다 */
  code: string;
  /** 자격 없음(간편 인증 · 가입 전) — 코드 대신 안내 · 단추 */
  locked?: boolean;
  /** 자격 없는 이유 — 기본 'verify'(간편 인증). 'signup' 이면 가입 안내로 바뀐다 */
  lockReason?: 'verify' | 'signup';
  /** 「간편 인증하기」 — 앱이 간편 인증 창을 연다. 끝나면 앱이 자격을 다시 읽어 `locked` 를 내린다 */
  onVerify: () => void | Promise<void>;
  /** 「가입하러 가기」 — lockReason='signup' 일 때 */
  onSignup?: () => void;
  /** 간편 인증 창이 열려 있는 동안 단추를 막는다 */
  verifying?: boolean;
  /** 초대한 사람이 받는 P · 친구가 받는 P */
  inviterPoint: number;
  inviteePoint: number;
  /** 확률권 장수(있으면 줄 아래 「확률권 n장」) */
  inviterBoost?: number;
  inviteeBoost?: number;
  /** 초대 성공한 친구 수 · 아직 받지 않은 친구 수 */
  invited: number;
  waiting: number;
  /** 이미 받은 초대 코드를 넣었나 */
  joined?: boolean;
  /** 초대 보상을 받았나 */
  rewarded?: boolean;
  /** 받은 코드 넣기 — 결과 문구(message)를 돌려주면 그대로 보인다 */
  onJoin: (code: string) => Promise<{ ok: boolean; message?: string }> | { ok: boolean; message?: string };
  /** 「링크 복사」 「카톡으로 공유하기」 — 앱이 공유 시트를 연다 */
  onShare: () => void;
  onBack: () => void;
  /** (0.4.13) iOS 왼쪽 가장자리를 오른쪽으로 밀면 onBack(기본 true). 안드로이드는 그대로. 이미 앱에서 밀기를 감싼 화면은 false */
  swipeBack?: boolean;
  /** 안내 문장 — 기본은 carrot 안내 4줄(기기 · 국가 중립) */
  notice?: readonly string[];
  title?: string;
  theme?: Partial<MissionPageTheme>;
  footer?: ReactNode;
};

const DEFAULT_NOTICE = [
  '보상은 초대받은 친구가 한 번 받아야 지급돼요',
  '가입만으로는 보상이 지급되지 않아요',
  '초대 코드는 한 사람이 한 번만 넣을 수 있어요',
  '가입하고 번호 인증을 마친 분만 초대할 수 있어요',
];

export function InvitePage({ code, locked = false, lockReason = 'verify', onVerify, onSignup, verifying = false, inviterPoint, inviteePoint, inviterBoost = 0, inviteeBoost = 0, invited, waiting, joined = false, rewarded = false, onJoin, onShare, onBack, swipeBack, notice = DEFAULT_NOTICE, title = '친구 초대', theme: themeIn, footer }: InvitePageProps) {
  const theme = resolvePageTheme(themeIn);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const signup = lockReason === 'signup';
  const canJoin = !busy && value.trim() !== '';

  const join = async () => {
    if (!canJoin) return;
    setBusy(true);
    try {
      const r = await settleWithin(Promise.resolve(onJoin(value.trim())));   // 서버가 안 돌아와도 잠금은 풀린다(0.4.3)
      if (!r) { setMessage('초대 코드를 넣지 못했어요'); return; }
      setMessage(r.message ?? (r.ok ? '' : '초대 코드를 넣지 못했어요'));
      if (r.ok) setValue('');
    } catch {
      setMessage('초대 코드를 넣지 못했어요');
    } finally {
      setBusy(false);
    }
  };

  return <PageFrame title={title} onBack={onBack} swipeBack={swipeBack} theme={theme} footer={footer}>
    <View style={[s.body, { backgroundColor: theme.card }]}>
      {theme.character != null ? <View accessible={false} style={s.character}>{theme.character}</View> : null}
      <Text style={[s.h1, { color: theme.text }]}>친구 초대하고</Text>
      <Text style={[s.h1Hi, { color: theme.accent }]}>{inviteHeadline(inviterPoint)}</Text>
      <Text style={[s.sub, { color: theme.sub }]}>친구가 코드를 넣고 한 번 받으면 둘 다 받아요</Text>

      {/* 자격이 없으면 코드를 내주지 않는다(2026-09-21 지시: 가입하고 번호 인증한 사람만) */}
      {locked ? <View style={[s.lock, { backgroundColor: theme.accentSoft }]}>
        <Text style={[s.lockTitle, { color: theme.text }]}>{signup ? 'SNS로 가입하면 초대할 수 있어요' : '간편 인증하면 초대할 수 있어요'}</Text>
        {signup ? <Text style={[s.lockBody, { color: theme.sub }]}>홈 오른쪽 위 내정보에서 가입할 수 있어요</Text> : null}
        <PageButton big label={signup ? '가입하러 가기' : '간편 인증하기'} theme={theme} disabled={verifying}
          on onPress={() => { if (signup) onSignup?.(); else void onVerify(); }} />
      </View> : <>
        <Text style={[s.label, { color: theme.sub }]}>내 초대 코드</Text>
        <Pressable accessibilityRole="button" onPress={onShare} style={({ pressed }) => [s.codeBox, { backgroundColor: theme.accentSoft }, pressed && s.pressed]}>
          <Text style={[s.code, { color: theme.text }]}>{code}</Text>
        </Pressable>
      </>}

      <View style={[s.panel, { borderColor: theme.line }]}>
        <Text style={[s.section, { color: theme.text }]}>미션 현황</Text>
        <View style={s.rewards}>
          <View style={s.reward}>
            <Text style={[s.who, { color: theme.sub }]}>친구</Text>
            <Text style={[s.point, { color: theme.accent }]}>{`${inviteePoint.toLocaleString()}P`}</Text>
            {inviteeBoost > 0 ? <Text style={[s.extra, { color: theme.sub }]}>{`확률권 ${inviteeBoost}장`}</Text> : null}
          </View>
          <View style={[s.line, { backgroundColor: theme.line }]} />
          <View style={s.reward}>
            <Text style={[s.who, { color: theme.sub }]}>나</Text>
            <Text style={[s.point, { color: theme.accent }]}>{`${inviterPoint.toLocaleString()}P`}</Text>
            {inviterBoost > 0 ? <Text style={[s.extra, { color: theme.sub }]}>{`확률권 ${inviterBoost}장`}</Text> : null}
          </View>
        </View>
      </View>

      <Text style={[s.section, { color: theme.text }]}>내 친구 초대 현황</Text>
      <View style={[s.stat, { borderColor: theme.line }]}><Text style={[s.statLabel, { color: theme.sub }]}>초대 성공한 친구</Text><Text style={[s.statValue, { color: theme.text }]}>{`${invited}명`}</Text></View>
      <View style={[s.stat, { borderColor: theme.line }]}><Text style={[s.statLabel, { color: theme.sub }]}>아직 받지 않은 친구</Text><Text style={[s.statValue, { color: theme.text }]}>{`${waiting}명`}</Text></View>

      <View style={[s.notice, { backgroundColor: theme.bg }]}>
        <Text style={[s.noticeTitle, { color: theme.text }]}>친구 초대 안내사항</Text>
        {notice.map(line => <View key={line} style={s.bulletRow}><Text style={[s.bullet, { color: theme.sub }]}>•</Text><Text style={[s.bulletText, { color: theme.sub }]}>{line}</Text></View>)}
      </View>

      {locked ? null : joined ? (
        <Text style={[s.joined, { color: theme.sub }]}>{rewarded ? '초대 보상을 받았어요' : '한 번 받으면 초대 보상을 받아요'}</Text>
      ) : <View style={s.enter}>
        <Text style={[s.section, { color: theme.text }]}>받은 코드 넣기</Text>
        <View style={s.joinRow}>
          <TextInput value={value} onChangeText={v => setValue(normalizeInviteCode(v))} placeholder="받은 코드 넣기" placeholderTextColor={theme.sub}
            autoCapitalize="characters" style={[s.input, { color: theme.text, borderColor: theme.line, backgroundColor: theme.bg }]} />
          <PageButton label="넣기" theme={theme} disabled={!canJoin} on onPress={() => { void join(); }} />
        </View>
        {message ? <Text accessibilityLiveRegion="polite" style={[s.message, { color: theme.sub }]}>{message}</Text> : null}
      </View>}

      {locked ? null : <View style={s.shareRow}>
        <PageButton label="링크 복사" theme={theme} width={100} on={false} onPress={onShare} />
        <View style={s.grow}><PageButton label="카톡으로 공유하기" theme={theme} big on onPress={onShare} /></View>
      </View>}
    </View>
  </PageFrame>;
}

const s = StyleSheet.create({
  body: { borderRadius: 20, padding: 20, gap: 10 },
  character: { alignSelf: 'center' },
  h1: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  h1Hi: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  lock: { borderRadius: 16, padding: 16, gap: 10, alignItems: 'center' },
  lockTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  lockBody: { fontSize: 13, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '700' },
  codeBox: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  code: { fontSize: 22, fontWeight: '800', letterSpacing: 2 },
  pressed: { opacity: 0.8 },
  panel: { borderWidth: 1, borderRadius: 16, padding: 14 },
  section: { fontSize: 15, fontWeight: '800', marginTop: 6 },
  rewards: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 8 },
  reward: { alignItems: 'center', gap: 2 },
  who: { fontSize: 12, fontWeight: '700' },
  point: { fontSize: 20, fontWeight: '800' },
  extra: { fontSize: 11 },
  line: { width: 1, height: 40 },
  stat: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, paddingVertical: 10 },
  statLabel: { fontSize: 14 },
  statValue: { fontSize: 15, fontWeight: '800' },
  notice: { borderRadius: 14, padding: 14, gap: 6 },
  noticeTitle: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  bulletRow: { flexDirection: 'row', gap: 6 },
  bullet: { fontSize: 12, lineHeight: 18 },
  bulletText: { flex: 1, fontSize: 12, lineHeight: 18 },
  joined: { fontSize: 13, textAlign: 'center', marginTop: 4 },
  enter: { gap: 8 },
  joinRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, height: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 15 },
  message: { fontSize: 12, textAlign: 'center' },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  grow: { flex: 1 },
});
