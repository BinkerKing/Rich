import { describe, expect, it } from "vitest";
import {
  parseSafeSourceStageDocument,
} from "../src/modules/project-dictionary/safe/sourceStageMapping.js";

const SOURCE_STAGE_DOCUMENT = `
## 2. 源文件与贴源层表
| ` + "`AIF2.TXT`" + ` | 账户文件 | ` + "`AifTab`" + ` | 按账号过滤 | 贴源账户 |
| ` + "`BLN2.TXT`" + ` | 余额文件 | ` + "`BlnTab`" + ` | 按业务日期重入 | 贴源余额 |
| ` + "`REPORT.TXT`" + ` | 校验文件 | 无 | 不入库 | 仅校验 |
## 3. 字段映射
## 1. ` + "`AIF2.TXT`" + ` 说明 -> ` + "`AifTab`" + `
| 第1字段 | Java[0] | ` + "`AifTab.customerId`" + ` | 客户号 | 直接写入 |
| 第2字段 | Java[1] | ` + "`AifTab.accountId`" + ` | 账号 | 直接写入 |
贴源表自动/
| ` + "`AifTab.id`" + ` | 主键 | 数据库生成 |
`;

describe("SAFE source-to-stage parser", () => {
  it("keeps confirmed source order and excludes REPORT.TXT from the import chain", () => {
    const parsed = parseSafeSourceStageDocument(SOURCE_STAGE_DOCUMENT);

    expect(parsed.sourceTables).toEqual([
      expect.objectContaining({ fileName: "AIF2.TXT", stageTable: "AifTab" }),
      expect.objectContaining({ fileName: "BLN2.TXT", stageTable: "BlnTab" }),
    ]);
    expect(parsed.fields).toEqual([
      expect.objectContaining({ sourceFile: "AIF2.TXT", sourceOrder: 1, javaIndex: 0, targetTable: "AifTab", targetField: "customerId" }),
      expect.objectContaining({ sourceFile: "AIF2.TXT", sourceOrder: 2, javaIndex: 1, targetTable: "AifTab", targetField: "accountId" }),
    ]);
    expect(parsed.autoFields).toEqual([
      expect.objectContaining({ targetTable: "AifTab", targetField: "id" }),
    ]);
  });
});
