"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * `@jcurve/money` — 리워드 앱 공용 **현금 인출 검증**.
 *
 * **앱마다 달라서는 안 되는 것만 담았다.** 금액 규칙(최소·최대·단위)은 서버가 앱별로 내려 주고,
 * 여기 있는 것은 **그 규칙을 어떻게 적용하고 무엇이 틀렸다고 말할지**다.
 *
 * ## 왜 묶었나
 *
 * 2026-09-21 실측에서 이 파일이 **네 앱에서 글자 하나까지 같았다**(140줄, 테스트 156줄).
 * 포크로 앱을 만들어 온 탓인데, 그 상태로 각자 자라면 **어떤 앱에서만 입금이 실패한다.**
 * 계좌번호·예금주·전화번호를 다듬는 규칙이 어긋나면 은행이 거절하고,
 * 그건 사용자가 고칠 수 없는 자리다.
 *
 * ## 담은 것
 *
 *  - `checkCash` — 얼마를 넣었나. 잔액·최소·최대·단위를 한 번에 본다
 *  - `amountChoices` — 눌러서 고를 금액(잔액 안에서)
 *  - `sayCashProblem` — 무엇이 틀렸는지 사람 말로
 *  - `cleanAccount`·`cleanName`·`cleanPhone` — 보내기 전에 다듬는다
 *  - `accountLooksOk`·`phoneLooksOk` — 보낼 만한 모양인가
 *
 * **화면은 없다.** 인출 화면은 앱마다 그 앱답게 생겨야 한다.
 */
__exportStar(require("./withdraw"), exports);
