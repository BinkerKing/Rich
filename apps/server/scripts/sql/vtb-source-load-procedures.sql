/*
  PostgreSQL equivalents of DataImportServiceImpl.parseTxtFile(File).
  Input is an array of decoded UTF-16 source lines. Decoding remains the file
  transport concern; each procedure owns the one-generation row semantics.
*/

CREATE OR REPLACE PROCEDURE vtb.usp_vtb_load_cif_tab(p_lines text[])
LANGUAGE plpgsql
AS $$
DECLARE
    v_line text;
    v_parts text[];
BEGIN
    TRUNCATE TABLE vtb.cif_tab;
    FOREACH v_line IN ARRAY COALESCE(p_lines, ARRAY[]::text[]) LOOP
        CONTINUE WHEN char_length(v_line) <= 4;
        v_parts := string_to_array(v_line, '|');
        IF COALESCE(array_length(v_parts, 1), 0) < 24 THEN
            RAISE EXCEPTION 'CIF row has % fields; one-generation parser requires 24', COALESCE(array_length(v_parts, 1), 0);
        END IF;
        INSERT INTO vtb.cif_tab (
            customer_id, depart_id, customer_type, id_type, id_code,
            customers_chinese_name, add_attrib_of_customer_to_aml,
            customers_english_name, customer_nationality, customers_tel,
            customers_address, customers_other_tel, vocation_type,
            registration_money, legal_person_representative,
            legal_person_representative_id_type, legal_person_representative_id_code,
            customer_code, istaxfree, taxfreecode, corporate_nature,
            industry_code, area_code, qygm
        ) VALUES (
            v_parts[1], v_parts[2], v_parts[3], v_parts[4], v_parts[5],
            v_parts[6], v_parts[7], v_parts[8], v_parts[9], v_parts[10],
            v_parts[11], v_parts[12], v_parts[13], v_parts[14], v_parts[15],
            v_parts[16], v_parts[17], NULL, v_parts[19], v_parts[20],
            v_parts[21], v_parts[22], v_parts[23], v_parts[24]
        );
    END LOOP;
END;
$$;

CREATE OR REPLACE PROCEDURE vtb.usp_vtb_load_aif_tab(p_lines text[])
LANGUAGE plpgsql
AS $$
DECLARE
    v_line text;
    v_parts text[];
BEGIN
    TRUNCATE TABLE vtb.aif_tab;
    FOREACH v_line IN ARRAY COALESCE(p_lines, ARRAY[]::text[]) LOOP
        CONTINUE WHEN char_length(v_line) <= 4;
        v_parts := string_to_array(v_line, '|');
        IF COALESCE(array_length(v_parts, 1), 0) < 12 THEN
            RAISE EXCEPTION 'AIF row has % fields; one-generation parser requires 12', COALESCE(array_length(v_parts, 1), 0);
        END IF;
        CONTINUE WHEN NOT vtb.is_vtb_own_fx_account(v_parts[1]);
        INSERT INTO vtb.aif_tab (
            account_id, currency_code, customer_id, account_type, account_open_time,
            account_close_time, add_attrib_of_account_to_aml, is_abroad_account,
            limit_type, limit_ccy, limit_amt, glcode
        ) VALUES (
            v_parts[1], v_parts[2], v_parts[3], v_parts[4], v_parts[5],
            v_parts[6], v_parts[7], v_parts[8], v_parts[9], v_parts[10],
            v_parts[11], v_parts[12]
        );
    END LOOP;
END;
$$;

CREATE OR REPLACE PROCEDURE vtb.usp_vtb_load_bln_tab(p_lines text[])
LANGUAGE plpgsql
AS $$
DECLARE
    v_line text;
    v_parts text[];
    v_business_date text;
    v_loaded boolean := false;
BEGIN
    FOREACH v_line IN ARRAY COALESCE(p_lines, ARRAY[]::text[]) LOOP
        CONTINUE WHEN char_length(v_line) <= 4;
        v_parts := string_to_array(v_line, '|');
        IF COALESCE(array_length(v_parts, 1), 0) < 5 THEN
            RAISE EXCEPTION 'BLN row has % fields; one-generation parser requires 5', COALESCE(array_length(v_parts, 1), 0);
        END IF;
        IF NOT v_loaded THEN
            v_business_date := split_part(v_parts[3], '-', 1);
            DELETE FROM vtb.bln_tab WHERE bus_date = v_business_date;
            v_loaded := true;
        END IF;
        INSERT INTO vtb.bln_tab (
            account_id, currency, bus_date, ldbl, cdbl,
            cdbl_usd, cdbl_cny, ldbl_usd, ldbl_cny
        ) VALUES (
            v_parts[1], CASE WHEN v_parts[2] = 'RUR' THEN 'RUB' ELSE v_parts[2] END,
            split_part(v_parts[3], '-', 1), v_parts[4]::numeric, v_parts[5]::numeric,
            NULL, NULL, NULL, NULL
        );
    END LOOP;
    IF NOT v_loaded THEN
        RAISE EXCEPTION 'BLN import has no rows longer than four characters';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE vtb.usp_vtb_load_transaction_tab(p_lines text[])
LANGUAGE plpgsql
AS $$
DECLARE
    v_line text;
    v_parts text[];
    v_transaction_date text;
    v_rate numeric(22,8);
    v_loaded boolean := false;
BEGIN
    FOREACH v_line IN ARRAY COALESCE(p_lines, ARRAY[]::text[]) LOOP
        CONTINUE WHEN char_length(v_line) <= 4;
        v_parts := string_to_array(v_line, '|');
        IF COALESCE(array_length(v_parts, 1), 0) < 40 THEN
            RAISE EXCEPTION 'TRN row has % fields; one-generation parser requires 40 base fields', COALESCE(array_length(v_parts, 1), 0);
        END IF;
        IF array_length(v_parts, 1) > 41 AND array_length(v_parts, 1) < 50 THEN
            RAISE EXCEPTION 'TRN row has % fields; one-generation optional mapping reads through field 50', array_length(v_parts, 1);
        END IF;
        IF NOT v_loaded THEN
            v_transaction_date := v_parts[8];
            DELETE FROM vtb.transaction_tab WHERE transaction_date = v_transaction_date;
            v_loaded := true;
        END IF;
        v_rate := CASE WHEN v_parts[14] = 'USD' THEN 1 ELSE NULL END;
        IF COALESCE(v_parts[12], '') <> '' AND position('@' IN v_parts[12]) > 0 THEN
            v_rate := substring(v_parts[12] FROM position('@' IN v_parts[12]) + 1)::numeric;
            IF v_parts[14] = 'RUB' THEN v_rate := round(1 / v_rate, 8); END IF;
        END IF;
        INSERT INTO vtb.transaction_tab (
            reference_number, tran_ref_number, work_date, depart_no, customer_code,
            agent_name, account_id, transaction_date, transaction_time, transaction_place,
            payment_flag, payment_direction, usage, currency_code, trade_amount_init,
            trade_amount, local_bank_fee, foreign_bank_fee, opposite_bank_code,
            opposite_bank_name, opposite_bank_type, oppositer_name, oppositer_type,
            oppositer_nationality, oppositers_id_code, oppositers_id_type,
            oppositers_account_id, oppositers_account_type, transaction_type, pay_method,
            maturity_date, depart_name, depart_area_code, depart_type, agent_id_type,
            agent_id_code, agent_nationality_code, trade_mode, trade_code,
            opposite_bank_area_code, use_type, usedetail, bop_tx_code, amount_for_bop,
            remark_for_bop, bop_tx_code2, amount_for_bop2, remark_for_bop2, prepayment,
            applicant_name, ref_no, rate
        ) VALUES (
            v_parts[1], v_parts[2], v_parts[3], v_parts[4], v_parts[5], v_parts[6],
            v_parts[7], v_parts[8], v_parts[9], v_parts[10], v_parts[11], v_parts[12],
            v_parts[13], v_parts[14], v_parts[15], v_parts[16], v_parts[17], v_parts[18],
            v_parts[19], v_parts[20], v_parts[21], v_parts[22], v_parts[23], v_parts[24],
            v_parts[25], v_parts[26], v_parts[27], v_parts[28], v_parts[29], v_parts[30],
            v_parts[31], v_parts[32], v_parts[33], v_parts[34], v_parts[35], v_parts[36],
            v_parts[37], v_parts[38], v_parts[39], v_parts[40],
            CASE WHEN array_length(v_parts, 1) > 41 THEN v_parts[41] END,
            CASE WHEN array_length(v_parts, 1) > 41 THEN v_parts[42] END,
            CASE WHEN array_length(v_parts, 1) > 41 THEN v_parts[43] END,
            CASE WHEN array_length(v_parts, 1) > 41 THEN v_parts[44] END,
            CASE WHEN array_length(v_parts, 1) > 41 THEN v_parts[45] END,
            CASE WHEN array_length(v_parts, 1) > 41 THEN v_parts[46] END,
            CASE WHEN array_length(v_parts, 1) > 41 THEN v_parts[47] END,
            CASE WHEN array_length(v_parts, 1) > 41 THEN v_parts[48] END,
            CASE WHEN array_length(v_parts, 1) > 41 THEN v_parts[49] END,
            CASE WHEN array_length(v_parts, 1) > 41 THEN v_parts[50] END,
            NULL, v_rate
        );
    END LOOP;
    IF NOT v_loaded THEN
        RAISE EXCEPTION 'TRN import has no rows longer than four characters';
    END IF;
END;
$$;

/*
  Equivalent of DataImportServiceImpl.importVTBFalData + parseExcelVtb.
  p_files is an ordered JSON array: [{"fileName":"dis...xlsx","sheetName":"...",
  "rows":[[cell0, cell1, ...], ...]}].  The Excel reader remains the transport
  layer; this procedure deliberately uses only the last file in p_files because
  the one-generation loop assigns resultList = parseExcelVtb(file) each time.
  p_customers preserves the enabled Customer iteration order and carries the
  one-generation fields used by setcountryCode: enName, countryCode, parn.
*/
CREATE OR REPLACE FUNCTION vtb.vtb_parse_fal_date(p_value text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_parts text[];
    v_month text;
BEGIN
    IF position('月' IN p_value) > 0 THEN
        v_parts := string_to_array(p_value, '-');
        v_month := CASE v_parts[2]
            WHEN '一月' THEN '01' WHEN '二月' THEN '02' WHEN '三月' THEN '03'
            WHEN '四月' THEN '04' WHEN '五月' THEN '05' WHEN '六月' THEN '06'
            WHEN '七月' THEN '07' WHEN '八月' THEN '08' WHEN '九月' THEN '09'
            WHEN '十月' THEN '10' WHEN '十一月' THEN '11' WHEN '十二月' THEN '12'
        END;
        RETURN to_date(v_parts[3] || v_month || v_parts[1], 'YYYYMMDD');
    ELSIF position('-' IN p_value) > 0 THEN
        RETURN to_date(p_value, 'YY-MM-DD');
    END IF;
    RETURN to_date(p_value, 'YYYY/MM/DD');
END;
$$;

CREATE OR REPLACE FUNCTION vtb.vtb_fal_month_diff(p_start date, p_end date)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_start date := p_start;
    v_end date := p_end;
    v_months integer;
BEGIN
    IF v_start > v_end THEN
        v_start := p_end;
        v_end := p_start;
    END IF;
    v_months := (extract(year FROM v_end)::integer - extract(year FROM v_start)::integer) * 12
        + extract(month FROM v_end)::integer - extract(month FROM v_start)::integer;
    IF extract(day FROM v_start) = 1 AND extract(day FROM v_end + 1) = 1 THEN
        RETURN v_months + 1;
    ELSIF extract(day FROM v_start) <> 1 AND extract(day FROM v_end + 1) = 1 THEN
        RETURN v_months;
    ELSIF extract(day FROM v_start) = 1 AND extract(day FROM v_end + 1) <> 1 THEN
        RETURN v_months;
    END IF;
    RETURN greatest(v_months - 1, 0);
END;
$$;

CREATE OR REPLACE PROCEDURE vtb.usp_vtb_load_fal_warehouse(
    p_import_date date,
    p_files jsonb,
    p_customers jsonb DEFAULT '[]'::jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_file jsonb;
    v_row jsonb;
    v_file_name text;
    v_sheet_name text;
    v_kind text;
    v_row_no integer := 0;
    v_ref_no text;
    v_en_name text;
    v_country_code text;
    v_value_date date;
    v_maturity_date date;
    v_amount numeric;
    v_rate numeric;
    v_days integer;
    v_original_days integer;
    v_denominator numeric;
    v_fal_no text;
    v_op_department text;
    v_mbalance numeric;
    v_mintbalance numeric;
    v_shortbalance numeric;
    v_int_accrual numeric;
    v_relation text;
    v_or_maturity text;
    v_customer jsonb;
    v_found boolean;
    v_customer_country text;
    v_customer_parn text;
    v_messages text[] := ARRAY[]::text[];
BEGIN
    IF jsonb_array_length(COALESCE(p_files, '[]'::jsonb)) = 0 THEN
        RAISE EXCEPTION 'FAL import has no files';
    END IF;
    SELECT value INTO v_file
    FROM jsonb_array_elements(p_files) WITH ORDINALITY AS files(value, ordinality)
    ORDER BY ordinality DESC
    LIMIT 1;
    v_file_name := lower(v_file->>'fileName');
    v_sheet_name := lower(COALESCE(v_file->>'sheetName', ''));
    v_kind := CASE
        WHEN v_file_name LIKE 'dis%' THEN 'dis'
        WHEN v_file_name LIKE 'mm%' THEN 'mm'
        WHEN v_file_name LIKE 'loan%' THEN 'loan'
    END;
    IF v_kind IS NULL OR (v_kind = 'loan' AND v_sheet_name <> 'drawdown') THEN
        RETURN;
    END IF;

    CREATE TEMP TABLE vtb_fal_candidate (
        fal_no text, ref_no text, en_name text, country_code text, op_department text,
        relation text, or_maturity text, value_date date, maturity_date date, ccy text,
        mbalance numeric, mintbalance numeric, shortbalance numeric, int_accrual numeric
    ) ON COMMIT DROP;

    FOR v_row IN SELECT value FROM jsonb_array_elements(COALESCE(v_file->'rows', '[]'::jsonb)) LOOP
        v_row_no := v_row_no + 1;
        CONTINUE WHEN (v_kind IN ('dis', 'mm') AND v_row_no = 1);
        v_ref_no := NULL; v_en_name := NULL; v_country_code := NULL; v_rate := 0;
        IF v_kind = 'dis' THEN
            CONTINUE WHEN NULLIF(btrim(v_row->>31), '') IS NULL;
            CONTINUE WHEN v_row->>31 NOT IN ('Y', 'N');
            v_value_date := vtb.vtb_parse_fal_date(btrim(v_row->>11));
            v_maturity_date := vtb.vtb_parse_fal_date(btrim(v_row->>12));
            v_fal_no := CASE WHEN v_row->>31 = 'N' THEN 'F01' WHEN lower(btrim(v_row->>2)) = 'discounting' THEN 'D02' END;
            CONTINUE WHEN v_fal_no IS NULL;
            v_ref_no := btrim(v_row->>CASE WHEN v_fal_no = 'F01' THEN 3 ELSE 1 END);
            CONTINUE WHEN v_fal_no = 'D02' AND v_ref_no = '';
            v_en_name := btrim(v_row->>4); v_country_code := btrim(v_row->>32);
            v_amount := COALESCE(NULLIF(replace(btrim(v_row->>7), ',', ''), '')::numeric, 0);
            v_rate := COALESCE(NULLIF(replace(btrim(v_row->>10), '%', ''), '')::numeric / CASE WHEN position('%' IN COALESCE(v_row->>10, '')) > 0 THEN 100 ELSE 1 END, 0);
            v_original_days := btrim(v_row->>8)::integer; v_denominator := 360;
            v_op_department := CASE WHEN v_fal_no = 'D02' THEN '5' END;
        ELSIF v_kind = 'mm' THEN
            v_ref_no := btrim(v_row->>0); CONTINUE WHEN v_ref_no = '';
            CONTINUE WHEN position('/' IN COALESCE(v_row->>14, '')) = 0 AND position('-' IN COALESCE(v_row->>14, '')) = 0 AND position('月' IN COALESCE(v_row->>14, '')) = 0;
            CONTINUE WHEN position('/' IN COALESCE(v_row->>16, '')) = 0 AND position('-' IN COALESCE(v_row->>16, '')) = 0 AND position('月' IN COALESCE(v_row->>16, '')) = 0;
            v_value_date := vtb.vtb_parse_fal_date(btrim(v_row->>14)); v_maturity_date := vtb.vtb_parse_fal_date(btrim(v_row->>16));
            v_fal_no := CASE lower(btrim(v_row->>4)) WHEN 'placing' THEN 'D02' WHEN 'taking' THEN 'D0601' END;
            CONTINUE WHEN v_fal_no IS NULL;
            v_en_name := btrim(v_row->>7); v_amount := COALESCE(NULLIF(replace(btrim(v_row->>10), ',', ''), '')::numeric, 0);
            v_rate := COALESCE(NULLIF(replace(btrim(v_row->>11), '%', ''), '')::numeric / CASE WHEN position('%' IN COALESCE(v_row->>11, '')) > 0 THEN 100 ELSE 1 END, 0);
            v_original_days := v_maturity_date - v_value_date; v_denominator := 360; v_op_department := '3';
        ELSE
            v_ref_no := btrim(v_row->>2); CONTINUE WHEN v_ref_no = '';
            v_value_date := vtb.vtb_parse_fal_date(btrim(v_row->>3)); v_maturity_date := vtb.vtb_parse_fal_date(btrim(v_row->>7));
            v_fal_no := 'D02'; v_en_name := btrim(v_row->>4);
            v_amount := COALESCE(NULLIF(replace(btrim(v_row->>6), ',', ''), '')::numeric, 0);
            v_rate := COALESCE(NULLIF(replace(btrim(v_row->>8), '%', ''), '')::numeric / CASE WHEN position('%' IN COALESCE(v_row->>8, '')) > 0 THEN 100 ELSE 1 END, 0);
            v_original_days := v_maturity_date - v_value_date; v_denominator := 365; v_op_department := '3';
        END IF;
        CONTINUE WHEN p_import_date < v_value_date;
        CONTINUE WHEN p_import_date > v_maturity_date AND date_trunc('month', p_import_date) <> date_trunc('month', v_maturity_date);
        v_relation := CASE WHEN upper(v_en_name) LIKE '%VTB%' THEN '3' ELSE '4' END;
        v_or_maturity := CASE WHEN v_original_days > 360 THEN '2' ELSE '1' END;
        v_mbalance := CASE WHEN date_trunc('month', v_maturity_date) = date_trunc('month', p_import_date) THEN 0 ELSE v_amount END;
        v_days := p_import_date - v_value_date;
        v_mintbalance := round(v_mbalance * v_rate * v_days / v_denominator, 2);
        v_shortbalance := CASE WHEN v_or_maturity = '1' OR v_maturity_date - p_import_date <= v_denominator THEN v_mbalance ELSE 0 END;
        v_int_accrual := 0;
        IF vtb.vtb_fal_month_diff(p_import_date, v_maturity_date) = 0 THEN
            v_int_accrual := round(v_mbalance * v_rate * v_original_days / v_denominator, 2);
            v_mintbalance := 0;
        END IF;
        /* One-generation F01 branch never sets interest fields. */
        IF v_fal_no = 'F01' THEN
            v_mintbalance := NULL;
            v_int_accrual := NULL;
        END IF;
        INSERT INTO vtb_fal_candidate VALUES (v_fal_no, v_ref_no, v_en_name, NULLIF(v_country_code, ''), v_op_department, v_relation, v_or_maturity, v_value_date, v_maturity_date, btrim(v_row->>CASE WHEN v_kind = 'dis' THEN 6 WHEN v_kind = 'mm' THEN 9 ELSE 5 END), v_mbalance, v_mintbalance, v_shortbalance, v_int_accrual);
    END LOOP;

    /* Java deletes the date only after parseExcelVtb yielded rows; a later mapping
       error rolls the whole call back, matching its no-save return path. */
    IF EXISTS (SELECT 1 FROM vtb_fal_candidate) THEN
        DELETE FROM vtb.fal_warehouse WHERE bus_date::date = p_import_date;
    END IF;
    FOR v_row IN SELECT to_jsonb(c) FROM vtb_fal_candidate c LOOP
        v_found := false; v_customer := NULL;
        IF v_row->>'fal_no' <> 'F01' THEN
            SELECT value INTO v_customer FROM jsonb_array_elements(COALESCE(p_customers, '[]'::jsonb))
            WHERE value->>'enName' LIKE (v_row->>'en_name') || '%' LIMIT 1;
            v_found := v_customer IS NOT NULL;
            IF NOT v_found THEN v_messages := array_append(v_messages, (v_row->>'en_name') || '-' || (v_row->>'fal_no') || '-在客户信息里面不存在，请补录。'); CONTINUE; END IF;
            v_customer_country := NULLIF(v_customer->>'countryCode', ''); v_customer_parn := NULLIF(v_customer->>'parn', '');
            IF v_row->>'fal_no' = 'D02' AND COALESCE(v_row->>'country_code', '') = '' THEN v_row := jsonb_set(v_row, '{country_code}', to_jsonb(v_customer_country)); END IF;
            IF v_row->>'fal_no' = 'D02' AND COALESCE(v_row->>'country_code', '') = '' THEN v_messages := array_append(v_messages, (v_row->>'en_name') || '-D02-没有维护国别，请补录。'); CONTINUE; END IF;
            /* setcountryCode persists D02 only for non-CHN counterparties. */
            IF v_row->>'fal_no' = 'D02' AND v_row->>'country_code' = 'CHN' THEN CONTINUE; END IF;
            IF v_row->>'fal_no' = 'D0601' AND v_customer_country IS NULL THEN v_messages := array_append(v_messages, (v_row->>'en_name') || '-D0601-没有在客户信息里面维护国别，请补录。'); CONTINUE; END IF;
            IF v_row->>'fal_no' = 'D0601' AND v_customer_country = 'CHN' THEN CONTINUE; END IF;
            IF v_row->>'fal_no' = 'D0601' THEN v_row := jsonb_set(v_row, '{country_code}', to_jsonb(v_customer_country)); END IF;
        END IF;
        INSERT INTO vtb.fal_warehouse (fal_no, ref_no, en_name, country_code, op_department, bus_type, is_entrust_loan, entrust_department, relation, value_date, maturity_date, or_maturity, ccy, mbalance, mintbalance, shortbalance, int_accrual, bus_date)
        VALUES (v_row->>'fal_no', v_row->>'ref_no', v_row->>'en_name', v_row->>'country_code', v_row->>'op_department', NULL, CASE WHEN v_row->>'fal_no' = 'F01' THEN NULL ELSE '2' END, NULL, v_row->>'relation', (v_row->>'value_date')::date, (v_row->>'maturity_date')::date, v_row->>'or_maturity', v_row->>'ccy', (v_row->>'mbalance')::numeric, (v_row->>'mintbalance')::numeric, (v_row->>'shortbalance')::numeric, (v_row->>'int_accrual')::numeric, p_import_date);
        IF v_row->>'fal_no' = 'D02' AND v_row->>'country_code' <> 'CHN' THEN
            INSERT INTO vtb.fal_warehouse (fal_no, ref_no, country_code, ccy, mbalance, bus_date)
            VALUES ('D09', v_row->>'ref_no', v_row->>'country_code', v_row->>'ccy', (v_row->>'mbalance')::numeric * COALESCE(v_customer_parn::numeric, 0.01), p_import_date);
        END IF;
    END LOOP;
    IF cardinality(v_messages) > 0 THEN RAISE EXCEPTION 'FAL customer mapping failed: %', array_to_string(v_messages, '; '); END IF;
END;
$$;
