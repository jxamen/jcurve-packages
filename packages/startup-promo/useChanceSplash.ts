import { useEffect, useRef, useState } from 'react';
import { readPromo, type ChancePromoCopy } from './policy';

/** One decision per cold launch. No persisted eligibility or repeat on foreground resume. */
export function useChanceSplash({ sessionReady, sessionKey, load }: {
  sessionReady: boolean;
  sessionKey: string | null;
  load: () => Promise<unknown>;
}) {
  const [decision, setDecision] = useState<{ key: string | null; copy: ChancePromoCopy | null } | null>(null);
  const [finished, setFinished] = useState(false);
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    if (!sessionReady || finished) return;
    let alive = true;
    const timer = setTimeout(() => { if (alive) { alive = false; setFinished(true); } }, 4000);
    void loadRef.current().then(value => {
      if (alive) {
        const copy = readPromo(value);
        if (copy) setDecision({ key: sessionKey, copy });
        else setFinished(true);
      }
    }).catch(() => {
      if (alive) setFinished(true);
    }).finally(() => clearTimeout(timer));
    return () => { alive = false; clearTimeout(timer); };
  }, [sessionReady, sessionKey, finished]);
  const current = decision?.key === sessionKey ? decision : null;
  const pending = !finished && (!sessionReady || current === null);
  const copy = !finished && !pending ? current?.copy ?? null : null;
  return { pending, copy, blocking: pending || !!copy, finish: () => setFinished(true) };
}
