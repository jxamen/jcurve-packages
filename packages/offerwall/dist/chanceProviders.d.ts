/**
 * 0.5.0 — 찬스 화면 제공자 목록. 찬스 탭에 어떤 오퍼월들이 있는지를 한 곳에서 들고 있다(꼬꼬 앱 코드의 `registerOfferwall` 을 패키지로 옮긴 것과 같은 생각).
 *
 * 한 제공자는 둘 중 하나다:
 *  - `embedded` — 화면 안에 끼워 넣는 오퍼월(애드팝콘: `OfferwallView`). 찬스 화면의 본문이 된다.
 *  - `launcher` — 전체 화면을 따로 여는 SDK(스냅플레이: `showOfferwall`). 탭을 누르면 열고, 화면에는 「다시 열기」 자리를 둔다.
 *
 * `chanceProviders()` 는 **지금 쓸 수 있는** 제공자만 등록 순서대로 준다. 쓸 수 없는 제공자(네이티브 모듈이 없는 옛 빌드 · 서버 설정이 없음 · 꺼짐)는 목록에 없으니,
 * 화면은 목록이 하나뿐이면 탭을 그리지 않고 지금 화면 그대로 둔다. 가져오는 순간 하는 일은 없다(등록은 객체 하나 넣기뿐).
 */
export type ChanceContext = {
    /** 회원의 오퍼월 별칭 — 서버가 준 64자 SHA256 hex. 실제 회원 번호 · 전화번호 · 이메일이 아니다. */
    usn: string;
    /** 화면에 보여 줄 이름(선택). 닉네임이 드러나면 안 되면 앱이 가려서 준다(예: 우리****). */
    displayName?: string;
};
export type ChanceResult = {
    ok: true;
} | {
    ok: false;
    reason: 'not_ready' | 'invalid_usn' | 'sdk_error';
    message: string;
};
export type ChanceProvider = {
    id: string;
    /** 제공자 이름(내부용 · 앱이 `showProviderNames` 를 켠 때만 탭에 부 제목으로 보인다). */
    name: string;
    kind: 'embedded' | 'launcher';
    /** 지금 이 기기에서 쓸 수 있는가. 던지지 않아야 하고(던지면 쓸 수 없는 것으로 본다) 가벼워야 한다 — 화면이 다시 그려질 때마다 불린다. */
    available(): boolean;
    /** launcher: 보여 주기 전에 미리 준비한다(SDK 초기화 · 회원 설정). 실패해도 화면은 그대로이고 `open` 이 다시 시도한다. */
    prepare?(context: ChanceContext): Promise<ChanceResult>;
    /** launcher: 전체 화면을 연다. */
    open?(context: ChanceContext): Promise<ChanceResult>;
    /** 0.6.0 launcher: 이 빌드가 제공자의 화면을 탭 안에 끼워 넣는 네이티브 뷰를 갖고 있는가(없는 옛 빌드면 false → `open` 의 전체 화면을 쓴다). */
    canEmbed?(): boolean;
    /** 0.6.0 launcher: 탭 안에 끼워 넣을 화면(`prepare` 가 끝난 뒤에 그린다). 못 그리면 null. `onClose` = 그 화면이 닫아 달라고 할 때(찬스1 로 돌아간다). */
    embed?(handlers: {
        onClose(): void;
    }): import('react').ReactElement | null;
};
/** 같은 id 가 있으면 그 자리에서 바꾸고, 없으면 맨 뒤에 넣는다(= 탭 순서는 등록 순서). */
export declare function registerChanceProvider(provider: ChanceProvider): void;
export declare function unregisterChanceProvider(id: string): void;
/** 쓸 수 있는 제공자들(등록 순서). */
export declare function chanceProviders(): ChanceProvider[];
export declare function chanceProviderById(id: string): ChanceProvider | undefined;
/** 제공자가 쓸 수 있게 되었거나 못 쓰게 되었을 때(설정이 왔다 · 초기화됨) 부른다. 화면이 탭을 다시 계산한다. 구독 해제 함수를 돌려준다. */
export declare function subscribeChanceProviders(listener: () => void): () => void;
export declare function notifyChanceProviders(): void;
/** 화면용: 쓸 수 있는 제공자 목록. 목록이 바뀔 때만 다시 그린다. */
export declare function useChanceProviders(): ChanceProvider[];
/** 애드팝콘 — 찬스 화면의 본문 그 자체(`OfferwallView`). 이 자리는 항상 첫 번째다. */
export declare const ADPOPCORN_PROVIDER_ID = "adpopcorn";
