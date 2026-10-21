import { useEffect, useReducer, useRef } from 'react';
import type { Requester } from './entry';
import { fetchHomeResult, homeInitial, homeReduce, homeStorageUsable, HOME_STORAGE_WAIT_MS, readStoredHome, type HomeConfig, type HomeStorage } from './home';

/**
 * (0.4.6) 서버 설정(mission/home)을 받는 공용 훅 — BenefitQuickList · useHomeRows 가 같이 쓴다.
 * `storage` 가 있으면 켤 때 **저장해 둔 마지막 목록으로 먼저** 그리고(저장값을 읽는 동안 `ready` 는 false, 최대 HOME_STORAGE_WAIT_MS) 서버 응답이 오면 갱신 · 저장한다.
 * `storage` 가 없으면 예전과 똑같다(처음부터 ready, 앱 기본 → 서버 응답).
 * 순서 규칙은 순수 함수 homeReduce 에 있다(시험). 저장소 객체가 렌더마다 새로 만들어져도 다시 읽지 않도록 ref 로 잡는다.
 */
export function useHomeConfig(fetchJson: Requester | undefined, refreshKey: unknown, storage?: HomeStorage, storageKey?: string): { config: HomeConfig; ready: boolean } {
  const hasStorage = homeStorageUsable(storage);   // get/set 또는 getItem/setItem — 쓸 수 없는 값이면 저장소를 안 넘긴 것과 같다
  const [state, dispatch] = useReducer(homeReduce, hasStorage, homeInitial);
  const storageRef = useRef(storage);
  storageRef.current = storage;

  useEffect(() => {
    if (!hasStorage || !fetchJson) return;
    let live = true;
    void readStoredHome(storageRef.current, storageKey).then(c => { if (live) dispatch({ type: 'stored', config: c }); });
    const timer = setTimeout(() => { if (live) dispatch({ type: 'timeout' }); }, HOME_STORAGE_WAIT_MS);

    return () => { live = false; clearTimeout(timer); };
  }, [hasStorage, storageKey, !!fetchJson]);

  useEffect(() => {
    if (!fetchJson) return;
    let live = true;
    void fetchHomeResult(fetchJson, { storage: storageRef.current, storageKey }).then(r => { if (live) dispatch({ type: 'server', value: r.value, ok: r.ok }); });

    return () => { live = false; };
  }, [fetchJson, refreshKey]);

  return { config: state.config, ready: state.ready };
}
