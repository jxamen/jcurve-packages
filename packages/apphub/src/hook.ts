/**
 * 입구(하단 버튼)를 그리는 앱이 쓰는 훅 — 목록과 칸 설정을 **한 번에** 받는다.
 *
 * 입구를 보일지(`section.on`) · 제목(`section.title`)을 알려고 `/family` 를 따로 부르고, 시트를 열 때 또 부르던 것을
 * 한 번으로 줄인다(2026-09-25). 받은 것을 `AppHubSheet` 의 `items` · `section` 에 그대로 넘기면 시트는 다시 부르지 않는다.
 *
 * (1.2.0) `storage` 를 넘기면 마지막으로 받은 목록 · 칸 설정을 저장해 두었다가 **켤 때 그 값으로 먼저** 그린다 — 서버 응답을 기다리느라 입구가
 * 늦게 나타나지 않는다(대표님 10-20 19:01 「늦게 로딩」). 입구는 `hub.visible` 로 그린다:
 *   - 저장값이 있으면 그 `section.on` 으로 바로(저장값을 읽는 동안 최대 300ms 는 false)
 *   - **첫 설치(저장값 없음)는 켜짐**
 *   - 서버가 **분명히 꺼짐(on:false)** 이라고 답한 뒤에만 숨기고, 그 꺼짐도 저장해 다음 켜기부터는 처음부터 숨긴다
 *   - 서버가 실패하면 저장값을 그대로 둔다
 * `storage` 를 안 넘기면 예전과 같고(`ready`/`visible` 은 처음부터 section.on 기준) 값 모양도 그대로다.
 *
 *   const hub = useAppHub({ base: API_BASE, token: APP_TOKEN, storage: AsyncStorage });
 *   {hub.visible ? <Entrance title={hub.section.title ?? '추천 포인트 앱 둘러보기'} /> : null}
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { hubLoader, type FamilySection, type Hub } from './load';
import type { FamilyApp } from './pick';
import { HUB_STORAGE_WAIT_MS, hubInitial, hubReduce, hubStorageUsable, hubView, readStoredHub, saveStoredHub, type HubStorage } from './store';

export type UseAppHub = {
  /** 아직 못 받았으면 null (저장값이 있으면 저장값) */
  items: FamilyApp[] | null;
  /** 받기 전 · 못 받았으면 기본값(켜짐 · 기존 문구) — 저장값이 있으면 저장값 */
  section: FamilySection;
  failed: boolean;
  reload: () => void;
  /** (1.2.0) 입구를 그려도 되는가 = 저장값을 읽은 뒤(저장소를 안 쓰면 처음부터) 이고 section.on */
  visible: boolean;
  /** (1.2.0) 저장값을 읽는 중이면 false — 입구를 `section.on` 으로 직접 그리는 앱은 이 값이 true 가 된 뒤에 그린다 */
  ready: boolean;
};

export function useAppHub(opts: { base?: string; token?: string; load?: () => Promise<Hub>; storage?: HubStorage; storageKey?: string }): UseAppHub {
  const { base, token, load, storage, storageKey } = opts;
  const hasStorage = hubStorageUsable(storage);
  const [state, dispatch] = useReducer(hubReduce, hasStorage, hubInitial);
  const storageRef = useRef(storage);
  storageRef.current = storage;

  const reload = useCallback(() => {
    const loader = load ?? (base ? hubLoader({ base, token }) : null);
    if (!loader) { dispatch({ type: 'failed' }); return; }
    dispatch({ type: 'retry' });
    loader().then(hub => {
      dispatch({ type: 'server', hub });
      void saveStoredHub(storageRef.current, hub, storageKey);
    }, () => dispatch({ type: 'failed' }));
  }, [base, token, load, storageKey]);

  useEffect(() => { reload(); }, [reload]);

  // 저장값 — 켤 때 한 번(저장소가 바뀌면 다시). 저장소 객체가 렌더마다 새로 만들어져도 다시 읽지 않도록 ref 로 잡는다
  useEffect(() => {
    if (!hasStorage) return;
    let live = true;
    void readStoredHub(storageRef.current, storageKey).then(hub => { if (live) dispatch({ type: 'stored', hub }); });
    const timer = setTimeout(() => { if (live) dispatch({ type: 'timeout' }); }, HUB_STORAGE_WAIT_MS);

    return () => { live = false; clearTimeout(timer); };
  }, [hasStorage, storageKey]);

  const view = hubView(state);

  return { items: view.items, section: view.section, failed: state.failed, reload, visible: view.visible, ready: state.ready };
}
