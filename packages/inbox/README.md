# @jcurve/inbox 0.1.1

0.1.1: 서버 배포 전 404 는 빈 목록

받은 푸시·알림 목록. **순수 JS, 새 네이티브 0**. peerDependencies는 react >=18, react-native >=0.74만 사용합니다.

앱 연결법 5줄:
1. `const api = createInboxApi(fetchJson)`을 메모이즈합니다. 앱 래퍼가 `v1/{app}/` 접두사와 로그인 Bearer를 붙입니다.
2. 오른쪽 위 종을 누르면 `<InboxScreen api={api} onBack={back} onOpen={openPush} />`를 엽니다. `openPush(item)`에서 기존 푸시의 `data.go/url/screen` 이동 코드를 사용합니다.
3. `const count = useInboxUnread(api, { refreshKey })`와 종을 감싼 View 안의 `<BellDot count={count} />`로 안 읽음 점을 표시합니다.
4. 앱의 expo-notifications 수신 리스너에서 `setRefreshKey(n => n + 1)`을 호출합니다. 화면에서 돌아올 때도 올리면 읽음 상태가 종에 반영됩니다. 리스너는 앱이 해제합니다.
5. 공지사항은 마이 메뉴로 옮기고 종은 받은 알림함에 연결합니다.

```tsx
import { createInboxApi, InboxScreen, useInboxUnread, BellDot } from '@jcurve/inbox';
// 앱 컴포넌트 내부
const api = useMemo(() => createInboxApi(fetchJson), [fetchJson]);
const [refreshKey, setRefreshKey] = useState(0);
const count = useInboxUnread(api, { refreshKey });
// <View><BellIcon /><BellDot count={count} /></View>
// <InboxScreen api={api} topInset={safeArea.top} onBack={back} onOpen={openPush} />
```

`fetchJson(method, path, body?)`는 파싱한 응답을 반환하며 네트워크 오류를 reject해야 합니다. 패키지는 fetch를 호출하지 않습니다. 기본 경로는 `me/push-inbox`, `me/push-inbox?cursor=…`, `me/push-inbox/unread`, `me/push-inbox/read`입니다. `createInboxApi(fetchJson, { basePath: 'custom/inbox' })`로 경로 앞부분을 바꿀 수 있습니다. 서버는 기본으로 안 읽은 행만 반환하며 패키지는 `all=1`을 보내지 않습니다. 필터 없이 모든 kind를 표시합니다. 서버가 30개와 `next`를 반환하며 `next`가 없으면 페이지 로딩을 끝냅니다. 빈 테이블 응답 `{ok:true, items:[], unread:0}`을 지원합니다.

`InboxApi.list(cursor?): Promise<Resp>`, `unread(): Promise<number>`, `read(ids?, all?): Promise<number>`를 직접 구현해도 됩니다. 어댑터는 항상 `{ ids: [...] }`로 읽음을 요청합니다. 빈 배열 또는 생략된 ids는 네트워크 호출 없이 마지막으로 확인한 unread(조회 전에는 0)를 반환합니다. 호환용 all 인자는 무시하며 전체 읽음 요청은 보내지 않습니다. 이동 대상(data.go/url/screen)이 있는 행은 누르는 즉시 목록에서 제거하고 read([id])와 onOpen(item)을 호출합니다. 이동 대상이 없으면 본문 전체를 펼치고, 다시 눌러 접거나 화면을 떠날 때 read([id]) 후 제거합니다. 일반 알림에는 onOpen을 호출하지 않습니다. 읽음 요청 실패 시 해당 행을 복원하고 오류를 표시합니다. 줄별 점과 모두 읽음 버튼은 없습니다. 화면을 떠날 때 언마운트하거나, 화면을 유지하는 내비게이터에서는 `isFocused={isFocused}`로 포커스 상태를 전달하세요. false로 바뀌면 펼친 행을 읽음 처리합니다.

`theme`은 `bg, card, text, sub, line, primary, unreadDot, adBadgeBg, adBadgeText, radius`를 부분 덮어쓰기합니다. 기본색은 #FFFFFF, #F2F4F6, #191F28, #6B7684, #E5E8EB입니다. `strings`도 부분 덮어쓰기 가능하며 기본값은 한국어입니다. `minutes(n)`, `hours(n)`, `date(month, day)`는 함수입니다. 상대 시각은 60초 미만 방금, 60분 미만 분, 24시간 미만 시간, 이후 한국 시간 기준 어제/M월 D일(연도 다름 포함)입니다.

`useInboxUnread`는 마운트·AppState active·refreshKey 변경에 갱신하며 경로 없음은 0, 그 외 실패 시 이전 값을 유지합니다(지난 값이 없으면 0). api 객체는 안정된 참조로 전달하세요. BellDot은 count > 0에만 절대 위치의 작은 빨간 점을 그립니다.

검증: `npm run build`, `npm test`, `npm pack`. GitHub release 및 npm 발행은 하지 않습니다.
