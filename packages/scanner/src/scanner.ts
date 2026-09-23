/**
 * 문서 스캐너 — 테두리를 잡아 자르고 반듯하게 편 사진 파일을 받는다.
 *
 * 부품은 `react-native-document-scanner-plugin` 2.0.4 다. 안드로이드는 구글 ML Kit 문서 스캐너
 * (Play 서비스 화면), 아이폰은 VisionKit 이다. 영테크 `src/receipt/scanner.ts` 와 총무님
 * `RecordScreen.tsx` 의 호출을 합쳐 떼어 냈다.
 */

export type ScanOptions = {
  /** 받을 장 수. 기본 1. 안드로이드는 여기서 막고, 아이폰 VisionKit 은 못 막는다 — 넘으면 `extraPages` 대로 */
  maxPages?: number;
  /** 잘라 낸 사진의 JPEG 품질 0~100. 기본 90 */
  quality?: number;
  /**
   * 아이폰에서 `maxPages` 보다 많이 찍었을 때.
   *   'reject'(기본) — `scanner_multiple_pages` 로 다시 찍게 한다(영테크: 영수증 한 장에 한 건)
   *   'keep'         — 찍은 것을 다 준다. 앱이 앞에서 잘라 쓰고 「N장까지」를 알린다(총무님: 찍은 것을 잃지 않게)
   * 어느 쪽이든 **조용히 버리지 않는다.**
   */
  extraPages?: 'reject' | 'keep';
};

export type ScannerCode =
  | 'scanner_unavailable'     // 웹이거나, 이 빌드에 네이티브 모듈이 없다(OTA 로 코드만 온 옛 빌드)
  | 'scanner_permission'      // 아이폰 카메라 권한 거절
  | 'scanner_multiple_pages'  // maxPages 보다 많이 찍었다 — 조용히 버리지 않는다
  | 'scanner_empty'           // 성공이라는데 사진이 없다
  | 'scanner_failed';         // 스캐너가 열리지 않았다(구글 모듈을 못 받았거나 기기가 안 된다)

export class ScannerError extends Error {
  constructor(
    public readonly code: ScannerCode,
    /** `scanner_permission` 일 때만 — false 면 다시 물어도 창이 안 뜬다. 설정으로 보내야 한다 */
    public readonly canAskAgain = true,
    options?: { cause?: unknown },
  ) {
    // 메시지를 코드와 같게 둔다 — 영테크가 `e.message === 'scanner_multiple_pages'` 로 가른다
    super(code);
    /** 네이티브가 던진 원래 오류 — 로그에 남길 때 쓴다 */
    (this as { cause?: unknown }).cause = options?.cause;
    this.name = 'ScannerError';
  }
}

/** 시험할 때 바꾼다. 앱은 넘기지 않는다 */
export type ScannerDeps = {
  os?: string;
  plugin?: () => { scanDocument: (o: object) => Promise<{ status?: string; scannedImages?: string[] }> };
  askCamera?: () => Promise<{ granted: boolean; canAskAgain?: boolean }>;
};

/**
 * 스캐너를 연다. 찍은 사진의 **파일 주소**(`file://…`)를 순서대로 준다. 취소하면 `null`.
 *
 * 실패는 {@link ScannerError} 로 던진다. `scanner_unavailable`·`scanner_failed` 면
 * **일반 촬영(`expo-image-picker` 의 `launchCameraAsync`)으로 넘어갈 길을 앱이 준다** — 영테크·총무님 모두 그렇다.
 */
export async function scanDocument(options: ScanOptions = {}, deps: ScannerDeps = {}): Promise<string[] | null> {
  const os = deps.os ?? platformOS();
  if (os === 'web') throw new ScannerError('scanner_unavailable');

  const maxPages = Math.max(1, Math.floor(options.maxPages ?? 1));
  const quality = Math.min(100, Math.max(0, Math.round(options.quality ?? 90)));

  /*
   | 카메라 권한은 **아이폰만** 묻는다. VisionKit 은 앱 권한이 필요하고, 안드로이드 스캐너는 구글 Play 서비스
   | 화면이라 앱 권한이 필요 없다. 안드로이드에서 묻다가 「이번만 허용」을 고르면 스캐너가 떠 있는 동안
   | 권한이 거둬져 **앱이 죽고 찍은 사진을 잃었다**(2026-09-22 총무님, 갤럭시 A32 — one-time permission revoked).
   */
  if (os === 'ios') {
    const ask = deps.askCamera ?? loadAskCamera();
    if (ask) {
      const perm = await ask();
      if (!perm.granted) throw new ScannerError('scanner_permission', perm.canAskAgain !== false);
    }
  }

  // 지연 require — 네이티브 모듈이 없는 빌드에서 정적 import 는 앱 시작을 죽인다(플러그인이 getEnforcing 으로 찾는다)
  let plugin: ReturnType<NonNullable<ScannerDeps['plugin']>>;
  try {
    plugin = (deps.plugin ?? loadPlugin)();
  } catch (cause) {
    throw new ScannerError('scanner_unavailable', true, { cause });
  }

  let result: { status?: string; scannedImages?: string[] };
  try {
    result = await plugin.scanDocument({ maxNumDocuments: maxPages, croppedImageQuality: quality, responseType: 'imageFilePath' });
  } catch (cause) {
    throw new ScannerError('scanner_failed', true, { cause });
  }

  if (result?.status === 'cancel') return null;
  const pages = (result?.scannedImages ?? []).filter((p) => typeof p === 'string' && p !== '');
  if (!pages.length) throw new ScannerError('scanner_empty');
  // VisionKit 은 장 수를 못 막는다. 넘친 것을 조용히 버리면 영수증을 잃는다 — 다시 찍게 한다
  if (pages.length > maxPages && options.extraPages !== 'keep') throw new ScannerError('scanner_multiple_pages');
  return pages;
}

/** 오류 코드 → 사용자에게 보일 문구. `maxPages` 는 `scanner_multiple_pages` 문구에 쓴다 */
export function scannerMessage(code: string, maxPages = 1): string {
  switch (code) {
    case 'scanner_permission': return '카메라를 쓸 수 있게 허락해 주세요. 설정에서 바꿀 수 있어요';
    case 'scanner_multiple_pages': return maxPages <= 1
      ? '한 장씩 찍어 주세요. 한 장만 찍고 다시 완료해 주세요'
      : `${maxPages}장까지 찍을 수 있어요. 다시 찍어 주세요`;
    case 'scanner_unavailable':
    case 'scanner_failed':
    case 'scanner_empty':
    default: return '자동 스캔을 열지 못했어요. 다시 해 보거나 일반 촬영으로 찍어 주세요';
  }
}

function platformOS(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native').Platform.OS;
  } catch {
    return 'web';
  }
}

function loadPlugin() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('react-native-document-scanner-plugin');
  return mod.default ?? mod;
}

function loadAskCamera(): ScannerDeps['askCamera'] | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const picker = require('expo-image-picker');
    return () => picker.requestCameraPermissionsAsync();
  } catch {
    return null;   // 없으면 VisionKit 이 처음 열 때 스스로 묻는다 — 거절하면 검은 화면이라 넣어 두는 것이 맞다
  }
}
