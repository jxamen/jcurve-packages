/** Single-use fullscreen lifecycle shared by normal and both rewarded formats. */
import type { AdsEnv } from './ads';
import { acquireFullscreen, adError, isForeground, safeCall } from './runtime';

export type FullscreenCallbacks = {
  onOpened?: () => void;
  onClosed?: () => void;
  onEarned?: () => void;
  onFail: (message: string, noAd: boolean) => void;
  onAbort?: (noAd?: boolean) => void;
};

export function createFullscreen(env: AdsEnv, sdk: any) {
  let abortCurrent: (() => void) | null = null;
  return {
    cancel: () => { abortCurrent?.(); },
    async show(config: {
      callbacks: FullscreenCallbacks;
      rewarded: boolean;
      prepare: (stillNeeded: () => boolean) => Promise<any>;
      makeAd: (request: any) => any;
      onOpen?: () => void;
      onFailure?: () => void;
    }): Promise<boolean> {
      const cb = config.callbacks;
      if (!isForeground(env)) { safeCall(cb.onFail, '앱이 앞에 있을 때 광고를 열 수 있어요', true); return false; }
      const lease = acquireFullscreen(env, sdk);
      if (!lease) return false;
      let disposed = false;
      let terminal = false;
      let opened = false;
      let closed = false;
      let earned = false;
      let presented = false;
      let sawBackground = false;
      let stage = 'init';
      const offs: Array<() => void> = [];
      const timers = new Set<ReturnType<typeof setTimeout>>();
      let appSub: { remove: () => void } | null = null;
      let stopPreparation: () => void = () => {};
      const stopped = new Promise<null>((resolve) => { stopPreparation = () => resolve(null); });
      const cleanup = () => {
        if (disposed) return;
        disposed = true;
        stopPreparation();
        lease.release();
        if (abortCurrent === abort) abortCurrent = null;
        try { appSub?.remove(); } catch { /* noop */ }
        for (const off of offs) { try { off(); } catch { /* noop */ } }
        for (const timer of timers) clearTimeout(timer);
        offs.length = 0; timers.clear();
      };
      const later = (fn: () => void, ms: number) => {
        const timer = setTimeout(() => { timers.delete(timer); fn(); }, ms);
        timers.add(timer);
      };
      const abort = () => {
        if (disposed || terminal) return;
        terminal = true;
        stopPreparation();
        safeCall(cb.onAbort, !presented && !opened);
        // Native fullscreen cannot be dismissed by JS. Keep its lease until CLOSED/foreground recovery.
        if ((!presented && !opened) || closed) cleanup();
      };
      abortCurrent = abort; // Installed before the very first await; cancel works during UMP/init.
      const fail = (message: string) => {
        if (disposed || terminal || closed) return;
        terminal = true;
        safeCall(config.onFailure);
        if (!presented && !opened) cleanup();
        safeCall(cb.onFail, message, !presented && !opened);
      };
      const finishClose = () => {
        if (disposed || closed) return;
        closed = true;
        if (terminal) { cleanup(); return; }
        if (!opened) { terminal = true; cleanup(); safeCall(cb.onFail, '광고가 열렸는지 확인할 수 없어요', !presented); return; }
        safeCall(cb.onClosed);
        if (disposed || terminal) return;
        if (!config.rewarded || earned) { terminal = true; cleanup(); return; }
        later(() => {
          if (disposed) return;
          terminal = true;
          cleanup();
          if (!earned) safeCall(cb.onFail, '광고를 끝까지 보지 않았어요', false);
        }, 1200);
      };
      // Permission dialogs can temporarily inactivate the app. Preparation checks the final foreground state.
      try {
        appSub = env.appState()?.addEventListener('change', (state) => {
          if (disposed) return;
          if (state !== 'active') {
            sawBackground = true;
            // Android opens Google's AdActivity before OPENED can reach JS. AppState alone
            // cannot distinguish this native presentation from Home; only the SDK can end it.
            if (!opened && !(env.os() === 'android' && presented) && (state === 'background' || stage !== 'init')) abort();
          } else if (env.os() !== 'android' && sawBackground && (presented || opened)) finishClose();
        }) ?? null;
        const prepared = await Promise.race([config.prepare(() => !disposed && !terminal), stopped]);
        if (disposed || terminal || prepared === null) return false;
        if (!isForeground(env)) { abort(); return false; }
        const ad = config.makeAd(prepared);
        const events = sdk.AdEventType;
        const rewardEvents = sdk.RewardedAdEventType;
        stage = 'load';
        offs.push(ad.addAdEventListener(config.rewarded ? rewardEvents.LOADED : events.LOADED, () => {
          if (disposed || terminal || closed || presented) return;
          if (!isForeground(env)) { abort(); return; }
          presented = true; stage = 'show'; sawBackground = false;
          const presentationFailed = (error: any) => {
            if (disposed || closed) return;
            if (!opened) {
              presented = false; // Native show rejected; an unconfirmed presentation cannot still open.
              if (terminal) { cleanup(); return; }
            }
            fail(adError(error));
          };
          try { Promise.resolve(ad.show()).catch(presentationFailed); }
          catch (error) { presentationFailed(error); }
        }));
        offs.push(ad.addAdEventListener(events.OPENED, () => {
          if (disposed || closed || opened) return;
          opened = true; stage = 'open'; sawBackground = false;
          // cancel/failure may already have delivered its result; still track the native lifecycle.
          if (terminal) return;
          safeCall(config.onOpen); safeCall(cb.onOpened);
        }));
        if (config.rewarded) offs.push(ad.addAdEventListener(rewardEvents.EARNED_REWARD, () => {
          if (disposed || terminal || earned || !opened) return;
          earned = true; safeCall(cb.onEarned);
          if (closed) { terminal = true; cleanup(); }
        }));
        offs.push(ad.addAdEventListener(events.CLOSED, finishClose));
        offs.push(ad.addAdEventListener(events.ERROR, (error: any) => {
          if (disposed || closed) return;
          // RNGMA 16.5 iOS delegate maps didFailToPresentFullScreenContentWithError to ERROR,
          // and dismissal to a separate CLOSED event. Failure before OPENED is authoritative;
          // waiting for CLOSED here can leave the SDK-wide lease permanently stuck.
          if (!opened) {
            presented = false;
            if (terminal) { cleanup(); return; } // Keep an existing cancel/failure result exactly once.
          }
          fail(adError(error));
        }));
        if (!isForeground(env)) { abort(); return false; }
        later(() => { if (!opened) fail('광고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요 (' + stage + ')'); }, 15_000);
        ad.load();
        return true;
      } catch (error) { fail(adError(error)); return false; }
    },
  };
}
