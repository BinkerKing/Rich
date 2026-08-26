import { writeFileSync } from 'node:fs';

const dir = new URL('.', import.meta.url);
const pad = (n, width) => String(n).padStart(width, '0');
const write = (name, rows) => writeFileSync(new URL(name, dir), `\uFEFF${rows.join('\r\n')}\r\n`, 'utf16le');
const customerId = n => ({ 38: '829240', 39: '686581', 40: '558429' }[n] ?? pad(100000 + n, 6));
const foreign = n => `40807156${pad(n, 6)}`;
const bridge = n => `30114156${pad(n, 6)}`;
const jshUsage = n => {
  const k = n % 4;
  if (k === 1) return `FXCBC${pad(n, 6)} JSH settlement`;
  if (k === 2) return `FXCSC${pad(n, 6)} JSH settlement`;
  if (k === 3) return `RBS${pad(n, 8)} JSH purchase`;
  return `FXCBC${pad(n, 6)} FXCSC${pad(n, 6)} RBS${pad(n, 8)} priority`;
};
const trn = ({ seq, customer, date, paymentFlag, accountId, oppositeAccount, transactionType, usage, amount, currency, useType = '', useDetail = '', bopTxCode = '' }) => {
  const a = Array(50).fill('');
  const c = customerId(customer);
  Object.assign(a, {
    0: `REF-${pad(seq, 4)}`, 1: `TRN-${pad(seq, 4)}`, 2: '20260825', 3: '0001', 4: c,
    5: `Customer ${c}`, 6: accountId, 7: date, 8: `09${pad(seq % 60, 2)}00`, 9: 'Moscow',
    10: paymentFlag, 11: '@', 12: usage, 13: currency ?? (customer % 3 === 0 ? 'EUR' : 'USD'),
    14: amount.toFixed(2), 15: amount.toFixed(2), 16: '0', 17: '0', 18: `BK${pad(customer, 4)}`,
    19: 'VTB', 20: '01', 21: `Counterparty ${c}`, 22: '01', 23: 'RU', 24: `P${c}`,
    25: '01', 26: oppositeAccount, 27: '01', 28: transactionType, 29: '01', 30: '20261231',
    31: 'Moscow Branch', 32: '770000', 33: '01', 34: '01', 35: `P${c}`, 36: 'RU',
    37: '01', 38: `T${pad(seq, 4)}`, 39: 'RU', 40: useType, 41: useDetail, 42: bopTxCode
  });
  return a.join('|');
};

const transactions = [];
let seq = 1;
for (let c = 1; c <= 30; c += 1) {
  const settlement = c % 2 === 1;
  const usage = c === 28 ? 'JSH transaction deliberately without marker' : jshUsage(c);
  const badHistoryAccount = c === 26;
  transactions.push(trn({
    seq: seq++, customer: c, date: '20260825', paymentFlag: '02',
    accountId: settlement ? bridge(c) : foreign(c), oppositeAccount: settlement ? bridge(c) : foreign(c),
    transactionType: settlement ? '0401' : '0301', usage, amount: 1000 + c * 100,
    useType: settlement ? '001' : '', useDetail: settlement ? '测试：贸易结汇用途' : '', bopTxCode: settlement ? '121010' : ''
  }));
  transactions.push(trn({
    seq: seq++, customer: c, date: '20260824', paymentFlag: '01',
    accountId: settlement ? foreign(c) : bridge(c), oppositeAccount: settlement ? (badHistoryAccount ? `409${pad(c, 11)}` : foreign(c)) : bridge(c),
    transactionType: '9999', usage, amount: 1000 + c * 100
  }));
}
for (let c = 31; c <= 40; c += 1) {
  for (let n = 0; n < 2; n += 1) transactions.push(trn({
    seq: seq++, customer: c, date: n ? '20260824' : '20260825', paymentFlag: n ? '01' : '02',
    accountId: foreign(c), oppositeAccount: foreign(c), transactionType: '9999',
    usage: `ordinary transaction ${c}-${n + 1} without JSH marker`, amount: 1000 + c * 100
  }));
}
for (let c = 1; c <= 20; c += 1) {
  const kind = c <= 10 ? 'LOAN ISSUE' : c <= 15 ? 'PRINCIPAL REPAYMENT' : 'INT REPAYMENT';
  const scenarioCustomer = c === 8 ? 38 : c === 9 ? 39 : c === 10 ? 40 : c;
  const isForeignOpposite = c !== 14 && c !== 19;
  transactions.push(trn({
    seq: seq++, customer: scenarioCustomer, date: c === 20 ? '20260823' : '20260825', paymentFlag: '01',
    accountId: foreign(scenarioCustomer), oppositeAccount: isForeignOpposite ? foreign(scenarioCustomer) : bridge(scenarioCustomer),
    transactionType: '9999', usage: `${kind} LD${pad(c, 11)} CFA case`, amount: 5000 + c * 100,
    currency: c === 1 ? 'CNY' : c === 2 ? 'RUR' : undefined
  }));
}

const cifs = [], aifs = [], blns = [];
for (let c = 1; c <= 40; c += 1) {
  const id = customerId(c);
  cifs.push([id, '0001', '01', '01', `P${id}`, `客户${id}`, '', `CUSTOMER ${id}`, 'RU', `1000${pad(c, 4)}`, 'Moscow', `1000${pad(c, 4)}`, '01', String(c * 100000), `Legal${c}`, '01', `LP${id}`, '', '0', '', '01', 'A', '770000', 'S'].join('|'));
  aifs.push([foreign(c), c % 3 === 0 ? 'EUR' : 'USD', id, '01', '20200101', '', '', '0', '', '', '', ''].join('|'));
  blns.push([foreign(c), c === 2 ? 'RUR' : c % 3 === 0 ? 'EUR' : 'USD', '2026-08-25', (1000 + c * 100).toFixed(2), '0.00'].join('|'));
}

write('TRN2.TXT', transactions);
write('CIF2.TXT', cifs);
write('AIF2.TXT', aifs);
write('BLN2.TXT', blns);
