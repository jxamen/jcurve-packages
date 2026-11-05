export declare const LATEST_URL = "https://api.j-curve.co.kr/v1/packages/latest";
export declare const GITHUB_RELEASES = "https://api.github.com/repos/jxamen/jcurve-packages/releases?per_page=100";
export type Dep = {
    name: string;
    spec: string;
    installed: string | null;
};
export type Row = Dep & {
    latest: string | null;
    state: 'ok' | 'old' | 'unknown' | 'ahead';
};
export type Report = {
    rows: Row[];
    old: number;
    source: string;
};
type Fetch = (url: string) => Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
}>;
/** 판 문자열 비교 — 숫자 세 자리만 본다(1.1.2 < 1.1.10) */
export declare function compareVersions(a: string, b: string): number;
/** 의존성 주소(tgz · 릴리스 태그)에서 판을 읽는다 — node_modules 가 없을 때의 대안 */
export declare function versionFromSpec(spec: string): string | null;
/** 저장소의 @jcurve/* 의존성 — dependencies · devDependencies */
export declare function readDeps(root: string): Dep[];
/** 릴리스 태그 `<이름>-v<판>` 목록 → 이름별 최신 판 */
export declare function latestFromTags(tags: readonly string[]): Record<string, string>;
/** 최신 판 표 — 서버 먼저, 안 되면 GitHub. 둘 다 안 되면 Error */
export declare function fetchLatest(fetchFn?: Fetch): Promise<{
    latest: Record<string, string>;
    source: string;
}>;
export declare function compare(deps: readonly Dep[], latest: Record<string, string>, source: string): Report;
export declare function check(root: string, fetchFn?: Fetch): Promise<Report>;
/** 사람이 읽는 표 — 한 줄에 한 패키지 */
export declare function format(rep: Report): string;
export {};
