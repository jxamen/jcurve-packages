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
export declare function stitchReceipts(assets: ImagePickerAsset[]): Promise<ImagePickerAsset>;
