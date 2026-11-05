/**
 * 긴 영수증 캡처 여러 장 → 한 장 JPEG(기기 안에서) — 대표님 10-03 23:25 「N+스토어가 길어」.
 *
 * 고른 순서대로 위 → 아래로 붙인 뒤 **한 장**으로 기존 올리기 길(prepareReceiptImage · submitReceipt)에
 * 그대로 넣는다. 그래서 영수증 1건 · 포인트 1번이고, 서버 중복 검사도 예전처럼 이 한 장에 걸린다.
 * 겹친 부분을 찾아 지우지 않는다 — 순서만 지킨다(자리 계산은 stitchLayout.ts).
 *
 * 1) 사진마다 이미지 조작기로 한 번 풀어 **EXIF 방향을 적용한 크기**를 잰다(캡처는 대개 방향 정보가 없지만
 *    사진첩의 사진은 있을 수 있다 — Skia 는 EXIF 를 보지 않는다).
 * 2) 공통 폭으로 줄인(또는 키운) 픽셀을 Skia 오프스크린 화면에 차례로 그린다.
 * 3) JPEG(90)로 뽑아 캐시 파일로 쓴다.
 *
 * 새 네이티브 모듈이 없다 — Skia · 이미지 조작기 · 파일 시스템 모두 이미 들어 있는 빌드에서 돈다(OTA 로 나간다).
 */
import type { ImagePickerAsset } from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { stitchLayout, type Size } from './stitchLayout';

export async function stitchReceipts(assets: ImagePickerAsset[]): Promise<ImagePickerAsset> {
  const contexts = assets.map((a) => ImageManipulator.manipulate(a.uri));
  try {
    const sizes: Size[] = [];
    for (const context of contexts) {
      const rendered = await context.renderAsync();
      sizes.push({ width: rendered.width, height: rendered.height });
      rendered.release();
    }
    const layout = stitchLayout(sizes);

    const { ImageFormat, Skia } = await import('@shopify/react-native-skia');
    const surface = Skia.Surface.MakeOffscreen(layout.width, layout.height);
    if (!surface) throw new Error('stitch_surface');
    try {
      const canvas = surface.getCanvas();
      canvas.clear(Skia.Color('white'));
      const paint = Skia.Paint();
      for (let i = 0; i < contexts.length; i += 1) {
        const rect = layout.rects[i];
        contexts[i].resize({ width: rect.width, height: rect.height });
        const rendered = await contexts[i].renderAsync();
        let base64: string | undefined;
        try {
          base64 = (await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.95, base64: true })).base64;
        } finally { rendered.release(); }
        if (!base64) throw new Error('stitch_read');
        const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(base64));
        if (!image) throw new Error('stitch_decode');
        canvas.drawImageRect(
          image,
          Skia.XYWHRect(0, 0, image.width(), image.height()),
          Skia.XYWHRect(rect.x, rect.y, rect.width, rect.height),
          paint,
        );
        image.dispose();
      }
      surface.flush();
      const snapshot = surface.makeImageSnapshot();
      const jpeg = snapshot.encodeToBase64(ImageFormat.JPEG, 90);
      snapshot.dispose();
      if (!jpeg) throw new Error('stitch_encode');

      const { File, Paths } = await import('expo-file-system');
      const file = new File(Paths.cache, `receipt-stitch-${Date.now()}.jpg`);
      file.create({ overwrite: true });
      file.write(jpeg, { encoding: 'base64' });

      return { uri: file.uri, width: layout.width, height: layout.height, type: 'image', mimeType: 'image/jpeg', fileName: 'receipt.jpg' };
    } finally { surface.dispose(); }
  } finally {
    for (const context of contexts) context.release();
  }
}
