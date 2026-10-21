import { describe, expect, it, vi } from 'vitest';
import { getPendingScan, scanDocument, ScannerError } from './scanner';

function native() {
  return {
    scanDocument: vi.fn(async () => ({ status: 'success', scannedImages: ['file:///saved.jpg'], _pendingScanId: 'scan-1' })),
    releaseScan: vi.fn(async (_id: string) => {}),
    acknowledgeScan: vi.fn(async (_id: string) => {}),
    getPendingScan: vi.fn(async (): Promise<{ uris: string[] } | null> => ({ uris: ['file:///pending.jpg'] })),
  };
}

describe('Android pending scan', () => {
  it('returns the native one-shot result and then null', async () => {
    const module = native();
    module.getPendingScan.mockResolvedValueOnce({ uris: ['file:///1.jpg', 'file:///2.jpg'] }).mockResolvedValueOnce(null);
    const deps = { os: 'android', androidNative: () => module };
    expect(await getPendingScan(deps)).toEqual({ uris: ['file:///1.jpg', 'file:///2.jpg'] });
    expect(await getPendingScan(deps)).toBeNull();
  });
  it.each(['ios', 'web'])('%s never touches Android native code', async os => {
    const load = vi.fn(() => { throw new Error('must not load'); });
    expect(await getPendingScan({ os, androidNative: load })).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
  it('old native builds return null', async () => {
    expect(await getPendingScan({ os: 'android', androidNative: () => null })).toBeNull();
  });
  it('does not hide a storage failure as an empty result', async () => {
    const module = native();
    const error = new Error('disk read failed');
    module.getPendingScan.mockRejectedValue(error);
    await expect(getPendingScan({ os: 'android', androidNative: () => module }))
      .rejects.toMatchObject({ code: 'scanner_failed', cause: error });
  });
  it('Android uses the durable module and acknowledges only after receiving valid images', async () => {
    const module = native();
    expect(await scanDocument({ maxPages: 2 }, { os: 'android', androidNative: () => module }))
      .toEqual(['file:///saved.jpg']);
    expect(module.scanDocument).toHaveBeenCalledWith({ maxNumDocuments: 2, croppedImageQuality: 90, responseType: 'imageFilePath' });
    expect(module.acknowledgeScan).toHaveBeenCalledWith('scan-1');
  });
  it('leaves unvalidated results pending', async () => {
    const module = native();
    module.scanDocument.mockResolvedValue({ status: 'success', scannedImages: [], _pendingScanId: 'scan-1' });
    await expect(scanDocument({}, { os: 'android', androidNative: () => module })).rejects.toBeInstanceOf(ScannerError);
    expect(module.acknowledgeScan).not.toHaveBeenCalled();
    expect(module.releaseScan).toHaveBeenCalledWith('scan-1');
  });
  it('propagates acknowledgment failure so recovery remains possible', async () => {
    const module = native();
    module.acknowledgeScan.mockRejectedValue(new Error('disk full'));
    await expect(scanDocument({}, { os: 'android', androidNative: () => module }))
      .rejects.toMatchObject({ code: 'scanner_failed' });
  });
  it('iOS keeps the existing plugin path without pending acknowledgment', async () => {
    const load = vi.fn(() => { throw new Error('Android not allowed'); });
    const plugin = { scanDocument: vi.fn(async () => ({ status: 'success', scannedImages: ['file:///ios.jpg'] })) };
    expect(await scanDocument({}, { os: 'ios', plugin: () => plugin, androidNative: load, askCamera: async () => ({ granted: true }) }))
      .toEqual(['file:///ios.jpg']);
    expect(load).not.toHaveBeenCalled();
  });
});
