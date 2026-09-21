"use strict";
/**
 * 공용 영수증 OCR 의 앱 쪽 — 사진을 준비하고, 맡기고, 결과를 받는다.
 *
 * 서버 계약은 `docs/api-docs-receipt-section.md` 의 「공용 OCR」 절이다.
 *   POST {app}/ocr/jobs        사진을 맡긴다 → { ok, id }
 *   GET  {app}/ocr/jobs/{id}   결과를 묻는다 → { ok, status: pending | done | failed, result? }
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OcrError = void 0;
exports.createOcr = createOcr;
exports.ocrMessage = ocrMessage;
exports.verdictMessage = verdictMessage;
exports.preparePhoto = preparePhoto;
class OcrError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'OcrError';
    }
}
exports.OcrError = OcrError;
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {};
function createOcr(deps) {
    const sleep = deps.sleep ?? ((ms) => new Promise((done) => setTimeout(done, ms)));
    const now = deps.now ?? (() => Date.now());
    /** 사진을 맡기고 번호를 받는다. **같은 사진을 다시 맡기면 서버가 앞선 번호를 돌려준다** */
    async function submit(photo) {
        const form = new FormData();
        // RN 의 FormData 는 {uri, name, type} 를 파일로 받는다. 타입 정의가 Blob 만 알아서 넓힌다
        form.append('image', { uri: photo.uri, name: photo.name ?? 'receipt.jpg', type: photo.type ?? 'image/jpeg' });
        form.append('kind', 'receipt');
        const res = object(await deps.post('ocr/jobs', form));
        if (typeof res.id !== 'string' || res.id === '') {
            throw new OcrError('bad_response', '영수증을 맡기지 못했어요');
        }
        return res.id;
    }
    /** 결과를 한 번 묻는다. 기다리지 않는다 — 기다리려면 `read` 를 쓴다 */
    async function status(id) {
        const res = object(await deps.get('ocr/jobs/' + encodeURIComponent(id)));
        const s = res.status;
        if (s === 'done') {
            const result = object(res.result);
            // 서버가 done 이라면서 결과를 안 주면 믿지 않는다 — 빈 판정을 성공으로 넘기면 안 된다
            if (typeof result.verdict !== 'string')
                throw new OcrError('bad_response', '결과를 읽지 못했어요');
            return { status: 'done', result: { ...result, sha256: typeof res.sha256 === 'string' ? res.sha256 : undefined } };
        }
        if (s === 'failed')
            return { status: 'failed' };
        return { status: 'pending' };
    }
    /**
     * 맡기고 끝날 때까지 기다린다. **보통 10~15초**다.
     *
     * 1.5초마다 묻는다. 더 촘촘히 물어도 빨라지지 않는다 — 맥이 읽는 시간이 전부다.
     * `timeoutMs` 가 지나면 `timeout` 으로 던지는데, **서버에서는 계속 돈다.** 번호(`submit` 의
     * 반환값)를 갖고 있으면 나중에 `status` 로 다시 물을 수 있다.
     */
    async function read(photo, opts = {}) {
        const timeoutMs = opts.timeoutMs ?? 60000;
        const intervalMs = opts.intervalMs ?? 1500;
        const id = await submit(photo);
        const until = now() + timeoutMs;
        for (;;) {
            const s = await status(id);
            if (s.status === 'done' && s.result)
                return s.result;
            if (s.status === 'failed')
                throw new OcrError('ocr_failed', '영수증을 읽지 못했어요. 다시 찍어 주세요');
            if (now() >= until)
                throw new OcrError('timeout', '읽는 데 시간이 오래 걸려요. 잠시 뒤 다시 확인해 주세요');
            await sleep(intervalMs);
        }
    }
    return { submit, status, read };
}
/**
 * 서버·패키지 오류 코드를 **그 사람이 할 수 있는 일**로 바꾼다.
 *
 * `ocr_disabled` 는 사용자가 고칠 수 없다 — 앱 관리에서 이 앱의 「영수증 OCR」 스위치가
 * 꺼져 있다는 뜻이다. 화면에는 일반 문구를 두고, 만드는 사람은 이 코드를 보고 켜면 된다.
 */
function ocrMessage(code) {
    switch (code) {
        case 'ocr_disabled': return '지금은 영수증을 읽을 수 없어요';
        case 'ocr_failed': return '영수증을 읽지 못했어요. 다시 찍어 주세요';
        case 'timeout': return '읽는 데 시간이 오래 걸려요. 잠시 뒤 다시 확인해 주세요';
        case 'bad_response': return '영수증을 맡기지 못했어요. 잠시 뒤 다시 해 주세요';
        default: return '영수증을 읽지 못했어요. 잠시 뒤 다시 해 주세요';
    }
}
/**
 * 판정을 사용자에게 보일 문장으로. **반려 사유는 그 사람이 할 수 있는 일로 적는다** —
 * 돌아간 사진에는 「돌려서 다시」, 못 읽은 사진에는 「밝은 곳에서 다시」.
 */
function verdictMessage(result) {
    if (result.verdict === 'confirmed')
        return '영수증을 확인했어요';
    if (result.verdict === 'review')
        return '확인이 필요해요. 잠시 뒤 결과를 알려 드릴게요';
    const failed = new Set(result.checks.filter((c) => c.blocking && !c.passed).map((c) => c.name));
    if (failed.has('is_receipt'))
        return '영수증으로 확인되지 않았어요';
    if (failed.has('upright'))
        return '사진이 돌아가 있어요. 바로 세워서 다시 올려 주세요';
    if (failed.has('evidence_present') || failed.has('total_present')) {
        return '글자를 읽지 못했어요. 밝은 곳에서 영수증 전체가 나오게 다시 찍어 주세요';
    }
    return '영수증으로 확인되지 않았어요';
}
/**
 * 올리기 전에 사진을 준비한다 — **긴 변 1600 으로 줄이고, 방향을 픽셀에 굽는다.**
 *
 * 둘 다 영테크에서 실기기로 밟은 것이다.
 *  - 원본은 서버도 맥도 버티지 못한다. 1600 이면 사업자번호 같은 작은 글씨도 읽힌다
 *    (1024 로 줄이면 사업자번호가 17장 중 3장 → 1장으로 떨어졌다).
 *  - **EXIF 회전 태그만 남기면 아래 단계가 그것을 안 본다.** 작은 사진도 다시 인코딩해
 *    픽셀 자체를 바로 세운다. 크기는 인코딩된 값이 아니라 **디코딩한 뒤 값**으로 본다 —
 *    인코딩된 가로·세로는 EXIF 때문에 뒤바뀌어 있을 수 있다.
 *
 * `expo-image-manipulator` 를 **지연 `require`** 로 집는다. 모듈이 없는 빌드에서 정적 import 는
 * 앱 시작 자체를 죽인다(`@jcurve/auth` 의 함정 ②). 모듈이 없으면 사진을 그대로 돌려준다.
 */
async function preparePhoto(photo) {
    let manipulator;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        manipulator = require('expo-image-manipulator');
    }
    catch {
        return photo; // 웹 미리보기처럼 네이티브가 없는 곳 — 그대로 보낸다
    }
    const { ImageManipulator, SaveFormat } = manipulator;
    const context = ImageManipulator.manipulate(photo.uri);
    try {
        let rendered = await context.renderAsync();
        try {
            if (Math.max(rendered.width, rendered.height) > 1600) {
                context.resize(rendered.width >= rendered.height ? { width: 1600, height: null } : { width: null, height: 1600 });
                const resized = await context.renderAsync();
                rendered.release();
                rendered = resized;
            }
            const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
            return { uri: saved.uri, name: 'receipt.jpg', type: 'image/jpeg' };
        }
        finally {
            rendered.release();
        }
    }
    finally {
        context.release();
    }
}
