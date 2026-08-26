from pathlib import Path

from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


OUT_DIR = Path("/Users/binkerking/Documents/Ai-WorkSpace/Rich/outputs/vtb-safe2-mapping-20260821/flowchart_preview")
ZH_PDF = OUT_DIR / "VTB_SAFE2_Data_Flow_CN.pdf"
EN_PDF = OUT_DIR / "VTB_SAFE2_Data_Flow_EN.pdf"

W, H = 2850, 2500

C = {
    "bg": "#FFFFFF",
    "lane": "#F8FAFC",
    "text": "#0F172A",
    "sub": "#475569",
    "border": "#334155",
    "source": "#E8F3FF",
    "stage": "#EAF7EA",
    "input": "#F1F5F9",
    "middle": "#FFF3C4",
    "report": "#F0E7FF",
    "message": "#FFE8E8",
    "acc": "#2563EB",
    "bop": "#7C3AED",
    "cfa": "#059669",
    "exd": "#0891B2",
    "fal": "#D97706",
    "jsh": "#DC2626",
    "muted": "#64748B",
}


def hx(name):
    return colors.HexColor(C[name] if name in C else name)


def register_fonts():
    font = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
    pdfmetrics.registerFont(TTFont("AppSans", font))


def ytop(y):
    return H - y


def rect(c, x, y, w, h, fill, stroke="border", radius=10, sw=1.2):
    c.setStrokeColor(hx(stroke))
    c.setFillColor(hx(fill))
    c.setLineWidth(sw)
    c.roundRect(x, H - y - h, w, h, radius, stroke=1, fill=1)


def text(c, s, x, y, size=14, fill="text", bold=False):
    c.setFillColor(hx(fill))
    c.setFont("AppSans", size)
    c.drawString(x, H - y, s)


def node(c, spec):
    x, y, w, h, title, sub, kind = spec
    rect(c, x, y, w, h, kind)
    lines = str(title).split("\n")
    sub_lines = str(sub).split("\n")
    ty = y + 26
    for i, line in enumerate(lines):
        text(c, line, x + 15, ty + i * 20, 18, "text", True)
    sy = ty + len(lines) * 21
    for i, line in enumerate(sub_lines):
        text(c, line, x + 15, sy + i * 17, 12.5, "sub")


def right(nodes, node_id):
    x, y, w, h = nodes[node_id][:4]
    return x + w, y + h / 2


def left(nodes, node_id):
    x, y, w, h = nodes[node_id][:4]
    return x, y + h / 2


def draw_arrow(c, x1, y1, x2, y2, color, dashed=False):
    c.setStrokeColor(hx(color))
    c.setFillColor(hx(color))
    c.setLineWidth(2.8)
    if dashed:
        c.setDash(8, 7)
    else:
        c.setDash()
    c.line(x1, H - y1, x2, H - y2)
    c.setDash()
    arrowhead(c, x2, y2, color)


def arrowhead(c, x, y, color):
    c.setFillColor(hx(color))
    p = c.beginPath()
    p.moveTo(x, H - y)
    p.lineTo(x - 15, H - y + 6)
    p.lineTo(x - 15, H - y - 6)
    p.close()
    c.drawPath(p, stroke=0, fill=1)


def edge(c, nodes, from_id, to_id, label, color, dashed=False):
    x1, y1 = right(nodes, from_id)
    x2, y2 = left(nodes, to_id)
    end_x = x2 - 18
    gap = x2 - x1
    mid = x1 + max(44, min(165, gap * 0.5))
    if abs(y1 - y2) < 2:
        draw_arrow(c, x1, y1, end_x, y2, color, dashed)
    else:
        c.setStrokeColor(hx(color))
        c.setLineWidth(2.8)
        c.setDash(8, 7) if dashed else c.setDash()
        p = c.beginPath()
        p.moveTo(x1, H - y1)
        p.lineTo(mid, H - y1)
        p.lineTo(mid, H - y2)
        p.lineTo(end_x, H - y2)
        c.drawPath(p, stroke=1, fill=0)
        c.setDash()
        arrowhead(c, end_x, y2, color)
    label_width = max(48, min(180, len(label) * 7.8))
    lx = max(x1 + 12, x2 - label_width - 18)
    target_top = nodes[to_id][1]
    ly = target_top - 8
    text(c, label, lx, ly, 11.5, color)


def lane(c, name, y, h, color):
    rect(c, 34, y, W - 68, h, "lane", "#CBD5E1", 18, 0.8)
    rect(c, 34, y, 48, h, color, color, 18, 0)
    c.saveState()
    c.translate(59, H - (y + h / 2))
    c.rotate(90)
    c.setFillColor(colors.white)
    c.setFont("AppSans", 18)
    c.drawCentredString(0, -6, name)
    c.restoreState()


def build(lang):
    is_en = lang == "en"
    title = "VTB 二代SAFE 数据流转说明" if not is_en else "VTB SAFE 2 Data Flow"

    columns = (
        [(116, "源文件层"), (488, "贴源层"), (588, "中间/过程层"), (1458, "报表层"), (2398, "报文层")]
        if not is_en
        else [(116, "Source Files"), (488, "Stage"), (588, "Middle / Process"), (1458, "Report"), (2398, "Message")]
    )

    nodes = {
        "AIF2": [126, 175, 220, 64, "AIF2.TXT", "账户源文件" if not is_en else "Account file", "source"],
        "BLN2": [126, 260, 220, 64, "BLN2.TXT", "余额源文件" if not is_en else "Balance file", "source"],
        "CIF2": [126, 345, 220, 64, "CIF2.TXT", "客户源文件" if not is_en else "Customer file", "source"],
        "TRN2": [126, 430, 220, 64, "TRN2.TXT", "交易源文件" if not is_en else "Transaction file", "source"],
        "AifTab": [490, 175, 240, 64, "AifTab", "账户贴源表" if not is_en else "Account stage table", "stage"],
        "BlnTab": [490, 260, 240, 64, "BlnTab", "余额贴源表" if not is_en else "Balance stage table", "stage"],
        "CifTab": [490, 345, 240, 64, "CifTab", "客户贴源表" if not is_en else "Customer stage table", "stage"],
        "TransactionTab": [490, 430, 240, 64, "TransactionTab", "交易贴源表" if not is_en else "Transaction stage table", "stage"],

        "ACCIn": [126, 665, 300, 76, "贴源输入" if not is_en else "Stage Input", "AIF + BLN + CIF + TRN", "input"],
        "ACCProc": [590, 665, 360, 76, "ACC 加工过程" if not is_en else "ACC Process", "账户/余额报表抽取" if not is_en else "Account and balance extraction", "middle"],
        "ACCCA": [1140, 625, 310, 70, "T_SAFE_ACCCA", "账户开关户信息" if not is_en else "Account open/close", "report"],
        "ACCCB": [1140, 710, 310, 70, "T_SAFE_ACCCB", "账户收支余信息" if not is_en else "Account flow/balance", "report"],
        "MACCCA": [2400, 625, 230, 70, "ACCCA", "账户开关户 XML" if not is_en else "Account open/close XML", "message"],
        "MACCCB": [2400, 710, 230, 70, "ACCCB", "账户收支余 XML" if not is_en else "Account flow/balance XML", "message"],

        "BOPIn": [126, 910, 300, 76, "贴源输入" if not is_en else "Stage Input", "TRN + AIF + CIF", "input"],
        "BOPMid": [590, 910, 360, 76, "BopTransaction", "涉外收支待判定前置" if not is_en else "BOP pre-classification", "middle"],
        "BOPRpt": [1140, 895, 350, 106, "BOPA/BOPB/BOPC\nBOPD/BOPE/BOPF", "当前未确认 VTB 自动生成正式报表" if not is_en else "Not confirmed as VTB auto reports", "report"],
        "MBOP": [2400, 910, 250, 76, "BOP XML", "当前未纳入 VTB 自动报送" if not is_en else "Not in VTB auto submission", "message"],

        "CFAIn": [126, 1160, 300, 76, "贴源输入" if not is_en else "Stage Input", "TRN + AIF + CIF + BLN", "input"],
        "CFACATab": [590, 1070, 360, 70, "CFACATab", "国内外汇贷款签约前置" if not is_en else "Domestic FX loan contract pre-table", "middle"],
        "CFACBTab": [590, 1155, 360, 70, "CFACBTab", "国内外汇贷款变动前置" if not is_en else "Domestic FX loan change pre-table", "middle"],
        "CFADATab": [590, 1240, 360, 70, "CFADATab", "外保内贷签约前置" if not is_en else "External guarantee contract pre-table", "middle"],
        "CFADBTab": [590, 1325, 360, 70, "CFADBTab", "外保内贷变动前置" if not is_en else "External guarantee change pre-table", "middle"],
        "Fogu": [980, 1240, 330, 70, "fogu_code_infos_tab", "境外担保人明细前置" if not is_en else "Overseas guarantor detail pre-table", "middle"],
        "CFACA": [1460, 1070, 310, 70, "T_SAFE_CFAC_A", "国内外汇贷款签约" if not is_en else "Domestic FX loan contract", "report"],
        "CFACB": [1460, 1155, 310, 70, "T_SAFE_CFAC_B", "国内外汇贷款变动" if not is_en else "Domestic FX loan change", "report"],
        "CFADA": [1460, 1240, 310, 70, "T_SAFE_CFAD_A", "外保内贷签约" if not is_en else "External guarantee contract", "report"],
        "CFADB": [1460, 1325, 310, 70, "T_SAFE_CFAD_B", "外保内贷变动/履约" if not is_en else "External guarantee change/performance", "report"],
        "CFADFogu": [1460, 1410, 310, 70, "T_SAFE_CFADA_FOGUCODEINFO", "境外担保人信息子表" if not is_en else "Overseas guarantor child table", "report"],
        "MCFACA": [2400, 1070, 230, 70, "CFACA", "国内外汇贷款签约 XML" if not is_en else "Domestic FX loan contract XML", "message"],
        "MCFACB": [2400, 1155, 230, 70, "CFACB", "国内外汇贷款变动 XML" if not is_en else "Domestic FX loan change XML", "message"],
        "MCFADA": [2400, 1240, 230, 70, "CFADA", "外保内贷签约 XML" if not is_en else "External guarantee contract XML", "message"],
        "MCFADB": [2400, 1325, 230, 70, "CFADB", "外保内贷变动 XML" if not is_en else "External guarantee change XML", "message"],

        "EXDIn": [126, 1585, 300, 76, "贴源输入" if not is_en else "Stage Input", "AIF + BLN + CIF", "input"],
        "EXDProc": [590, 1585, 420, 76, "EXD N/S 加工过程" if not is_en else "EXD N/S Process", "二代替代一代 CFAAN/CFAAS 承载角色" if not is_en else "Replaces one-gen CFAAN/CFAAS carrier role", "middle"],
        "EXDN": [1460, 1545, 330, 70, "T_SAFE_EXDA_N", "替代一代 CFAAN，生成 EXDAN" if not is_en else "Replaces CFAAN; generates EXDAN", "report"],
        "EXDS": [1460, 1630, 330, 70, "T_SAFE_EXDA_S", "替代一代 CFAAS，生成 EXDAS" if not is_en else "Replaces CFAAS; generates EXDAS", "report"],
        "MEXDAN": [2400, 1545, 230, 70, "EXDAN", "外债签约 XML" if not is_en else "External debt contract XML", "message"],
        "MEXDAS": [2400, 1630, 230, 70, "EXDAS", "外债变动 XML" if not is_en else "External debt change XML", "message"],

        "FALIn": [126, 1860, 300, 76, "贴源/报表输入" if not is_en else "Stage / Report Input", "TRN + AIF + CIF + BLN\nEXD N/S + CFA 支撑" if not is_en else "TRN + AIF + CIF + BLN\nEXD N/S + CFA support", "input"],
        "FalWarehouse": [590, 1860, 360, 76, "FalWarehouse", "FAL 白名单加工仓" if not is_en else "FAL whitelist warehouse", "middle"],
        "FALZB": [1460, 1775, 310, 70, "T_SAFE_FAL_Z02", "Z02 业务概览" if not is_en else "Z02 business overview", "report"],
        "FALDB": [1460, 1860, 310, 70, "T_SAFE_FALD_02", "D02 贷款" if not is_en else "D02 loans", "report"],
        "FALDE": [1460, 1945, 310, 70, "T_SAFE_FALD_0501", "D05-1 境外机构存款" if not is_en else "D05-1 overseas institution deposits", "report"],
        "FALDK": [1460, 2030, 310, 70, "T_SAFE_FALD_09", "D09 减值准备余额" if not is_en else "D09 impairment allowance balance", "report"],
        "FALFA": [1460, 2115, 310, 70, "T_SAFE_FALF_01", "F01 出口票据单证" if not is_en else "F01 export bills/documents", "report"],
        "MFALZB": [2400, 1775, 230, 70, "FALZB", "Z02 XML", "message"],
        "MFALDB": [2400, 1860, 230, 70, "FALDB", "D02 XML", "message"],
        "MFALDE": [2400, 1945, 230, 70, "FALDE", "D05-1 XML", "message"],
        "MFALDK": [2400, 2030, 230, 70, "FALDK", "D09 XML", "message"],
        "MFALFA": [2400, 2115, 230, 70, "FALFA", "F01 XML", "message"],

        "JSHIn": [126, 2330, 300, 76, "贴源输入" if not is_en else "Stage Input", "TRN + AIF + CIF", "input"],
        "FAEBaseInfo": [590, 2288, 360, 70, "FAEBaseInfo", "结售汇基础前置" if not is_en else "FX settlement/sale base pre-table", "middle"],
        "FAEManage": [590, 2373, 360, 70, "FAEManage", "结汇资金用途明细" if not is_en else "FX settlement purpose detail", "middle"],
        "JSHD": [1460, 2245, 310, 70, "T_SAFE_JSHD", "结汇基础信息" if not is_en else "FX settlement base info", "report"],
        "JSHF": [1460, 2330, 310, 70, "T_SAFE_JSHD_F", "结汇管理信息" if not is_en else "FX settlement management info", "report"],
        "JSHE": [1460, 2415, 310, 70, "T_SAFE_JSHE", "购汇基础信息" if not is_en else "FX purchase base info", "report"],
        "MJSHD": [2400, 2245, 230, 70, "JSHD", "结汇基础 XML" if not is_en else "FX settlement base XML", "message"],
        "MJSHF": [2400, 2330, 230, 70, "JSHF", "结汇管理 XML" if not is_en else "FX settlement management XML", "message"],
        "MJSHE": [2400, 2415, 230, 70, "JSHE", "购汇基础 XML" if not is_en else "FX purchase base XML", "message"],
    }

    lanes = (
        [("源文件入库", 145, 395, "muted"), ("ACC", 595, 230, "acc"), ("BOP", 850, 200, "bop"), ("CFA", 1025, 510, "cfa"), ("EXD", 1530, 220, "exd"), ("FAL", 1745, 465, "fal"), ("JSH", 2205, 290, "jsh")]
        if not is_en
        else [("Source Load", 145, 395, "muted"), ("ACC", 595, 230, "acc"), ("BOP", 850, 200, "bop"), ("CFA", 1025, 510, "cfa"), ("EXD", 1530, 220, "exd"), ("FAL", 1745, 465, "fal"), ("JSH", 2205, 290, "jsh")]
    )

    edges = [
        ("AIF2", "AifTab", "1:1 入库" if not is_en else "1:1 load", "muted"),
        ("BLN2", "BlnTab", "1:1 入库" if not is_en else "1:1 load", "muted"),
        ("CIF2", "CifTab", "1:1 入库" if not is_en else "1:1 load", "muted"),
        ("TRN2", "TransactionTab", "1:1 入库" if not is_en else "1:1 load", "muted"),
        ("ACCIn", "ACCProc", "输入贴源表" if not is_en else "stage input", "acc"),
        ("ACCProc", "ACCCA", "AIF+CIF", "acc"),
        ("ACCProc", "ACCCB", "BLN+TRN+ACCCA", "acc"),
        ("ACCCA", "MACCCA", "XML", "acc"),
        ("ACCCB", "MACCCB", "XML", "acc"),
        ("BOPIn", "BOPMid", "TRN加工" if not is_en else "TRN process", "bop"),
        ("BOPMid", "BOPRpt", "待确认" if not is_en else "to confirm", "bop", True),
        ("BOPRpt", "MBOP", "未纳入" if not is_en else "not included", "bop", True),
        ("CFAIn", "CFACATab", "贷款签约" if not is_en else "loan contract", "cfa"),
        ("CFAIn", "CFACBTab", "贷款变动" if not is_en else "loan change", "cfa"),
        ("CFAIn", "CFADATab", "外保内贷签约" if not is_en else "EG contract", "cfa"),
        ("CFAIn", "CFADBTab", "外保内贷变动" if not is_en else "EG change", "cfa"),
        ("CFADATab", "Fogu", "担保人明细" if not is_en else "guarantor detail", "cfa"),
        ("CFACATab", "CFACA", "前置转正式" if not is_en else "pre to final", "cfa"),
        ("CFACBTab", "CFACB", "前置转正式" if not is_en else "pre to final", "cfa"),
        ("CFADATab", "CFADA", "前置转正式" if not is_en else "pre to final", "cfa"),
        ("CFADBTab", "CFADB", "前置转正式" if not is_en else "pre to final", "cfa"),
        ("Fogu", "CFADFogu", "明细转正式" if not is_en else "detail to final", "cfa"),
        ("CFACA", "MCFACA", "XML", "cfa"),
        ("CFACB", "MCFACB", "XML", "cfa"),
        ("CFADA", "MCFADA", "子节点" if not is_en else "child node", "cfa"),
        ("CFADFogu", "MCFADA", "子节点" if not is_en else "child node", "cfa"),
        ("CFADB", "MCFADB", "XML", "cfa"),
        ("EXDIn", "EXDProc", "迁移CFAAN/CFAAS逻辑" if not is_en else "migrate CFAAN/CFAAS logic", "exd"),
        ("EXDProc", "EXDN", "N: CFAAN角色" if not is_en else "N: CFAAN role", "exd"),
        ("EXDProc", "EXDS", "S: CFAAS角色" if not is_en else "S: CFAAS role", "exd"),
        ("EXDN", "MEXDAN", "XML", "exd"),
        ("EXDS", "MEXDAS", "XML", "exd"),
        ("FALIn", "FalWarehouse", "白名单加工" if not is_en else "whitelist process", "fal"),
        ("FalWarehouse", "FALZB", "Z02", "fal"),
        ("FalWarehouse", "FALDB", "D02", "fal"),
        ("FalWarehouse", "FALDE", "D05-1", "fal"),
        ("FalWarehouse", "FALDK", "D09", "fal"),
        ("FalWarehouse", "FALFA", "F01", "fal"),
        ("FALZB", "MFALZB", "XML", "fal"),
        ("FALDB", "MFALDB", "XML", "fal"),
        ("FALDE", "MFALDE", "XML", "fal"),
        ("FALDK", "MFALDK", "XML", "fal"),
        ("FALFA", "MFALFA", "XML", "fal"),
        ("JSHIn", "FAEBaseInfo", "基础信息" if not is_en else "base info", "jsh"),
        ("JSHIn", "FAEManage", "用途明细" if not is_en else "purpose detail", "jsh"),
        ("FAEBaseInfo", "JSHD", "基础信息" if not is_en else "base info", "jsh"),
        ("FAEManage", "JSHF", "管理信息" if not is_en else "management info", "jsh"),
        ("FAEBaseInfo", "JSHE", "购汇基础" if not is_en else "purchase base", "jsh"),
        ("JSHD", "MJSHD", "XML", "jsh"),
        ("JSHF", "MJSHF", "XML", "jsh"),
        ("JSHE", "MJSHE", "XML", "jsh"),
    ]
    return title, columns, nodes, lanes, edges


def render_pdf(path, lang):
    title, columns, nodes, lanes, edges = build(lang)
    c = canvas.Canvas(str(path), pagesize=(W, H))
    c.setFillColor(hx("bg"))
    c.rect(0, 0, W, H, fill=1, stroke=0)
    text(c, title, 72, 60, 32, "text", True)
    for x, label in columns:
        rect(c, x, 100, 250, 42, "#0F172A", "#0F172A", 9, 0)
        c.setFillColor(colors.white)
        c.setFont("AppSans", 18)
        c.drawString(x + 18, H - 128, label)
    for spec in lanes:
        lane(c, *spec)
    for e in edges:
        edge(c, nodes, *e)
    for spec in nodes.values():
        node(c, spec)
    c.showPage()
    c.save()


if __name__ == "__main__":
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    register_fonts()
    render_pdf(ZH_PDF, "zh")
    render_pdf(EN_PDF, "en")
    print(ZH_PDF)
    print(EN_PDF)
