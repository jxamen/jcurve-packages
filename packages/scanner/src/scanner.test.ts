import { describe, expect, it, vi } from 'vitest';
import { scanDocument, scannerMessage, ScannerError, type ScannerDeps } from './scanner';

/** 스캐너를 흉내 낸다 — 결과를 정하거나 던지게 한다 */
function deps(os: string, result: unknown, opts: { throws?: boolean; missing?: boolean; perm?: { granted: boolean; canAskAgain?: boolean } } = {}) {
  const scan = vi.fn(async () => { if (opts.throws) throw new Error('unsupported device'); return result as { status?: string; scannedImages?: string[] }; });
  const askCamera = vi.fn(async () => opts.perm ?? { granted: true });
  const d: ScannerDeps = {
    os,
    askCamera,
    plugin: () => { if (opts.missing) throw new Error("TurboModuleRegistry.getEnforcing(...): 'DocumentScanner' could not be found"); return { scanDocument: scan }; },
  };
  return { d, scan, askCamera };
}

const code = async (p: Promise<unknown>) => { try { await p; } catch (e) { return (e as ScannerError).code; } return 'resolved'; };

describe('찍기', () => {
  it('보정한 사진 파일 주소를 준다', async () => {
    const { d, scan } = deps('android', { status: 'success', scannedImages: ['file:///corrected.jpg'] });
    expect(await scanDocument({}, d)).toEqual(['file:///corrected.jpg']);
    expect(scan).toHaveBeenCalledWith({ maxNumDocuments: 1, croppedImageQuality: 90, responseType: 'imageFilePath' });
  });

  it('취소하면 null — 사진이 없다', async () => {
    const { d } = deps('android', { status: 'cancel' });
    expect(await scanDocument({}, d)).toBeNull();
  });

  it('여러 장을 허락하면 순서대로 다 준다', async () => {
    const { d, scan } = deps('android', { status: 'success', scannedImages: ['file:///1.jpg', 'file:///2.jpg'] });
    expect(await scanDocument({ maxPages: 3, quality: 80 }, d)).toEqual(['file:///1.jpg', 'file:///2.jpg']);
    expect(scan).toHaveBeenCalledWith(expect.objectContaining({ maxNumDocuments: 3, croppedImageQuality: 80 }));
  });

  it('아이폰에서 장 수를 넘으면 조용히 버리지 않고 다시 찍게 한다', async () => {
    const { d } = deps('ios', { status: 'success', scannedImages: ['file:///1.jpg', 'file:///2.jpg'] });
    expect(await code(scanDocument({ maxPages: 1 }, d))).toBe('scanner_multiple_pages');
  });

  it("extraPages: 'keep' 이면 넘친 것까지 다 준다 — 앱이 잘라 쓰고 알린다", async () => {
    const { d } = deps('ios', { status: 'success', scannedImages: ['file:///1.jpg', 'file:///2.jpg', 'file:///3.jpg'] });
    expect(await scanDocument({ maxPages: 2, extraPages: 'keep' }, d)).toHaveLength(3);
  });

  it('성공인데 사진이 없으면 오류', async () => {
    const { d } = deps('android', { status: 'success', scannedImages: [] });
    expect(await code(scanDocument({}, d))).toBe('scanner_empty');
  });
});

describe('권한 — 아이폰만 묻는다', () => {
  it('안드로이드는 묻지 않는다 — 「이번만 허용」이 스캐너 도중 거둬져 앱이 죽었다', async () => {
    const { d, askCamera } = deps('android', { status: 'success', scannedImages: ['file:///a.jpg'] });
    await scanDocument({}, d);
    expect(askCamera).not.toHaveBeenCalled();
  });

  it('아이폰은 묻고, 거절하면 스캐너를 열지 않는다', async () => {
    const { d, scan } = deps('ios', {}, { perm: { granted: false, canAskAgain: false } });
    const err = await scanDocument({}, d).catch((e) => e as ScannerError);
    expect(err).toBeInstanceOf(ScannerError);
    expect((err as ScannerError).code).toBe('scanner_permission');
    expect((err as ScannerError).canAskAgain).toBe(false);
    expect(scan).not.toHaveBeenCalled();
  });
});

describe('안 열릴 때 — 앱이 일반 촬영으로 넘어갈 수 있게 코드로 알린다', () => {
  it('웹에서는 네이티브를 부르지 않는다', async () => {
    const { d, scan } = deps('web', {});
    expect(await code(scanDocument({}, d))).toBe('scanner_unavailable');
    expect(scan).not.toHaveBeenCalled();
  });

  it('네이티브 모듈이 없는 빌드(OTA 로 코드만 온 옛 빌드)', async () => {
    const { d } = deps('android', {}, { missing: true });
    expect(await code(scanDocument({}, d))).toBe('scanner_unavailable');
  });

  it('스캐너가 던지면 scanner_failed, 원래 오류는 cause 에 남긴다', async () => {
    const { d } = deps('android', {}, { throws: true });
    const err = (await scanDocument({}, d).catch((e) => e)) as ScannerError & { cause?: Error };
    expect(err.code).toBe('scanner_failed');
    expect(err.cause?.message).toBe('unsupported device');
  });

  it('메시지가 코드와 같다 — 영테크의 e.message 비교가 그대로 된다', () => {
    expect(new ScannerError('scanner_multiple_pages').message).toBe('scanner_multiple_pages');
  });
});

describe('문구', () => {
  it('코드마다 안내가 있다', () => {
    expect(scannerMessage('scanner_permission')).toContain('허락');
    expect(scannerMessage('scanner_multiple_pages')).toContain('한 장씩');
    expect(scannerMessage('scanner_multiple_pages', 5)).toContain('5장');
    expect(scannerMessage('scanner_failed')).toContain('일반 촬영');
    expect(scannerMessage('모르는_코드')).toContain('일반 촬영');
  });
});
