/**
 * 공용 영수증 OCR 의 앱 쪽 — 사진을 준비하고, 맡기고, 결과를 받는다.
 *
 * 서버 계약은 `docs/api-docs-receipt-section.md` 의 「공용 OCR」 절이다.
 *   POST {app}/ocr/jobs        사진을 맡긴다 → { ok, id }
 *   GET  {app}/ocr/jobs/{id}   결과를 묻는다 → { ok, status: pending | done | failed, result? }
 */
/** 품목 한 줄. 단가와 금액은 다르다 — 둘 다 **인쇄된 것만** 오고 곱해서 채우지 않는다 */
export type OcrItem = {
    name: string;
    unitPrice: number | null;
    price: number | null;
    count: number;
};
/**
 * 뽑힌 값. 못 읽은 칸은 `null` 이다 — 지어내서 채우지 않는다.
 *
 * `paidAt` 이 결제일시 한 칸이다(`2026-08-16 12:10:17`). 영수증에 초가 없으면 분까지만 온다.
 * `businessNumber` 는 검증번호까지 통과한 것만, `approval` 은 여덟 자리만 온다.
 * **`store` 는 믿을 만하지 않다** — 밴사 로고·카드 이름·손글씨를 상호로 읽는 일이 잦다.
 */
export type OcrFields = {
    store: string | null;
    paidAt: string | null;
    date: string | null;
    time: string | null;
    total: number | null;
    businessNumber: string | null;
    approval: string | null;
    items: OcrItem[];
    /** 대조할 원문이 어디서 왔나. `model` 이면 독립 OCR 없이 판정한 것이라 대조가 약했다 */
    evidenceSource?: 'vision' | 'model';
    rotation?: number;
    [key: string]: unknown;
};
export type OcrCheck = {
    name: string;
    passed: boolean;
    blocking: boolean;
    detail: string;
};
/**
 * 판정 하나.
 *
 *   confirmed  값이 종이에 있다
 *   review     값은 있는데 자리가 안 맞거나 못 가렸다 — 사람이 볼 자리
 *   rejected   영수증이 아니거나, 읽을 것이 없거나, 돌아갔다
 *
 * **중복은 여기서 안 막는다.** 앱마다 기준이 달라서다. `contentKey`(결제일+시:분+총액)와
 * `sha256` 으로 앱이 직접 가른다.
 */
export type OcrResult = {
    verdict: 'confirmed' | 'review' | 'rejected';
    fields: OcrFields;
    checks: OcrCheck[];
    contentKey: string | null;
    sha256?: string;
};
export type OcrStatus = {
    status: 'pending' | 'done' | 'failed';
    result?: OcrResult;
};
/** React Native `FormData` 가 받는 파일 모양 */
export type OcrPhoto = {
    uri: string;
    name?: string;
    type?: string;
};
/**
 * 앱마다 다른 것은 **HTTP 하나뿐**이다 — 인증 헤더(`X-App-Token` + 회원 세션)와 오류 모양이
 * 앱마다 달라서, 이 패키지가 직접 부르지 않고 앱의 호출 함수를 받는다(`@jcurve/auth` 와 같은 방식).
 *
 * `path` 는 앱 주소 뒤에 붙는 부분이다(`ocr/jobs`). 앱은 자기 `{base}/{app}/` 를 앞에 붙인다.
 * 서버가 거절하면 **던져라** — 오류 코드는 그 앱의 오류 모양 그대로 두면 된다.
 */
export type OcrDeps = {
    post: (path: string, body: FormData) => Promise<unknown>;
    get: (path: string) => Promise<unknown>;
    /** 시험할 때 바꾼다 */
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
};
export declare class OcrError extends Error {
    readonly code: 'bad_response' | 'ocr_failed' | 'timeout';
    constructor(code: 'bad_response' | 'ocr_failed' | 'timeout', message: string);
}
export declare function createOcr(deps: OcrDeps): {
    submit: (photo: OcrPhoto) => Promise<string>;
    status: (id: string) => Promise<OcrStatus>;
    read: (photo: OcrPhoto, opts?: {
        timeoutMs?: number;
        intervalMs?: number;
    }) => Promise<OcrResult>;
};
/**
 * 서버·패키지 오류 코드를 **그 사람이 할 수 있는 일**로 바꾼다.
 *
 * `ocr_disabled` 는 사용자가 고칠 수 없다 — 앱 관리에서 이 앱의 「영수증 OCR」 스위치가
 * 꺼져 있다는 뜻이다. 화면에는 일반 문구를 두고, 만드는 사람은 이 코드를 보고 켜면 된다.
 */
export declare function ocrMessage(code: string): string;
/**
 * 판정을 사용자에게 보일 문장으로. **반려 사유는 그 사람이 할 수 있는 일로 적는다** —
 * 돌아간 사진에는 「돌려서 다시」, 못 읽은 사진에는 「밝은 곳에서 다시」.
 */
export declare function verdictMessage(result: OcrResult): string;
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
export declare function preparePhoto(photo: OcrPhoto): Promise<OcrPhoto>;
