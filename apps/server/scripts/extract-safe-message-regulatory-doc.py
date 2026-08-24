#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SOURCE_DOC = Path("/Users/binkerking/Downloads/金融机构外汇业务数据采集规范（1.4版）.docx")
OUTPUT_JSON = PROJECT_ROOT / "apps/server/scripts/generated/safe-message-regulatory-nodes.json"
OUTPUT_MD = PROJECT_ROOT / "docs/SAFE_MESSAGE_REGULATORY_XML_NODES.md"

GENERIC_HEADINGS = {"数据术语解释", "数据格式", "数据字典"}
FIELD_HEADERS = {
    ("字段", "内容", "类型（长度）", "校验"),
    ("字段名", "基础数据项", "数据类型", "数据长度", "校验"),
}

GROUP_APPLICATION_PREFIX = {
    "组织机构基本情况表": "BOP",
    "涉外收支": "BOP",
    "境内划转": "BOP",
    "外汇账户数据": "ACC",
    "账户内结售汇": "JSH",
    "银行自身外债业务": "EXD",
    "银行自身资本项目业务（不包括外债）": "CFA",
    "对外金融资产负债及交易信息": "FAL",
    "机构外币现钞存取数据": "CWD",
    "银行卡境外交易数据": "",
    "涉嫌外汇违规账户信息": "SAC",
    "机构大额结售汇资金来源和使用数据": "SAC",
}

GROUP_CODE_HINTS = {
    "组织机构基本情况表": "BOPU",
    "银行卡境外交易数据|银行卡境外提现明细数据": "CRDTA",
    "银行卡境外交易数据|银行卡境外消费明细数据": "CRXXA",
}


def text(value: Any) -> str:
    return " ".join((getattr(value, "text", value) or "").split())


def iter_blocks(doc: Document):
    table_index = -1
    for child in doc.element.body.iterchildren():
        if child.tag == qn("w:p"):
            yield "p", Paragraph(child, doc), None
        elif child.tag == qn("w:tbl"):
            table_index += 1
            yield "t", Table(child, doc), table_index


def parse_type_and_length(raw: str) -> tuple[str, str, str]:
    raw = text(raw)
    if "字符" in raw:
        field_type = "string"
    elif "数值" in raw or "数字" in raw or "金额" in raw:
        field_type = "decimal"
    elif "日期" in raw:
        field_type = "date"
    elif "时间" in raw:
        field_type = "datetime"
    else:
        field_type = "string" if raw else "待确认"
    match = re.match(r"([^，,]+)[，,]\s*(.+)", raw)
    length = match.group(2).strip() if match else ""
    return field_type, length, raw


def parse_field_rows(table: Table, header: tuple[str, ...]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for index, row in enumerate(table.rows[1:], 1):
        cells = [text(cell) for cell in row.cells]
        if header[0] == "字段":
            field_name, field_cn, type_length, validation = (cells + ["", "", "", ""])[:4]
        else:
            field_name, field_cn, field_type_raw, field_length_raw, validation = (cells + ["", "", "", "", ""])[:5]
            type_length = f"{field_type_raw}，{field_length_raw}" if field_length_raw else field_type_raw
        if not field_name or field_name == header[0]:
            continue
        field_type, field_length, raw_type = parse_type_and_length(type_length)
        rows.append(
            {
                "name": field_name.strip(),
                "cn": field_cn.strip(),
                "fieldType": field_type,
                "fieldLength": field_length,
                "rawType": raw_type,
                "validation": validation.strip(),
                "order": index,
            }
        )
    return rows


def extract_xml_nodes(lines: list[str]) -> list[dict[str, Any]]:
    stack: list[str] = []
    nodes: list[dict[str, Any]] = []
    seen: set[str] = set()
    for line in lines:
        for match in re.finditer(r"<(/?)([A-Za-z][A-Za-z0-9_]*)(?:\s[^>]*)?>", line):
            closing, tag = match.group(1), match.group(2)
            if closing:
                if tag in stack:
                    reverse_index = stack[::-1].index(tag)
                    stack = stack[: len(stack) - reverse_index - 1]
                continue
            path = ".".join(stack + [tag])
            label_match = re.match(rf".*<{re.escape(tag)}>([^<]*)</{re.escape(tag)}>", line)
            label = text(label_match.group(1)) if label_match else ""
            if path not in seen:
                nodes.append({"path": path, "tag": tag, "label": label, "order": len(nodes) + 1, "container": False})
                seen.add(path)
            tail = line[match.end() :]
            if not re.match(rf"[^<]*</{re.escape(tag)}>", tail):
                stack.append(tag)
    paths = [node["path"] for node in nodes]
    for node in nodes:
        node["container"] = any(path.startswith(f"{node['path']}.") for path in paths)
    return nodes


def table_code(title: str, table_index: int) -> str:
    match = re.match(r"([A-Z]\d{2}(?:-\d+)?)表", title)
    if match:
        return match.group(1).replace("-", "_")
    digest = hashlib.sha1(f"{table_index}:{title}".encode("utf-8")).hexdigest()[:6]
    return f"T{table_index:03d}_{digest}".upper()


def normalize_name(value: str) -> str:
    value = re.sub(r"[-—–－]", "", value)
    value = re.sub(r"[：:，,。、；;（）()《》“”\"'\\s]", "", value)
    value = re.sub(r"\d+(?:\.\d+)+数据字典", "", value)
    value = value.replace("申报单", "")
    value = value.replace("申请书", "")
    value = value.replace("业务", "")
    value = value.replace("数据", "")
    value = value.replace("信息", "")
    value = value.replace("表", "")
    value = re.sub(r"仅.*?填写", "", value)
    value = re.sub(r"含.*?转贷款", "", value)
    return value


def extract_interface_codes(doc: Document) -> list[dict[str, str]]:
    chapter = ""
    section = ""
    current_prefix = ""
    mappings: list[dict[str, str]] = []
    for kind, block, _table_index in iter_blocks(doc):
        if kind != "p":
            continue
        value = text(block)
        if not value:
            continue
        style = block.style.name if block.style else ""
        if style == "Heading 1":
            chapter = value
            section = ""
            current_prefix = ""
        elif style == "Heading 2":
            section = value
            current_prefix = ""
        if chapter != "接口文件命名与报送规范" or section != "金融机构信息系统生成的接口文件的命名规则":
            continue
        prefix_match = re.search(r"\b([A-Z]{3})\s*\+\s*(?:1位|2位|1位或2位)?接口", value)
        colon_prefix_match = re.match(r".*?：\s*([A-Z]{3})\s*\+\s*2位接口", value)
        sac_prefix_match = re.match(r"(SAC)\s*\+\s*2位接口", value)
        if colon_prefix_match:
            current_prefix = colon_prefix_match.group(1)
            continue
        if prefix_match:
            current_prefix = prefix_match.group(1)
            continue
        if sac_prefix_match:
            current_prefix = sac_prefix_match.group(1)
            continue
        item_match = re.match(r"^([A-Z]{1,2})\s+(.+)$", value)
        if current_prefix and item_match:
            type_code, description = item_match.group(1), item_match.group(2)
            if "接口控制文件" in description:
                continue
            mappings.append(
                {
                    "fileType": f"{current_prefix}{type_code}",
                    "applicationType": current_prefix,
                    "interfaceTypeCode": type_code,
                    "description": description,
                    "normalized": normalize_name(description),
                }
            )
    return mappings


def resolve_interface_file_type(group: str, title: str, interface_codes: list[dict[str, str]]) -> tuple[str, dict[str, str] | None]:
    hint = GROUP_CODE_HINTS.get(f"{group}|{title}") or GROUP_CODE_HINTS.get(group)
    if hint:
        for item in interface_codes:
            if item["fileType"] == hint:
                return hint, item
        return hint, None

    title_key = normalize_name(title)
    table_no_match = re.match(r"([A-Z]\d{2}(?:-\d+)?)表", title)
    group_prefix = GROUP_APPLICATION_PREFIX.get(group, "")
    candidates = [item for item in interface_codes if not group_prefix or item["applicationType"] == group_prefix]
    if table_no_match:
        table_no = table_no_match.group(1)
        exact = [item for item in candidates if item["description"].startswith(f"{table_no}表")]
        if exact:
            return exact[0]["fileType"], exact[0]

    exd_contract_match = re.match(r"外债签约信息[-—–－](.+)", title)
    if group_prefix == "EXD" and exd_contract_match:
        product_key = normalize_name(exd_contract_match.group(1))
        exact = [
            item
            for item in candidates
            if "签约" in item["description"] and product_key and product_key in item["normalized"]
        ]
        if exact:
            return exact[0]["fileType"], exact[0]

    scored: list[tuple[int, dict[str, str]]] = []
    for item in candidates:
        desc_key = item["normalized"]
        if not desc_key or not title_key:
            continue
        score = 0
        if title_key == desc_key:
            score = 100
        elif title_key in desc_key or desc_key in title_key:
            score = min(len(title_key), len(desc_key))
        if score:
            scored.append((score, item))
    if scored:
        scored.sort(key=lambda item: item[0], reverse=True)
        return scored[0][1]["fileType"], scored[0][1]

    code = table_code(title, 0)
    return f"SAFE_MSG_{code}", None


def build_report_fields(xml_nodes: list[dict[str, Any]], dictionary_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_name = {row["name"].upper(): row for row in dictionary_rows}
    fields: list[dict[str, Any]] = []
    seen_tags: set[str] = set()
    for node in xml_nodes:
        row = by_name.get(node["tag"].upper())
        seen_tags.add(node["tag"].upper())
        fields.append(
            {
                "fieldName": node["path"],
                "fieldCn": row["cn"] if row else node["label"] or ("XML容器节点" if node["container"] else ""),
                "fieldType": "xml_node" if node["container"] else (row["fieldType"] if row else "待确认"),
                "fieldLength": "" if node["container"] else (row["fieldLength"] if row else ""),
                "formatPattern": "" if node["container"] else (row["rawType"] if row else ""),
                "description": "XML 容器节点。" if node["container"] else (row["validation"] if row else "发文 XML 示例存在该节点，数据字典属性待补充。"),
                "validation": "" if node["container"] else (row["validation"] if row else ""),
                "order": len(fields) + 1,
                "xmlTag": node["tag"],
                "xmlPath": node["path"],
                "container": node["container"],
                "rawType": "" if node["container"] else (row["rawType"] if row else ""),
            }
        )
    for row in dictionary_rows:
        if row["name"].upper() in seen_tags:
            continue
        fields.append(
            {
                "fieldName": f"REC.{row['name']}",
                "fieldCn": row["cn"],
                "fieldType": row["fieldType"],
                "fieldLength": row["fieldLength"],
                "formatPattern": row["rawType"],
                "description": row["validation"] or "发文数据字典定义，XML 示例未单独列出。",
                "validation": row["validation"],
                "order": len(fields) + 1,
                "xmlTag": row["name"],
                "xmlPath": f"REC.{row['name']}",
                "container": False,
                "rawType": row["rawType"],
            }
        )
    return fields


def parse_doc() -> list[dict[str, Any]]:
    doc = Document(str(SOURCE_DOC))
    interface_codes = extract_interface_codes(doc)
    chapter = ""
    headings = {2: "", 3: "", 4: "", 5: ""}
    mode = ""
    format_lines: list[str] = []
    last_format_lines: list[str] = []
    reports: list[dict[str, Any]] = []
    skipped_content_only = 0

    for kind, block, table_index in iter_blocks(doc):
        if kind == "p":
            value = text(block)
            if not value:
                continue
            style = block.style.name if block.style else ""
            if style == "Heading 1":
                chapter = value
            if chapter != "数据接口格式":
                continue
            heading_match = re.match(r"Heading (\d+)", style)
            if heading_match:
                level = int(heading_match.group(1))
                if 2 <= level <= 5:
                    if value not in GENERIC_HEADINGS:
                        headings[level] = value
                        for key in list(headings):
                            if key > level:
                                headings[key] = ""
                    if value == "数据格式":
                        format_lines = []
                        mode = "format"
                    elif value == "数据字典":
                        last_format_lines = format_lines[:]
                        mode = "dictionary"
                    elif value == "数据术语解释":
                        mode = "terms"
                    elif value not in GENERIC_HEADINGS:
                        mode = ""
            elif mode == "format" and "<" in value and ">" in value:
                format_lines.append(value)
            continue

        if chapter != "数据接口格式" or not block.rows:
            continue
        header = tuple(text(cell) for cell in block.rows[0].cells)
        if header == ("内容", "类型（长度）", "校验"):
            skipped_content_only += 1
            continue
        if header not in FIELD_HEADERS:
            continue

        title = headings[2]
        if headings[3]:
            title = headings[3]
        if headings[4]:
            title = f"{title}-{headings[4]}"
        dictionary_rows = parse_field_rows(block, header)
        if not dictionary_rows:
            continue
        xml_nodes = extract_xml_nodes(last_format_lines)
        fields = build_report_fields(xml_nodes, dictionary_rows)
        file_type, interface_rule = resolve_interface_file_type(headings[2], title, interface_codes)
        reports.append(
            {
                "tableIndex": table_index,
                "tableName": file_type,
                "tableCn": f"[报文]{title}",
                "group": headings[2],
                "title": title,
                "fieldCount": len(fields),
                "dictionaryFieldCount": len(dictionary_rows),
                "xmlNodeCount": len(xml_nodes),
                "interfaceNamingRule": interface_rule,
                "fields": fields,
            }
        )
    return reports


def write_outputs(reports: list[dict[str, Any]]) -> None:
    payload = {
        "sourceDoc": str(SOURCE_DOC),
        "sourceDocTitle": "金融机构外汇业务数据采集规范（1.4版）",
        "scope": "第六章 数据接口格式",
        "tableCount": len(reports),
        "fieldCount": sum(report["fieldCount"] for report in reports),
        "reports": reports,
    }
    OUTPUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "# SAFE_MESSAGE 监管 XML 节点整理",
        "",
        f"- 证据来源：`{SOURCE_DOC}`",
        "- 证据范围：第六章「数据接口格式」中的数据格式 XML 示例与数据字典表。",
        "- 处理原则：每个 XML 节点作为一个字段元；字段英文名使用 XML 路径，例如 `REC.ACTIONTYPE`。",
        "- 类型规则：监管原始类型保存在「格式」和 `extra.rawType`；字段类型规范化为 `string`、`decimal`、`date`、`datetime`、`xml_node` 或 `待确认`。",
        "",
        "## 汇总",
        "",
        "| 报文数 | 字段数 |",
        "| --- | --- |",
        f"| {payload['tableCount']} | {payload['fieldCount']} |",
        "",
        "## 报文清单",
        "",
        "| 序号 | 英文表名 | 中文表名 | 分组 | XML节点数 | 字段数 |",
        "| --- | --- | --- | --- | ---: | ---: |",
    ]
    for index, report in enumerate(reports, 1):
        lines.append(
            f"| {index} | `{report['tableName']}` | {report['tableCn']} | {report['group']} | {report['xmlNodeCount']} | {report['fieldCount']} |"
        )
    for index, report in enumerate(reports, 1):
        lines.extend(
            [
                "",
                f"## {index}. {report['tableCn']}",
                "",
                f"- 英文表名：`{report['tableName']}`",
                f"- 发文表序号：`{report['tableIndex']}`",
                f"- 分组：{report['group']}",
                "",
                "| 序号 | XML路径 | 中文名 | 类型 | 长度 | 格式/原始类型 | 说明/校验 |",
                "| ---: | --- | --- | --- | --- | --- | --- |",
            ]
        )
        for field in report["fields"]:
            desc = field["description"].replace("|", "｜")
            lines.append(
                f"| {field['order']} | `{field['fieldName']}` | {field['fieldCn']} | `{field['fieldType']}` | {field['fieldLength'] or '-'} | {field['formatPattern'] or '-'} | {desc or '-'} |"
            )
    OUTPUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    reports = parse_doc()
    write_outputs(reports)
    print(json.dumps({"tables": len(reports), "fields": sum(report["fieldCount"] for report in reports), "markdown": str(OUTPUT_MD), "json": str(OUTPUT_JSON)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
