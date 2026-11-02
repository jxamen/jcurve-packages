/**
 * 주문 불러오기 — 읽는 대로 서버에 올리는 순수 로직(노드에서 시험한다). react-native 를 import 하지 않는다.
 * 흐름이 주문을 내면 add 로 검사 · 중복 거르기(최근 1년 · 주문번호)를 거쳐 줄에 세우고, 한 번에 한 요청씩 50건 이하로 올린다.
 * 요청이 실패하면 그 묶음은 줄 맨 앞에 남고, 다음 add 나 finish 에서 다시 올린다. 주문 내용은 로그나 예외에 넣지 않는다.
 */
import { type ImportResult } from './importPlan';
import { type ImportTally, type OrderInput } from './model';
export type UploadProgress = {
    /** 지금까지 읽어 담은 주문(중복 · 기간 밖 · 한도 밖은 빼고) */
    read: number;
    /** 서버가 받은 주문 수(요청이 성공한 묶음의 건수) */
    sent: number;
    /** 아직 못 올린 주문 */
    pending: number;
    /** 마지막 요청이 실패했다 — 다음 add · finish 에서 다시 올린다 */
    failed: boolean;
    /** 서버가 이 곳 읽기를 막고 있다(read_disabled) */
    readOff: boolean;
    /** 주머니가 가득 차서 더 올리지 않는다 */
    full: boolean;
};
export type UploadSummary = {
    result: ImportResult;
    pending: number;
    readOff: boolean;
};
export type UploaderSend = (orders: OrderInput[]) => Promise<{
    tally: ImportTally;
    unreadable: number;
}>;
export type Uploader = {
    /** 흐름이 낸 주문들 — 검사 · 중복 거르기 뒤 줄에 세우고 바로 올린다 */
    add(orders: unknown[]): void;
    /** 줄에 남은 것을 모두 올린다(실패하면 거기서 멈춘다) */
    flush(): Promise<void>;
    /** 읽기 기간(일)을 바꾼다 — 플랫폼마다 서버 설정이 다르므로 흐름을 시작하기 전에 맞춘다. 없으면 365 */
    setWindowDays(days?: number): void;
    progress(): UploadProgress;
    /** 끝: 남은 것을 올려 보고(실패 시 한 번 더) 결과를 낸다 */
    finish(): Promise<UploadSummary>;
};
export declare function createUploader(args: {
    send: UploaderSend;
    onChange?: (p: UploadProgress) => void;
    nowMs?: number;
}): Uploader;
