"use strict";
/**
 * 현금 인출 — 모은 포인트를 **계좌로 받는다**(2026-09-17 지시).
 *
 * 기프티콘 교환과 다르다. 저쪽은 상품이 정해져 있어 금액을 고를 일이 없지만, 이쪽은
 * 사람이 금액을 직접 적는다 — **적은 숫자가 곧 나가는 돈**이라 여기서 막지 못하면
 * 서버가 막아야 하고, 둘 다 못 막으면 돈이 잘못 나간다.
 *
 * 규칙(어드민 「앱 설정」이 값을 정한다):
 *  - 1,000원 단위로만 (`unit`)
 *  - 한 번에 50,000원까지 (`max`)
 *  - 최소 1,000원 (`min`)
 *  - 가진 포인트보다 많이 못 뺀다 (1P = 1원)
 *
 * **게스트는 신청할 수 없다.** 받는 사람을 확인할 수 없는 계정으로 현금이 나가면 되돌릴 수
 * 없다 — 기프티콘도 같은 이유로 막아 두었다(서버가 403 `signup_required`).
 *
 * 순수 함수다. 화면은 이 결과를 그리기만 하고, 진짜 판정은 서버가 한 번 더 한다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CASH = void 0;
exports.checkCash = checkCash;
exports.amountChoices = amountChoices;
exports.sayCashProblem = sayCashProblem;
exports.cleanAccount = cleanAccount;
exports.accountLooksOk = accountLooksOk;
exports.cleanName = cleanName;
exports.cleanPhone = cleanPhone;
exports.phoneLooksOk = phoneLooksOk;
exports.cashFormReady = cashFormReady;
exports.DEFAULT_CASH = { min: 1000, max: 50000, unit: 1000 };
/**
 * 적은 금액이 나갈 수 있는 금액인가.
 *
 * 순서가 중요하다 — 「50,500원」은 단위도 틀리고 한도도 넘지만, **단위**를 먼저 말해 줘야
 * 사람이 고칠 수 있다. 한도부터 말하면 5만 원으로 줄였다가 또 단위로 걸린다.
 */
function checkCash(input, balance, rules = exports.DEFAULT_CASH) {
    const raw = String(input ?? '').replace(/[,\s원]/g, '');
    if (raw === '')
        return { ok: false, problem: 'empty' };
    if (!/^\d+$/.test(raw))
        return { ok: false, problem: 'not_number' };
    const amount = Number(raw);
    const unit = Math.max(1, Math.trunc(rules.unit));
    if (amount % unit !== 0)
        return { ok: false, problem: 'unit' };
    if (amount < rules.min)
        return { ok: false, problem: 'min' };
    if (amount > rules.max)
        return { ok: false, problem: 'max' };
    if (amount > balance)
        return { ok: false, problem: 'balance' };
    return { ok: true, amount };
}
/**
 * 고를 수 있는 금액들 — **가진 포인트 안에서만**(2026-09-17 지시).
 *
 * 전에는 숫자를 직접 적게 했다. 그러다 보니 74P 를 가진 사람에게도 숫자판이 열렸고,
 * 다 적고 누른 뒤에야 「가진 포인트보다 많아요」를 봤다. 애초에 못 고르게 하면
 * 틀릴 일이 없다 — 나갈 수 있는 금액만 목록에 올린다.
 *
 * 모자라면 **빈 배열**이다. 화면은 그때 목록 대신 「얼마가 더 필요한지」를 말한다.
 */
function amountChoices(balance, rules = exports.DEFAULT_CASH) {
    const unit = Math.max(1, Math.trunc(rules.unit));
    // 가진 것과 한도 중 **작은 쪽**까지. 단위로 내림 — 3,500P 면 3,000원까지다
    const ceiling = Math.floor(Math.min(rules.max, Math.trunc(balance)) / unit) * unit;
    const out = [];
    for (let v = Math.max(rules.min, unit); v <= ceiling; v += unit)
        out.push(v);
    return out;
}
/** 사유를 사람 말로 */
function sayCashProblem(p, rules = exports.DEFAULT_CASH) {
    switch (p) {
        case 'empty': return '받을 금액을 적어 주세요';
        case 'not_number': return '숫자만 적어 주세요';
        case 'unit': return rules.unit.toLocaleString() + '원 단위로 적어 주세요';
        case 'min': return '최소 ' + rules.min.toLocaleString() + '원부터 신청할 수 있어요';
        case 'max': return '한 번에 ' + rules.max.toLocaleString() + '원까지 신청할 수 있어요';
        case 'balance': return '가진 포인트보다 많아요';
    }
}
/**
 * 계좌번호 — 숫자와 하이픈만 남긴다.
 * 은행마다 자릿수가 달라서 길이는 재지 않는다. 대신 **너무 짧으면** 오타다.
 */
function cleanAccount(v) {
    return String(v ?? '').replace(/[^\d-]/g, '').slice(0, 20);
}
/** 계좌번호로 볼 만한가 — 숫자만 세서 판단한다 */
function accountLooksOk(v) {
    return cleanAccount(v).replace(/-/g, '').length >= 10;
}
/** 이름 — 앞뒤 공백만 걷어낸다. 예금주는 은행이 대조하므로 우리가 모양을 따지지 않는다 */
function cleanName(v) {
    return String(v ?? '').trim().slice(0, 20);
}
/**
 * 휴대폰 번호 — 숫자만 남기고 11자리까지.
 * 인증은 서버가 한다. 여기서는 **적어 넣을 수 있는 모양**인지만 본다.
 */
function cleanPhone(v) {
    return String(v ?? '').replace(/\D/g, '').slice(0, 11);
}
function phoneLooksOk(v) {
    return /^01[016789]\d{7,8}$/.test(cleanPhone(v));
}
/** 신청에 필요한 것이 다 찼나 — 버튼을 켤지 정한다 */
function cashFormReady(f, balance, rules = exports.DEFAULT_CASH) {
    return cleanName(f.name).length >= 2
        && f.bank !== ''
        && accountLooksOk(f.account)
        && checkCash(f.amount, balance, rules).ok;
}
