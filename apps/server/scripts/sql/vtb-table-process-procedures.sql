/* Generated from the VTB PostgreSQL reference script. Do not hand-edit; run generate-vtb-table-process-procedures.ts. */

/* One target table only. Extracted without changing the original DML from usp_vtb_safe2_extract_acc. */
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_table_t_safe_accca(
p_business_date date,
    p_branch_id numeric DEFAULT NULL,
    p_branch_code varchar DEFAULT '310000167001',
    p_branch_name varchar DEFAULT NULL,
    p_safe_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_name varchar DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    WITH src AS (
            SELECT
                a.account_id,
                left(a.currency_code, 3) AS currency_code,
                m.target_account_type,
                a.account_open_time,
                a.limit_type,
                a.limit_amt,
                CASE
                    WHEN substring(p_branch_code from 7 for 4) IN ('1511', '1670', '1451', '1481')
                    THEN c.customer_type
                END AS amttype,
                CASE
                    WHEN substring(p_branch_code from 7 for 4) IN ('1511', '1670', '1451', '1481')
                    THEN c.depart_id
                END AS encode,
                CASE
                    WHEN substring(p_branch_code from 7 for 4) IN ('1511', '1670', '1451', '1481')
                    THEN c.customers_english_name
                END AS enname,
                CASE
                    WHEN m.target_account_type = '3400' OR c.depart_id = '636882221'
                    THEN 'NRA' || a.account_id
                    ELSE a.account_id
                END AS target_account_no
            FROM vtb.aif_tab a
            JOIN vtb.account_type_map m ON m.source_account_type = a.account_type
            LEFT JOIN vtb.cif_tab c ON c.customer_id = a.customer_id
            WHERE a.account_id LIKE '40%'
              AND a.account_id NOT LIKE '409%'
              AND NOT (a.account_id LIKE '40807156%' AND m.target_account_type <> '3400')
        )
        INSERT INTO vtb.t_safe_accca (
            createdtime, lastmodifiedtime, invalid, actiontype, branchid, datasource, datastatus,
            dealno, safebranchcode, safebranchname, tname, accountcata, accountlimit,
            accountno, accountstat, accounttype, branchcode, branchname, busdate,
            currencycode, amttype, encode, enname, filenumber, limittype, data_date
        )
        SELECT
            now(), now(), 0, 'A', p_branch_id, 2, 0,
            s.target_account_no, p_safe_branch_code, p_safe_branch_name, 'ACCCA', '12',
            NULLIF(s.limit_amt, '')::numeric, s.target_account_no, '11', s.target_account_type,
            p_branch_code, p_branch_name, COALESCE(vtb.to_date_yyyymmdd(s.account_open_time), p_business_date),
            s.currency_code, s.amttype, s.encode, s.enname, '', NULLIF(s.limit_type, ''), p_business_date
        FROM src s
        WHERE NOT EXISTS (
            SELECT 1 FROM vtb.t_safe_accca old
            WHERE old.accountno = s.target_account_no
              AND old.currencycode = s.currency_code
              AND COALESCE(old.invalid, 0) = 0
        );
END;
$$;

/* One target table only. Extracted without changing the original DML from usp_vtb_safe2_extract_acc. */
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_table_t_safe_acccb(
p_business_date date,
    p_branch_id numeric DEFAULT NULL,
    p_branch_code varchar DEFAULT '310000167001',
    p_branch_name varchar DEFAULT NULL,
    p_safe_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_name varchar DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM vtb.t_safe_acccb WHERE dealdate::date = p_business_date AND COALESCE(invalid, 0) = 0;

    WITH flow AS (
            SELECT account_no, currency_code, sum(credit) AS credit, sum(debit) AS debit
            FROM (
                SELECT
                    t.account_id AS account_no,
                    left(t.currency_code, 3) AS currency_code,
                    CASE WHEN t.payment_flag = '01' THEN abs(NULLIF(t.trade_amount, '')::numeric) ELSE 0 END AS credit,
                    CASE WHEN t.payment_flag = '01' THEN 0 ELSE abs(NULLIF(t.trade_amount, '')::numeric) END AS debit
                FROM vtb.transaction_tab t
                WHERE vtb.to_date_yyyymmdd(t.transaction_date) = p_business_date
                  AND t.account_id LIKE '40%'
                  AND t.account_id NOT LIKE '409%'
                UNION ALL
                SELECT
                    t.oppositers_account_id,
                    left(t.currency_code, 3),
                    CASE
                        WHEN t.ref_no LIKE 'FXCSC%' THEN abs(NULLIF(t.trade_amount, '')::numeric)
                        WHEN t.ref_no LIKE 'FXCBC%' THEN 0
                        WHEN t.usage LIKE 'LOAN ISSUE%' THEN abs(NULLIF(t.trade_amount, '')::numeric)
                        WHEN t.account_id LIKE '47405%' OR t.account_id LIKE '3230%' OR t.account_id LIKE '30114%'
                            THEN CASE WHEN t.payment_flag = '01' THEN abs(NULLIF(t.trade_amount, '')::numeric) ELSE 0 END
                        ELSE CASE WHEN t.payment_flag = '01' THEN 0 ELSE abs(NULLIF(t.trade_amount, '')::numeric) END
                    END,
                    CASE
                        WHEN t.ref_no LIKE 'FXCSC%' THEN 0
                        WHEN t.ref_no LIKE 'FXCBC%' THEN abs(NULLIF(t.trade_amount, '')::numeric)
                        WHEN t.usage LIKE 'LOAN ISSUE%' THEN 0
                        WHEN t.account_id LIKE '47405%' OR t.account_id LIKE '3230%' OR t.account_id LIKE '30114%'
                            THEN CASE WHEN t.payment_flag = '01' THEN 0 ELSE abs(NULLIF(t.trade_amount, '')::numeric) END
                        ELSE CASE WHEN t.payment_flag = '01' THEN abs(NULLIF(t.trade_amount, '')::numeric) ELSE 0 END
                    END
                FROM vtb.transaction_tab t
                WHERE vtb.to_date_yyyymmdd(t.transaction_date) = p_business_date
                  AND t.oppositers_account_id LIKE '40%'
                  AND t.oppositers_account_id NOT LIKE '409%'
            ) x
            GROUP BY account_no, currency_code
        )
        INSERT INTO vtb.t_safe_acccb (
            createdtime, lastmodifiedtime, invalid, actiontype, branchid, datasource, datastatus,
            dealno, safebranchcode, safebranchname, tname, acccaid, accountno, accounttype,
            balance, branchcode, branchname, credit, currencycode, dealdate, debit,
            encode, enname, busdate, data_date
        )
        SELECT
            now(), now(), 0, 'A', p_branch_id, 2, 0,
            acc.dealno, p_safe_branch_code, p_safe_branch_name, 'ACCCB', acc.id,
            acc.accountno, acc.accounttype, COALESCE(NULLIF(b.ldbl::text, '')::numeric, 0), p_branch_code,
            p_branch_name, COALESCE(f.credit, 0), b.currency, p_business_date,
            COALESCE(f.debit, 0), acc.encode, acc.enname, p_business_date, p_business_date
        FROM vtb.bln_tab b
        JOIN vtb.t_safe_accca acc
          ON replace(acc.accountno, 'NRA', '') = b.account_id
         AND acc.currencycode = b.currency
         AND COALESCE(acc.invalid, 0) = 0
        LEFT JOIN flow f ON f.account_no = b.account_id AND f.currency_code = b.currency
        WHERE vtb.to_date_yyyymmdd(b.bus_date) = p_business_date;
END;
$$;

/* One target table only. Extracted without changing the original DML from usp_vtb_safe2_extract_exd_contracts. */
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_table_t_safe_exda_n(
p_business_date date,
    p_branch_id numeric DEFAULT NULL,
    p_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_name varchar DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM vtb.t_safe_exda_n WHERE busdate::date = p_business_date AND COALESCE(invalid, 0) = 0;

    INSERT INTO vtb.t_safe_exda_n (
            invalid, actiontype, actiondesc, branchid, datasource, datastatus,
            dealno, safebranchcode, safebranchname, tname, anninrate,
            contractamount, contractcurr, creditorcode, creditorname, creditornamen,
            creditortype, crehqcode, debtype, debtorcode, deptype, exdebtcode,
            floatrate, limittype, opercode, originalperiod, relation, remark,
            spapfeboindex, valuedate, busdate, businesscode
        )
        SELECT
            0, COALESCE(NULLIF(t.action_type, ''), 'A'), t.action_desc,
            p_branch_id, 2, 0, t.deal_no, p_safe_branch_code, p_safe_branch_name,
            'EXDA_N', t.annin_rate, t.contract_amount, left(t.contract_curr, 3),
            left(t.creditor_code, 11), t.creditor_name, t.creditor_namen,
            t.creditor_type, t.crehq_code, t.deb_type,
            CASE WHEN p_branch_code IN ('310000167001', '310000151101') THEN p_branch_code ELSE t.debtor_code END,
            1, t.exdebt_code, t.float_rate, COALESCE(t.limit_type, 'NRA'),
            t.oper_code, t.original_period, t.relation, t.remark, t.spapfebo_index,
            t.value_date, p_business_date, t.deal_no
        FROM vtb.cfaa_tab t
        WHERE t.data_type = 'AN' AND t.value_date::date = p_business_date;
END;
$$;

/* One target table only. Extracted without changing the original DML from usp_vtb_safe2_extract_exd. */
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_table_t_safe_exda_s(
p_business_date date,
    p_branch_id numeric DEFAULT NULL,
    p_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_name varchar DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    /*
          Second-generation EXD target generation from the first-generation
          CFAAM/CFAAS business tables.
    
          This covers the VTB-relevant external debt contract/balance chain:
          CFAAM -> T_SAFE_EXDA_A, CFAAS -> T_SAFE_EXDA_S.
        */
    
        DELETE FROM vtb.t_safe_exda_s
        WHERE busdate::date = p_business_date
          AND COALESCE(invalid, 0) = 0;

    INSERT INTO vtb.t_safe_exda_s (
            invalid, actiontype, branchid, datasource, datastatus, dealno,
            safebranchcode, safebranchname, tname, accoamount, buscode,
            chdate, changeno, exdebtcode, remark, contractcurr, busdate
        )
        SELECT
            0,
            COALESCE(NULLIF(s.action_type, ''), 'A'),
            COALESCE(s.branch_id::numeric, p_branch_id),
            2,
            0,
            s.deal_no,
            p_safe_branch_code,
            p_safe_branch_name,
            'EXDA_S',
            s.acco_amount,
            s.bus_code,
            s.ch_date,
            s.change_no,
            COALESCE(NULLIF(s.exdebt_code, ''), s.deal_no),
            s.remark,
            left(m.contract_curr, 3),
            p_business_date
        FROM vtb.cfaas s
        LEFT JOIN vtb.cfaam m ON m.id = s.contract_id OR m.deal_no = s.deal_no
        WHERE s.ch_date::date = p_business_date
          AND COALESCE(NULLIF(s.deal_no, ''), NULLIF(s.exdebt_code, '')) IS NOT NULL;
END;
$$;

/* One target table only. Extracted without changing the original DML from usp_vtb_safe2_extract_cfa. */
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_table_t_safe_cfac_a(
p_business_date date,
    p_branch_id numeric DEFAULT NULL,
    p_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_name varchar DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM vtb.t_safe_cfac_a WHERE busdate::date = p_business_date AND COALESCE(invalid, 0) = 0;

    WITH loan AS (
            SELECT
                t.*,
                substring(t.usage from position('LD' in t.usage) for 13) AS safe_deal_no,
                c.depart_id,
                c.customers_english_name
            FROM vtb.transaction_tab t
            LEFT JOIN vtb.cif_tab c ON c.customer_id = t.customer_code
            WHERE vtb.to_date_yyyymmdd(t.transaction_date) = p_business_date
              AND t.customer_code <> '829240'
              AND t.currency_code <> 'CNY'
              AND t.usage LIKE 'LOAN ISSUE%'
              AND position('LD' in t.usage) > 0
        )
        INSERT INTO vtb.t_safe_cfac_a (
            createdtime, lastmodifiedtime, invalid, actiontype, branchid, datasource, datastatus,
            dealno, safebranchcode, safebranchname, tname, creditorcode, debtorcode,
            debtorname, dofoexlotype, lenproname, valuedate, maturity, currence,
            contractamount, anninrate, busdate
        )
        SELECT
            now(), now(), 0, 'A', p_branch_id, 2, 0, l.safe_deal_no,
            p_safe_branch_code, p_safe_branch_name, 'CFAC_A', p_branch_code,
            COALESCE(l.depart_id, ''), COALESCE(l.customers_english_name, ''), NULL::varchar, NULL::varchar,
            vtb.to_date_yyyymmdd(l.transaction_date), vtb.to_date_yyyymmdd(l.maturity_date),
            left(l.currency_code, 3), abs(NULLIF(l.trade_amount, '')::numeric), NULLIF(l.rate::text, '')::numeric,
            p_business_date
        FROM loan l;

    INSERT INTO vtb.t_safe_cfac_a (
            createdtime, lastmodifiedtime, invalid, actiontype, actiondesc, branchid, datasource, datastatus,
            dealno, safebranchcode, safebranchname, tname, dofoexlocode, creditorcode,
            debtorcode, debtorname, dofoexlotype, lenproname, lenagree, valuedate,
            maturity, currence, contractamount, anninrate, remark, busdate
        )
        SELECT
            now(), now(), 0, COALESCE(NULLIF(t.action_type, ''), 'A'), t.action_desc,
            p_branch_id, 2, 0, t.deal_no,
            COALESCE(NULLIF(t.safe_branch_code, ''), p_safe_branch_code), p_safe_branch_name, 'CFAC_A',
            t.dofoexlo_code, COALESCE(NULLIF(t.creditor_code, ''), p_branch_code),
            t.debtor_code, t.debtor_name, t.dofoexlo_type, t.lenpro_name, t.lenagree,
            t.value_date, t.maturity, t.currence, t.contract_amount, t.annin_rate,
            t.remark, p_business_date
        FROM vtb.cfaca_tab t
        WHERE t.import_date::date = p_business_date
          AND NOT EXISTS (
              SELECT 1
              FROM vtb.t_safe_cfac_a a
              WHERE a.busdate::date = p_business_date
                AND COALESCE(a.invalid, 0) = 0
                AND a.dealno = t.deal_no
          );
END;
$$;

/* One target table only. Extracted without changing the original DML from usp_vtb_safe2_extract_cfa. */
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_table_t_safe_cfac_b(
p_business_date date,
    p_branch_id numeric DEFAULT NULL,
    p_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_name varchar DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    /*
          Complete CFA logic for VTB tests:
          - LOAN ISSUE creates CFAC_A/CFAC_B and CFAD_A/CFAD_B.
          - PRINCIPAL REPAYMENT creates CFAC_B/CFAD_B repayment rows when a parent deal exists.
          - INT REPAYMENT creates CFAC_B/CFAD_B interest rows when a parent deal exists.
        */
    
        DELETE FROM vtb.t_safe_cfac_b WHERE busdate::date = p_business_date AND COALESCE(invalid, 0) = 0;

    INSERT INTO vtb.t_safe_cfac_b (
            createdtime, lastmodifiedtime, invalid, actiontype, branchid, datasource, datastatus,
            dealno, safebranchcode, safebranchname, tname, cfacaid, changedate, changeno,
            loanopenbalan, withcurrence, withamount, endbalan, busdate
        )
        SELECT
            now(), now(), 0, 'A', p_branch_id, 2, 0, a.dealno,
            p_safe_branch_code, p_safe_branch_name, 'CFAC_B', a.id::varchar,
            a.valuedate, '0001', 0, a.currence, a.contractamount, a.contractamount,
            p_business_date
        FROM vtb.t_safe_cfac_a a
        WHERE a.busdate::date = p_business_date;

    INSERT INTO vtb.t_safe_cfac_b (
            createdtime, lastmodifiedtime, invalid, actiontype, actiondesc, branchid, datasource, datastatus,
            dealno, safebranchcode, safebranchname, tname, cfacaid, dofoexlocode, buscode,
            changedate, changeno, loanopenbalan, withcurrence, withamount, settamount,
            useofunds, princurr, repayamount, prepayamount, inpaycurr, inpayamount,
            pinpayamount, endbalan, remark, busdate
        )
        SELECT
            now(), now(), 0, COALESCE(NULLIF(t.action_type, ''), 'A'), t.action_desc,
            p_branch_id, 2, 0, t.deal_no,
            p_safe_branch_code, p_safe_branch_name, 'CFAC_B', a.id::varchar,
            t.dofoexlo_code, t.bus_code, t.change_date, NULL::varchar,
            t.loanopen_balan, t.with_currence, t.with_amount, t.sett_amount,
            t.useofunds, t.prin_curr, t.repay_amount, t.prepay_amount,
            t.inpay_curr, t.inpay_amount, t.pinpay_amount, t.end_balan, t.remark,
            p_business_date
        FROM vtb.cfacb_tab t
        JOIN LATERAL (
            SELECT a.id
            FROM vtb.t_safe_cfac_a a
            WHERE a.dealno = t.deal_no
              AND COALESCE(a.invalid, 0) = 0
            ORDER BY a.busdate DESC NULLS LAST, a.id DESC
            LIMIT 1
        ) a ON true
        WHERE t.import_date::date = p_business_date
          AND NOT EXISTS (
              SELECT 1
              FROM vtb.t_safe_cfac_b b
              WHERE b.busdate::date = p_business_date
                AND COALESCE(b.invalid, 0) = 0
                AND b.dealno = t.deal_no
                AND b.changedate IS NOT DISTINCT FROM t.change_date
                AND COALESCE(b.buscode, '') = COALESCE(t.bus_code, '')
          );

    WITH change_trn AS (
            SELECT
                t.*,
                substring(t.usage from position('LD' in t.usage) for 13) AS safe_deal_no,
                abs(NULLIF(t.trade_amount, '')::numeric) AS amount
            FROM vtb.transaction_tab t
            WHERE vtb.to_date_yyyymmdd(t.transaction_date) = p_business_date
              AND t.customer_code <> '829240'
              AND t.currency_code <> 'CNY'
              AND position('LD' in t.usage) > 0
              AND (t.oppositers_account_id IS NULL OR t.oppositers_account_id NOT LIKE '40%' OR t.oppositers_account_id LIKE '409%')
              AND (t.usage LIKE 'PRINCIPAL REPAYMENT%' OR t.usage LIKE 'INT REPAYMENT%')
        ),
        parent_contract AS (
            SELECT DISTINCT ON (dealno) id, dealno
            FROM vtb.t_safe_cfac_a
            WHERE COALESCE(invalid, 0) = 0
              -- 一代 importCFATab 在生成 CFACBTab 时只检查已存在的正式 CFACA；
              -- 本轮由 LOAN ISSUE 刚生成的 CFACATab/CFACA 不会反向参与还本/付息。
              AND COALESCE(busdate::date, valuedate::date) < p_business_date
            ORDER BY dealno, busdate DESC NULLS LAST, id DESC
        ),
        latest_balance AS (
            SELECT DISTINCT ON (dealno) dealno, endbalan
            FROM vtb.t_safe_cfac_b
            WHERE COALESCE(invalid, 0) = 0
              AND changedate::date < p_business_date
            ORDER BY dealno, changedate DESC NULLS LAST, id DESC
        )
        INSERT INTO vtb.t_safe_cfac_b (
            createdtime, lastmodifiedtime, invalid, actiontype, branchid, datasource, datastatus,
            dealno, safebranchcode, safebranchname, tname, cfacaid, changedate, changeno,
            loanopenbalan, princurr, repayamount, inpaycurr, inpayamount, endbalan, busdate
        )
        SELECT
            now(), now(), 0, 'A', p_branch_id, 2, 0, t.safe_deal_no,
            p_safe_branch_code, p_safe_branch_name, 'CFAC_B', p.id::varchar,
            vtb.to_date_yyyymmdd(t.transaction_date), '0001', COALESCE(b.endbalan, 0),
            CASE WHEN t.usage LIKE 'PRINCIPAL REPAYMENT%' THEN left(t.currency_code, 3) END,
            CASE WHEN t.usage LIKE 'PRINCIPAL REPAYMENT%' THEN t.amount ELSE 0 END,
            CASE WHEN t.usage LIKE 'INT REPAYMENT%' THEN left(t.currency_code, 3) END,
            CASE WHEN t.usage LIKE 'INT REPAYMENT%' THEN t.amount ELSE 0 END,
            CASE
                WHEN t.usage LIKE 'PRINCIPAL REPAYMENT%' THEN COALESCE(b.endbalan - t.amount, t.amount)
                WHEN t.usage LIKE 'INT REPAYMENT%' THEN b.endbalan
            END,
            p_business_date
        FROM change_trn t
        JOIN parent_contract p ON p.dealno = t.safe_deal_no
        LEFT JOIN latest_balance b ON b.dealno = t.safe_deal_no;
END;
$$;

/* One target table only. Extracted without changing the original DML from usp_vtb_safe2_extract_cfa. */
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_table_t_safe_cfad_a(
p_business_date date,
    p_branch_id numeric DEFAULT NULL,
    p_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_name varchar DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM vtb.t_safe_cfad_a WHERE busdate::date = p_business_date AND COALESCE(invalid, 0) = 0;

    WITH cfad_loan AS (
            SELECT
                t.*,
                substring(t.usage from position('LD' in t.usage) for 13) AS safe_deal_no,
                c.depart_id,
                c.customers_english_name
            FROM vtb.transaction_tab t
            LEFT JOIN vtb.cif_tab c ON c.customer_id = t.customer_code
            WHERE vtb.to_date_yyyymmdd(t.transaction_date) = p_business_date
              AND t.customer_code <> '829240'
              AND t.usage LIKE 'LOAN ISSUE%'
              AND position('LD' in t.usage) > 0
              AND NOT EXISTS (
                  SELECT 1
                  FROM vtb.cfa_cnum_filter f
                  WHERE f.filter_type = 'DA'
                    AND f.cnum = t.customer_code
              )
        )
        INSERT INTO vtb.t_safe_cfad_a (
            createdtime, lastmodifiedtime, invalid, actiontype, branchid, datasource, datastatus,
            dealno, safebranchcode, safebranchname, tname, creditorcode, debtorcode,
            debtorname, debtortype, credcurrcode, credconamount, valuedate, maturity, busdate
        )
        SELECT
            now(), now(), 0, 'A', p_branch_id, 2, 0, l.safe_deal_no,
            p_safe_branch_code, p_safe_branch_name, 'CFAD_A', p_branch_code,
            COALESCE(l.depart_id, ''), COALESCE(l.customers_english_name, ''),
            NULL::varchar, left(l.currency_code, 3), abs(NULLIF(l.trade_amount, '')::numeric),
            vtb.to_date_yyyymmdd(l.transaction_date), vtb.to_date_yyyymmdd(l.maturity_date), p_business_date
        FROM cfad_loan l;

    INSERT INTO vtb.t_safe_cfad_a (
            createdtime, lastmodifiedtime, invalid, actiontype, actiondesc, branchid, datasource, datastatus,
            dealno, safebranchcode, safebranchname, tname, lounexgucode, creditorcode,
            debtorcode, debtorname, debtortype, credcurrcode, credconamount, valuedate,
            maturity, dofoexlocode, remark, busdate
        )
        SELECT
            now(), now(), 0, COALESCE(NULLIF(t.action_type, ''), 'A'), t.action_desc,
            p_branch_id, 2, 0, t.deal_no,
            COALESCE(NULLIF(t.safe_branch_code, ''), p_safe_branch_code), p_safe_branch_name, 'CFAD_A',
            t.lounexgu_code, COALESCE(NULLIF(t.creditor_code, ''), p_branch_code),
            t.debtor_code, t.debtor_name, t.debtor_type, t.cred_curr_code,
            t.cred_con_amount, t.value_date, t.maturity, t.dofoexlo_code, t.remark,
            p_business_date
        FROM vtb.cfada_tab t
        WHERE t.import_date::date = p_business_date
          AND NOT EXISTS (
              SELECT 1
              FROM vtb.t_safe_cfad_a a
              WHERE a.busdate::date = p_business_date
                AND COALESCE(a.invalid, 0) = 0
                AND a.dealno = t.deal_no
          );
END;
$$;

/* One target table only. Extracted without changing the original DML from usp_vtb_safe2_extract_cfa. */
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_table_t_safe_cfad_b(
p_business_date date,
    p_branch_id numeric DEFAULT NULL,
    p_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_name varchar DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM vtb.t_safe_cfad_b WHERE busdate::date = p_business_date AND COALESCE(invalid, 0) = 0;

    INSERT INTO vtb.t_safe_cfad_b (
            createdtime, lastmodifiedtime, invalid, actiontype, branchid, datasource, datastatus,
            dealno, safebranchcode, safebranchname, tname, cfadaid, changedate, changeno,
            credcurrcode, credwithamount, credprinbala, credprinbalacurr,
            guarantlibala, guarantlibalacurr, busdate
        )
        SELECT
            now(), now(), 0, 'A', p_branch_id, 2, 0, a.dealno,
            p_safe_branch_code, p_safe_branch_name, 'CFAD_B', a.id::varchar,
            a.valuedate, '0001', a.credcurrcode, a.credconamount, a.credconamount,
            a.credcurrcode, NULL::numeric, a.credcurrcode, p_business_date
        FROM vtb.t_safe_cfad_a a
        WHERE a.busdate::date = p_business_date;

    INSERT INTO vtb.t_safe_cfad_b (
            createdtime, lastmodifiedtime, invalid, actiontype, actiondesc, branchid, datasource, datastatus,
            dealno, safebranchcode, safebranchname, tname, cfadaid, lounexgucode, buscode,
            changedate, changeno, credcurrcode, credwithamount, credrepayamount, picamount,
            credprinbala, credprinbalacurr, guarantlibala, guarantlibalacurr, guperamount,
            remark, busdate
        )
        SELECT
            now(), now(), 0, COALESCE(NULLIF(t.action_type, ''), 'A'), t.action_desc,
            p_branch_id, 2, 0, t.deal_no,
            p_safe_branch_code, p_safe_branch_name, 'CFAD_B', a.id::varchar,
            t.lounexgu_code, t.bus_code, t.change_date, NULL::varchar,
            t.cred_curr_code, t.cred_with_amount, t.cred_repay_amount, t.pic_amount,
            t.cred_prin_bala, t.cred_curr_code, t.guarantll_bala, t.cred_curr_code,
            t.guper_amount, t.remark, p_business_date
        FROM vtb.cfadb_tab t
        JOIN LATERAL (
            SELECT a.id
            FROM vtb.t_safe_cfad_a a
            WHERE a.dealno = t.deal_no
              AND COALESCE(a.invalid, 0) = 0
            ORDER BY a.busdate DESC NULLS LAST, a.id DESC
            LIMIT 1
        ) a ON true
        WHERE t.import_date::date = p_business_date
          AND NOT EXISTS (
              SELECT 1
              FROM vtb.t_safe_cfad_b b
              WHERE b.busdate::date = p_business_date
                AND COALESCE(b.invalid, 0) = 0
                AND b.dealno = t.deal_no
                AND b.changedate IS NOT DISTINCT FROM t.change_date
                AND COALESCE(b.buscode, '') = COALESCE(t.bus_code, '')
          );

    WITH change_trn AS (
            SELECT
                t.*,
                substring(t.usage from position('LD' in t.usage) for 13) AS safe_deal_no,
                abs(NULLIF(t.trade_amount, '')::numeric) AS amount
            FROM vtb.transaction_tab t
            WHERE vtb.to_date_yyyymmdd(t.transaction_date) = p_business_date
              AND position('LD' in t.usage) > 0
              AND (t.oppositers_account_id IS NULL OR t.oppositers_account_id NOT LIKE '40%' OR t.oppositers_account_id LIKE '409%')
              AND (t.usage LIKE 'PRINCIPAL REPAYMENT%' OR t.usage LIKE 'INT REPAYMENT%')
        ),
        parent_contract AS (
            SELECT DISTINCT ON (dealno) id, dealno
            FROM vtb.t_safe_cfad_a
            WHERE COALESCE(invalid, 0) = 0
              -- 一代外保内贷还本/付息只检查已存在的正式 CFADA。
              AND COALESCE(busdate::date, valuedate::date) < p_business_date
            ORDER BY dealno, busdate DESC NULLS LAST, id DESC
        ),
        latest_balance AS (
            SELECT DISTINCT ON (dealno) dealno, credprinbala, guarantlibala
            FROM vtb.t_safe_cfad_b
            WHERE COALESCE(invalid, 0) = 0
              AND changedate::date < p_business_date
            ORDER BY dealno, changedate DESC NULLS LAST, id DESC
        )
        INSERT INTO vtb.t_safe_cfad_b (
            createdtime, lastmodifiedtime, invalid, actiontype, branchid, datasource, datastatus,
            dealno, safebranchcode, safebranchname, tname, cfadaid, changedate, changeno,
            credcurrcode, credrepayamount, picamount, credprinbala, credprinbalacurr,
            guarantlibala, guarantlibalacurr, busdate
        )
        SELECT
            now(), now(), 0, 'A', p_branch_id, 2, 0, t.safe_deal_no,
            p_safe_branch_code, p_safe_branch_name, 'CFAD_B', p.id::varchar,
            vtb.to_date_yyyymmdd(t.transaction_date), '0001', left(t.currency_code, 3),
            CASE WHEN t.usage LIKE 'PRINCIPAL REPAYMENT%' THEN t.amount ELSE 0 END,
            CASE WHEN t.usage LIKE 'INT REPAYMENT%' THEN t.amount ELSE 0 END,
            CASE
                WHEN t.usage LIKE 'PRINCIPAL REPAYMENT%' AND b.credprinbala IS NOT NULL THEN b.credprinbala - t.amount
                WHEN t.usage LIKE 'INT REPAYMENT%' THEN b.credprinbala
            END,
            left(t.currency_code, 3),
            NULL::numeric,
            NULL::varchar,
            p_business_date
        FROM change_trn t
        JOIN parent_contract p ON p.dealno = t.safe_deal_no
        LEFT JOIN latest_balance b ON b.dealno = t.safe_deal_no;
END;
$$;

/* One target table only. Extracted without changing the original DML from usp_vtb_safe2_extract_cfa. */
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_table_t_safe_cfada_fogucodeinfo(
p_business_date date,
    p_branch_id numeric DEFAULT NULL,
    p_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_name varchar DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM vtb.t_safe_cfada_fogucodeinfo f
        USING vtb.t_safe_cfad_a a
        WHERE f.cfadaid = a.id
          AND a.busdate::date = p_business_date
          AND COALESCE(a.invalid, 0) = 0;

    INSERT INTO vtb.t_safe_cfada_fogucodeinfo (
            cfadaid, fogucode, foguname, fogunamen, fogurecode,
            guaranteeobject, guaranteetype, createdtime
        )
        SELECT
            a.id, f.fogu_code, f.fogu_name, f.fogu_namen, f.fogu_re_code,
            NULL::varchar, f.guarantee_type, now()
        FROM vtb.fogu_code_infos_tab f
        JOIN vtb.cfada_tab t ON t.id = f.cfada_tab_id
        JOIN vtb.t_safe_cfad_a a
          ON a.dealno = t.deal_no
         AND a.busdate::date = p_business_date
         AND COALESCE(a.invalid, 0) = 0
        WHERE t.import_date::date = p_business_date;
END;
$$;

/* One target table only. Extracted without changing the original DML from usp_vtb_safe2_extract_fal. */
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_table_t_safe_fal_z02(
p_business_date date,
    p_branch_id numeric DEFAULT NULL,
    p_obj_code varchar DEFAULT '310000167001',
    p_safe_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_name varchar DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM vtb.t_safe_fal_z02 WHERE busdate::date = p_business_date AND COALESCE(invalid, 0) = 0;

    /*
          一代 DataExtractVtbFalServiceImpl.extractZ02：
          复制上月 Z02 到本月，重置为新增、未审核/未申报状态，并清空反馈/错误信息。
        */
        INSERT INTO vtb.t_safe_fal_z02 (
            createdtime, lastmodifiedtime, invalid, actiontype, actiondesc, branchid,
            datasource, datastatus, dealno, safebranchcode, safebranchname, tname,
            buocmonth, objcode, remark, snocode, tablecode, tablename,
            z0201, z0202, z0203, z0204, z0205, z0206, busdate,
            isfeedback, refusereason, resetreason, safeerrinfo, logfeedbackstatus,
            manualflag, operateremark
        )
        SELECT
            now(), now(), 0, 'A', NULL, p_branch_id,
            COALESCE(prev.datasource, 2), 0, prev.dealno, p_safe_branch_code,
            p_safe_branch_name, 'FAL_Z02', to_char(p_business_date, 'YYYYMM')::numeric,
            COALESCE(prev.objcode, p_obj_code), NULL, NULL, prev.tablecode, prev.tablename,
            prev.z0201, prev.z0202, prev.z0203, prev.z0204, prev.z0205, prev.z0206,
            p_business_date, NULL, NULL, NULL, NULL, NULL, NULL, NULL
        FROM vtb.t_safe_fal_z02 prev
        WHERE prev.buocmonth = to_char(p_business_date - interval '1 month', 'YYYYMM')::numeric
          AND COALESCE(prev.invalid, 0) = 0;
END;
$$;

/* One target table only. Extracted without changing the original DML from usp_vtb_safe2_extract_fal. */
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_table_t_safe_fald_02(
p_business_date date,
    p_branch_id numeric DEFAULT NULL,
    p_obj_code varchar DEFAULT '310000167001',
    p_safe_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_name varchar DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM vtb.t_safe_fald_02 WHERE busdate::date = p_business_date AND COALESCE(invalid, 0) = 0;

    WITH previous_d02 AS (
            SELECT DISTINCT ON (dealno)
                dealno, d0210, d0212, d0201type, d0221, d0222, d0223
            FROM vtb.t_safe_fald_02
            WHERE buocmonth = to_char(p_business_date - interval '1 month', 'YYYYMM')::numeric
              AND COALESCE(issum, 0) = 0
              AND COALESCE(actiontype, '') <> 'D'
              AND COALESCE(invalid, 0) = 0
            ORDER BY dealno, id DESC
        )
        INSERT INTO vtb.t_safe_fald_02 (
            createdtime, lastmodifiedtime, invalid, actiontype, branchid, datasource, datastatus,
            dealno, safebranchcode, safebranchname, tname, buocmonth, objcode,
            d0201, d0202, d0203, d0204, d0205, d0206, d0207, d0208, d0209,
            d0210, d0211, d0212, d0213, d0214, d0215, issum, busdate,
            d0201type, d0221, d0222, d0223
        )
        SELECT
            now(), now(), 0, 'A', p_branch_id, 2, 0, fw.ref_no,
            p_safe_branch_code, p_safe_branch_name, 'FALD_02',
            to_char(p_business_date, 'YYYYMM')::numeric, p_obj_code,
            NULLIF(fw.is_entrust_loan, '')::numeric,
            CASE WHEN fw.is_entrust_loan = '1' THEN NULLIF(fw.entrust_department, '')::numeric ELSE NULL END,
            left(fw.country_code, 3), NULLIF(fw.op_department, '')::numeric,
            NULLIF(fw.relation, '')::numeric, NULLIF(fw.or_maturity, '')::numeric,
            left(fw.ccy, 3), COALESCE(prev.d0210, 0), COALESCE(prev.d0212, 0),
            COALESCE(fw.mbalance, 0), COALESCE(fw.shortbalance, 0),
            COALESCE(fw.mintbalance, 0), 0,
            COALESCE(fw.mbalance, 0) + COALESCE(fw.mintbalance, 0)
                - COALESCE(prev.d0210, 0) - COALESCE(prev.d0212, 0),
            COALESCE(fw.int_accrual, 0), 0, p_business_date,
            prev.d0201type, prev.d0221, prev.d0222, prev.d0223
        FROM vtb.fal_warehouse fw
        LEFT JOIN previous_d02 prev ON prev.dealno = fw.ref_no
        WHERE fw.bus_date::date = p_business_date AND fw.fal_no = 'D02';
END;
$$;

/* One target table only. Extracted without changing the original DML from usp_vtb_safe2_extract_fal. */
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_table_t_safe_fald_0501(
p_business_date date,
    p_branch_id numeric DEFAULT NULL,
    p_obj_code varchar DEFAULT '310000167001',
    p_safe_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_name varchar DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM vtb.t_safe_fald_0501 WHERE busdate::date = p_business_date AND COALESCE(invalid, 0) = 0;

    WITH current_s AS (
            SELECT DISTINCT ON (s.exdebtcode) s.*
            FROM vtb.t_safe_exda_s s
            WHERE s.chdate::date <= p_business_date
              AND COALESCE(s.actiontype, '') <> 'D'
              AND (COALESCE(s.accoamount, 0) > 0 OR (COALESCE(s.accoamount, 0) = 0 AND date_trunc('month', s.chdate) = date_trunc('month', p_business_date::timestamp)))
            ORDER BY s.exdebtcode, s.chdate DESC
        ),
        previous_s AS (
            SELECT DISTINCT ON (s.exdebtcode) s.exdebtcode, s.accoamount AS faccoamount
            FROM vtb.t_safe_exda_s s
            WHERE s.chdate < date_trunc('month', p_business_date::timestamp)
              AND COALESCE(s.actiontype, '') <> 'D'
            ORDER BY s.exdebtcode, s.chdate DESC
        ),
        previous_d0501 AS (
            SELECT DISTINCT ON (dealno) dealno, d0511
            FROM vtb.t_safe_fald_0501
            WHERE busdate::date < date_trunc('month', p_business_date::timestamp)
              AND COALESCE(invalid, 0) = 0
              AND COALESCE(actiontype, '') <> 'D'
            ORDER BY dealno, busdate DESC, id DESC
        ),
        current_contract AS (
            SELECT DISTINCT ON (x.exdebtcode) x.*
            FROM (
                SELECT
                    m.id, m.dealno, m.actiontype, m.busdate, m.exdebtcode, m.deptype,
                    m.opercode, m.creditortype, m.relation, m.originalperiod,
                    m.contractcurr, m.valuedate, c.maturity
                FROM vtb.t_safe_exda_m m
                LEFT JOIN vtb.cfaam c ON c.exdebt_code = m.exdebtcode
                WHERE m.busdate::date <= p_business_date
                  AND COALESCE(m.actiontype, '') <> 'D'
    
                UNION ALL
    
                SELECT
                    l.id, l.dealno, l.actiontype, l.busdate, l.exdebtcode, l.deptype,
                    l.opercode, l.creditortype, l.relation, l.originalperiod,
                    l.contractcurr, l.valuedate, NULL::timestamp AS maturity
                FROM vtb.t_safe_exda_l l
                WHERE l.busdate::date <= p_business_date
                  AND COALESCE(l.actiontype, '') <> 'D'
    
                UNION ALL
    
                SELECT
                    n.id, n.dealno, n.actiontype, n.busdate, n.exdebtcode, n.deptype,
                    n.opercode, n.creditortype, n.relation, n.originalperiod,
                    n.contractcurr, n.valuedate, NULL::timestamp AS maturity
                FROM vtb.t_safe_exda_n n
                WHERE n.busdate::date <= p_business_date
                  AND COALESCE(n.actiontype, '') <> 'D'
            ) x
            ORDER BY x.exdebtcode, x.busdate DESC, x.id DESC
        )
        INSERT INTO vtb.t_safe_fald_0501 (
            createdtime, lastmodifiedtime, invalid, actiontype, branchid, datasource, datastatus,
            dealno, safebranchcode, safebranchname, tname, buocmonth, objcode,
            d0501, d0502, d0503, d0504, d0505, d0506, d0507, d0508,
            d0509, d0510, d0511, d0512, d0513, d0514, exdebtcode, busdate
        )
        SELECT
            now(), now(), 0, 'A', p_branch_id, 2, 0, m.dealno,
            p_safe_branch_code, p_safe_branch_name, 'FALD_0501',
            to_char(p_business_date, 'YYYYMM')::numeric, p_obj_code,
            COALESCE(m.deptype, 1), left(m.opercode, 3),
            CASE
                WHEN m.creditortype LIKE '200011%' THEN 1
                WHEN m.creditortype LIKE '200012%' THEN 6
                WHEN m.creditortype LIKE '200013%' THEN 2
                WHEN m.creditortype LIKE '200014%' THEN 3
                WHEN m.creditortype LIKE '200015%' THEN 4
                WHEN m.creditortype LIKE '200016%' OR m.creditortype LIKE '200017%' OR m.creditortype LIKE '200018%' OR m.creditortype LIKE '200099%' THEN 5
                ELSE NULL
            END,
            COALESCE(NULLIF(m.relation, '')::numeric, 4),
            COALESCE(m.originalperiod, 1),
            left(m.contractcurr, 3), COALESCE(p.faccoamount, 0), COALESCE(old.d0511, 0),
            COALESCE(s.accoamount, 0),
            CASE
                WHEN COALESCE(m.originalperiod, 1) = 1 THEN abs(COALESCE(s.accoamount, 0))
                WHEN m.maturity::date - p_business_date <= 365 THEN abs(COALESCE(s.accoamount, 0))
                ELSE 0
            END,
            0, 0, COALESCE(s.accoamount, 0) - COALESCE(old.d0511, 0) - COALESCE(p.faccoamount, 0), 0,
            m.exdebtcode, p_business_date
        FROM current_contract m
        JOIN current_s s ON s.exdebtcode = m.exdebtcode
        LEFT JOIN previous_s p ON p.exdebtcode = m.exdebtcode
        LEFT JOIN previous_d0501 old ON old.dealno = m.dealno;
END;
$$;

/* One target table only. Extracted without changing the original DML from usp_vtb_safe2_extract_fal. */
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_table_t_safe_fald_09(
p_business_date date,
    p_branch_id numeric DEFAULT NULL,
    p_obj_code varchar DEFAULT '310000167001',
    p_safe_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_name varchar DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM vtb.t_safe_fald_09 WHERE busdate::date = p_business_date AND COALESCE(invalid, 0) = 0;

    INSERT INTO vtb.t_safe_fald_09 (
            createdtime, lastmodifiedtime, invalid, actiontype, branchid, datasource, datastatus,
            dealno, safebranchcode, safebranchname, tname, buocmonth, objcode,
            d0901, d0902, d0903, d0904, d0905, busdate
        )
        SELECT
            now(), now(), 0, 'A', p_branch_id, 2, 0,
            fw.ref_no, p_safe_branch_code, p_safe_branch_name, 'FALD_09',
            to_char(p_business_date, 'YYYYMM')::numeric, p_obj_code,
            1, 1, left(fw.ccy, 3), COALESCE(fw.mbalance, 0),
            left(fw.country_code, 3), p_business_date
        FROM vtb.fal_warehouse fw
        WHERE fw.bus_date::date = p_business_date AND fw.fal_no = 'D09';
END;
$$;

/* One target table only. Extracted without changing the original DML from usp_vtb_safe2_extract_fal. */
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_table_t_safe_falf_01(
p_business_date date,
    p_branch_id numeric DEFAULT NULL,
    p_obj_code varchar DEFAULT '310000167001',
    p_safe_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_name varchar DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM vtb.t_safe_falf_01 WHERE busdate::date = p_business_date AND COALESCE(invalid, 0) = 0;

    WITH previous_f01 AS (
            SELECT DISTINCT ON (dealno) dealno, f0109
            FROM vtb.t_safe_falf_01
            WHERE buocmonth = to_char(p_business_date - interval '1 month', 'YYYYMM')::numeric
              AND COALESCE(issum, 0) = 0
              AND COALESCE(actiontype, '') <> 'D'
              AND COALESCE(invalid, 0) = 0
            ORDER BY dealno, id DESC
        )
        INSERT INTO vtb.t_safe_falf_01 (
            createdtime, lastmodifiedtime, invalid, actiontype, branchid, datasource, datastatus,
            dealno, safebranchcode, safebranchname, tname, buocmonth, objcode,
            f0101, f0102, f0103, f0104, f0105, f0106, f0107, f0108,
            f0109, f0110, f0111, f0112, issum, busdate
        )
        SELECT
            now(), now(), 0, 'A', p_branch_id, 2, 0, fw.ref_no,
            p_safe_branch_code, p_safe_branch_name, 'FALF_01',
            to_char(p_business_date, 'YYYYMM')::numeric, p_obj_code,
            3, 0, left(fw.country_code, 3), 3, NULLIF(fw.relation, '')::numeric,
            NULLIF(fw.or_maturity, '')::numeric, left(fw.ccy, 3), COALESCE(prev.f0109, 0),
            COALESCE(fw.mbalance, 0), COALESCE(fw.shortbalance, 0), 0,
            COALESCE(fw.mbalance, 0) - COALESCE(prev.f0109, 0), 0, p_business_date
        FROM vtb.fal_warehouse fw
        LEFT JOIN previous_f01 prev ON prev.dealno = fw.ref_no
        WHERE fw.bus_date::date = p_business_date AND fw.fal_no = 'F01';
END;
$$;

/* One target table only. Extracted without changing the original DML from usp_vtb_safe2_extract_jsh. */
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_table_fae_base_info(
p_business_date date,
    p_branch_id numeric DEFAULT NULL,
    p_branch_code varchar DEFAULT '310000167001',
    p_branch_name varchar DEFAULT NULL,
    p_safe_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_name varchar DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM vtb.fae_base_info WHERE transdate = p_business_date;

    WITH current_trn AS (
            SELECT t.*, vtb.vtb_ref_no(t.ref_no, t.usage) AS effective_ref_no
            FROM vtb.transaction_tab t
            WHERE vtb.to_date_yyyymmdd(t.transaction_date) = p_business_date
              AND NULLIF(vtb.vtb_ref_no(t.ref_no, t.usage), '') IS NOT NULL
        ),
        paired AS (
            SELECT
                t.*,
                u.id AS old_id,
                u.customer_code AS old_customer_code,
                u.agent_name AS old_agent_name,
                u.account_id AS old_account_id,
                u.payment_flag AS old_payment_flag,
                u.currency_code AS old_currency_code,
                u.trade_amount AS old_trade_amount,
                u.oppositers_account_id AS old_oppositers_account_id,
                CASE
                    WHEN left(COALESCE(t.transaction_type, ''), 2) = '04'
                     AND (
                            (t.payment_flag = '02' AND vtb.is_vtb_jsh_bridge_account(t.oppositers_account_id))
                         OR (t.payment_flag = '01' AND vtb.is_vtb_jsh_bridge_account(t.account_id))
                     )
                     AND (
                            (u.payment_flag = '01' AND vtb.is_vtb_own_fx_account(u.oppositers_account_id))
                         OR (u.payment_flag = '02' AND vtb.is_vtb_own_fx_account(u.account_id))
                     )
                        THEN '1'
                    WHEN left(COALESCE(t.transaction_type, ''), 2) = '03'
                     AND (
                            (t.payment_flag = '02' AND vtb.is_vtb_own_fx_account(t.oppositers_account_id))
                         OR (t.payment_flag = '01' AND vtb.is_vtb_own_fx_account(t.account_id))
                     )
                     AND (
                            (u.payment_flag = '01' AND vtb.is_vtb_jsh_bridge_account(u.oppositers_account_id))
                         OR (u.payment_flag = '02' AND vtb.is_vtb_jsh_bridge_account(u.account_id))
                     )
                        THEN '2'
                END AS jghflag,
                (t.payment_flag = '02') AS t_uses_opposite,
                (u.payment_flag = '01') AS old_uses_opposite
            FROM current_trn t
            JOIN LATERAL (
                SELECT u.*
                FROM vtb.transaction_tab u
                WHERE u.id <> t.id
                  AND vtb.vtb_ref_no(u.ref_no, u.usage) = t.effective_ref_no
                  AND vtb.to_date_yyyymmdd(u.transaction_date) <= p_business_date
                ORDER BY vtb.to_date_yyyymmdd(u.transaction_date) DESC, u.id
                LIMIT 1
            ) u ON true
        ),
        matched AS (
            SELECT p.*
            FROM paired p
            WHERE p.jghflag IS NOT NULL
        ),
        numbered AS (
            SELECT
                m.*,
                row_number() OVER (PARTITION BY m.jghflag ORDER BY m.id, m.old_id) AS rn,
                c.customers_english_name,
                c.depart_id,
                c.id_code,
                c.customer_type
            FROM matched m
            LEFT JOIN vtb.cif_tab c ON c.customer_id = m.old_customer_code
        )
        INSERT INTO vtb.fae_base_info (
            actiontype, actiondesc, rptno, buscode, jghflag, transdate, custype,
            custcod, idcode, custnm, fcyacc, lcyacc, oppuser, oppbank, fcyamt,
            lcyamt, fcyccy, lcyccy, exrate, branchid, branchcode, branchname,
            safebranchcode, safebranchname, source_transaction_id, paired_transaction_id
        )
        SELECT
            'A',
            NULL,
            p_safe_branch_code || to_char(p_business_date, 'YYMMDD') ||
                lpad(n.rn::text, 3, '0') || CASE WHEN n.jghflag = '1' THEN 'U' ELSE 'X' END,
            n.effective_ref_no,
            n.jghflag,
            p_business_date,
            CASE n.customer_type WHEN '01' THEN 'C' WHEN '02' THEN 'D' WHEN '03' THEN 'F' ELSE NULL END,
            CASE WHEN n.customer_type = '01' THEN n.depart_id ELSE NULL END,
            CASE WHEN n.customer_type IN ('02', '03') THEN COALESCE(NULLIF(n.depart_id, ''), NULLIF(n.id_code, '')) ELSE NULL END,
            COALESCE(NULLIF(n.customers_english_name, ''), NULLIF(n.old_agent_name, '')),
            CASE
                WHEN n.jghflag = '1' THEN CASE WHEN n.old_uses_opposite THEN n.old_oppositers_account_id ELSE n.old_account_id END
                ELSE CASE WHEN n.t_uses_opposite THEN n.oppositers_account_id ELSE n.account_id END
            END,
            CASE
                WHEN n.jghflag = '1' THEN NULL
                ELSE CASE WHEN n.old_uses_opposite THEN n.old_oppositers_account_id ELSE n.old_account_id END
            END,
            CASE WHEN n.jghflag = '2' THEN COALESCE(NULLIF(n.customers_english_name, ''), NULLIF(n.old_agent_name, '')) ELSE NULL END,
            CASE WHEN n.jghflag = '2' THEN p_branch_name ELSE NULL END,
            CASE WHEN n.jghflag = '1' THEN NULLIF(n.old_trade_amount, '')::numeric ELSE NULLIF(n.trade_amount, '')::numeric END,
            CASE WHEN n.jghflag = '1' THEN NULLIF(n.trade_amount, '')::numeric ELSE NULLIF(n.old_trade_amount, '')::numeric END,
            CASE WHEN n.jghflag = '1' THEN left(n.old_currency_code, 3) ELSE left(n.currency_code, 3) END,
            CASE WHEN n.jghflag = '1' THEN left(n.currency_code, 3) ELSE left(n.old_currency_code, 3) END,
            CASE
                WHEN (CASE WHEN n.jghflag = '1' THEN NULLIF(n.trade_amount, '')::numeric ELSE NULLIF(n.old_trade_amount, '')::numeric END) = 0 THEN NULL
                WHEN (CASE WHEN n.jghflag = '1' THEN NULLIF(n.old_trade_amount, '')::numeric ELSE NULLIF(n.trade_amount, '')::numeric END)
                     / (CASE WHEN n.jghflag = '1' THEN NULLIF(n.trade_amount, '')::numeric ELSE NULLIF(n.old_trade_amount, '')::numeric END) < 1
                    THEN round(
                        (CASE WHEN n.jghflag = '1' THEN NULLIF(n.trade_amount, '')::numeric ELSE NULLIF(n.old_trade_amount, '')::numeric END)
                        / NULLIF((CASE WHEN n.jghflag = '1' THEN NULLIF(n.old_trade_amount, '')::numeric ELSE NULLIF(n.trade_amount, '')::numeric END), 0),
                        8
                    )
                ELSE round(
                    (CASE WHEN n.jghflag = '1' THEN NULLIF(n.old_trade_amount, '')::numeric ELSE NULLIF(n.trade_amount, '')::numeric END)
                    / NULLIF((CASE WHEN n.jghflag = '1' THEN NULLIF(n.trade_amount, '')::numeric ELSE NULLIF(n.old_trade_amount, '')::numeric END), 0),
                    8
                )
            END,
            p_branch_id,
            p_branch_code,
            p_branch_name,
            p_safe_branch_code,
            p_safe_branch_name,
            n.id,
            n.old_id
        FROM numbered n;
END;
$$;

/* One target table only. Extracted without changing the original DML from usp_vtb_safe2_extract_jsh. */
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_table_fae_manage(
p_business_date date,
    p_branch_id numeric DEFAULT NULL,
    p_branch_code varchar DEFAULT '310000167001',
    p_branch_name varchar DEFAULT NULL,
    p_safe_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_name varchar DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM vtb.fae_manage WHERE rptdate = p_business_date;

    INSERT INTO vtb.fae_manage (
            fae_base_info_id, actiontype, actiondesc, rptno, regno, txcode,
            usetype, usedetail, crtuser, inptelc, rptdate, jghflag
        )
        SELECT
            f.id, 'A', NULL, f.rptno, NULL, left(t.bop_tx_code, 6),
            left(t.use_type, 3), t.usedetail, NULL, NULL, p_business_date, f.jghflag
        FROM vtb.fae_base_info f
        JOIN vtb.transaction_tab t ON t.id = f.source_transaction_id
        WHERE f.transdate = p_business_date
          AND f.jghflag = '1'
          AND NULLIF(t.use_type, '') IS NOT NULL;
END;
$$;

/* One target table only. Extracted without changing the original DML from usp_vtb_safe2_extract_jsh. */
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_table_t_safe_jshd(
p_business_date date,
    p_branch_id numeric DEFAULT NULL,
    p_branch_code varchar DEFAULT '310000167001',
    p_branch_name varchar DEFAULT NULL,
    p_safe_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_name varchar DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM vtb.t_safe_jshd WHERE busdate::date = p_business_date;

    INSERT INTO vtb.t_safe_jshd (
            invalid, actiontype, actiondesc, branchid, datasource, datastatus,
            safebranchcode, safebranchname, tname, buscode, busdate, custype,
            custcod, idcode, custnm, fcyacc, lcyacc, oppuser, oppbank, fcyamt,
            fcyccy, exrate, rptbank, rptno, businesscode, unique_ref_no, data_date
        )
        SELECT
            0, actiontype, actiondesc, branchid, 2, 0, safebranchcode,
            safebranchname, 'JSHD', buscode, transdate, custype, custcod, idcode,
            custnm, fcyacc, lcyacc, oppuser, oppbank, fcyamt, fcyccy, exrate,
            safebranchcode, rptno, buscode, buscode, transdate
        FROM vtb.fae_base_info
        WHERE transdate = p_business_date AND jghflag = '1';
END;
$$;

/* One target table only. Extracted without changing the original DML from usp_vtb_safe2_extract_jsh. */
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_table_t_safe_jshe(
p_business_date date,
    p_branch_id numeric DEFAULT NULL,
    p_branch_code varchar DEFAULT '310000167001',
    p_branch_name varchar DEFAULT NULL,
    p_safe_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_name varchar DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM vtb.t_safe_jshe WHERE busdate::date = p_business_date;

    INSERT INTO vtb.t_safe_jshe (
            invalid, actiontype, actiondesc, branchid, datasource, datastatus,
            safebranchcode, safebranchname, tname, buscode, busdate, custype,
            custcod, idcode, custnm, fcyacc, lcyacc, lcyamt, lcyccy, oppuser,
            oppbank, exrate, rptbank, rptno, businesscode, unique_ref_no, data_date
        )
        SELECT
            0, actiontype, actiondesc, branchid, 2, 0, safebranchcode,
            safebranchname, 'JSHE', buscode, transdate, custype, custcod, idcode,
            custnm, fcyacc, lcyacc, lcyamt, fcyccy, oppuser, oppbank, exrate,
            safebranchcode, rptno, buscode, buscode, transdate
        FROM vtb.fae_base_info
        WHERE transdate = p_business_date AND jghflag = '2';
END;
$$;

/* One target table only. Extracted without changing the original DML from usp_vtb_safe2_extract_jsh. */
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_table_t_safe_jshd_f(
p_business_date date,
    p_branch_id numeric DEFAULT NULL,
    p_branch_code varchar DEFAULT '310000167001',
    p_branch_name varchar DEFAULT NULL,
    p_safe_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_name varchar DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    /*
          JSH first-generation mapping:
          - Current-day TRN rows with the same refNo are paired with the latest
            prior/current non-self TRN row.
          - transactionType 04 creates settlement base info (JSHD).
          - transactionType 03 creates purchase base info (JSHE).
          - FAEManage is auto-created only for settlement rows when useType exists.
          Notes preserved from the Java code:
          - Settlement LCY account assignment is commented out in legacy code.
          - JSHE target LCYCCY follows legacy export behavior and uses fcyCcy.
        */
    
        DELETE FROM vtb.t_safe_jshd_f WHERE busdate::date = p_business_date;

    INSERT INTO vtb.t_safe_jshd_f (
            invalid, actiontype, actiondesc, branchid, datasource, datastatus,
            safebranchcode, safebranchname, tname, busdate, crtuser, inptelc,
            jshdid, regno, rptdate, rptno, txcode, usedetail, usetype,
            businesscode, unique_ref_no, data_date
        )
        SELECT
            0, m.actiontype, m.actiondesc, f.branchid, 2, 0, f.safebranchcode,
            f.safebranchname, 'JSHD_F', m.rptdate, m.crtuser, m.inptelc,
            d.id, m.regno, m.rptdate, m.rptno, m.txcode, m.usedetail, m.usetype,
            f.buscode, f.buscode, m.rptdate
        FROM vtb.fae_manage m
        JOIN vtb.fae_base_info f ON f.id = m.fae_base_info_id
        JOIN vtb.t_safe_jshd d ON d.rptno = f.rptno
        WHERE m.rptdate = p_business_date AND m.jghflag = '1';
END;
$$;

/* One target table only. Extracted without changing the original DML from usp_vtb_safe2_extract_jsh. */
CREATE OR REPLACE PROCEDURE vtb.usp_vtb_table_t_safe_jshe_g(
p_business_date date,
    p_branch_id numeric DEFAULT NULL,
    p_branch_code varchar DEFAULT '310000167001',
    p_branch_name varchar DEFAULT NULL,
    p_safe_branch_code varchar DEFAULT '310000167001',
    p_safe_branch_name varchar DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM vtb.t_safe_jshe_g WHERE busdate::date = p_business_date;

    INSERT INTO vtb.t_safe_jshe_g (
            invalid, actiontype, actiondesc, branchid, datasource, datastatus,
            safebranchcode, safebranchname, tname, busdate, crtuser, inptelc,
            jsheid, regno, rptdate, rptno, txcode, businesscode, unique_ref_no,
            data_date
        )
        SELECT
            0, m.actiontype, m.actiondesc, f.branchid, 2, 0, f.safebranchcode,
            f.safebranchname, 'JSHE_G', m.rptdate, m.crtuser, m.inptelc,
            e.id, m.regno, m.rptdate, m.rptno, m.txcode, f.buscode, f.buscode,
            m.rptdate
        FROM vtb.fae_manage m
        JOIN vtb.fae_base_info f ON f.id = m.fae_base_info_id
        JOIN vtb.t_safe_jshe e ON e.rptno = f.rptno
        WHERE m.rptdate = p_business_date AND m.jghflag = '2';
END;
$$;
