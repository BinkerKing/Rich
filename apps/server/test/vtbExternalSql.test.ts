import { describe, expect, it } from "vitest";
import { VTB_EXTERNAL_SQL_PROCEDURES, VTB_TABLE_PROCESS_NOTES, tableProcedureNames } from "../src/modules/project-dictionary/safe/vtbExternalSql.js";

describe("VTB external SQL procedure ownership", () => {
  it("covers the VTB automation chain without adding SAC", () => {
    const mapped = tableProcedureNames();

    expect(mapped.get("CifTab")).toEqual(["usp_vtb_load_cif_tab"]);
    expect(mapped.get("AifTab")).toEqual(["usp_vtb_load_aif_tab"]);
    expect(mapped.get("BlnTab")).toEqual(["usp_vtb_load_bln_tab"]);
    expect(mapped.get("TransactionTab")).toEqual(["usp_vtb_load_transaction_tab"]);
    expect(mapped.get("fal_warehouse")).toEqual(["usp_vtb_load_fal_warehouse"]);
    expect(mapped.get("T_SAFE_ACCCA")).toEqual(["usp_vtb_table_t_safe_accca"]);
    expect(mapped.get("T_SAFE_CFAC_A")).toEqual(["usp_vtb_table_t_safe_cfac_a"]);
    expect(mapped.get("T_SAFE_JSHD")).toEqual(["usp_vtb_table_t_safe_jshd"]);
    expect(mapped.get("T_SAFE_FALD_0501")).toEqual(["usp_vtb_table_t_safe_fald_0501"]);
    expect(mapped.get("T_SAFE_EXDA_N")).toEqual(["usp_vtb_table_t_safe_exda_n"]);
    expect(mapped.get("T_SAFE_SAC_JP")).toBeUndefined();
    expect(mapped.get("T_SAFE_CFAB_A")).toBeUndefined();
    expect(mapped.get("T_SAFE_BOPA")).toEqual([]);
    expect(VTB_TABLE_PROCESS_NOTES.T_SAFE_BOPA).toContain("人工判定");
    expect(VTB_EXTERNAL_SQL_PROCEDURES).not.toContain("usp_vtb_safe2_process_all");
  });
});
