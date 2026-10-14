#!/bin/zsh
set -euo pipefail

test_root='/Users/binkerking/Documents/Riking-Project/Tomcat/tomcat-9.0.120-fbds/riking'
source_dir="$test_root/source"
backup_dir="$test_root/test-backup/vtb-safe-full-20260821-before-generate"
temp_dir=$(mktemp -d)

if [[ -e "$backup_dir" ]]; then
  print -u2 -- "Refusing to overwrite existing backup: $backup_dir"
  exit 2
fi

mkdir -p "$backup_dir"
for filename in AIF2.TXT BLN2.TXT CIF2.TXT REPORT.TXT TRN2.TXT; do
  cp -p "$source_dir/$filename" "$backup_dir/$filename"
done

write_utf16() {
  local utf8_file="$1"
  local target_file="$2"
  iconv -f UTF-8 -t UTF-16LE "$utf8_file" > "$target_file"
}

customer_id() { printf '100%03d' "$1"; }
account_no() { printf '408071560001%08d' "$1"; }
rmb_account() { printf '301141560001%08d' "$1"; }
external_account() { printf '621700000000%08d' "$1"; }

cif_utf8="$temp_dir/CIF2.txt"
aif_utf8="$temp_dir/AIF2.txt"
bln_utf8="$temp_dir/BLN2.txt"
trn_utf8="$temp_dir/TRN2.txt"
report_utf8="$temp_dir/REPORT.txt"

print -n -- $'\uFEFF' > "$cif_utf8"
print -n -- $'\uFEFF' > "$aif_utf8"
print -n -- $'\uFEFF' > "$bln_utf8"
print -n -- $'\uFEFF' > "$trn_utf8"
print -n -- $'\uFEFF' > "$report_utf8"

for i in {1..10}; do
  number=$(printf '%02d' "$i")
  cnum=$(customer_id "$i")
  account=$(account_no "$i")
  print -r -- "${cnum}|9131000010000000${number}|11|01|ID${cnum}|VTB测试客户${number}有限公司|0|VTB TEST CUSTOMER ${number} CO LTD|CHN|02150000${number}|SHANGHAI PUDONG||A|1000000.00|LEGAL REP ${number}|01|31010119800101${number}|CUST${cnum}|0||01|F5141|310000|02" >> "$cif_utf8"
  print -r -- "${account}|USD|${cnum}|8000|202401${number}||0|0|DAY|USD|5000000.00|40807" >> "$aif_utf8"
  print -r -- "${account}|USD|20260821-235959|100000.00|102345.67" >> "$bln_utf8"
done

print -r -- 'AIF2.TXT - Account' >> "$report_utf8"
print -r -- 'BLN2.TXT - Balance for end date of period' >> "$report_utf8"
print -r -- 'CIF2.TXT - Client' >> "$report_utf8"
print -r -- 'TRN2.TXT - Transaction' >> "$report_utf8"
print -r -- '' >> "$report_utf8"
print -r -- 'Period from 21.08.2026 00:00:00 to 21.08.2026 23:59:59' >> "$report_utf8"

write_trn() {
  local ref="$1" trn_ref="$2" cnum="$3" customer="$4" account="$5" time="$6" payment="$7" usage="$8" currency="$9" init_amount="${10}" trade_amount="${11}" opposite_account="${12}" transaction_type="${13}" use_type="${14}" use_detail="${15}" bop_code="${16}" bop_amount="${17}"
  print -r -- "${ref}|${trn_ref}|20260821|0001|${cnum}|${customer}|${account}|20260821|${time}|SHANGHAI|${payment}|FX RATE @7.1000|${usage}|${currency}|${init_amount}|${trade_amount}|10.00|5.00|OPBK001|OVERSEA BANK|01|OVERSEA COUNTERPARTY|01|USA|OPID${trn_ref}|14|${opposite_account}|01|${transaction_type}|T/T|20271231|VTB BANK SHANGHAI BRANCH|310000|00|01|AGENT${trn_ref}|CHN|ONLINE|TRD001|840|${use_type}|${use_detail}|${bop_code}|${bop_amount}|BOP TEST|929090|100.00|BOP TEST 2|0|TEST APPLICANT" >> "$trn_utf8"
}

# Ten loan issues produce CFACA, CFACB, CFADA and CFADB at the same time.
# Customer 100001 already exists in the current test database, avoiding the legacy
# VTB CFADA importer null-customer defect while the other customers are created by extraction.
for i in {1..10}; do
  number=$(printf '%02d' "$i")
  account=$(account_no "$i")
  external=$(external_account "$i")
  deal=$(printf 'LD20260821%03d' "$i")
  amount=$((10000 * i))
  write_trn "CFA20260821${number}" "TRNCFA${number}" '100001' 'VTB测试客户01有限公司' "$account" "110${number}" '02' "LOAN ISSUE ${deal} VTB CFA TEST" 'USD' "$amount" "-$amount" "$external" '0101' '001' "CFA TEST ${number}" '621011' "$amount"
done

# Ten sell-FX pairs. Only the 0401 leg is eligible, producing ten JSHD records.
for i in {1..10}; do
  number=$(printf '%02d' "$i")
  cnum=$(customer_id "$i")
  account=$(account_no "$i")
  rmb=$(rmb_account "$i")
  external=$(external_account "$i")
  ref="JSHSELL20260821${number}"
  write_trn "$ref" "TRNSELLA${number}" "$cnum" "VTB测试客户${number}有限公司" "$rmb" "120${number}" '02' "JSH SELL FX RMB LEG ${number}" 'CNY' '71000.00' '71000.00' "$rmb" '0401' '' '' '' ''
  write_trn "$ref" "TRNSELLB${number}" "$cnum" "VTB测试客户${number}有限公司" "$external" "121${number}" '01' "JSH SELL FX USD LEG ${number}" 'USD' '10000.00' '10000.00' "$account" '9901' '' '' '' ''
done

# Ten buy-FX pairs. Only the 0301 leg is eligible, producing ten JSHE records.
for i in {1..10}; do
  number=$(printf '%02d' "$i")
  cnum=$(customer_id "$i")
  account=$(account_no "$i")
  rmb=$(rmb_account "$i")
  external=$(external_account "$((100 + i))")
  ref="JSHBUY20260821${number}"
  write_trn "$ref" "TRNBUYA${number}" "$cnum" "VTB测试客户${number}有限公司" "$account" "130${number}" '01' "JSH BUY FX USD LEG ${number}" 'USD' '10000.00' '10000.00' "$external" '0301' '' '' '' ''
  write_trn "$ref" "TRNBUYB${number}" "$cnum" "VTB测试客户${number}有限公司" "$rmb" "131${number}" '02' "JSH BUY FX RMB LEG ${number}" 'CNY' '71000.00' '71000.00' "$account" '9902' '' '' '' ''
done

# Twenty independently traceable BOP pool transactions.
for i in {1..20}; do
  number=$(printf '%02d' "$i")
  customer_index=$(( (i - 1) % 10 + 1 ))
  cnum=$(customer_id "$customer_index")
  account=$(account_no "$customer_index")
  external=$(external_account "$((200 + i))")
  if (( i % 2 == 0 )); then
    ref="BOPOUT20260821${number}"
    payment='02'
    bop_code='122030'
  else
    ref="BOPINC20260821${number}"
    payment='01'
    bop_code='121010'
  fi
  amount=$((2000 + i * 100))
  write_trn "$ref" "TRNBOP${number}" "$cnum" "VTB测试客户${customer_index}有限公司" "$account" "140${number}" "$payment" "BOP POOL TEST ${number}" 'USD' "$amount" "$amount" "$external" '0201' '001' "BOP POOL TEST ${number}" "$bop_code" "$amount"
done

write_utf16 "$cif_utf8" "$source_dir/CIF2.TXT"
write_utf16 "$aif_utf8" "$source_dir/AIF2.TXT"
write_utf16 "$bln_utf8" "$source_dir/BLN2.TXT"
write_utf16 "$trn_utf8" "$source_dir/TRN2.TXT"
write_utf16 "$report_utf8" "$source_dir/REPORT.TXT"

rm -f "$cif_utf8" "$aif_utf8" "$bln_utf8" "$trn_utf8" "$report_utf8"
rmdir "$temp_dir"
print -r -- "Generated VTB SAFE test data in: $source_dir"
print -r -- "Source backup: $backup_dir"
