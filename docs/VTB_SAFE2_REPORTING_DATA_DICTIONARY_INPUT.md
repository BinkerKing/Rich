# 二代 SAFE 产品报表层数据字典整理

| 项目 | 内容 |
| --- | --- |
| 整理范围 | CFA、EXD、FAL、ACC、JSH、BOP 六个模块的二代 SAFE 业务报表/报文承载表 |
| 本版边界 | 按用户要求暂不整理 Mapping 逻辑；字段来源、加工来源、上下游无可靠证据处写待确认 |
| 主要证据 | 本地 SQL Server `safe` 数据库 `sys.tables`、`sys.columns`、`sys.extended_properties`；本地 SAFE V1.4.8.0 数据库说明书/既有审计文档用于范围交叉校验 |
| 生成日期 | 2026-08-20 |

## 1. 库元

| 库编码 | 库名称 | 系统类型 | 资产层级 | 用途说明 | 连接信息 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SAFE_REPORTING | 二代 SAFE 报表层 | reporting | 报表层 | 承载 SAFE 各监管模块的数据维护、报文生成前数据结构及报表口径字段 | `127.0.0.1:1433/safe` | SQL Server `safe` 数据库元数据；`RIKING-DEV-TEC-SAFE系统V1.4.8.0 数据库说明书.xlsx` | 本文先整理字段设计，不整理 Mapping |

## 2. 表元清单

| 所属库 | 英文名 | 中文名 | 分组 | 数据层级 | 载体类型 | 表口径 | 生成方式 | 上游来源 | 下游去向 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SAFE_REPORTING | T_SAFE_CFAB_A | [报表]对外担保—签约信息 | 资本项目 | 报表层 | 数据库 | 对外担保—签约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_CFAB_B | [报表]对外担保—责任余额信息 | 资本项目 | 报表层 | 数据库 | 对外担保—责任余额信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_CFAB_C | [报表]对外担保-履约信息 | 资本项目 | 报表层 | 数据库 | 对外担保-履约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_CFABA_BENEFICIARY | [报表]对外担保—受益人信息 | 资本项目 | 报表层 | 数据库 | 对外担保—受益人信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_CFABA_COUNGUAR | [报表]对外担保—反担保人信息 | 资本项目 | 报表层 | 数据库 | 对外担保—反担保人信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_CFABA_GUARANTOR | [报表]对外担保—被担保人信息 | 资本项目 | 报表层 | 数据库 | 对外担保—被担保人信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_CFAC_A | [报表]国内外汇贷款—签约信息 | 资本项目 | 报表层 | 数据库 | 国内外汇贷款—签约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_CFAC_B | [报表]国内外汇贷款—变动信息 | 资本项目 | 报表层 | 数据库 | 国内外汇贷款—变动信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_CFAD_A | [报表]境外担保项下境内贷款—签约信息 | 资本项目 | 报表层 | 数据库 | 境外担保项下境内贷款—签约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_CFAD_B | [报表]境外担保项下境内贷款—变动及履约信息 | 资本项目 | 报表层 | 数据库 | 境外担保项下境内贷款—变动及履约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_CFADA_FOGUCODEINFO | [报表]境外担保项下境内贷款—境外担保人信息 | 资本项目 | 报表层 | 数据库 | 境外担保项下境内贷款—境外担保人信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_CFAE_A | [报表]外汇质押人民币贷款—签约信息 | 资本项目 | 报表层 | 数据库 | 外汇质押人民币贷款—签约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_CFAE_B | [报表]外汇质押人民币贷款—变动信息 | 资本项目 | 报表层 | 数据库 | 外汇质押人民币贷款—变动信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_CFAEA_EXPLCURRINFO | [报表]外汇质押人民币贷款—质押外汇币种信息 | 资本项目 | 报表层 | 数据库 | 外汇质押人民币贷款—质押外汇币种信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_CFAEB_EXPLBALAINFO | [报表]外汇质押人民币贷款—质押外汇币种信息 | 资本项目 | 报表层 | 数据库 | 外汇质押人民币贷款—质押外汇币种信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_CFAF_A | [报表]商业银行人民币结构性存款—签约信息 | 资本项目 | 报表层 | 数据库 | 商业银行人民币结构性存款—签约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_CFAF_B | [报表]商业银行人民币结构性存款—终止信息 | 资本项目 | 报表层 | 数据库 | 商业银行人民币结构性存款—终止信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_CFAF_C | [报表]商业银行人民币结构性存款—利息给付信息 | 资本项目 | 报表层 | 数据库 | 商业银行人民币结构性存款—利息给付信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_CFAF_D | [报表]商业银行人民币结构性存款—资金流出入和结购汇信息 | 资本项目 | 报表层 | 数据库 | 商业银行人民币结构性存款—资金流出入和结购汇信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_EXDA_A | [报表]外债双边贷款—签约信息 | 银行自身外债 | 报表层 | 数据库 | 外债双边贷款—签约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_EXDA_B | [报表]外债买方信贷—签约信息 | 银行自身外债 | 报表层 | 数据库 | 外债买方信贷—签约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_EXDA_C | [报表]外债境外拆借—签约信息 | 银行自身外债 | 报表层 | 数据库 | 外债境外拆借—签约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_EXDA_D | [报表]外债海外代付—签约信息 | 银行自身外债 | 报表层 | 数据库 | 外债海外代付—签约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_EXDA_E | [报表]外债卖出回购—签约信息 | 银行自身外债 | 报表层 | 数据库 | 外债卖出回购—签约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_EXDA_F | [报表]外债远期信用证（含即期单证相符）—签约信息 | 银行自身外债 | 报表层 | 数据库 | 外债远期信用证（含即期单证相符）—签约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_EXDA_G | [报表]外债银团贷款—签约信息 | 银行自身外债 | 报表层 | 数据库 | 外债银团贷款—签约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_EXDA_H | [报表]外债贵金属拆借—签约信息 | 银行自身外债 | 报表层 | 数据库 | 外债贵金属拆借—签约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_EXDA_I | [报表]外债其他贷款—签约信息 | 银行自身外债 | 报表层 | 数据库 | 外债其他贷款—签约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_EXDA_J | [报表]外债货币市场工具—签约信息 | 银行自身外债 | 报表层 | 数据库 | 外债货币市场工具—签约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_EXDA_K | [报表]外债债券和票据—签约信息 | 银行自身外债 | 报表层 | 数据库 | 外债债券和票据—签约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_EXDA_L | [报表]外债境外同业存放—签约信息 | 银行自身外债 | 报表层 | 数据库 | 外债境外同业存放—签约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_EXDA_M | [报表]外债境外联行及附属机构往来—签约信息 | 银行自身外债 | 报表层 | 数据库 | 外债境外联行及附属机构往来—签约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_EXDA_N | [报表]外债非居民机构存款—签约信息 | 银行自身外债 | 报表层 | 数据库 | 外债非居民机构存款—签约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_EXDA_P | [报表]外债非居民个人存款—签约信息 | 银行自身外债 | 报表层 | 数据库 | 外债非居民个人存款—签约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_EXDA_Q | [报表]外债其他外债—签约信息 | 银行自身外债 | 报表层 | 数据库 | 外债其他外债—签约信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_EXDA_R | [报表]外债—变动信息 | 银行自身外债 | 报表层 | 数据库 | 外债—变动信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_EXDA_S | [报表]外债—余额信息 | 银行自身外债 | 报表层 | 数据库 | 外债—余额信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_EXDAA_PROJECT | 待确认 | 银行自身外债 | 报表层 | 数据库 | 待确认 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_EXDAB_PROJECT | 待确认 | 银行自身外债 | 报表层 | 数据库 | 待确认 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_EXDAG_PROJECT | 待确认 | 银行自身外债 | 报表层 | 数据库 | 待确认 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_A0101 | [报表]A0101-对外直接投资 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | A0101-对外直接投资 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_A0102 | [报表]A0102-对外直接投资(流量) | 对外金融资产负债及交易统计 | 报表层 | 数据库 | A0102-对外直接投资(流量) | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_A0201 | [报表]A0201-外国来华直接投资 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | A0201-外国来华直接投资 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_A0202 | [报表]A0202-境外直接投资者名录 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | A0202-境外直接投资者名录 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_A0203 | [报表]A0203-外国来华直接投资(流量) | 对外金融资产负债及交易统计 | 报表层 | 数据库 | A0203-外国来华直接投资(流量) | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_E01 | 待确认 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | 待确认 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_E0101 | [报表]E01-1表：货物出口及相关贸易信贷 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | E01-1表：货物出口及相关贸易信贷 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_E0102 | [报表]E01-2表：货物进口及相关贸易信贷 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | E01-2表：货物进口及相关贸易信贷 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_E0103 | [报表]E01-3表：货物进出口商品类别调查表（年度）（仅贸易信贷调查主体填写） | 对外金融资产负债及交易统计 | 报表层 | 数据库 | E01-3表：货物进出口商品类别调查表（年度）（仅贸易信贷调查主体填写） | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_E0104 | [报表]E01-4表：货物进出口商品类别调查表（年度）（仅贸易信贷调查主体填写） | 对外金融资产负债及交易统计 | 报表层 | 数据库 | E01-4表：货物进出口商品类别调查表（年度）（仅贸易信贷调查主体填写） | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_E0201 | [报表]E0201-境外建设项目概览表 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | E0201-境外建设项目概览表 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_E0202 | [报表]E0202-境外建设统计表 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | E0202-境外建设统计表 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_E03 | 待确认 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | 待确认 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_E0301 | [报表]E03-1表：境内承运人国际运输收入统计表（仅国际运输调查主体填写） | 对外金融资产负债及交易统计 | 报表层 | 数据库 | E03-1表：境内承运人国际运输收入统计表（仅国际运输调查主体填写） | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_E0302 | [报表]E03-2表：境内承运人国际运输支出统计表（仅国际运输调查主体填写） | 对外金融资产负债及交易统计 | 报表层 | 数据库 | E03-2表：境内承运人国际运输支出统计表（仅国际运输调查主体填写） | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_E0303 | [报表]E03-3表：外资承运人国际运输服务统计表（仅国际运输调查主体填写） | 对外金融资产负债及交易统计 | 报表层 | 数据库 | E03-3表：外资承运人国际运输服务统计表（仅国际运输调查主体填写） | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_E0304 | [报表]E03-4表：油气类进口运费统计表 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | E03-4表：油气类进口运费统计表 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_E04 | [报表]E04表：服务、雇员报酬、债务减免等其他各类往来 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | E04表：服务、雇员报酬、债务减免等其他各类往来 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_E09 | [报表]E09表：国际贸易集中申报报表（适用于集约申报主体） | 对外金融资产负债及交易统计 | 报表层 | 数据库 | E09表：国际贸易集中申报报表（适用于集约申报主体） | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_I01 | [报表]I01-为非居民提供直接保险服务 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | I01-为非居民提供直接保险服务 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_I02 | [报表]I02-为非居民提供再保险服务（分入保险） | 对外金融资产负债及交易统计 | 报表层 | 数据库 | I02-为非居民提供再保险服务（分入保险） | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_I03 | [报表]I03-从非居民保险机构获得再保险服务（分出保险） | 对外金融资产负债及交易统计 | 报表层 | 数据库 | I03-从非居民保险机构获得再保险服务（分出保险） | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_Z01 | [报表]Z01-单位基本信息 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | Z01-单位基本信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_Z02 | [报表]Z02-业务概览及联系方式 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | Z02-业务概览及联系方式 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FAL_Z03 | [报表]Z03-填报单位投资关系 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | Z03-填报单位投资关系 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALB_01 | [报表]B01-投资境外证券和基金 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | B01-投资境外证券和基金 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALB_02 | [报表]B02-投资境外债务证券（资产） | 对外金融资产负债及交易统计 | 报表层 | 数据库 | B02-投资境外债务证券（资产） | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALB_03 | [报表]B03-投资非居民境内证券 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | B03-投资非居民境内证券 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALB_04 | [报表]B04-吸收境外股权和投资 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | B04-吸收境外股权和投资 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALB_05 | [报表]B05-境外发行债务证券 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | B05-境外发行债务证券 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALB_06 | [报表]B06-非居民投资境内证券 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | B06-非居民投资境内证券 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALC_01 | [报表]C01-金融衍生产品及雇员认股权 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | C01-金融衍生产品及雇员认股权 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALD_01 | [报表]D01表：货币与存款 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | D01表：货币与存款 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALD_02 | [报表]D02表：贷款 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | D02表：贷款 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALD_03 | [报表]D03表：持有境外非公司制机构10%以下表决权和国际组织股权 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | D03表：持有境外非公司制机构10%以下表决权和国际组织股权 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALD_04 | [报表]D04表：应收款 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | D04表：应收款 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALD_0501 | [报表]D05_1表：存款--境外机构存款 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | D05_1表：存款--境外机构存款 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALD_0502 | [报表]D05_2表：存款--非居民个人存款 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | D05_2表：存款--非居民个人存款 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALD_0601 | [报表]D06_1表：贷款--月末存量 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | D06_1表：贷款--月末存量 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALD_0602 | [报表]D06-2表：贷款（含银行同业和联行拆借）（负债）——非登记外债 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | D06-2表：贷款（含银行同业和联行拆借）（负债）——非登记外债 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALD_07 | [报表]D07表：非居民持有本机构 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | D07表：非居民持有本机构 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALD_08 | [报表]D08表:应付款 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | D08表:应付款 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALD_09 | [报表]D09表：对非居民的贷款和应收款减值准备余额 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | D09表：对非居民的贷款和应收款减值准备余额 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALF_01 | [报表]F01-出口票据单证业务 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | F01-出口票据单证业务 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALF_02 | [报表]F02-出口票据单证业务 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | F02-出口票据单证业务 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALG_01 | [报表]G01-投资境外证券和基金 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | G01-投资境外证券和基金 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALG_02 | [报表]G02-投资境外证券和基金 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | G02-投资境外证券和基金 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALG_03 | [报表]G03-非居民持有境内银行卡的收入支出 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | G03-非居民持有境内银行卡的收入支出 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALH_01 | [报表]H01表：为非居民托管业务统计（QFII、RQFII相关） | 对外金融资产负债及交易统计 | 报表层 | 数据库 | H01表：为非居民托管业务统计（QFII、RQFII相关） | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALH_02 | [报表]H02表：为居民托管业务统计（QDII、RQDII相关） | 对外金融资产负债及交易统计 | 报表层 | 数据库 | H02表：为居民托管业务统计（QDII、RQDII相关） | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_FALX_01 | [报表]X01-银行进出口贸易融资余额 | 对外金融资产负债及交易统计 | 报表层 | 数据库 | X01-银行进出口贸易融资余额 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_ACCCA | [报表]外汇账户_账户开关户信息 | 外汇账户 | 报表层 | 数据库 | 外汇账户_账户开关户信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_ACCCB | [报表]外汇账户_账户收支余信息 | 外汇账户 | 报表层 | 数据库 | 外汇账户_账户收支余信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_JSHD | [报表]结汇申请书—基础信息 | 外汇账户内结售汇 | 报表层 | 数据库 | 结汇申请书—基础信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_JSHD_F | [报表]结汇申请书—管理信息 | 外汇账户内结售汇 | 报表层 | 数据库 | 结汇申请书—管理信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_JSHE | [报表]购汇申请书—基础信息 | 外汇账户内结售汇 | 报表层 | 数据库 | 购汇申请书—基础信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_JSHE_G | [报表]购汇申请书—管理信息 | 外汇账户内结售汇 | 报表层 | 数据库 | 购汇申请书—管理信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_BOPA | [报表]涉外收入申报单_基础信息 | 国际收支 | 报表层 | 数据库 | 涉外收入申报单_基础信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_BOPA_G | [报表]涉外收入申报单_申报信息 | 国际收支 | 报表层 | 数据库 | 涉外收入申报单_申报信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_BOPB | [报表]境外汇款申请书_基础信息 | 国际收支 | 报表层 | 数据库 | 境外汇款申请书_基础信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_BOPB_H | [报表]境外汇款申请书_申报信息 | 国际收支 | 报表层 | 数据库 | 境外汇款申请书_申报信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_BOPB_N | [报表]境外汇款申请书_管理信息 | 国际收支 | 报表层 | 数据库 | 境外汇款申请书_管理信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_BOPC | [报表]对外付款/承兑通知书_基础信息 | 国际收支 | 报表层 | 数据库 | 对外付款/承兑通知书_基础信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_BOPC_K | [报表]对外付款/承兑通知书_申报信息 | 国际收支 | 报表层 | 数据库 | 对外付款/承兑通知书_申报信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_BOPC_P | [报表]对外付款/承兑通知书_管理信息 | 国际收支 | 报表层 | 数据库 | 对外付款/承兑通知书_管理信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_BOPD | [报表]境内收入申报单_基础信息 | 国际收支 | 报表层 | 数据库 | 境内收入申报单_基础信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_BOPD_R | [报表]境内收入申报单_管理信息 | 国际收支 | 报表层 | 数据库 | 境内收入申报单_管理信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_BOPE | [报表]境内汇款申请书_基础信息 | 国际收支 | 报表层 | 数据库 | 境内汇款申请书_基础信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_BOPE_Q | [报表]境内汇款申请书_管理信息 | 国际收支 | 报表层 | 数据库 | 境内汇款申请书_管理信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_BOPF | [报表]境内付款/承兑通知书_基础信息 | 国际收支 | 报表层 | 数据库 | 境内付款/承兑通知书_基础信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_BOPF_S | [报表]境内付款/承兑通知书_管理信息 | 国际收支 | 报表层 | 数据库 | 境内付款/承兑通知书_管理信息 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_BOPU | [报表]单位基本情况表 | 国际收支 | 报表层 | 数据库 | 单位基本情况表 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_BOPU_BANKINFO | [报表]单位基本情况表-开户行 | 国际收支 | 报表层 | 数据库 | 单位基本情况表-开户行 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |
| SAFE_REPORTING | T_SAFE_BOPU_INVCOUNTRYCODE | 待确认 | 国际收支 | 报表层 | 数据库 | 待确认 | 待确认 | 待确认 | 待确认 | SQL Server safe.sys.tables / extended_properties |  |

## 3. 字段清单

## 3.1 CFA 资本项目

### 表：T_SAFE_CFAB_A

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | CGYN | 是否有反担保人 | string | 1 | nvarchar(1) | 否 | 否 | 是否有反担保人 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | CONTRACTDATE | 签约日期 | datetime |  | datetime2 | 否 | 否 | 签约日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | EXGUARANCODE | 对外担保编号 | string | 28 | nvarchar(28) | 否 | 否 | 对外担保编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | GUAPPCODE | 担保申请人代码 | string | 32 | nvarchar(32) | 否 | 否 | 担保申请人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | GUAPPNAME | 担保申请人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 担保申请人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | GUAPPNAMEN | 担保申请人英文名称 | string | 128 | nvarchar(128) | 否 | 否 | 担保申请人英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | GUARANAMOUNT | 保函金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 保函金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | GUARANCURR | 保函币种 | string | 3 | nvarchar(3) | 否 | 否 | 保函币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | GUARANTYPE | 担保类型 | string | 4 | nvarchar(4) | 否 | 否 | 担保类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | GUARANTORCODE | 担保人代码 | string | 12 | nvarchar(12) | 否 | 否 | 担保人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | INTRAT | 借款利率（%） | decimal | 15,7 | decimal(15,7) | 否 | 否 | 借款利率（%） |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | JWYN | 是否与境外投资相关 1-是，0-否 | string | 1 | nvarchar(1) | 否 | 否 | 是否与境外投资相关 1-是，0-否 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | MAINDEBTMANNER | 发行/上市方式 | string | 12 | nvarchar(12) | 否 | 否 | 发行/上市方式 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | MAINDEBTMATURITY | 主债务到期日 | datetime |  | datetime2 | 否 | 否 | 主债务到期日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | MAINDEBTAMOUNT | 主债务金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 主债务金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | MAINDEBTCURR | 主债务币种 | string | 3 | nvarchar(3) | 否 | 否 | 主债务币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | MAINDEBTDATE | 主债务期限（日） | string | 5 | nvarchar(5) | 否 | 否 | 主债务期限（日） |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | MAINDEBTCONDATE | 主债务签约日期 | datetime |  | datetime2 | 否 | 否 | 主债务签约日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | MATURITY | 到期日 | datetime |  | datetime2 | 否 | 否 | 到期日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | RETURNTYPEFUNDS | 主债务合同资金用途 | string | 20 | nvarchar(20) | 否 | 否 | 主债务合同资金用途 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | THJE | 资金调回金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 资金调回金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | THYN | 是否调回境内 1-是，0-否 | string | 1 | nvarchar(1) | 否 | 否 | 是否调回境内 1-是，0-否 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_CFAB_B

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BASERE | 担保责任余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 担保责任余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | CFABAID | 对外担保签约信息ID | string | 255 | nvarchar(255) | 否 | 否 | 对外担保签约信息ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | EXGUARANCODE | 对外担保编号 | string | 28 | nvarchar(28) | 否 | 否 | 对外担保编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | WABACHANDATE | 担保责任余额变动日期 | datetime |  | datetime2 | 否 | 否 | 担保责任余额变动日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_CFAB_C

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BENAME | 受益人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 受益人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | BENAMEN | 受益人英文名称 | string | 128 | nvarchar(128) | 否 | 否 | 受益人英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | BENCODE | 受益人代码 | string | 32 | nvarchar(32) | 否 | 否 | 受益人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | BUSCODE | 银行业务参号 | string | 32 | nvarchar(32) | 否 | 否 | 银行业务参号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CFABAID | 对外担保签约信息ID | string | 255 | nvarchar(255) | 否 | 否 | 对外担保签约信息ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | COMPLIANCENO | 履约编号 | string | 4 | nvarchar(4) | 否 | 否 | 履约编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | EXGUARANCODE | 对外担保编号 | string | 28 | nvarchar(28) | 否 | 否 | 对外担保编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | GUARANTORCODE | 担保人代码 | string | 12 | nvarchar(12) | 否 | 否 | 担保人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | GUPERAMOUNT | 履约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 履约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | GUPERCURR | 履约币种 | string | 3 | nvarchar(3) | 否 | 否 | 履约币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | GUPERDATE | 履约日期 | datetime |  | datetime2 | 否 | 否 | 履约日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | PGUPERAMOUNT | 购汇履约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 购汇履约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_CFABA_BENEFICIARY

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | BENAME | 受益人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 受益人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | BENAMEN | 受益人英文名称 | string | 128 | nvarchar(128) | 否 | 否 | 受益人英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | BENCODE | 受益人代码 | string | 32 | nvarchar(32) | 否 | 否 | 受益人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | BENCOUNTRYCODE | 受益人国别/地区 | string | 3 | nvarchar(3) | 否 | 否 | 受益人国别/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | BENTYPE | 受益人类型 | string | 8 | nvarchar(8) | 否 | 否 | 受益人类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | CFABAID | CFABA的ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | CFABA的ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_CFABA_COUNGUAR

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CFABAID | CFABA的ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | CFABA的ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CGCODE | 反担保人代码 | string | 32 | nvarchar(32) | 否 | 否 | 反担保人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CGNAME | 反担保人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 反担保人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CGNAMEN | 反担保人英文名称 | string | 128 | nvarchar(128) | 否 | 否 | 反担保人英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | CGCOUNCODE | 反担保人国别/地区代码 | string | 3 | nvarchar(3) | 否 | 否 | 反担保人国别/地区代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_CFABA_GUARANTOR

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CFABAID | CFABA的ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | CFABA的ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | GUEDCODE | 被担保人代码 | string | 32 | nvarchar(32) | 否 | 否 | 被担保人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | GUEDNAME | 被担保人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 被担保人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | GUEDNAMEN | 被担保人英文名称 | string | 128 | nvarchar(128) | 否 | 否 | 被担保人英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | GUEDTYPE | 被担保人类型 | string | 8 | nvarchar(8) | 否 | 否 | 被担保人类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | GUEDCOUNCODE | 被担保人国别/地区代码 | string | 3 | nvarchar(3) | 否 | 否 | 被担保人国别/地区代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | GUEDINDUSTRYCODE | 被担保人所属行业 | string | 4 | nvarchar(4) | 否 | 否 | 被担保人所属行业 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | GUEDPARECOMPCODE | 被担保人境内母公司代码 | string | 18 | nvarchar(18) | 否 | 否 | 被担保人境内母公司代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | GUEDPARECOMPNAME | 被担保人境内母公司中文名称 | string | 120 | nvarchar(120) | 否 | 否 | 被担保人境内母公司中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | GUEDPARECOMPNAMEN | 被担保人境内母公司英文名称 | string | 120 | nvarchar(120) | 否 | 否 | 被担保人境内母公司英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | ISSUECOUNTRYCODE | 发行/上市国家与地区 | string | 3 | nvarchar(3) | 否 | 否 | 发行/上市国家与地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_CFAC_A

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | ANNINRATE | 年化利率值 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 年化利率值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | CONTRACTAMOUNT | 签约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 签约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CREDITORCODE | 债权人代码 | string | 12 | nvarchar(12) | 否 | 否 | 债权人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CURRENCE | 贷款币种 | string | 3 | nvarchar(3) | 否 | 否 | 贷款币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | DEBTORCODE | 债务人代码 | string | 18 | nvarchar(18) | 否 | 否 | 债务人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | DEBTORNAME | 债务人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债务人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | DOFOEXLOCODE | 国内外汇贷款编号 | string | 28 | nvarchar(28) | 否 | 否 | 国内外汇贷款编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | DOFOEXLOTYPE | 国内外汇贷款类型 | string | 4 | nvarchar(4) | 否 | 否 | 国内外汇贷款类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | LENAGREE | 转贷协议号 | string | 128 | nvarchar(128) | 否 | 否 | 转贷协议号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | LENPRONAME | 转贷项目名称 | string | 128 | nvarchar(128) | 否 | 否 | 转贷项目名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | MATURITY | 到期日 | datetime |  | datetime2 | 否 | 否 | 到期日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | VALUEDATE | 起息日 | datetime |  | datetime2 | 否 | 否 | 起息日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_CFAC_B

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSCODE | 银行业务参号 | string | 32 | nvarchar(32) | 否 | 否 | 银行业务参号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | CFACAID | 国内外汇贷款签约信息ID | string | 255 | nvarchar(255) | 否 | 否 | 国内外汇贷款签约信息ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CHANGEDATE | 变动日期 | datetime |  | datetime2 | 否 | 否 | 变动日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CHANGENO | 变动编号 | string | 4 | nvarchar(4) | 否 | 否 | 变动编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | DOFOEXLOCODE | 国内外汇贷款编号 | string | 28 | nvarchar(28) | 否 | 否 | 国内外汇贷款编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | ENDBALAN | 期末余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | INPAYAMOUNT | 付息金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 付息金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | INPAYCURR | 付息币种 | string | 3 | nvarchar(3) | 否 | 否 | 付息币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | LOANOPENBALAN | 期初余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期初余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | PINPAYAMOUNT | 购汇付息金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 购汇付息金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | PREPAYAMOUNT | 购汇还本金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 购汇还本金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | PRINCURR | 还本币种 | string | 3 | nvarchar(3) | 否 | 否 | 还本币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | REPAYAMOUNT | 还本金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 还本金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | SETTAMOUNT | 结汇金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 结汇金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | USEOFUNDS | 资金用途 | string | 2 | nvarchar(2) | 否 | 否 | 资金用途 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | WITHAMOUNT | 提款金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 提款金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | WITHCURRENCE | 提款币种 | string | 3 | nvarchar(3) | 否 | 否 | 提款币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_CFAD_A

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | CREDCONAMOUNT | 贷款签约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 贷款签约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | CREDCURRCODE | 贷款币种 | string | 3 | nvarchar(3) | 否 | 否 | 贷款币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CREDITORCODE | 债权人代码 | string | 12 | nvarchar(12) | 否 | 否 | 债权人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | DEBTORCODE | 债务人代码 | string | 18 | nvarchar(18) | 否 | 否 | 债务人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | DEBTORNAME | 债务人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债务人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | DEBTORTYPE | 债务人类型 | string | 8 | nvarchar(8) | 否 | 否 | 债务人类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | DOFOEXLOCODE | 国内外汇贷款编号 | string | 32 | nvarchar(32) | 否 | 否 | 国内外汇贷款编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | LOUNEXGUCODE | 外保内贷编号 | string | 28 | nvarchar(28) | 否 | 否 | 外保内贷编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | MATURITY | 到期日 | datetime |  | datetime2 | 否 | 否 | 到期日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | VALUEDATE | 起息日 | datetime |  | datetime2 | 否 | 否 | 起息日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_CFAD_B

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSCODE | 银行业务参号 | string | 32 | nvarchar(32) | 否 | 否 | 银行业务参号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | CFADAID | 外保内贷签约信息ID | string | 255 | nvarchar(255) | 否 | 否 | 外保内贷签约信息ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CHANGEDATE | 变动日期 | datetime |  | datetime2 | 否 | 否 | 变动日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CHANGENO | 变动编号 | string | 4 | nvarchar(4) | 否 | 否 | 变动编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CREDPRINBALA | 贷款余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 贷款余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CREDPRINBALACURR | 贷款余额币种 | string | 3 | nvarchar(3) | 否 | 否 | 贷款余额币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CREDCURRCODE | 变动币种 | string | 3 | nvarchar(3) | 否 | 否 | 变动币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | CREDREPAYAMOUNT | 还本金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 还本金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | CREDWITHAMOUNT | 提款金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 提款金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | GUARANTLIBALA | 担保责任余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 担保责任余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | GUARANTLIBALACURR | 担保责任余额币种 | string | 3 | nvarchar(3) | 否 | 否 | 担保责任余额币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | GUPERAMOUNT | 担保履约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 担保履约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | LOUNEXGUCODE | 外保内贷编号 | string | 28 | nvarchar(28) | 否 | 否 | 外保内贷编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | PICAMOUNT | 付息费金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 付息费金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_CFADA_FOGUCODEINFO

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CFADAID | CFADA的ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | CFADA的ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | FOGUCODE | 境外担保人代码 | string | 32 | nvarchar(32) | 否 | 否 | 境外担保人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | FOGUNAME | 境外担保人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 境外担保人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | FOGUNAMEN | 境外担保人英文名称 | string | 128 | nvarchar(128) | 否 | 否 | 境外担保人英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | FOGURECODE | 境外担保人注册地国家/地区代码 | string | 3 | nvarchar(3) | 否 | 否 | 境外担保人注册地国家/地区代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | GUARANTEEOBJECT | 担保标的 | string | 4 | nvarchar(4) | 否 | 否 | 担保标的 |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | GUARANTEETYPE | 担保方式 | string | 2 | nvarchar(2) | 否 | 否 | 担保方式 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_CFAE_A

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | CREDCONAMOUNT | 贷款签约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 贷款签约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | CREDCONCURR | 贷款签约币种 | string | 3 | nvarchar(3) | 否 | 否 | 贷款签约币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CREDITORCODE | 债权人代码 | string | 12 | nvarchar(12) | 否 | 否 | 债权人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | DEBTORCODE | 债务人代码 | string | 18 | nvarchar(18) | 否 | 否 | 债务人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | DEBTORNAME | 债务人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债务人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | EXPLRMBLONO | 外汇质押人民币贷款编号 | string | 28 | nvarchar(28) | 否 | 否 | 外汇质押人民币贷款编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | MATURITY | 贷款到期日 | datetime |  | datetime2 | 否 | 否 | 贷款到期日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | VALUEDATE | 贷款起息日 | datetime |  | datetime2 | 否 | 否 | 贷款起息日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_CFAE_B

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | CFAEAID | 外汇质押人民币贷款签约信息ID | string | 255 | nvarchar(255) | 否 | 否 | 外汇质押人民币贷款签约信息ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CHANGENO | 变动编号 | string | 4 | nvarchar(4) | 否 | 否 | 变动编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CREDREPAYAMOUNT | 本月还本金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月还本金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CREDWITHAMOUNT | 本月提款金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月提款金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | EXPLRMBLONO | 外汇质押人民币贷款编号 | string | 28 | nvarchar(28) | 否 | 否 | 外汇质押人民币贷款编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | MONBELOADBAL | 月初贷款余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 月初贷款余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | MONENLOADBAL | 月末贷款余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 月末贷款余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | PICAMOUNT | 本月付息费金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月付息费金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_CFAEA_EXPLCURRINFO

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CFAEAID | CFAEA的ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | CFAEA的ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | EXPLAMOUNT | 质押外汇金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 质押外汇金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | EXPLCURR | 质押外汇币种 | string | 3 | nvarchar(3) | 否 | 否 | 质押外汇币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_CFAEB_EXPLBALAINFO

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CFAEBID | CFAEB的ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | CFAEB的ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | EXPLBALA | 质押外汇余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 质押外汇余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | EXPLCURR | 质押外汇币种 | string | 3 | nvarchar(3) | 否 | 否 | 质押外汇币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | EXPLPERAMOUNT | 质押外汇履约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 质押外汇履约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | PLCOSEAMOUNT | 质押履约结汇金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 质押履约结汇金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_CFAF_A

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | AGINRALO | 约定的利率下限 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 约定的利率下限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | AGINRALOINPAY | 利息给付方式 | string | 256 | nvarchar(256) | 否 | 否 | 利息给付方式 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | AGINRAUP | 约定的利率上限 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 约定的利率上限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | BRANCHCODE | 金融机构标识码 | string | 12 | nvarchar(12) | 否 | 否 | 金融机构标识码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CLIENTCODE | 客户代码 | string | 18 | nvarchar(18) | 否 | 否 | 客户代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CLIENTNAME | 客户名称 | string | 128 | nvarchar(128) | 否 | 否 | 客户名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CONTRACT | 合同号 | string | 32 | nvarchar(32) | 否 | 否 | 合同号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | CONTRACTAMOUNT | 签约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 签约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | CONTRACTDATE | 签约日期 | datetime |  | datetime2 | 否 | 否 | 签约日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | LINCAME | 挂钩指标 | string | 256 | nvarchar(256) | 否 | 否 | 挂钩指标 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | LINCAMETHOD | 挂钩指标计算方法 | string | 256 | nvarchar(256) | 否 | 否 | 挂钩指标计算方法 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | MATURITY | 到期日 | datetime |  | datetime2 | 否 | 否 | 到期日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | STRDECODE | 人民币结构性存款编号 | string | 28 | nvarchar(28) | 否 | 否 | 人民币结构性存款编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_CFAF_B

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BRANCHCODE | 金融机构标识码 | string | 12 | nvarchar(12) | 否 | 否 | 金融机构标识码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | CFAFAID | 人民币结构性存款签约信息ID | string | 255 | nvarchar(255) | 否 | 否 | 人民币结构性存款签约信息ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CONTRACT | 合同号 | string | 32 | nvarchar(32) | 否 | 否 | 合同号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | STRDECODE | 人民币结构性存款编号 | string | 28 | nvarchar(28) | 否 | 否 | 人民币结构性存款编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | TERDATE | 终止日期 | datetime |  | datetime2 | 否 | 否 | 终止日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | TERTYPE | 终止类型 | string | 2 | nvarchar(2) | 否 | 否 | 终止类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | TERPAYAMTORMB | 终止支付金额合计折人民币 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 终止支付金额合计折人民币 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | TERPAYCODE | 终止支付编号 | string | 4 | nvarchar(4) | 否 | 否 | 终止支付编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | TERPAYCURR | 终止外币支付币种 | string | 3 | nvarchar(3) | 否 | 否 | 终止外币支付币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | TERPAYCURRAM | 终止外币支付金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 终止外币支付金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | TERRMBPAYAM | 终止人民币支付金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 终止人民币支付金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_CFAF_C

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BRANCHCODE | 金融机构标识码 | string | 12 | nvarchar(12) | 否 | 否 | 金融机构标识码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | CFAFAID | 人民币结构性存款签约信息ID | string | 255 | nvarchar(255) | 否 | 否 | 人民币结构性存款签约信息ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CONTRACT | 合同号 | string | 32 | nvarchar(32) | 否 | 否 | 合同号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | INPAYCODE | 付息编号 | string | 4 | nvarchar(4) | 否 | 否 | 付息编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | INPAYCURR | 付息外币支付币种 | string | 3 | nvarchar(3) | 否 | 否 | 付息外币支付币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | INPAYCURRAM | 付息外币支付金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 付息外币支付金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | INPAYMONTH | 付息年月 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 付息年月 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | INPAYRMBAM | 付息人民币支付金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 付息人民币支付金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | STRDECODE | 人民币结构性存款编号 | string | 28 | nvarchar(28) | 否 | 否 | 人民币结构性存款编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_CFAF_D

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BRANCHCODE | 金融机构标识码 | string | 12 | nvarchar(12) | 否 | 否 | 金融机构标识码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CFAFAID | 人民币结构性存款签约信息ID-已废弃 | string | 255 | nvarchar(255) | 否 | 否 | 人民币结构性存款签约信息ID-已废弃 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CURRENCY | 币种 | string | 3 | nvarchar(3) | 否 | 否 | 币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | MOAMREUSD | 本月汇入金额折美元 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月汇入金额折美元 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | MOEXAMUSD | 本月汇出金额折美元 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月汇出金额折美元 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | MOPFEXAMUSD | 本月购汇金额折美元 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月购汇金额折美元 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | MOSETTAMUSD | 本月结汇金额折美元 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月结汇金额折美元 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | STRDECODE | 人民币结构性存款编号-已废弃 | string | 28 | nvarchar(28) | 否 | 否 | 人民币结构性存款编号-已废弃 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

## 3.2 EXD 银行自身外债

### 表：T_SAFE_EXDA_A

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | ANNINRATE | 年化利率值 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 年化利率值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | ARCOUNT | 变动数目 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 变动数目 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CONTRACTAMOUNT | 签约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 签约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CONTRACTCURR | 签约币种 | string | 3 | nvarchar(3) | 否 | 否 | 签约币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CONTRACTDATE | 签约日期 | datetime |  | datetime2 | 否 | 否 | 签约日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CREDITORCODE | 债权人代码 | string | 11 | nvarchar(11) | 否 | 否 | 债权人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CREDITORNAME | 债权人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | CREDITORNAMEN | 债权人英文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | CREDITORTYPE | 债权人类型代码 | string | 8 | nvarchar(8) | 否 | 否 | 债权人类型代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | CREHQCODE | 债权人总部所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人总部所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | DEBTYPE | 债务类型 | string | 4 | nvarchar(4) | 否 | 否 | 债务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | DEBTORCODE | 债务人代码 | string | 12 | nvarchar(12) | 否 | 否 | 债务人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | EXDEBTCODE | 外债编号 | string | 28 | nvarchar(28) | 否 | 否 | 外债编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | FLOATRATE | 是否浮动利率 | string | 1 | nvarchar(1) | 否 | 否 | 是否浮动利率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | INPRTERM | 是否有利息本金化条款 | string | 1 | nvarchar(1) | 否 | 否 | 是否有利息本金化条款 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | MATURITY | 到期日 | datetime |  | datetime2 | 否 | 否 | 到期日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | OPERCODE | 债权人经营地所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人经营地所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | RELATION | 对方与本机构的关系 | string | 2 | nvarchar(2) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | SPAPFEBOINDEX | 是否不纳入跨境融资风险加权余额计算 | string | 1 | nvarchar(1) | 否 | 否 | 是否不纳入跨境融资风险加权余额计算 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | VALUEDATE | 起息日 | datetime |  | datetime2 | 否 | 否 | 起息日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_EXDA_B

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | ANNINRATE | 年化利率值 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 年化利率值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | ARCOUNT | 变动数目 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 变动数目 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CONTRACTAMOUNT | 签约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 签约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CONTRACTCURR | 签约币种 | string | 3 | nvarchar(3) | 否 | 否 | 签约币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CONTRACTDATE | 签约日期 | datetime |  | datetime2 | 否 | 否 | 签约日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CREDITORCODE | 债权人代码 | string | 11 | nvarchar(11) | 否 | 否 | 债权人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CREDITORNAME | 债权人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | CREDITORNAMEN | 债权人英文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | CREDITORTYPE | 债权人类型代码 | string | 8 | nvarchar(8) | 否 | 否 | 债权人类型代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | CREHQCODE | 债权人总部所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人总部所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | DEBTYPE | 债务类型 | string | 4 | nvarchar(4) | 否 | 否 | 债务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | DEBTORCODE | 债务人代码 | string | 12 | nvarchar(12) | 否 | 否 | 债务人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | EXDEBTCODE | 外债编号  | string | 28 | nvarchar(28) | 否 | 否 | 外债编号  |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | FLOATRATE | 是否浮动利率 | string | 1 | nvarchar(1) | 否 | 否 | 是否浮动利率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | INPRTERM | 是否有利息本金化条款 | string | 1 | nvarchar(1) | 否 | 否 | 是否有利息本金化条款 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | MATURITY | 到期日 | datetime |  | datetime2 | 否 | 否 | 到期日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | OPERCODE | 债权人经营地所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人经营地所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | RELATION | 对方与本机构的关系 | string | 2 | nvarchar(2) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | SPAPFEBOINDEX | 是否不纳入跨境融资风险加权余额计算 | string | 1 | nvarchar(1) | 否 | 否 | 是否不纳入跨境融资风险加权余额计算 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | VALUEDATE | 起息日 | datetime |  | datetime2 | 否 | 否 | 起息日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_EXDA_C

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | ANNINRATE | 年化利率值 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 年化利率值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | ARCOUNT | 变动数目 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 变动数目 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CONTRACTAMOUNT | 签约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 签约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CONTRACTCURR | 签约币种 | string | 3 | nvarchar(3) | 否 | 否 | 签约币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CREDITORCODE | 债权人代码 | string | 11 | nvarchar(11) | 否 | 否 | 债权人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CREDITORNAME | 债权人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CREDITORNAMEN | 债权人英文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | CREDITORTYPE | 债权人类型代码 | string | 8 | nvarchar(8) | 否 | 否 | 债权人类型代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | CREHQCODE | 债权人总部所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人总部所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | DEBTYPE | 债务类型 | string | 4 | nvarchar(4) | 否 | 否 | 债务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | DEBTORCODE | 债务人代码 | string | 12 | nvarchar(12) | 否 | 否 | 债务人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | EXDEBTCODE | 外债编号 | string | 28 | nvarchar(28) | 否 | 否 | 外债编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | FLOATRATE | 是否浮动利率 | string | 1 | nvarchar(1) | 否 | 否 | 是否浮动利率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | INPRTERM | 是否有利息本金化条款 | string | 1 | nvarchar(1) | 否 | 否 | 是否有利息本金化条款 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | MATURITY | 到期日 | datetime |  | datetime2 | 否 | 否 | 到期日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | OPERCODE | 债权人经营地所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人经营地所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | RELATION | 对方与本机构的关系 | string | 2 | nvarchar(2) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | SPAPFEBOINDEX | 是否不纳入跨境融资风险加权余额计算 | string | 1 | nvarchar(1) | 否 | 否 | 是否不纳入跨境融资风险加权余额计算 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | VALUEDATE | 起息日 | datetime |  | datetime2 | 否 | 否 | 起息日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_EXDA_D

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | ANNINRATE | 年化利率值 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 年化利率值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | APPCODE | 申请人代码 | string | 18 | nvarchar(18) | 否 | 否 | 申请人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | APPNAME | 申请人名称 | string | 128 | nvarchar(128) | 否 | 否 | 申请人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | ARCOUNT | 变动数目 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 变动数目 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CONTRACTAMOUNT | 签约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 签约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CONTRACTCURR | 签约币种 | string | 3 | nvarchar(3) | 否 | 否 | 签约币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CREDITORCODE | 债权人代码 | string | 11 | nvarchar(11) | 否 | 否 | 债权人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | CREDITORNAME | 债权人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | CREDITORNAMEN | 债权人英文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | CREDITORTYPE | 债权人类型代码 | string | 8 | nvarchar(8) | 否 | 否 | 债权人类型代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | CREHQCODE | 债权人总部所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人总部所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | DEBTYPE | 债务类型 | string | 4 | nvarchar(4) | 否 | 否 | 债务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | DEBTORCODE | 债务人代码 | string | 12 | nvarchar(12) | 否 | 否 | 债务人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | EXDEBTCODE | 外债编号 | string | 28 | nvarchar(28) | 否 | 否 | 外债编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | FLOATRATE | 是否浮动利率 | string | 1 | nvarchar(1) | 否 | 否 | 是否浮动利率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | INLTCABUSCODE | 承继的远期信用证承兑银行业务参号 | string | 32 | nvarchar(32) | 否 | 否 | 承继的远期信用证承兑银行业务参号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | MATURITY | 到期日 | datetime |  | datetime2 | 否 | 否 | 到期日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | OPERCODE | 债权人经营地所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人经营地所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | RELATION | 对方与本机构的关系 | string | 2 | nvarchar(2) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | SPAPFEBOINDEX | 是否不纳入跨境融资风险加权余额计算 | string | 1 | nvarchar(1) | 否 | 否 | 是否不纳入跨境融资风险加权余额计算 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | VALUEDATE | 起息日 | datetime |  | datetime2 | 否 | 否 | 起息日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_EXDA_E

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | ANNINRATE | 年化利率值 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 年化利率值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | ARCOUNT | 变动数目 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 变动数目 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CONTRACTAMOUNT | 签约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 签约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CONTRACTCURR | 签约币种 | string | 3 | nvarchar(3) | 否 | 否 | 签约币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CREDITORCODE | 债权人代码 | string | 11 | nvarchar(11) | 否 | 否 | 债权人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CREDITORNAME | 债权人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CREDITORNAMEN | 债权人英文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | CREDITORTYPE | 债权人类型代码 | string | 8 | nvarchar(8) | 否 | 否 | 债权人类型代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | CREHQCODE | 债权人总部所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人总部所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | DEBTYPE | 债务类型 | string | 4 | nvarchar(4) | 否 | 否 | 债务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | DEBTORCODE | 债务人代码 | string | 12 | nvarchar(12) | 否 | 否 | 债务人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | EXDEBTCODE | 外债编号 | string | 28 | nvarchar(28) | 否 | 否 | 外债编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | FLOATRATE | 是否浮动利率 | string | 1 | nvarchar(1) | 否 | 否 | 是否浮动利率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | INPRIAMOUNT | 利息本金化金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 利息本金化金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | MATURITY | 到期日 | datetime |  | datetime2 | 否 | 否 | 到期日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | OPERCODE | 债权人经营地所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人经营地所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | RELATION | 对方与本机构的关系 | string | 2 | nvarchar(2) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | SPAPFEBOINDEX | 是否不纳入跨境融资风险加权余额计算 | string | 1 | nvarchar(1) | 否 | 否 | 是否不纳入跨境融资风险加权余额计算 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | VALUEDATE | 起息日 | datetime |  | datetime2 | 否 | 否 | 起息日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_EXDA_F

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | APPCODE | 开证申请人代码 | string | 18 | nvarchar(18) | 否 | 否 | 开证申请人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | APPNAME | 开证申请人名称 | string | 128 | nvarchar(128) | 否 | 否 | 开证申请人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | ARCOUNT | 变动数目 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 变动数目 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | BILLSN | 是否附有银行承兑汇票 | string | 1 | nvarchar(1) | 否 | 否 | 是否附有银行承兑汇票 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CONTRACTAMOUNT | 签约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 签约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CONTRACTCURR | 签约币种 | string | 3 | nvarchar(3) | 否 | 否 | 签约币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CREDITTYPE | 相关业务类型 | string | 1 | nvarchar(1) | 否 | 否 | 相关业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | CREDITORCODE | 债权人代码 | string | 11 | nvarchar(11) | 否 | 否 | 债权人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | CREDITORNAME | 债权人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | CREDITORNAMEN | 债权人英文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | CREDITORTYPE | 债权人类型代码 | string | 8 | nvarchar(8) | 否 | 否 | 债权人类型代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | CREHQCODE | 债权人总部所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人总部所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | DEBTYPE | 债务类型 | string | 4 | nvarchar(4) | 否 | 否 | 债务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | DEBTORCODE | 债务人代码 | string | 12 | nvarchar(12) | 否 | 否 | 债务人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | EXDEBTCODE | 外债编号 | string | 28 | nvarchar(28) | 否 | 否 | 外债编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | MATURITY | 到期日 | datetime |  | datetime2 | 否 | 否 | 到期日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | OPERCODE | 债权人经营地所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人经营地所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | RELATION | 对方与本机构的关系 | string | 2 | nvarchar(2) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | SPAPFEBOINDEX | 是否不纳入跨境融资风险加权余额计算 | string | 1 | nvarchar(1) | 否 | 否 | 是否不纳入跨境融资风险加权余额计算 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | VALUEDATE | 起息日 | datetime |  | datetime2 | 否 | 否 | 起息日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_EXDA_G

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | ANNINRATE | 年化利率值 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 年化利率值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | ARCOUNT | 变动数目 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 变动数目 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CONTRACTAMOUNT | 签约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 签约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CONTRACTCURR | 签约币种 | string | 3 | nvarchar(3) | 否 | 否 | 签约币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | DEBTYPE | 债务类型 | string | 4 | nvarchar(4) | 否 | 否 | 债务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | DEBTORCODE | 债务人代码 | string | 12 | nvarchar(12) | 否 | 否 | 债务人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | EXDEBTCODE | 外债编号 | string | 28 | nvarchar(28) | 否 | 否 | 外债编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | FLOATRATE | 是否浮动利率 | string | 1 | nvarchar(1) | 否 | 否 | 是否浮动利率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | INPRTERM | 是否有利息本金化条款 | string | 1 | nvarchar(1) | 否 | 否 | 是否有利息本金化条款 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | MATURITY | 到期日 | datetime |  | datetime2 | 否 | 否 | 到期日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | RELATION | 对方与本机构的关系 | string | 2 | nvarchar(2) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | SPAPFEBOINDEX | 是否不纳入跨境融资风险加权余额计算 | string | 1 | nvarchar(1) | 否 | 否 | 是否不纳入跨境融资风险加权余额计算 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | VALUEDATE | 起息日 | datetime |  | datetime2 | 否 | 否 | 起息日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_EXDA_H

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | ANNINRATE | 年化利率值 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 年化利率值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | ARCOUNT | 变动数目 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 变动数目 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CONTRACTAMOUNT | 签约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 签约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CONTRACTCURR | 签约币种 | string | 3 | nvarchar(3) | 否 | 否 | 签约币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CREDITORCODE | 债权人代码 | string | 11 | nvarchar(11) | 否 | 否 | 债权人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CREDITORNAME | 债权人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CREDITORNAMEN | 债权人英文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | CREDITORTYPE | 债权人类型代码 | string | 8 | nvarchar(8) | 否 | 否 | 债权人类型代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | CREHQCODE | 债权人总部所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人总部所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | DEBTYPE | 债务类型 | string | 4 | nvarchar(4) | 否 | 否 | 债务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | DEBTORCODE | 债务人代码 | string | 12 | nvarchar(12) | 否 | 否 | 债务人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | EXDEBTCODE | 外债编号 | string | 28 | nvarchar(28) | 否 | 否 | 外债编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | FLOATRATE | 是否浮动利率 | string | 1 | nvarchar(1) | 否 | 否 | 是否浮动利率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | INPRTERM | 是否有利息本金化条款 | string | 1 | nvarchar(1) | 否 | 否 | 是否有利息本金化条款 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | MATURITY | 到期日 | datetime |  | datetime2 | 否 | 否 | 到期日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | OPERCODE | 债权人经营地所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人经营地所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | RELATION | 对方与本机构的关系 | string | 2 | nvarchar(2) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | SPAPFEBOINDEX | 是否不纳入跨境融资风险加权余额计算 | string | 1 | nvarchar(1) | 否 | 否 | 是否不纳入跨境融资风险加权余额计算 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | VALUEDATE | 起息日 | datetime |  | datetime2 | 否 | 否 | 起息日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_EXDA_I

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | ANNINRATE | 年化利率值 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 年化利率值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | ARCOUNT | 变动数目 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 变动数目 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CONTRACTAMOUNT | 签约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 签约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CONTRACTCURR | 签约币种 | string | 3 | nvarchar(3) | 否 | 否 | 签约币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CREDITORCODE | 债权人代码 | string | 11 | nvarchar(11) | 否 | 否 | 债权人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CREDITORNAME | 债权人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CREDITORNAMEN | 债权人英文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | CREDITORTYPE | 债权人类型代码 | string | 8 | nvarchar(8) | 否 | 否 | 债权人类型代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | CREHQCODE | 债权人总部所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人总部所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | DEBTYPE | 债务类型 | string | 4 | nvarchar(4) | 否 | 否 | 债务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | DEBTYPEREMA | 债务类型备注 | string | 128 | nvarchar(128) | 否 | 否 | 债务类型备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | DEBTORCODE | 债务人代码 | string | 12 | nvarchar(12) | 否 | 否 | 债务人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | EXDEBTCODE | 外债编号 | string | 28 | nvarchar(28) | 否 | 否 | 外债编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | FLOATRATE | 是否浮动利率 | string | 1 | nvarchar(1) | 否 | 否 | 是否浮动利率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | INPRTERM | 是否有利息本金化条款 | string | 1 | nvarchar(1) | 否 | 否 | 是否有利息本金化条款 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | MATURITY | 到期日 | datetime |  | datetime2 | 否 | 否 | 到期日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | OPERCODE | 债权人经营地所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人经营地所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | PROJECTNAME | 项目名称 | string | 128 | nvarchar(128) | 否 | 否 | 项目名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | RELATION | 对方与本机构的关系 | string | 2 | nvarchar(2) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | SPAPFEBOINDEX | 是否不纳入跨境融资风险加权余额计算 | string | 1 | nvarchar(1) | 否 | 否 | 是否不纳入跨境融资风险加权余额计算 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | VALUEDATE | 起息日 | datetime |  | datetime2 | 否 | 否 | 起息日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_EXDA_J

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | ANNINRATE | 年化利率值 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 年化利率值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | ARCOUNT | 变动数目 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 变动数目 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CONTRACTAMOUNT | 签约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 签约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CONTRACTCURR | 签约币种 | string | 3 | nvarchar(3) | 否 | 否 | 签约币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CREDITORCODE | 债权人代码 | string | 11 | nvarchar(11) | 否 | 否 | 债权人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CREDITORNAME | 债权人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CREDITORNAMEN | 债权人英文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | CREDITORTYPE | 债权人类型代码 | string | 8 | nvarchar(8) | 否 | 否 | 债权人类型代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | CREHQCODE | 债权人总部所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人总部所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | DEBTYPE | 债务类型 | string | 4 | nvarchar(4) | 否 | 否 | 债务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | DEBTORCODE | 债务人代码 | string | 12 | nvarchar(12) | 否 | 否 | 债务人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | EXDEBTCODE | 外债编号 | string | 28 | nvarchar(28) | 否 | 否 | 外债编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | FLOATRATE | 是否浮动利率 | string | 1 | nvarchar(1) | 否 | 否 | 是否浮动利率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | ISINCODE | ISIN CODE | string | 12 | nvarchar(12) | 否 | 否 | ISIN CODE |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | MATURITY | 到期日 | datetime |  | datetime2 | 否 | 否 | 到期日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | OPERCODE | 债权人经营地所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人经营地所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | SPAPFEBOINDEX | 是否不纳入跨境融资风险加权余额计算 | string | 1 | nvarchar(1) | 否 | 否 | 是否不纳入跨境融资风险加权余额计算 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | VALUEDATE | 起息日 | datetime |  | datetime2 | 否 | 否 | 起息日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_EXDA_K

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | ANNINRATE | 年化利率值 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 年化利率值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | ARCOUNT | 变动数目 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 变动数目 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CONTRACTAMOUNT | 签约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 签约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CONTRACTCURR | 签约币种 | string | 3 | nvarchar(3) | 否 | 否 | 签约币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CREDITORCODE | 债权人代码 | string | 11 | nvarchar(11) | 否 | 否 | 债权人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CREDITORNAME | 债权人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CREDITORNAMEN | 债权人英文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | CREDITORTYPE | 债权人类型代码 | string | 8 | nvarchar(8) | 否 | 否 | 债权人类型代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | CREHQCODE | 债权人总部所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人总部所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | DEBTYPE | 债务类型 | string | 4 | nvarchar(4) | 否 | 否 | 债务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | DEBTORCODE | 债务人代码 | string | 12 | nvarchar(12) | 否 | 否 | 债务人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | EXDEBTCODE | 外债编号 | string | 28 | nvarchar(28) | 否 | 否 | 外债编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | FLOATRATE | 是否浮动利率 | string | 1 | nvarchar(1) | 否 | 否 | 是否浮动利率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | ISINCODE | ISIN CODE | string | 12 | nvarchar(12) | 否 | 否 | ISIN CODE |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | MATURITY | 到期日 | datetime |  | datetime2 | 否 | 否 | 到期日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | OPERCODE | 债权人经营地所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人经营地所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | SPAPFEBOINDEX | 是否不纳入跨境融资风险加权余额计算 | string | 1 | nvarchar(1) | 否 | 否 | 是否不纳入跨境融资风险加权余额计算 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | VALUEDATE | 起息日 | datetime |  | datetime2 | 否 | 否 | 起息日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_EXDA_L

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | ANNINRATE | 年化利率值 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 年化利率值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | ASCOUNT | 余额数目 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 余额数目 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CONTRACTAMOUNT | 签约金额 不需要报送，但自动化程序对比余额时需要使用 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 签约金额 不需要报送，但自动化程序对比余额时需要使用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CONTRACTCURR | 签约币种 | string | 3 | nvarchar(3) | 否 | 否 | 签约币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CREDITORCODE | 债权人代码 | string | 11 | nvarchar(11) | 否 | 否 | 债权人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CREDITORNAME | 债权人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CREDITORNAMEN | 债权人英文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | CREDITORTYPE | 债权人类型代码 | string | 8 | nvarchar(8) | 否 | 否 | 债权人类型代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | CREHQCODE | 债权人总部所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人总部所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | DEBTYPE | 债务类型 | string | 4 | nvarchar(4) | 否 | 否 | 债务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | DEBTORCODE | 债务人代码 | string | 12 | nvarchar(12) | 否 | 否 | 债务人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | DEPTYPE | 存款业务类别 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 存款业务类别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | EXDEBTCODE | 外债编号 | string | 28 | nvarchar(28) | 否 | 否 | 外债编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | FLOATRATE | 是否浮动利率 | string | 1 | nvarchar(1) | 否 | 否 | 是否浮动利率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | OPERCODE | 债权人经营地所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人经营地所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | ORIGINALPERIOD | 原始期限 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 原始期限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | RELATION | 对方与本机构的关系 | string | 2 | nvarchar(2) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | SPAPFEBOINDEX | 是否不纳入跨境融资风险加权余额计算 | string | 1 | nvarchar(1) | 否 | 否 | 是否不纳入跨境融资风险加权余额计算 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | VALUEDATE | 起息日 | datetime |  | datetime2 | 否 | 否 | 起息日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_EXDA_M

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | ANNINRATE | 年化利率值 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 年化利率值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | ASCOUNT | 余额数目 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 余额数目 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CONTRACTAMOUNT | 签约金额 不需要报送，但自动化程序对比余额时需要使用 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 签约金额 不需要报送，但自动化程序对比余额时需要使用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CONTRACTCURR | 签约币种 | string | 3 | nvarchar(3) | 否 | 否 | 签约币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CREDITORCODE | 债权人代码 | string | 11 | nvarchar(11) | 否 | 否 | 债权人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CREDITORNAME | 债权人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CREDITORNAMEN | 债权人英文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | CREDITORTYPE | 债权人类型代码 | string | 8 | nvarchar(8) | 否 | 否 | 债权人类型代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | CREHQCODE | 债权人总部所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人总部所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | DEBTYPE | 债务类型 | string | 4 | nvarchar(4) | 否 | 否 | 债务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | DEBTORCODE | 债务人代码 | string | 12 | nvarchar(12) | 否 | 否 | 债务人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | DEPTYPE | 存款业务类别 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 存款业务类别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | EXDEBTCODE | 外债编号 | string | 28 | nvarchar(28) | 否 | 否 | 外债编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | FLOATRATE | 是否浮动利率 | string | 1 | nvarchar(1) | 否 | 否 | 是否浮动利率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | OPERCODE | 债权人经营地所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人经营地所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | ORIGINALPERIOD | 原始期限 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 原始期限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | RELATION | 对方与本机构的关系 | string | 2 | nvarchar(2) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | SPAPFEBOINDEX | 是否不纳入跨境融资风险加权余额计算 | string | 1 | nvarchar(1) | 否 | 否 | 是否不纳入跨境融资风险加权余额计算 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | VALUEDATE | 起息日 | datetime |  | datetime2 | 否 | 否 | 起息日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_EXDA_N

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | ANNINRATE | 年化利率值 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 年化利率值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | ASCOUNT | 余额数目 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 余额数目 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CONTRACTAMOUNT | 签约金额 不需要报送，但自动化程序对比余额时需要使用 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 签约金额 不需要报送，但自动化程序对比余额时需要使用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CONTRACTCURR | 签约币种 | string | 3 | nvarchar(3) | 否 | 否 | 签约币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CREDITORCODE | 债权人代码 | string | 11 | nvarchar(11) | 否 | 否 | 债权人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CREDITORNAME | 债权人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CREDITORNAMEN | 债权人英文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | CREDITORTYPE | 债权人类型代码 | string | 8 | nvarchar(8) | 否 | 否 | 债权人类型代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | CREHQCODE | 债权人总部所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人总部所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | DEBTYPE | 债务类型 | string | 4 | nvarchar(4) | 否 | 否 | 债务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | DEBTORCODE | 债务人代码 | string | 12 | nvarchar(12) | 否 | 否 | 债务人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | DEPTYPE | 存款业务类别 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 存款业务类别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | EXDEBTCODE | 外债编号 | string | 28 | nvarchar(28) | 否 | 否 | 外债编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | FLOATRATE | 是否浮动利率 | string | 1 | nvarchar(1) | 否 | 否 | 是否浮动利率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | LIMITTYPE | 账户类型 | string | 255 | nvarchar(255) | 否 | 否 | 账户类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | OPERCODE | 债权人经营地所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人经营地所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | ORIGINALPERIOD | 原始期限 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 原始期限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | RELATION | 对方与本机构的关系 | string | 2 | nvarchar(2) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | SPAPFEBOINDEX | 是否不纳入跨境融资风险加权余额计算 | string | 1 | nvarchar(1) | 否 | 否 | 是否不纳入跨境融资风险加权余额计算 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | VALUEDATE | 起息日 | datetime |  | datetime2 | 否 | 否 | 起息日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_EXDA_P

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | ANNINRATE | 年化利率值 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 年化利率值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | ASCOUNT | 余额数目 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 余额数目 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CONTRACTAMOUNT | 签约金额 不需要报送，但自动化程序对比余额时需要使用 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 签约金额 不需要报送，但自动化程序对比余额时需要使用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CONTRACTCURR | 签约币种 | string | 3 | nvarchar(3) | 否 | 否 | 签约币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CREDITORCODE | 债权人代码 | string | 11 | nvarchar(11) | 否 | 否 | 债权人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CREDITORNAME | 债权人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CREDITORNAMEN | 债权人英文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | CREDITORTYPE | 债权人类型代码 | string | 8 | nvarchar(8) | 否 | 否 | 债权人类型代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | CREHQCODE | 债权人国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | DEBTYPE | 债务类型 | string | 4 | nvarchar(4) | 否 | 否 | 债务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | DEBTORCODE | 债务人代码 | string | 12 | nvarchar(12) | 否 | 否 | 债务人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | EXDEBTCODE | 外债编号 | string | 28 | nvarchar(28) | 否 | 否 | 外债编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | FLOATRATE | 是否浮动利率 | string | 1 | nvarchar(1) | 否 | 否 | 是否浮动利率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | SPAPFEBOINDEX | 是否不纳入跨境融资风险加权余额计算 | string | 1 | nvarchar(1) | 否 | 否 | 是否不纳入跨境融资风险加权余额计算 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | VALUEDATE | 报送日期 | datetime |  | datetime2 | 否 | 否 | 报送日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_EXDA_Q

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | ANNINRATE | 年化利率值 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 年化利率值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | ARCOUNT | 变动数目 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 变动数目 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CONTRACTAMOUNT | 签约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 签约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CONTRACTCURR | 签约币种 | string | 3 | nvarchar(3) | 否 | 否 | 签约币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CREDITORCODE | 债权人代码 | string | 11 | nvarchar(11) | 否 | 否 | 债权人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CREDITORNAME | 债权人中文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人中文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CREDITORNAMEN | 债权人英文名称 | string | 128 | nvarchar(128) | 否 | 否 | 债权人英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | CREDITORTYPE | 债权人类型代码 | string | 8 | nvarchar(8) | 否 | 否 | 债权人类型代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | CREHQCODE | 债权人总部所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人总部所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | DEBTYPE | 债务类型 | string | 4 | nvarchar(4) | 否 | 否 | 债务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | DEBTORCODE | 债务人代码 | string | 12 | nvarchar(12) | 否 | 否 | 债务人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | DEBTYPEREMA | 债务类型备注 | string | 128 | nvarchar(128) | 否 | 否 | 债务类型备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | EXDEBTCODE | 外债编号 | string | 28 | nvarchar(28) | 否 | 否 | 外债编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | FLOATRATE | 是否浮动利率 | string | 1 | nvarchar(1) | 否 | 否 | 是否浮动利率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | INPRTERM | 是否有利息本金化条款 | string | 1 | nvarchar(1) | 否 | 否 | 是否有利息本金化条款 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | MATURITY | 到期日 | datetime |  | datetime2 | 否 | 否 | 到期日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | OPERCODE | 债权人经营地所在国家（地区）代码 | string | 3 | nvarchar(3) | 否 | 否 | 债权人经营地所在国家（地区）代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | RELATION | 对方与本机构的关系 | string | 2 | nvarchar(2) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | SPAPFEBOINDEX | 是否不纳入跨境融资风险加权余额计算 | string | 1 | nvarchar(1) | 否 | 否 | 是否不纳入跨境融资风险加权余额计算 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | VALUEDATE | 起息日 | datetime |  | datetime2 | 否 | 否 | 起息日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_EXDA_R

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BELONGMODE | 外债—变动信息 | string | 20 | nvarchar(20) | 否 | 否 | 外债—变动信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | BUSCODE | 银行业务参号 | string | 32 | nvarchar(32) | 否 | 否 | 银行业务参号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CHAMOUNT | 变动金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 变动金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CHCURRENCY | 变动币种 | string | 3 | nvarchar(3) | 否 | 否 | 变动币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CHDATE | 变动日期 | datetime |  | datetime2 | 否 | 否 | 变动日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CHANGTYPE | 变动类型 | string | 4 | nvarchar(4) | 否 | 否 | 变动类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CHANGENO | 变动编号 | string | 4 | nvarchar(4) | 否 | 否 | 变动编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | EXDEBTCODE | 外债编号 | string | 28 | nvarchar(28) | 否 | 否 | 外债编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | FAIRVALUE | 公允价值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 公允价值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | MODELID | 所属主信息id | decimal | 19,0 | decimal(19,0) | 否 | 否 | 所属主信息id |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | SPAPFEBOINDEX | 是否不纳入跨境融资风险加权余额计算 | string | 1 | nvarchar(1) | 否 | 否 | 是否不纳入跨境融资风险加权余额计算 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | COUNTRY | 国别 | string | 10 | nvarchar(10) | 否 | 否 | 国别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_EXDA_S

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | ACCOAMOUNT | 外债余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 外债余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | ACCOAMOUNTUSD | 待确认 | decimal | 22,2 | decimal(22,2) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | BELONGMODE | 外债—余额信息 | string | 20 | nvarchar(20) | 否 | 否 | 外债—余额信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | BUSCODE | 银行账号 | string | 32 | nvarchar(32) | 否 | 否 | 银行账号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CHDATE | 变动日期 | datetime |  | datetime2 | 否 | 否 | 变动日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CHANGENO | 变动编号 | string | 4 | nvarchar(4) | 否 | 否 | 变动编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | EXDEBTCODE | 外债编号 | string | 28 | nvarchar(28) | 否 | 否 | 外债编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | MODELID | 所属主信息id | decimal | 19,0 | decimal(19,0) | 否 | 否 | 所属主信息id |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | CONTRACTCURR | 主信息币种 | string | 3 | nvarchar(3) | 否 | 否 | 主信息币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | SPAPFEBOINDEX | 是否不纳入跨境融资风险加权余额计算 | string | 1 | nvarchar(1) | 否 | 否 | 是否不纳入跨境融资风险加权余额计算 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | COUNTRY | 国别 | string | 10 | nvarchar(10) | 否 | 否 | 国别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_EXDAA_PROJECT

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 待确认 | bigint | 19 | bigint | 是 | 是 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | EXDAAID | 待确认 | decimal | 19,0 | decimal(19,0) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | PROJECTNAME | 项目名称 | string | 128 | nvarchar(128) | 否 | 否 | 项目名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_EXDAB_PROJECT

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 待确认 | bigint | 19 | bigint | 是 | 是 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | EXDABID | 待确认 | decimal | 19,0 | decimal(19,0) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | PROJECTNAME | 项目名称 | string | 128 | nvarchar(128) | 否 | 否 | 项目名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_EXDAG_PROJECT

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 待确认 | bigint | 19 | bigint | 是 | 是 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | EXDAGID | 待确认 | decimal | 19,0 | decimal(19,0) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | PROJECTNAME | 项目名称 | string | 128 | nvarchar(128) | 否 | 否 | 项目名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |

## 3.3 FAL 对外金融资产负债及交易统计

### 表：T_SAFE_FAL_A0101

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | A0101 | 境外被投资机构代码 | string | 256 | nvarchar(256) | 否 | 否 | 境外被投资机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | A0102 | 境外被投资机构全称 | string | 256 | nvarchar(256) | 否 | 否 | 境外被投资机构全称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | A0103 | 境外被投资机构所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 境外被投资机构所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | A0104 | 境外被投资机构所属行业 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 境外被投资机构所属行业 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | A0105 | 境外被投资机构与本机构的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 境外被投资机构与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | A0106 | 最终控制方全称 | string | 256 | nvarchar(256) | 否 | 否 | 最终控制方全称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | A0107 | 最终控制方所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 最终控制方所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | A0108 | 期末（本机构）表决权比例（%） | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末（本机构）表决权比例（%） |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | A0109 | 期末（本机构）持股比例（%） | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末（本机构）持股比例（%） |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | A0110 | 本机构是否通过SPV或壳机构持有该境外被投资机构 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 本机构是否通过SPV或壳机构持有该境外被投资机构 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | A0111 | 该SPV或壳机构所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 该SPV或壳机构所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | A0112 | 期末会计记账币种（原币） | string | 3 | nvarchar(3) | 否 | 否 | 期末会计记账币种（原币） |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | A0113 | 期末资产 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末资产 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | A0114 | 期末负债 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末负债 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | A0115 | 期末负债中本机构拨付的营运资金 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末负债中本机构拨付的营运资金 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | A0116 | 期末归属于被投资机构全体股东的权益（总额） | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末归属于被投资机构全体股东的权益（总额） |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | A0117 | 期末归属于被投资机构全体股东的权益中的实收资本 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末归属于被投资机构全体股东的权益中的实收资本 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | A0118 | 期末归属于被投资机构全体股东的权益中的资本公积 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末归属于被投资机构全体股东的权益中的资本公积 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | A0119 | 期末归属于被投资机构全体股东的权益中的盈余公积 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末归属于被投资机构全体股东的权益中的盈余公积 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | A0120 | 期末归属于被投资机构全体股东的权益中的未分配利润 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末归属于被投资机构全体股东的权益中的未分配利润 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | A0121 | 期末归属于被投资机构全体股东的权益中的其他 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末归属于被投资机构全体股东的权益中的其他 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | A0122 | 期末少数股东权益 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末少数股东权益 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | A0123 | 本期利润总额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本期利润总额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | A0124 | 本期被投资机构全体股东应享净利润 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本期被投资机构全体股东应享净利润 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | A0125 | 本月分配申报主体的利润 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月分配申报主体的利润 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | A0126 | 对所在国缴纳的税金总额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 对所在国缴纳的税金总额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | A0127 | 年末从业人数(人) | decimal | 19,0 | decimal(19,0) | 否 | 否 | 年末从业人数(人) |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | A0128 | 年末从业人数中的中方雇员数 | decimal | 19,0 | decimal(19,0) | 否 | 否 | 年末从业人数中的中方雇员数 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | A01291 | 可流通股票（份额）的记账币种（原币）1 | string | 3 | nvarchar(3) | 否 | 否 | 可流通股票（份额）的记账币种（原币）1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | A01292 | 可流通股票（份额）的记账币种（原币）2 | string | 3 | nvarchar(3) | 否 | 否 | 可流通股票（份额）的记账币种（原币）2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 51 | A01293 | 可流通股票（份额）的记账币种（原币）3 | string | 3 | nvarchar(3) | 否 | 否 | 可流通股票（份额）的记账币种（原币）3 |  | SQL Server safe.sys.columns / extended_properties |  |
| 52 | A01294 | 可流通股票（份额）的记账币种（原币）4 | string | 3 | nvarchar(3) | 否 | 否 | 可流通股票（份额）的记账币种（原币）4 |  | SQL Server safe.sys.columns / extended_properties |  |
| 53 | A01295 | 可流通股票（份额）的记账币种（原币）5 | string | 3 | nvarchar(3) | 否 | 否 | 可流通股票（份额）的记账币种（原币）5 |  | SQL Server safe.sys.columns / extended_properties |  |
| 54 | A01301 | 本机构持股（份额）数量1 | decimal | 19,0 | decimal(19,0) | 否 | 否 | 本机构持股（份额）数量1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 55 | A01302 | 本机构持股（份额）数量2 | decimal | 19,0 | decimal(19,0) | 否 | 否 | 本机构持股（份额）数量2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 56 | A01303 | 本机构持股（份额）数量3 | decimal | 19,0 | decimal(19,0) | 否 | 否 | 本机构持股（份额）数量3 |  | SQL Server safe.sys.columns / extended_properties |  |
| 57 | A01304 | 本机构持股（份额）数量4 | decimal | 19,0 | decimal(19,0) | 否 | 否 | 本机构持股（份额）数量4 |  | SQL Server safe.sys.columns / extended_properties |  |
| 58 | A01305 | 本机构持股（份额）数量5 | decimal | 19,0 | decimal(19,0) | 否 | 否 | 本机构持股（份额）数量5 |  | SQL Server safe.sys.columns / extended_properties |  |
| 59 | A01311 | 每股（每份）市价1 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 每股（每份）市价1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 60 | A01312 | 每股（每份）市价2 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 每股（每份）市价2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 61 | A01313 | 每股（每份）市价3 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 每股（每份）市价3 |  | SQL Server safe.sys.columns / extended_properties |  |
| 62 | A01314 | 每股（每份）市价4 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 每股（每份）市价4 |  | SQL Server safe.sys.columns / extended_properties |  |
| 63 | A01315 | 每股（每份）市价5 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 每股（每份）市价5 |  | SQL Server safe.sys.columns / extended_properties |  |
| 64 | A0139 | 该SPV或壳机构名称 | string | 100 | nvarchar(100) | 否 | 否 | 该SPV或壳机构名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 65 | A0140 | 该SPV或壳机构代码 | string | 100 | nvarchar(100) | 否 | 否 | 该SPV或壳机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 66 | A0141 | 该SPV或壳机构所属部门 | string | 100 | nvarchar(100) | 否 | 否 | 该SPV或壳机构所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 67 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 68 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 69 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 70 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 71 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 72 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 73 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 74 | A0142 | 申报主体持有该SPV或壳机构的股权比例（%） | decimal | 22,2 | decimal(22,2) | 否 | 否 | 申报主体持有该SPV或壳机构的股权比例（%） |  | SQL Server safe.sys.columns / extended_properties |  |
| 75 | A0143 | 境外被投资机构是否为上市企业 | int | 10 | int | 否 | 否 | 境外被投资机构是否为上市企业 |  | SQL Server safe.sys.columns / extended_properties |  |
| 76 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 77 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 78 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 79 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_A0102

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | A0101 | 境外被投资机构代码 | string | 256 | nvarchar(256) | 否 | 否 | 境外被投资机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | A0132 | 投资/撤资日期 | datetime |  | datetime2 | 否 | 否 | 投资/撤资日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | A0133 | 投资币种（原币） | string | 3 | nvarchar(3) | 否 | 否 | 投资币种（原币） |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | A0134 | 投资金额增减（+或-） | decimal | 22,2 | decimal(22,2) | 否 | 否 | 投资金额增减（+或-） |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | A0135 | 本机构持有表决权比例增减(%) | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本机构持有表决权比例增减(%) |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | A0136 | 直接投资类型 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 直接投资类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | A0137 | 出资/撤资方式 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 出资/撤资方式 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | A0138 | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_A0201

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | A0201 | 期末会计记账币种（原币） | string | 3 | nvarchar(3) | 否 | 否 | 期末会计记账币种（原币） |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | A0202 | 期末资产 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末资产 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | A0203 | 期末负债 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末负债 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | A0204 | 期末负债中境外母公司拨付的营运资金 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末负债中境外母公司拨付的营运资金 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | A0205 | 期末归属于本机构全体股东的权益(总额) | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末归属于本机构全体股东的权益(总额) |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | A0206 | 期末归属于本机构全体股东的权益中的实收资本 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末归属于本机构全体股东的权益中的实收资本 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | A0207 | 期末归属于本机构全体股东的权益中的资本公积 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末归属于本机构全体股东的权益中的资本公积 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | A0208 | 期末归属于本机构全体股东的权益中的盈余公积 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末归属于本机构全体股东的权益中的盈余公积 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | A0209 | 期末归属于本机构全体股东的权益中的未分配利润 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末归属于本机构全体股东的权益中的未分配利润 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | A0210 | 期末归属于本机构全体股东的权益中的其他 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末归属于本机构全体股东的权益中的其他 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | A0211 | 期末少数股东权益 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末少数股东权益 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | A0212 | 本期利润总额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本期利润总额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | A0213 | 本期本机构全体股东应享净利润 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本期本机构全体股东应享净利润 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | A0214 | 本月本机构分配给全体股东的利润 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月本机构分配给全体股东的利润 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | A0215 | 本机构在境内缴纳的税金总额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本机构在境内缴纳的税金总额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | A0216 | 年末从业人数(人) | decimal | 19,0 | decimal(19,0) | 否 | 否 | 年末从业人数(人) |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | A0217 | 年末从业人数中的外方雇员数（人） | decimal | 19,0 | decimal(19,0) | 否 | 否 | 年末从业人数中的外方雇员数（人） |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_A0202

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | A0218 | 境外投资者代码 | string | 255 | nvarchar(255) | 否 | 否 | 境外投资者代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | A0219 | 境外投资者全称 | string | 255 | nvarchar(255) | 否 | 否 | 境外投资者全称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | A0220 | 境外投资者所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 境外投资者所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | A0221 | 境外投资者所属行业 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 境外投资者所属行业 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | A0222 | 境外投资者与本机构的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 境外投资者与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | A0223 | 最终控制方全称 | string | 255 | nvarchar(255) | 否 | 否 | 最终控制方全称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | A0224 | 最终控制方所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 最终控制方所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | A0225 | 期末(外方)表决权比例(%) | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末(外方)表决权比例(%) |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | A0226 | 期末(外方)持股比例(%) | decimal | 22,2 | decimal(22,2) | 否 | 否 | 期末(外方)持股比例(%) |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | A02271 | 可流通股票（份额）的记账币种（原币）1 | string | 3 | nvarchar(3) | 否 | 否 | 可流通股票（份额）的记账币种（原币）1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | A02272 | 可流通股票（份额）的记账币种（原币）2 | string | 3 | nvarchar(3) | 否 | 否 | 可流通股票（份额）的记账币种（原币）2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | A02273 | 可流通股票（份额）的记账币种（原币）3 | string | 3 | nvarchar(3) | 否 | 否 | 可流通股票（份额）的记账币种（原币）3 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | A02274 | 可流通股票（份额）的记账币种（原币）4 | string | 3 | nvarchar(3) | 否 | 否 | 可流通股票（份额）的记账币种（原币）4 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | A02275 | 可流通股票（份额）的记账币种（原币）5 | string | 3 | nvarchar(3) | 否 | 否 | 可流通股票（份额）的记账币种（原币）5 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | A02281 | 持股（份额）数量1 | decimal | 19,0 | decimal(19,0) | 否 | 否 | 持股（份额）数量1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | A02282 | 持股（份额）数量2 | decimal | 19,0 | decimal(19,0) | 否 | 否 | 持股（份额）数量2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | A02283 | 持股（份额）数量3 | decimal | 19,0 | decimal(19,0) | 否 | 否 | 持股（份额）数量3 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | A02284 | 持股（份额）数量4 | decimal | 19,0 | decimal(19,0) | 否 | 否 | 持股（份额）数量4 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | A02285 | 持股（份额）数量5 | decimal | 19,0 | decimal(19,0) | 否 | 否 | 持股（份额）数量5 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | A02291 | 每股（每份）市价1 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 每股（每份）市价1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | A02292 | 每股（每份）市价2 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 每股（每份）市价2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | A02293 | 每股（每份）市价3 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 每股（每份）市价3 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | A02294 | 每股（每份）市价4 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 每股（每份）市价4 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | A02295 | 每股（每份）市价5 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 每股（每份）市价5 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 51 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 52 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 53 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 54 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 55 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_A0203

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | A0218 | 境外投资者代码 | string | 255 | nvarchar(255) | 否 | 否 | 境外投资者代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | A0230 | 投资/撤资日期 | datetime |  | datetime2 | 否 | 否 | 投资/撤资日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | A0231 | 投资币种（原币) | string | 3 | nvarchar(3) | 否 | 否 | 投资币种（原币) |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | A0232 | 投资金额增减（+或-） | decimal | 22,2 | decimal(22,2) | 否 | 否 | 投资金额增减（+或-） |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | A0233 | 外方持有表决权比例增减(%) | decimal | 22,2 | decimal(22,2) | 否 | 否 | 外方持有表决权比例增减(%) |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | A0234 | 直接投资类型 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 直接投资类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | A0235 | 出资/撤资方式 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 出资/撤资方式 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | A0236 | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_E01

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 待确认 | bigint | 19 | bigint | 是 | 是 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 待确认 | string | 64 | nvarchar(64) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 待确认 | datetime |  | datetime2 | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 待确认 | string | 64 | nvarchar(64) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 待确认 | datetime |  | datetime2 | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 待确认 | int | 10 | int | 是 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 待确认 | string | 64 | nvarchar(64) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 待确认 | datetime |  | datetime2 | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 待确认 | string | 128 | nvarchar(128) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 待确认 | string | 1 | nvarchar(1) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 待确认 | decimal | 19,0 | decimal(19,0) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 待确认 | int | 10 | int | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 待确认 | int | 10 | int | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 待确认 | string | 64 | nvarchar(64) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 待确认 | int | 10 | int | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 待确认 | string | 128 | nvarchar(128) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 待确认 | string | 128 | nvarchar(128) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | 待确认 | string | 32 | nvarchar(32) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | 待确认 | string | 100 | nvarchar(100) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 待确认 | string | 32 | nvarchar(32) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 待确认 | decimal | 10,0 | decimal(10,0) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | E0101 | 待确认 | string | 6 | nvarchar(6) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | E0102 | 待确认 | string | 3 | nvarchar(3) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | E0103 | 待确认 | decimal | 22,2 | decimal(22,2) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | E0104 | 待确认 | decimal | 22,2 | decimal(22,2) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | OBJCODE | 待确认 | string | 18 | nvarchar(18) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | REMARK | 待确认 | string | 512 | nvarchar(512) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | SNOCODE | 待确认 | string | 36 | nvarchar(36) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | BUSDATE | 待确认 | datetime |  | datetime2 | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | DECLAREUPDORDELTIME | 待确认 | datetime |  | datetime2 | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | BUSINESSCODE | 待确认 | string | 30 | nvarchar(30) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | E0101CUR | 待确认 | string | 3 | nvarchar(3) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | SAFEERRINFO | 待确认 | string | 1000 | nvarchar(1000) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | LOGFEEDBACKSTATUS | 待确认 | string | 64 | varchar(64) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | MANUALFLAG | 待确认 | string | 1 | varchar(1) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | OPERATEREMARK | 待确认 | string | 1000 | nvarchar(1000) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_E0101

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | BRANCHID | 机构ID | bigint | 19 | bigint | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | nvarchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | MANUALFLAG | 人工操作标识 | string | 1 | nvarchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | OBJCODE | 申报主体代码 | string | 18 | nvarchar(18) | 否 | 否 | 申报主体代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | BUOCMONTH | 报告期 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | E0101 | 交易代码 | string | 6 | nvarchar(6) | 否 | 否 | 交易代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | E0102 | 交易对方国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 交易对方国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | E0103 | 对方部门 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 对方部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | E0104 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | E0105 | 本月出口额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月出口额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | E0106 | 本月收到的出口货款金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月收到的出口货款金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | E0107 | 上月末账面出口应收款余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末账面出口应收款余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | E0108 | 本月末账面出口应收款余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末账面出口应收款余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | E0109 | 上月末账面出口预收款余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末账面出口预收款余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | E0110 | 本月末账面出口预收款余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末账面出口预收款余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_E0102

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | BRANCHID | 机构ID | bigint | 19 | bigint | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | nvarchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | MANUALFLAG | 人工操作标识 | string | 1 | nvarchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | OBJCODE | 申报主体代码 | string | 18 | nvarchar(18) | 否 | 否 | 申报主体代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | BUOCMONTH | 报告期 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | E0111 | 交易代码 | string | 6 | nvarchar(6) | 否 | 否 | 交易代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | E0112 | 交易对方国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 交易对方国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | E0113 | 对方部门 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 对方部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | E0114 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | E0115 | 本月进口额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月进口额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | E0116 | 本月支付的进口货款金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月支付的进口货款金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | E0117 | 上月末账面进口应付款余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末账面进口应付款余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | E0118 | 本月末账面进口应付款余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末账面进口应付款余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | E0119 | 上月末账面进口预付款余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末账面进口预付款余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | E0120 | 本月末账面进口预付款余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末账面进口预付款余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_E0103

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | BRANCHID | 机构ID | bigint | 19 | bigint | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | nvarchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | MANUALFLAG | 人工操作标识 | string | 1 | nvarchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | OBJCODE | 申报主体代码 | string | 18 | nvarchar(18) | 否 | 否 | 申报主体代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | BUOCMONTH | 报告期 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | E0121 | 进出口类型 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 进出口类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | E0122 | 商品类别 | string | 2 | nvarchar(2) | 否 | 否 | 商品类别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | E0123 | 进出口商品金额（折人民币） | decimal | 22,2 | decimal(22,2) | 否 | 否 | 进出口商品金额（折人民币） |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_E0104

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | BRANCHID | 机构ID | bigint | 19 | bigint | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | nvarchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | MANUALFLAG | 人工操作标识 | string | 1 | nvarchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | OBJCODE | 申报主体代码 | string | 18 | nvarchar(18) | 否 | 否 | 申报主体代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | BUOCMONTH | 报告期 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | E0124 | 进出口类型 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 进出口类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | E0125 | 年末应收/应付款余额（折人民币） | decimal | 22,2 | decimal(22,2) | 否 | 否 | 年末应收/应付款余额（折人民币） |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | E0126 | 其中：对关联企业应收/应付款余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 其中：对关联企业应收/应付款余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | E0127 | 应收/应付款平均周期（天） | decimal | 6,0 | decimal(6,0) | 否 | 否 | 应收/应付款平均周期（天） |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | E0128 | 原始期限超过一年的金额（折人民币） | decimal | 22,2 | decimal(22,2) | 否 | 否 | 原始期限超过一年的金额（折人民币） |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_E0201

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | decimal | 18,0 | decimal(18,0) | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | decimal | 18,0 | decimal(18,0) | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | decimal | 18,0 | decimal(18,0) | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | decimal | 18,0 | decimal(18,0) | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | BUOCMONTH | 报告期 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | E0201 | 境外项目代码 | string | 256 | nvarchar(256) | 否 | 否 | 境外项目代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | E0202 | 境外项目全称 | string | 256 | nvarchar(256) | 否 | 否 | 境外项目全称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | E0203 | 境外项目所在国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 境外项目所在国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | E0204 | 项目类型 | decimal | 1,0 | decimal(1,0) | 否 | 否 | 项目类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | E0205 | 签约主体类型 | decimal | 1,0 | decimal(1,0) | 否 | 否 | 签约主体类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | E0206 | 签约主体名称 | string | 256 | nvarchar(256) | 否 | 否 | 签约主体名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | E0207 | 合同签约币种 | string | 3 | nvarchar(3) | 否 | 否 | 合同签约币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | E0208 | 合同签约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 合同签约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | E0209 | 项目建设期限（月） | decimal | 22,2 | decimal(22,2) | 否 | 否 | 项目建设期限（月） |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | E0210 | 是否存在分包 | decimal | 1,0 | decimal(1,0) | 否 | 否 | 是否存在分包 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | E02111 | 实际承包主体代码1 | string | 256 | nvarchar(256) | 否 | 否 | 实际承包主体代码1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | E02121 | 实际承包主体名称1 | string | 256 | nvarchar(256) | 否 | 否 | 实际承包主体名称1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | E02131 | 实际承包主体类型1 | string | 3 | nvarchar(3) | 否 | 否 | 实际承包主体类型1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | E02112 | 实际承包主体代码2 | string | 256 | nvarchar(256) | 否 | 否 | 实际承包主体代码2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | E02122 | 实际承包主体名称2 | string | 256 | nvarchar(256) | 否 | 否 | 实际承包主体名称2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | E02132 | 实际承包主体类型2 | string | 3 | nvarchar(3) | 否 | 否 | 实际承包主体类型2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | E02113 | 实际承包主体代码3 | string | 256 | nvarchar(256) | 否 | 否 | 实际承包主体代码3 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | E02123 | 实际承包主体名称3 | string | 256 | nvarchar(256) | 否 | 否 | 实际承包主体名称3 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | E02133 | 实际承包主体类型3 | string | 3 | nvarchar(3) | 否 | 否 | 实际承包主体类型3 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | E02114 | 实际承包主体代码4 | string | 256 | nvarchar(256) | 否 | 否 | 实际承包主体代码4 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | E02124 | 实际承包主体名称4 | string | 256 | nvarchar(256) | 否 | 否 | 实际承包主体名称4 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | E02134 | 实际承包主体类型4 | string | 3 | nvarchar(3) | 否 | 否 | 实际承包主体类型4 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | E02115 | 实际承包主体代码5 | string | 256 | nvarchar(256) | 否 | 否 | 实际承包主体代码5 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | E02125 | 实际承包主体名称5 | string | 256 | nvarchar(256) | 否 | 否 | 实际承包主体名称5 |  | SQL Server safe.sys.columns / extended_properties |  |
| 51 | E02135 | 实际承包主体类型5 | string | 3 | nvarchar(3) | 否 | 否 | 实际承包主体类型5 |  | SQL Server safe.sys.columns / extended_properties |  |
| 52 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 53 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 54 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 55 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 56 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 57 | E0203CODE | 项目业主所在国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 项目业主所在国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_E0202

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | decimal | 18,0 | decimal(18,0) | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | decimal | 18,0 | decimal(18,0) | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | decimal | 18,0 | decimal(18,0) | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | decimal | 18,0 | decimal(18,0) | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | BUOCMONTH | 报告期 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | E0205 | 签约主体类型 | decimal | 1,0 | decimal(1,0) | 否 | 否 | 签约主体类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | E0214 | 建设项目所在国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 建设项目所在国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | E0215 | 记账币种 | string | 3 | nvarchar(3) | 否 | 否 | 记账币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | E0216 | 本月确认收入 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月确认收入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | E0217 | 本月确认对境内成本 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月确认对境内成本 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | E0218 | 从我国境内采购货物金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 从我国境内采购货物金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | E0219 | 从我国境内采购服务金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 从我国境内采购服务金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | E0220 | 外派居民雇员报酬 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 外派居民雇员报酬 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | E0221 | 对境内其他成本金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 对境内其他成本金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | E0222 | 本月确认对境外成本 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月确认对境外成本 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | E0223 | 从我国以外国家/地区采购货物金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 从我国以外国家/地区采购货物金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | E0224 | 从我国以外国家/地区采购服务金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 从我国以外国家/地区采购服务金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | E0225 | 非居民雇员报酬 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 非居民雇员报酬 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | E0226 | 对境外其他成本金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 对境外其他成本金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | E0227 | 本月计提境外税金 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月计提境外税金 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | E0228 | 本月净利润 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月净利润 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | REMARK | 待确认 | string | 512 | nvarchar(512) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | E0214CODE | 项目业主所在国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 项目业主所在国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | E0229 | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_E03

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 待确认 | bigint | 19 | bigint | 是 | 是 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 待确认 | string | 64 | nvarchar(64) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 待确认 | datetime |  | datetime2 | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 待确认 | string | 64 | nvarchar(64) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 待确认 | datetime |  | datetime2 | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 待确认 | decimal | 18,0 | decimal(18,0) | 是 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 待确认 | string | 64 | nvarchar(64) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 待确认 | datetime |  | datetime2 | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | BRANCHID | 待确认 | decimal | 19,0 | decimal(19,0) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | SAFEBRANCHCODE | 待确认 | string | 32 | nvarchar(32) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | SAFEBRANCHNAME | 待确认 | string | 100 | nvarchar(100) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | ISFEEDBACK | 待确认 | decimal | 18,0 | decimal(18,0) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | REFUSEREASON | 待确认 | string | 128 | nvarchar(128) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | RESETREASON | 待确认 | string | 128 | nvarchar(128) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | DATASOURCE | 待确认 | decimal | 18,0 | decimal(18,0) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | DATASTATUS | 待确认 | decimal | 18,0 | decimal(18,0) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | DEALNO | 待确认 | string | 64 | nvarchar(64) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | ACTIONTYPE | 待确认 | string | 1 | nvarchar(1) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | ACTIONDESC | 待确认 | string | 128 | nvarchar(128) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | SNOCODE | 待确认 | string | 36 | nvarchar(36) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | OBJCODE | 待确认 | string | 18 | nvarchar(18) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | BUOCMONTH | 待确认 | decimal | 6,0 | decimal(6,0) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | E0301 | 待确认 | int | 10 | int | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | E0302 | 待确认 | int | 10 | int | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | E0303 | 待确认 | string | 3 | nvarchar(3) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | E0304 | 待确认 | string | 3 | nvarchar(3) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | E0305 | 待确认 | string | 3 | nvarchar(3) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | E0306 | 待确认 | string | 3 | nvarchar(3) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | E0307 | 待确认 | decimal | 22,2 | decimal(22,2) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | TNAME | 待确认 | string | 32 | nvarchar(32) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | REMARK | 待确认 | string | 512 | nvarchar(512) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | BUSDATE | 待确认 | datetime |  | datetime2 | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | DECLAREUPDORDELTIME | 待确认 | datetime |  | datetime2 | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | BUSINESSCODE | 待确认 | string | 30 | nvarchar(30) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | SAFEERRINFO | 待确认 | string | 1000 | nvarchar(1000) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | LOGFEEDBACKSTATUS | 待确认 | string | 64 | varchar(64) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | MANUALFLAG | 待确认 | string | 1 | varchar(1) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | OPERATEREMARK | 待确认 | string | 1000 | nvarchar(1000) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_E0301

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | BRANCHID | 机构ID | bigint | 19 | bigint | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | nvarchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | MANUALFLAG | 人工操作标识 | string | 1 | nvarchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | OBJCODE | 申报主体代码 | string | 18 | nvarchar(18) | 否 | 否 | 申报主体代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | BUOCMONTH | 报告期 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | E0301 | 运输方式 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 运输方式 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | E0301CUR | 记账币种 | string | 3 | nvarchar(3) | 否 | 否 | 记账币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | E0302 | 非居民旅客所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 非居民旅客所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | E0303 | 客运收入 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 客运收入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | E0304 | 货运业务类型 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 货运业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | E0305 | 交易对手方所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 交易对手方所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | E0306 | 始发地 | string | 3 | nvarchar(3) | 否 | 否 | 始发地 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | E0307 | 目的地 | string | 3 | nvarchar(3) | 否 | 否 | 目的地 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | E0308 | 货运收入 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 货运收入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | E0309 | 货运重量单位 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 货运重量单位 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | E0310 | 货物重量 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 货物重量 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_E0302

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | BRANCHID | 机构ID | bigint | 19 | bigint | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | nvarchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | MANUALFLAG | 人工操作标识 | string | 1 | nvarchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | OBJCODE | 申报主体代码 | string | 18 | nvarchar(18) | 否 | 否 | 申报主体代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | BUOCMONTH | 报告期 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | E0311 | 运输方式 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 运输方式 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | E0311CUR | 记账币种 | string | 3 | nvarchar(3) | 否 | 否 | 记账币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | E0312 | 支出业务类型 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 支出业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | E0313 | 交易对手方所属国家/地区（支出） | string | 3 | nvarchar(3) | 否 | 否 | 交易对手方所属国家/地区（支出） |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | E0314 | 当期支出 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 当期支出 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_E0303

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | BRANCHID | 机构ID | bigint | 19 | bigint | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | nvarchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | MANUALFLAG | 人工操作标识 | string | 1 | nvarchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | OBJCODE | 申报主体代码 | string | 18 | nvarchar(18) | 否 | 否 | 申报主体代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | BUOCMONTH | 报告期 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | E0315 | 运输方式 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 运输方式 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | E0315CUR | 记账币种 | string | 3 | nvarchar(3) | 否 | 否 | 记账币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | E0316 | 总公司所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 总公司所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | E0317 | 当期为中国居民提供的客运服务收入 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 当期为中国居民提供的客运服务收入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | E0318 | 当期货物进口到中国方向运输收入 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 当期货物进口到中国方向运输收入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | E0319 | 当期货物自中国出口方向运输收入 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 当期货物自中国出口方向运输收入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | E0320 | 当期境内运输附属服务费用 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 当期境内运输附属服务费用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | E0321 | 当期境内购买货物费用 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 当期境内购买货物费用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | E0322 | 当期境内其他费用 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 当期境内其他费用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_E0304

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | BRANCHID | 机构ID | bigint | 19 | bigint | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | nvarchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | MANUALFLAG | 人工操作标识 | string | 1 | nvarchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | OBJCODE | 申报主体代码 | string | 18 | nvarchar(18) | 否 | 否 | 申报主体代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | BUOCMONTH | 报告期 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | E0323 | 运输方式（油气类） | decimal | 6,0 | decimal(6,0) | 否 | 否 | 运输方式（油气类） |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | E0323CUR | 记账币种 | string | 3 | nvarchar(3) | 否 | 否 | 记账币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | E0324 | 承运人所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 承运人所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | E0325 | 成交条件 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 成交条件 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | E0326 | 当期运费 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 当期运费 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_E04

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | BRANCHID | 机构ID | bigint | 19 | bigint | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | nvarchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | MANUALFLAG | 人工操作标识 | string | 1 | nvarchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | OBJCODE | 申报主体代码 | string | 18 | nvarchar(18) | 否 | 否 | 申报主体代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | BUOCMONTH | 报告期 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | E0401CODE | 申报主体身份 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 申报主体身份 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | E0401 | 交易代码 | string | 6 | nvarchar(6) | 否 | 否 | 交易代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | E0402 | 交易对方国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 交易对方国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | E0403 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | E0404 | 收入金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 收入金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | E0405 | 支出金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 支出金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_E09

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | BRANCHID | 机构ID | bigint | 19 | bigint | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | nvarchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | MANUALFLAG | 人工操作标识 | string | 1 | nvarchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | OBJCODE | 申报主体代码 | string | 18 | nvarchar(18) | 否 | 否 | 申报主体代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | BUOCMONTH | 报告期 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | E0901 | 境内主体名称 | string | 256 | nvarchar(256) | 否 | 否 | 境内主体名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | E0902 | 境内主体统一社会信用代码 | string | 18 | nvarchar(18) | 否 | 否 | 境内主体统一社会信用代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | E0903 | 境内主体所属行业标识码 | string | 4 | nvarchar(4) | 否 | 否 | 境内主体所属行业标识码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | E0904 | 经济类型 | string | 3 | nvarchar(3) | 否 | 否 | 经济类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | E0905 | 境内主体所在地 | string | 6 | nvarchar(6) | 否 | 否 | 境内主体所在地 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | E0906 | 交易代码 | string | 6 | nvarchar(6) | 否 | 否 | 交易代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | E0907 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | E0908 | 交易对方国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 交易对方国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | E0909 | 出口金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 出口金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | E0910 | 进口金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 进口金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_I01

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | I0101 | 保险类别 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 保险类别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | I0102 | 保单持有人所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 保单持有人所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | I0103 | 保单持有人所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 保单持有人所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | I0104 | 保单持有人与本机构的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 保单持有人与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | I0105 | 填表币种 | string | 3 | nvarchar(3) | 否 | 否 | 填表币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | I0106 | 本月已赚毛保费总额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月已赚毛保费总额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | I0107 | 本月归属于非居民保单持有人的收益（补充保费） | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月归属于非居民保单持有人的收益（补充保费） |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | I0108 | 本月应付索赔/福利总额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月应付索赔/福利总额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | I0109 | 上月末保单责任准备金余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末保单责任准备金余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | I0110 | 本月末保单责任准备金余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末保单责任准备金余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | I0111 | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_I02

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | I0201 | 保险类别 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 保险类别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | I0202 | 再保险分出人所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 再保险分出人所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | I0203 | 再保险分出人所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 再保险分出人所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | I0204 | 再保险分出人与本机构的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 再保险分出人与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | I0205 | 填表币种 | string | 3 | nvarchar(3) | 否 | 否 | 填表币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | I0206 | 本月分入业务已赚分保费收入 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月分入业务已赚分保费收入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | I0207 | 本月归属于非居民保单持有人的收益（补充保费） | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月归属于非居民保单持有人的收益（补充保费） |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | I0208 | 本月应付分保费用 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月应付分保费用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | I0209 | 本月应付分保赔款 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月应付分保赔款 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | I0210 | 上月末分保责任准备金余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末分保责任准备金余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | I0211 | 本月末分保责任准备金余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末分保责任准备金余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | I0212 | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_I03

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | I0301 | 保险类别 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 保险类别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | I0302 | 再保险接受人所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 再保险接受人所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | I0303 | 再保险接受人所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 再保险接受人所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | I0304 | 再保险接受人与本机构的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 再保险接受人与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | I0305 | 填表币种 | string | 3 | nvarchar(3) | 否 | 否 | 填表币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | I0306 | 本月分出业务保费支出 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月分出业务保费支出 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | I0307 | 本月摊回分保费用收入 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月摊回分保费用收入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | I0308 | 本月摊回赔付成本收入 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月摊回赔付成本收入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | I0309 | 上月末应收分保责任准备金余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末应收分保责任准备金余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | I0310 | 本月末应收分保责任准备金余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末应收分保责任准备金余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | I0311 | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_Z01

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | CONTACT | 牵头部门联系人 | string | 256 | nvarchar(256) | 否 | 否 | 牵头部门联系人 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | DPT | 牵头部门 | string | 256 | nvarchar(256) | 否 | 否 | 牵头部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | TEL | 牵头部门联系电话 | string | 256 | nvarchar(256) | 否 | 否 | 牵头部门联系电话 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | Z0101 | 填报单位名称 | string | 256 | nvarchar(256) | 否 | 否 | 填报单位名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | Z0101NAME | 填报单位英文全称 | string | 256 | nvarchar(256) | 否 | 否 | 填报单位英文全称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | Z0102 | 证照类别 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 证照类别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | Z0103 | 证照号码 | string | 30 | nvarchar(30) | 否 | 否 | 证照号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | Z0104 | 金融机构代码 | string | 4 | nvarchar(4) | 否 | 否 | 金融机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | Z0104CODE | SWIFT代码 | string | 11 | nvarchar(11) | 否 | 否 | SWIFT代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | Z0105 | 申报主体所属行业标识码 | string | 4 | nvarchar(4) | 否 | 否 | 申报主体所属行业标识码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | Z0106 | 经济类型 | string | 3 | nvarchar(3) | 否 | 否 | 经济类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | Z0107 | 填报单位类型 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 填报单位类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | Z0108 | 所在地 | string | 6 | nvarchar(6) | 否 | 否 | 所在地 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | Z0109 | 地址 | string | 256 | nvarchar(256) | 否 | 否 | 地址 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | Z0112 | LEI编码 中文全称为全球法人机构识别编码 | string | 20 | nvarchar(20) | 否 | 否 | LEI编码 中文全称为全球法人机构识别编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | Z0101TYPE | 申报主体类别 | string | 256 | nvarchar(256) | 否 | 否 | 申报主体类别 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_Z02

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | TABLECODE | 表号 | string | 5 | nvarchar(5) | 否 | 否 | 表号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | TABLENAME | 表名 | string | 256 | nvarchar(256) | 否 | 否 | 表名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | Z0201 | 本机构是否有相关业务(1-有，0-无。) | decimal | 10,0 | decimal(10,0) | 否 | 否 | 本机构是否有相关业务(1-有，0-无。) |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | Z0202 | 填报部门 | string | 256 | nvarchar(256) | 否 | 否 | 填报部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | Z0203 | 统计负责人 | string | 256 | nvarchar(256) | 否 | 否 | 统计负责人 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | Z0204 | 统计负责人电话 | string | 256 | nvarchar(256) | 否 | 否 | 统计负责人电话 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | Z0205 | 填表人 | string | 256 | nvarchar(256) | 否 | 否 | 填表人 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | Z0206 | 填表人电话及电子邮箱 | string | 256 | nvarchar(256) | 否 | 否 | 填表人电话及电子邮箱 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FAL_Z03

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | Z0301 | 投资者名称 | string | 256 | nvarchar(256) | 否 | 否 | 投资者名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | Z0302 | 投资者代码 | string | 256 | nvarchar(256) | 否 | 否 | 投资者代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | Z0303 | 投资者所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 投资者所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | Z0304 | 投资者所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 投资者所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | Z0305 | 投资者表决权比例 (取值范围10≤ z0305 ≤100) | decimal | 22,2 | decimal(22,2) | 否 | 否 | 投资者表决权比例 (取值范围10≤ z0305 ≤100) |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | Z0306 | 被投资机构名称 | string | 256 | nvarchar(256) | 否 | 否 | 被投资机构名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | Z0307 | 被投资机构代码 | string | 256 | nvarchar(256) | 否 | 否 | 被投资机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | Z0308 | 被投资机构所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 被投资机构所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | Z0309 | 被投资机构所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 被投资机构所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALB_01

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | B0101 | 填报机构身份 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 填报机构身份 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | B0102 | 被代理人/委托人所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 被代理人/委托人所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | B0103 | 被代理人/委托人所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 被代理人/委托人所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | B0104 | 投资类型 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 投资类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | B0104CODE | 业务类型 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | B0105 | 发行地 | string | 3 | nvarchar(3) | 否 | 否 | 发行地 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | B0106 | 证券代码（逐支报送使用） | string | 255 | nvarchar(255) | 否 | 否 | 证券代码（逐支报送使用） |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | B0107 | 证券发行主体名称（逐支报送使用） | string | 255 | nvarchar(255) | 否 | 否 | 证券发行主体名称（逐支报送使用） |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | B0108 | 发行主体所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 发行主体所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | B0109 | 发行主体所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 发行主体所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | B0110 | 发行主体与本机构的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 发行主体与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | B0111 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | B0112 | 上月末市值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末市值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | B0113 | 本月买入金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月买入金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | B0114 | 本月卖出金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月卖出金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | B0115 | 本月非交易变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | B0116 | 本月非交易变动：其中注销、调整或重新分类至其他报表统计的金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动：其中注销、调整或重新分类至其他报表统计的金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | B0117 | 本月非交易变动：其中价值重估因素 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动：其中价值重估因素 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | B0118 | 本月末市值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末市值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | B0119 | 本月股息/红利收入 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月股息/红利收入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | B0120 | 待确认 | decimal | 19,0 | decimal(19,0) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | B0121 | 本月末每股（每份）市价（逐支报送使用） | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末每股（每份）市价（逐支报送使用） |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 51 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 52 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 53 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALB_02

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | B0201 | 填报机构身份 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 填报机构身份 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | B0202 | 被代理人/委托人所属国家/地区        | string | 3 | nvarchar(3) | 否 | 否 | 被代理人/委托人所属国家/地区        |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | B0203 | 被代理人/委托人所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 被代理人/委托人所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | B0204 | 发行地 | string | 3 | nvarchar(3) | 否 | 否 | 发行地 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | B0205 | 证券代码（逐支报送使用） | string | 255 | nvarchar(255) | 否 | 否 | 证券代码（逐支报送使用） |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | B0206 | /证券发行主体名称（逐支报送使用） | string | 255 | nvarchar(255) | 否 | 否 | /证券发行主体名称（逐支报送使用） |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | B0207 | 发行主体所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 发行主体所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | B0208 | 发行主体所属部门  | decimal | 10,0 | decimal(10,0) | 否 | 否 | 发行主体所属部门  |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | B0209 | 发行主体与本机构的关系   | decimal | 10,0 | decimal(10,0) | 否 | 否 | 发行主体与本机构的关系   |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | B0210 | 原始期限 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 原始期限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | B0211 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | B0212 | 上月末市值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末市值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | B0213 | 本月买入金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月买入金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | B0214 | 本月卖出金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月卖出金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | B0215 | 本月非交易变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | B0216 | 本月非交易变动：其中注销、调整或重新分类至其他报表统计的金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动：其中注销、调整或重新分类至其他报表统计的金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | B0217 | 本月非交易变动：其中价值重估因素 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动：其中价值重估因素 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | B0218 | 本月末市值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末市值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | B0219 | 本月末市值中的其中：剩余期限在一年及以下 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末市值中的其中：剩余期限在一年及以下 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | B0220 | 本月利息收入 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月利息收入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | B0201TYPE | 业务类型 | int | 10 | int | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | B0214AMT | 本月卖出金额其中：债券到期或提前兑付的本息金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月卖出金额其中：债券到期或提前兑付的本息金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | B0221 | 本月末未到期/未偿付债券面值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末未到期/未偿付债券面值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 51 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 52 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 53 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 54 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 55 | B0222 | 是否存在风险转移 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 是否存在风险转移 |  | SQL Server safe.sys.columns / extended_properties |  |
| 56 | B0223 | 风险转往国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 风险转往国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 57 | B0224 | 风险转往部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 风险转往部门 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALB_03

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | B0301 | 投资者所属国家/地区（必须为中国） | string | 3 | nvarchar(3) | 否 | 否 | 投资者所属国家/地区（必须为中国） |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | B0302 | 投资者所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 投资者所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | B0303 | 境外付款人与本机构的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 境外付款人与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | B0304 | 所投资产品代码（逐支报送使用） | string | 255 | nvarchar(255) | 否 | 否 | 所投资产品代码（逐支报送使用） |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | B0305 | 非居民发行主体名称（逐支报送使用） | string | 255 | nvarchar(255) | 否 | 否 | 非居民发行主体名称（逐支报送使用） |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | B0306 | 非居民发行主体所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 非居民发行主体所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | B0307 | 境外付款人与本机构的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 境外付款人与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | B0308 | 债务证券原始期限 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 债务证券原始期限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | B0309 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | B0310 | 上月末市值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末市值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | B0311 | 本月买入（申购）金额  | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月买入（申购）金额  |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | B0312 | 本月卖出（赎回）金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月卖出（赎回）金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | B0313 | 本月非交易变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | B0314 | 本月非交易变动：其中债权注销金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动：其中债权注销金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | B0315 | 本月非交易变动：其中价值重估因素 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动：其中价值重估因素 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | B0316 | 本月末市值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末市值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | B0317 | 本月末市值：其中剩余期限在一年及以下 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末市值：其中剩余期限在一年及以下 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | B0318 | 本月投资者红利或利息收入 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月投资者红利或利息收入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | B0319 | 本月末未到期/未偿付债券面值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末未到期/未偿付债券面值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | B0312AMT | 本月卖出（赎回）金额其中：债券到期或提前兑付的本息金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月卖出（赎回）金额其中：债券到期或提前兑付的本息金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 51 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALB_04

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | B0401 | 工具类型 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 工具类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | B0401CODE | 业务类型 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | B0402 | 证券代码 | string | 12 | nvarchar(12) | 否 | 否 | 证券代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | B0403 | 发行地 | string | 3 | nvarchar(3) | 否 | 否 | 发行地 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | B0404 | 投资者名称 | string | 256 | nvarchar(256) | 否 | 否 | 投资者名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | B0405 | 投资者所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 投资者所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | B0406 | 投资者所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 投资者所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | B0407 | 投资者与本机构的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 投资者与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | B0408 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | B0409 | 上月末市值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末市值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | B0410 | 本月发行金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月发行金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | B0411 | 本月回购（赎回）金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月回购（赎回）金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | B0412 | 本月非交易变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | B0413 | 本月非交易变动：其中调整及重新分类至其他报表统计的金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动：其中调整及重新分类至其他报表统计的金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | B0414 | 本月非交易变动：其中价值重估因素 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动：其中价值重估因素 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | B0415 | 本月末市值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末市值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | B0416 | 本月分配投资者的股息/红利 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月分配投资者的股息/红利 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | B0417 | 本月末未实现收益（仅限发行产品为货币市场投资基金份额/单位） | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末未实现收益（仅限发行产品为货币市场投资基金份额/单位） |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | B0418 | 本月末投资者持股（份额）数量 | decimal | 19,0 | decimal(19,0) | 否 | 否 | 本月末投资者持股（份额）数量 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | B0419 | 本月末每股（每份）市价 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末每股（每份）市价 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | B0420 | 本月末投资者持股（份额）比例 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末投资者持股（份额）比例 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 51 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 52 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALB_05

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | B0501 | 证券代码 | string | 12 | nvarchar(12) | 否 | 否 | 证券代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | B0502 | 发行地 | string | 3 | nvarchar(3) | 否 | 否 | 发行地 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | B0503 | 原始期限 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 原始期限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | B0504 | 投资者名称 | string | 255 | nvarchar(255) | 否 | 否 | 投资者名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | B0505 | 投资者所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 投资者所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | B0506 | 投资者所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 投资者所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | B0507 | 投资者与本机构的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 投资者与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | B0508 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | B0509 | 上月末市值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末市值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | B0510 | 本月发行金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月发行金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | B0511 | 本月赎回金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月赎回金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | B0512 | 本月非交易变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | B0513 | 本月非交易变动：其中重新分类等非买卖因素引起的变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动：其中重新分类等非买卖因素引起的变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | B0514 | 本月非交易变动：其中价值重估因素 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动：其中价值重估因素 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | B0515 | 本月末市值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末市值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | B0516 | 本月末市值：其中剩余期限在一年及以下 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末市值：其中剩余期限在一年及以下 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | B0517 | 本月利息支出 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月利息支出 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | EXDEBTCODE | 外债编号 | string | 28 | nvarchar(28) | 否 | 否 | 外债编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | B0518 | 本月末未到期/未偿付债券面值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末未到期/未偿付债券面值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALB_06

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | B0601 | 非居民投资者名称 | string | 256 | nvarchar(256) | 否 | 否 | 非居民投资者名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | B0601TYPE | 业务类型 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | B0602 | 非居民投资者所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 非居民投资者所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | B0603 | 非居民投资者所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 非居民投资者所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | B0604 | 投资产品类型 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 投资产品类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | B0605 | 投资产品代码（逐支报送使用） | string | 256 | nvarchar(256) | 否 | 否 | 投资产品代码（逐支报送使用） |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | B0606 | 发行主体名称（逐支报送使用） | string | 256 | nvarchar(256) | 否 | 否 | 发行主体名称（逐支报送使用） |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | B0607 | 发行主体所属国家/地区（必须为中国） | string | 3 | nvarchar(3) | 否 | 否 | 发行主体所属国家/地区（必须为中国） |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | B0608 | 发行主体所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 发行主体所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | B0609 | 债务证券原始期限 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 债务证券原始期限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | B0610 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | B0611 | 上月末市值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末市值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | B0612 | 本月买入金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月买入金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | B0613 | 本月卖出金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月卖出金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | B0614 | 本月非交易变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | B0615 | 本月非交易变动：其中债权注销金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动：其中债权注销金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | B0616 | 本月非交易变动：其中价值重估因素 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动：其中价值重估因素 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | B0617 | 本月末市值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末市值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | B0618 | 本月末市值：其中剩余期限在一年及以下 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末市值：其中剩余期限在一年及以下 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | B0619 | 本月非居民投资者红利或利息收入 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非居民投资者红利或利息收入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | B0621 | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | B0620 | 本月末未到期/未偿付债券面值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末未到期/未偿付债券面值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | B0613AMT | 本月卖出金额其中：债券到期或提 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月卖出金额其中：债券到期或提 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 51 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 52 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 53 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALC_01

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | C0101 | 填报机构身份 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 填报机构身份 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | C0102 | 居民被代理人/委托人所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 居民被代理人/委托人所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | C0103 | 居民被代理人/委托人所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 居民被代理人/委托人所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | C0104 | 合约类别 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 合约类别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | C0105 | 金融风险类别 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 金融风险类别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | C0106 | 非居民交易对手所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 非居民交易对手所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | C0107 | 非居民交易对手所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 非居民交易对手所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | C0108 | 居民交易对手与本机构/居民机构的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 居民交易对手与本机构/居民机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | C0109 | 结算的原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 结算的原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | C0110 | 上月末头寸市值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末头寸市值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | C0111 | 本月（现金）结算付款额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月（现金）结算付款额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | C0112 | 本月（现金）结算收款额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月（现金）结算收款额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | C0113 | 本月非交易变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | C0114 | 本月非交易变动：其中注销、调整及重新分类至其他报表统计的金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动：其中注销、调整及重新分类至其他报表统计的金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | C0115 | 本月非交易变动：其中价值重估因素 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动：其中价值重估因素 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | C0116 | 本月末头寸市值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末头寸市值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | C0117 | 名义本金币种 | string | 3 | nvarchar(3) | 否 | 否 | 名义本金币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | C0118 | 本月末名义本金金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末名义本金金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALD_01

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | D0101 | 业务类别 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 业务类别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | D0102 | 对方国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 对方国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | D0103 | 对方部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 对方部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | D0104 | 对方与本机构的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | D0105 | 原始期限 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 原始期限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | D0106 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | D0107 | 上月末本金余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末本金余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | D0108 | 上月末应收利息余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末应收利息余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | D0109 | 本月末本金余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末本金余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | D0110 | 本月末本金余额：其中剩余期限在一年及以下 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末本金余额：其中剩余期限在一年及以下 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | D0111 | 本月末应收利息余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末应收利息余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | D0112 | 本月非交易变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | D0113 | 本月净发生额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月净发生额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | D0114 | 本月利息收入 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月利息收入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | ISSUM | 是否是汇总数据 | int | 10 | int | 否 | 否 | 是否是汇总数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | D0115 | 是否存在风险转移 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 是否存在风险转移 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | D0116 | 风险转往国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 风险转往国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | D0117 | 风险转往部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 风险转往部门 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALD_02

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | D0201 | 是否委托贷款 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 是否委托贷款 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | D0202 | 委托人所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 委托人所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | D0203 | 对方国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 对方国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | D0204 | 对方部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 对方部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | D0205 | 对方与本机构/委托人的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 对方与本机构/委托人的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | D0206 | 原始期限 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 原始期限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | D0207 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | D0208 | 上月末本金余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末本金余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | D0209 | 上月末应收利息余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末应收利息余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | D0210 | 本月末本金余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末本金余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | D0211 | 本月末本金余额：其中剩余期限在一年及以下 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末本金余额：其中剩余期限在一年及以下 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | D0212 | 本月末应收利息余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末应收利息余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | D0213 | 本月非交易变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | D0214 | 本月净发生额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月净发生额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | D0215 | 本月利息收入 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月利息收入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | D0216 | 债务人名称 | string | 100 | nvarchar(100) | 否 | 否 | 债务人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | D0217 | 签约金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 签约金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | D0218 | 资金用途 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 资金用途 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | D0219 | 原始放款天数 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 原始放款天数 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | D0220 | 到期日 | datetime |  | datetime2 | 否 | 否 | 到期日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | ISSUM | 是否是汇总数据 | int | 10 | int | 否 | 否 | 是否是汇总数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | D0201TYPE | 贷款类别 | int | 10 | int | 否 | 否 | 贷款类别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | D0221 | 是否存在风险转移 | int | 10 | int | 否 | 否 | 是否存在风险转移 |  | SQL Server safe.sys.columns / extended_properties |  |
| 51 | D0222 | 风险转往国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 风险转往国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 52 | D0223 | 风险转往部门 | int | 10 | int | 否 | 否 | 风险转往部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 53 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 54 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 55 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 56 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALD_03

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | D0301 | 对方名称 | string | 256 | nvarchar(256) | 否 | 否 | 对方名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | D0302 | 对方代码 | string | 256 | nvarchar(256) | 否 | 否 | 对方代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | D0303 | 对方国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 对方国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | D0304 | 对方部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 对方部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | D0305 | 对方与本机构的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | D0306 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | D0307 | 上月末余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | D0308 | 本月末余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | D0309 | 本月非交易变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | D0310 | 本月净发生额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月净发生额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | D0311 | 本月末本机构持表决权比例（%） | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末本机构持表决权比例（%） |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | D0312 | 本月本机构的红利/股息/利润收入 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月本机构的红利/股息/利润收入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | ISSUM | 是否是汇总数据 | int | 10 | int | 否 | 否 | 是否是汇总数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALD_04

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | D0401 | 对方国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 对方国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | D0402 | 对方部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 对方部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | D0403 | 对方与本机构的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | D0404 | 原始期限 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 原始期限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | D0405 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | D0406 | 上月末余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | D0407 | 本月末余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | D0408 | 本月末余额：其中剩余期限在一年及以下 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末余额：其中剩余期限在一年及以下 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | D0409 | 本月非交易变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | D0410 | 本月净发生额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月净发生额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | ISSUM | 是否是汇总数据 | int | 10 | int | 否 | 否 | 是否是汇总数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALD_0501

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | D0501 | 业务类别 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 业务类别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | D0502 | 对方国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 对方国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | D0503 | 对方部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 对方部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | D0504 | 对方与本机构的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | D0505 | 原始期限 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 原始期限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | D0506 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | D0507 | 上月末本金余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末本金余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | D0508 | 上月末应付利息余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末应付利息余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | D0509 | 本月末本金余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末本金余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | D0510 | 本月末本金余额：其中剩余期限在一年及以下 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末本金余额：其中剩余期限在一年及以下 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | D0511 | 本月末应付利息余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末应付利息余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | D0512 | 本月非交易变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | D0513 | 本月净发生额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月净发生额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | D0514 | 本月利息支出 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月利息支出 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | EXDEBTCODE | 外债编号 | string | 28 | nvarchar(28) | 否 | 否 | 外债编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALD_0502

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | D0501 | 业务类别 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 业务类别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | D0502 | 对方国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 对方国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | D0503 | 对方部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 对方部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | D0504 | 对方与本机构的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | D0505 | 原始期限 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 原始期限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | D0506 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | D0507 | 上月末本金余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末本金余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | D0508 | 上月末应付利息余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末应付利息余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | D0509 | 本月末本金余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末本金余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | D0510 | 本月末本金余额：其中剩余期限在一年及以下 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末本金余额：其中剩余期限在一年及以下 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | D0511 | 本月末应付利息余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末应付利息余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | D0512 | 本月非交易变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | D0513 | 本月净发生额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月净发生额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | D0514 | 本月利息支出 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月利息支出 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | ISSUM | 是否是汇总数据 | int | 10 | int | 否 | 否 | 是否是汇总数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALD_0601

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | D0601 | 对方国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 对方国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | D0602 | 对方部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 对方部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | D0603 | 对方与本机构的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | D0604 | 原始期限 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 原始期限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | D0605 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | D0606 | 上月末本金余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末本金余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | D0607 | 上月末应付利息余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末应付利息余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | D0608 | 本月末本金金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末本金金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | D0609 | 其中：剩余期限在一年及以下 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 其中：剩余期限在一年及以下 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | D0610 | 本月末应付利息余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末应付利息余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | D0611 | 本月非交易变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | D0612 | 本月净发生额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月净发生额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | D0613 | 本月利息支出 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月利息支出 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | EXDEBTCODE | 外债编号 | string | 28 | nvarchar(28) | 否 | 否 | 外债编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | ISSUM | 是否是汇总数据 | int | 10 | int | 否 | 否 | 是否是汇总数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALD_0602

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | BRANCHID | 机构ID | bigint | 19 | bigint | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | nvarchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | MANUALFLAG | 人工操作标识 | string | 1 | nvarchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | BUOCMONTH | 报告期 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | D0601 | 对方国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 对方国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | D0602 | 对方部门 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 对方部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | D0603 | 对方与本机构的关系 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | D0604 | 原始期限 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 原始期限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | D0605 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | D0606 | 上月末本金余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末本金余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | D0607 | 上月末应付利息余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末应付利息余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | D0608 | 本月末本金余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末本金余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | D0609 | 其中：剩余期限在一年以下 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 其中：剩余期限在一年以下 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | D0610 | 本月末应付利息余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末应付利息余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | D0611 | 本月非交易变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | D0612 | 本月净发生额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月净发生额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | D0613 | 本月利息支出 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月利息支出 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALD_07

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | D0701 | 对方名称 | string | 256 | nvarchar(256) | 否 | 否 | 对方名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | D0702 | 对方代码 | string | 256 | nvarchar(256) | 否 | 否 | 对方代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | D0703 | 对方国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 对方国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | D0704 | 对方部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 对方部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | D0705 | 对方与本机构的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | D0706 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | D0707 | 上月末余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | D0708 | 本月末余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | D0709 | 本月非交易变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | D0710 | 本月净发生额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月净发生额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | D0711 | 本月末外方表决权比例（%） | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末外方表决权比例（%） |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | D0712 | 本月对外方的股息/红利/利润支出 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月对外方的股息/红利/利润支出 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | ISSUM | 是否是汇总数据 | int | 10 | int | 否 | 否 | 是否是汇总数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALD_08

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | D0801 | 对方国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 对方国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | D0802 | 对方部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 对方部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | D0803 | 对方与本机构的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 对方与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | D0804 | 原始期限 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 原始期限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | D0805 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | D0806 | 上月末余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | D0807 | 本月末余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | D0808 | 本月末余额：其中剩余期限在一年及以下 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末余额：其中剩余期限在一年及以下 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | D0809 | 本月非交易变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | D0810 | 本月净发生额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月净发生额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | ISSUM | 是否是汇总数据 | int | 10 | int | 否 | 否 | 是否是汇总数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | D0801TYPE | 业务类型 | int | 10 | int | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALD_09

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | D0901 | 资产类别 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 资产类别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | D0902 | 风险分类 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 风险分类 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | D0903 | 币种 | string | 3 | nvarchar(3) | 否 | 否 | 币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | D0904 | 本月末减值准备余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末减值准备余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | D0905 | 对方国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 对方国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALF_01

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | F0101 | 相关业务类型 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 相关业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | F0102 | 是否附有银行承兑汇票 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 是否附有银行承兑汇票 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | F0103 | 境外付款人所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 境外付款人所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | F0104 | 境外付款人所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 境外付款人所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | F0105 | 境外付款人与本机构的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 境外付款人与本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | F0106 | 原始期限 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 原始期限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | F0107 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | F0108 | 上月末余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | F0109 | 本月末余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | F0110 | 本月末余额：其中剩余期限在一年及以下 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末余额：其中剩余期限在一年及以下 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | F0111 | 本月非交易变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | F0112 | 本月净发生额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月净发生额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | ISSUM | 是否是汇总数据 | int | 10 | int | 否 | 否 | 是否是汇总数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | F0113 | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALF_02

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | F0201 | 相关业务类型 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 相关业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | F0202 | 是否附有银行承兑汇票 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 是否附有银行承兑汇票 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | F0203 | 境外付款人所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 境外付款人所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | F0204 | 境外付款人所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 境外付款人所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | F0205 | 境外付款人于本机构的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 境外付款人于本机构的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | F0206 | 原始期限 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 原始期限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | F0207 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | F0208 | 上月末余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | F0209 | 本月末余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | F0210 | 其中:剩余期限在一年及以下 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 其中:剩余期限在一年及以下 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | F0211 | 本月非交易变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | F0212 | 本月净发生额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月净发生额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALG_01

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | G0101 | 发卡机构名称 | string | 256 | nvarchar(256) | 否 | 否 | 发卡机构名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | G0101CODE | 发卡机构代码 | string | 4 | nvarchar(4) | 否 | 否 | 发卡机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | G0102 | 银行卡清算渠道 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 银行卡清算渠道 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | G0103 | 持卡人是否为中国居民 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 持卡人是否为中国居民 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | G0104 | 交易类型 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 交易类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | G0104CODE | 交易方式 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 交易方式 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | G0105 | 交易所在地国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 交易所在地国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | G0106 | 交易原币） | string | 3 | nvarchar(3) | 否 | 否 | 交易原币） |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | G0107 | 交易金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 交易金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALG_02

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | G0201 | 银行卡清算渠道 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 银行卡清算渠道 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | G0202 | 交易类型 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 交易类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | G0202CODE | 交易方式 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 交易方式 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | G0203 | 发卡行所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 发卡行所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | G0204 | 交易原币） | string | 3 | nvarchar(3) | 否 | 否 | 交易原币） |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | G0205 | 交易金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 交易金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALG_03

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | decimal | 18,0 | decimal(18,0) | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | ISFEEDBACK | 是否为反馈失败数据 | decimal | 18,0 | decimal(18,0) | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | decimal | 18,0 | decimal(18,0) | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | DATASTATUS | 数据状态 | decimal | 18,0 | decimal(18,0) | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | OBJCODE | 申报主体代码 | string | 18 | nvarchar(18) | 否 | 否 | 申报主体代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | BUOCMONTH | 报告期 | decimal | 6,0 | decimal(6,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | G0301 | 银行卡清算渠道 | int | 10 | int | 否 | 否 | 银行卡清算渠道 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | G0302 | 持卡人所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 持卡人所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | G0303 | 交易原币） | string | 3 | nvarchar(3) | 否 | 否 | 交易原币） |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | G0304 | 收支类型 | int | 10 | int | 否 | 否 | 收支类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | G0305 | 交易类型 | int | 10 | int | 否 | 否 | 交易类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | G0306 | 交易金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 交易金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALH_01

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | H0101 | 非居民委托人名称 | string | 255 | nvarchar(255) | 否 | 否 | 非居民委托人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | H0101CODE | 非居民委托人代码 | string | 9 | nvarchar(9) | 否 | 否 | 非居民委托人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | H0102 | 非居民委托人所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 非居民委托人所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | H0103 | 非居民委托人所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 非居民委托人所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | H0104 | 非居民委托人产品名称 | string | 255 | nvarchar(255) | 否 | 否 | 非居民委托人产品名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | H0104CODE | 业务编号 | string | 20 | nvarchar(20) | 否 | 否 | 业务编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | H0105 | 投资工具类型 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 投资工具类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | H0105CODE | 业务类型 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | H0106 | 金融衍生产品 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 金融衍生产品 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | H0107 | 金融衍生产品的风险类别 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 金融衍生产品的风险类别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | H0108 | 投资工具代码（逐支报送使用） | string | 255 | nvarchar(255) | 否 | 否 | 投资工具代码（逐支报送使用） |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | H0109 | 投资工具发行人名称(逐支报送使用) | string | 255 | nvarchar(255) | 否 | 否 | 投资工具发行人名称(逐支报送使用) |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | H0110 | 投资工具发行人（对手方）所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 投资工具发行人（对手方）所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | H0111 | 非居民委托人与境内发行人（对手方）的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 非居民委托人与境内发行人（对手方）的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | H0112 | 投资工具的原始期限 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 投资工具的原始期限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | H0113 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | H0114 | 上月末市值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末市值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | H0115 | 本月买入/申购/(现金)结算付款额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月买入/申购/(现金)结算付款额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | H0116 | 本月卖出/赎回/(现金)结算收款额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月卖出/赎回/(现金)结算收款额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | H0117 | 本月非交易变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | H0118 | 本月非交易变动：其中注销或重新分类至其他项目统计的金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动：其中注销或重新分类至其他项目统计的金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | H0119 | 本月非交易变动：其中价值重估因素 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动：其中价值重估因素 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | H0120 | 本月末市值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末市值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | H0121 | 本月末市值：其中剩余期限在一年及以下 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末市值：其中剩余期限在一年及以下 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | H0122 | 本月红利或利息收入 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月红利或利息收入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | H0123 | 本月未实现收益（仅适用于货币市场基金份额） | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月未实现收益（仅适用于货币市场基金份额） |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | H0124 | 金融衍生产品的名义本金币种 | string | 255 | nvarchar(255) | 否 | 否 | 金融衍生产品的名义本金币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | H0125 | 金融衍生产品的本月末名义本金金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 金融衍生产品的本月末名义本金金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | INVTYPE | 投资品种类型 | string | 3 | nvarchar(3) | 否 | 否 | 投资品种类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 51 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 52 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 53 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 54 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 55 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 56 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 57 | H0109CODE | 投资工具发行人所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 投资工具发行人所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 58 | H0126 | 本月末未到期/未偿付债券面值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末未到期/未偿付债券面值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 59 | H0116AMT | 本月卖出/赎回/(现金)结算收款额其中：债券到期或提前兑付的本息金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月卖出/赎回/(现金)结算收款额其中：债券到期或提前兑付的本息金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 60 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 61 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 62 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 63 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 64 | H0101CODE2 | QFII/RQFII许可证号 | string | 20 | nvarchar(20) | 否 | 否 | QFII/RQFII许可证号 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALH_02

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | H0201 | 居民委托人名称 | string | 255 | nvarchar(255) | 否 | 否 | 居民委托人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | H0201CODE | 居民委托人代码 | string | 12 | nvarchar(12) | 否 | 否 | 居民委托人代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | H0202 | 居民委托人所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 居民委托人所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | H0203 | 居民委托人产品名称 | string | 255 | nvarchar(255) | 否 | 否 | 居民委托人产品名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | H0203CODE | 业务编号 | string | 255 | nvarchar(255) | 否 | 否 | 业务编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | H0204 | 投资工具类型 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 投资工具类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | H0204CODE | 业务类型 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | H0205 | 金融衍生产品的合约类别 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 金融衍生产品的合约类别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | H0206 | 金融衍生产品的风险类别 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 金融衍生产品的风险类别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | H0207 | 投资工具代码（逐支报送使用） | string | 255 | nvarchar(255) | 否 | 否 | 投资工具代码（逐支报送使用） |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | H0208 | 投资工具发行人名称（逐支报送使用） | string | 255 | nvarchar(255) | 否 | 否 | 投资工具发行人名称（逐支报送使用） |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | H0209 | 投资工具发行市场 | string | 3 | nvarchar(3) | 否 | 否 | 投资工具发行市场 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | H0210 | 投资工具发行人所属国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 投资工具发行人所属国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | H0211 | 投资工具发行人所属部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 投资工具发行人所属部门 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | H0212 | 投资工具发行人与居民委托人的关系 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 投资工具发行人与居民委托人的关系 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | H0213 | 投资工具的原始期限 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 投资工具的原始期限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | H0214 | 原始币种 | string | 3 | nvarchar(3) | 否 | 否 | 原始币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | H0215 | 上月末市值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 上月末市值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | H0216 | 本月买入/申购/(现金)结算付款额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月买入/申购/(现金)结算付款额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | H0217 | 本月卖出/赎回/(现金)结算收款额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月卖出/赎回/(现金)结算收款额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | H0218 | 本月非交易变动 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | H0219 | 本月非交易变动：其中注销或重新分类至其他项目统计的金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动：其中注销或重新分类至其他项目统计的金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | H0220 | 本月非交易变动：其中价值重估因素 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月非交易变动：其中价值重估因素 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | H0221 | 本月末市值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末市值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | H0222 | 本月末市值：其中剩余期限在一年及以下 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末市值：其中剩余期限在一年及以下 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | H0223 | 本月红利或利息收入 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月红利或利息收入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | H0224 | 金融衍生产品的名义本金币种 | string | 3 | nvarchar(3) | 否 | 否 | 金融衍生产品的名义本金币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | H0225 | 金融衍生产品的本月末名义本金金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 金融衍生产品的本月末名义本金金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | INVTYPE | 投资品种类型 | string | 3 | nvarchar(3) | 否 | 否 | 投资品种类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 51 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 52 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 53 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 54 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 55 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 56 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 57 | H0217AMT | 本月卖出/赎回/(现金)结算收款额其中：债券到期或提前兑付的本息金额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月卖出/赎回/(现金)结算收款额其中：债券到期或提前兑付的本息金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 58 | H0226 | 本月末未到期/未偿付债券面值 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 本月末未到期/未偿付债券面值 |  | SQL Server safe.sys.columns / extended_properties |  |
| 59 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 60 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 61 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 62 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 63 | H0227 | 是否存在风险转移 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 是否存在风险转移 |  | SQL Server safe.sys.columns / extended_properties |  |
| 64 | H0228 | 风险转往国家/地区 | string | 3 | nvarchar(3) | 否 | 否 | 风险转往国家/地区 |  | SQL Server safe.sys.columns / extended_properties |  |
| 65 | H0229 | 风险转往部门 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 风险转往部门 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_FALX_01

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUOCMONTH | 报告期 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 报告期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | OBJCODE | 填报机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 填报机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | REMARK | 备注 | string | 512 | nvarchar(512) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | SNOCODE | 数据自编码 | string | 36 | nvarchar(36) | 否 | 否 | 数据自编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | X1000 | 银行进口贸易融资业务—境外银行提供贸易融资 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 银行进口贸易融资业务—境外银行提供贸易融资 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | X1001 | 银行进口贸易融资业务—境外银行提供贸易融资 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 银行进口贸易融资业务—境外银行提供贸易融资 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | X1100 | 海外代付（境内银行名义融资） | decimal | 22,2 | decimal(22,2) | 否 | 否 | 海外代付（境内银行名义融资） |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | X1101 | 海外代付（境内银行名义融资） | decimal | 22,2 | decimal(22,2) | 否 | 否 | 海外代付（境内银行名义融资） |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | X1110 | 海外代付（境内银行名义融资） | decimal | 22,2 | decimal(22,2) | 否 | 否 | 海外代付（境内银行名义融资） |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | X1111 | 海外代付（境内银行名义融资） | decimal | 22,2 | decimal(22,2) | 否 | 否 | 海外代付（境内银行名义融资） |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | X1200 | 境内银行提供担保 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 境内银行提供担保 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | X1201 | 境内银行提供担保 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 境内银行提供担保 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | X1300 | 境内银行居间业务 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 境内银行居间业务 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | X1301 | 境内银行居间业务 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 境内银行居间业务 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | X2000 | 银行出口贸易融资业务—境外银行提供贸易融资 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 银行出口贸易融资业务—境外银行提供贸易融资 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | X2001 | 银行出口贸易融资业务—境外银行提供贸易融资 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 银行出口贸易融资业务—境外银行提供贸易融资 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | X2100 | 境外银行提供贷款性质融资 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 境外银行提供贷款性质融资 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | X2101 | 境外银行提供贷款性质融资 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 境外银行提供贷款性质融资 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | X2200 | 境外银行承兑远期信用证及应付未付即期信用证 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 境外银行承兑远期信用证及应付未付即期信用证 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | X2201 | 境外银行承兑远期信用证及应付未付即期信用证 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 境外银行承兑远期信用证及应付未付即期信用证 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

## 3.4 ACC 外汇账户

### 表：T_SAFE_ACCCA

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | ACCOUNTCATA | 账户类别 | string | 2 | nvarchar(2) | 否 | 否 | 账户类别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | ACCOUNTLIMIT | 账户限额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 账户限额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | ACCOUNTNO | 账号 | string | 64 | nvarchar(64) | 否 | 否 | 账号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | ACCOUNTSTAT | 账户状态 | string | 2 | nvarchar(2) | 否 | 否 | 账户状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | ACCOUNTTYPE | 账户性质代码 | string | 4 | nvarchar(4) | 否 | 否 | 账户性质代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | AMTTYPE | 开户主体类型 | string | 2 | nvarchar(2) | 否 | 否 | 开户主体类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | BOPUID | 单位基本情况表ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 单位基本情况表ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | BRANCHCODE | 金融机构标识码 | string | 12 | nvarchar(12) | 否 | 否 | 金融机构标识码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | BRANCHNAME | 金融机构名称 | string | 128 | nvarchar(128) | 否 | 否 | 金融机构名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | CLOSESIGN | 关户标记 | string | 2 | nvarchar(2) | 否 | 否 | 关户标记 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | CURRENCYCODE | 币种 | string | 3 | nvarchar(3) | 否 | 否 | 币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | ENCODE | 开户主体代码 | string | 18 | nvarchar(18) | 否 | 否 | 开户主体代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | ENNAME | 开户主体名称 | string | 128 | nvarchar(128) | 否 | 否 | 开户主体名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | FILENUMBER | 外汇局批件号/备案表号/业务编号 | string | 28 | nvarchar(28) | 否 | 否 | 外汇局批件号/备案表号/业务编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | LIMITTYPE | 限额类型 | string | 2 | nvarchar(2) | 否 | 否 | 限额类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | LOCKFLAG | 数据有效状态 :无效==0,有效==1  也是用来标记该记录是否为最新一笔记录(因为其他模块是一笔记录一直update，但acc可以存在多条记录，所以根据此字段区分) | int | 10 | int | 否 | 否 | 数据有效状态 :无效==0,有效==1  也是用来标记该记录是否为最新一笔记录(因为其他模块是一笔记录一直update，但acc可以存在多条记录，所以根据此字段区分) |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | SIGN | 更改标记 | string | 2 | nvarchar(2) | 否 | 否 | 更改标记 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | DATA_DATE | 数据日期 | datetime |  | datetime2 | 否 | 否 | 数据日期 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_ACCCB

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | ACCCAID | 对应账户信息ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 对应账户信息ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | ACCOUNTNO | 账号 | string | 64 | nvarchar(64) | 否 | 否 | 账号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | ACCOUNTTYPE | 账户性质代码 | string | 4 | nvarchar(4) | 否 | 否 | 账户性质代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | BALANCE | 账户余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 账户余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | BALANCESIGN | 收支余计算标记 | string | 2 | nvarchar(2) | 否 | 否 | 收支余计算标记 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | BRANCHCODE | 金融机构标识码 | string | 12 | nvarchar(12) | 否 | 否 | 金融机构标识码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | BRANCHNAME | 机构名称 | string | 128 | nvarchar(128) | 否 | 否 | 机构名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | CLOSESIGN | 关户标记 | string | 2 | nvarchar(2) | 否 | 否 | 关户标记 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | CREDIT | 当日贷方发生额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 当日贷方发生额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | CURRENCYCODE | 币种 | string | 3 | nvarchar(3) | 否 | 否 | 币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | DEALDATE | 发生日期 | datetime |  | datetime2 | 否 | 否 | 发生日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | DEBIT | 当日借方发生额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 当日借方发生额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | ENCODE | 证件号码 | string | 18 | nvarchar(18) | 否 | 否 | 证件号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | ENNAME | 开户主体名称 | string | 128 | nvarchar(128) | 否 | 否 | 开户主体名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | LASTBALANCE | 账户上日余额 | decimal | 22,2 | decimal(22,2) | 否 | 否 | 账户上日余额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | REMARK | 备注 | string | 256 | nvarchar(256) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | DATA_DATE | 数据日期 | datetime |  | datetime2 | 否 | 否 | 数据日期 |  | SQL Server safe.sys.columns / extended_properties |  |

## 3.5 JSH 外汇账户内结售汇

### 表：T_SAFE_JSHD

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSCODE | 银行业务编号 | string | 22 | nvarchar(22) | 否 | 否 | 银行业务编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CUSTYPE | 结汇申请人主体类型 | string | 1 | nvarchar(1) | 否 | 否 | 结汇申请人主体类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CUSTCOD | 结汇申请人组织机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 结汇申请人组织机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CUSTNM | 结汇申请人名称 | string | 128 | nvarchar(128) | 否 | 否 | 结汇申请人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | EXRATE | 汇率 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 汇率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | FCYACC | 外汇账户账号 | string | 32 | nvarchar(32) | 否 | 否 | 外汇账户账号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | FCYAMT | 结汇金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 结汇金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | FCYCCY | 币别 | string | 3 | nvarchar(3) | 否 | 否 | 币别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | IDCODE | 结汇申请人个人身份证件号码 | string | 32 | nvarchar(32) | 否 | 否 | 结汇申请人个人身份证件号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | LCYACC | 人民币账户账号 | string | 32 | nvarchar(32) | 否 | 否 | 人民币账户账号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | OPPBANK | 人民币账户开户行 | string | 256 | nvarchar(256) | 否 | 否 | 人民币账户开户行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | OPPUSER | 人民币收款人名称 | string | 128 | nvarchar(128) | 否 | 否 | 人民币收款人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | RPTBANK | 申报银行 | string | 128 | nvarchar(128) | 否 | 否 | 申报银行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | RPTNO | 申报号码 | string | 22 | nvarchar(22) | 否 | 否 | 申报号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | SUBFLAG | 报送标记：是否需要管理信息 | int | 10 | int | 否 | 否 | 报送标记：是否需要管理信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | CASHMARK | 取现标识：是否取现，1：是  0：否 | decimal | 2,0 | decimal(2,0) | 否 | 否 | 取现标识：是否取现，1：是  0：否 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | SORT | 排序 | int | 10 | int | 否 | 否 | 排序 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | BUSINESS_TYPE | 业务类型 | string | 100 | nvarchar(100) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | UNIQUE_REF_NO | 业务主键 | string | 100 | nvarchar(100) | 否 | 否 | 业务主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | CROSSGENERATEFLAG | 待确认 | decimal | 1,0 | decimal(1,0) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_JSHD_F

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | CRTUSER | 填报人 | string | 20 | nvarchar(20) | 否 | 否 | 填报人 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | INPTELC | 填报人电话 | string | 20 | nvarchar(20) | 否 | 否 | 填报人电话 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | JSHDID | 对应基础信息ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 对应基础信息ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | REGNO | 外汇局批件号/备案表号/业务编号 | string | 20 | nvarchar(20) | 否 | 否 | 外汇局批件号/备案表号/业务编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | RPTDATE | 申报日期 | datetime |  | datetime2 | 否 | 否 | 申报日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | RPTNO | 申报号码 | string | 22 | nvarchar(22) | 否 | 否 | 申报号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | TXCODE | 交易编码 | string | 6 | nvarchar(6) | 否 | 否 | 交易编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | USEDETAIL | 结汇详细用途 | string | 100 | nvarchar(100) | 否 | 否 | 结汇详细用途 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | USETYPE | 结汇用途 | string | 6 | nvarchar(6) | 否 | 否 | 结汇用途 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | SORT | 排序 | int | 10 | int | 否 | 否 | 排序 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | BUSINESS_TYPE | 业务类型 | string | 100 | nvarchar(100) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_JSHE

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSCODE | 银行业务编号 | string | 22 | nvarchar(22) | 否 | 否 | 银行业务编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CUSTYPE | 购汇申请人主体类型 | string | 1 | nvarchar(1) | 否 | 否 | 购汇申请人主体类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CUSTCOD | 购汇申请人组织机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 购汇申请人组织机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CUSTNM | 购汇申请人名称 | string | 128 | nvarchar(128) | 否 | 否 | 购汇申请人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | EXRATE | 汇率 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 汇率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | FCYACC | 外汇账户账号 | string | 32 | nvarchar(32) | 否 | 否 | 外汇账户账号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | IDCODE | 购汇申请人个人身份证件号码 | string | 32 | nvarchar(32) | 否 | 否 | 购汇申请人个人身份证件号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | LCYACC | 人民币账户账号 | string | 32 | nvarchar(32) | 否 | 否 | 人民币账户账号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | LCYAMT | 购汇金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 购汇金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | LCYCCY | 购汇币别 | string | 3 | nvarchar(3) | 否 | 否 | 购汇币别 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | OPPBANK | 外汇账户开户行 | string | 256 | nvarchar(256) | 否 | 否 | 外汇账户开户行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | OPPUSER | 外汇收款人名称 | string | 128 | nvarchar(128) | 否 | 否 | 外汇收款人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | RPTBANK | 申报银行 | string | 128 | nvarchar(128) | 否 | 否 | 申报银行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | RPTNO | 申报号码 | string | 22 | nvarchar(22) | 否 | 否 | 申报号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | SUBFLAG | 报送标记：是否需要管理信息 | int | 10 | int | 否 | 否 | 报送标记：是否需要管理信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | CASHMARK | 取现标识：是否取现，1：是  0：否 | decimal | 2,0 | decimal(2,0) | 否 | 否 | 取现标识：是否取现，1：是  0：否 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | SORT | 排序 | int | 10 | int | 否 | 否 | 排序 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | BUSINESS_TYPE | 业务类型 | string | 100 | nvarchar(100) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | UNIQUE_REF_NO | 业务主键 | string | 100 | nvarchar(100) | 否 | 否 | 业务主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | CROSSGENERATEFLAG | 待确认 | decimal | 1,0 | decimal(1,0) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_JSHE_G

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | CRTUSER | 填报人 | string | 20 | nvarchar(20) | 否 | 否 | 填报人 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | INPTELC | 填报人电话 | string | 20 | nvarchar(20) | 否 | 否 | 填报人电话 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | JSHEID | 对应基础信息ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 对应基础信息ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | REGNO | 外汇局批件号/备案表号/业务编号 | string | 20 | nvarchar(20) | 否 | 否 | 外汇局批件号/备案表号/业务编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | RPTDATE | 申报日期 | datetime |  | datetime2 | 否 | 否 | 申报日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | RPTNO | 申报号码 | string | 22 | nvarchar(22) | 否 | 否 | 申报号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | TXCODE | 交易编码 | string | 6 | nvarchar(6) | 否 | 否 | 交易编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | SORT | 排序 | int | 10 | int | 否 | 否 | 排序 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | BUSINESS_TYPE | 业务类型 | string | 100 | nvarchar(100) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |

## 3.6 BOP 国际收支

### 表：T_SAFE_BOPA

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSCODE | 银行业务编号 | string | 22 | nvarchar(22) | 否 | 否 | 银行业务编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CUSTYPE | C－对公用户，D－对私中国居民,F－对私中国非居民 需与申报号码中第19位字母所表明的含义一致 | string | 1 | nvarchar(1) | 否 | 否 | C－对公用户，D－对私中国居民,F－对私中国非居民 需与申报号码中第19位字母所表明的含义一致 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CUSTCOD | 组织机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 组织机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CUSTNM | 收款人名称 | string | 128 | nvarchar(128) | 否 | 否 | 收款人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | EXRATE | 结汇汇率 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 结汇汇率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | FCYACC | 外汇账号/银行卡号 | string | 32 | nvarchar(32) | 否 | 否 | 外汇账号/银行卡号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | FCYAMT | 现汇金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 现汇金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | IDCODE | 个人身份证号码 | string | 32 | nvarchar(32) | 否 | 否 | 个人身份证号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | INCHARGEAMT | 国内银行扣费金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 国内银行扣费金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | INCHARGECCY | 国内银行扣费币种 | string | 3 | nvarchar(3) | 否 | 否 | 国内银行扣费币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | LCYACC | 人民币账号/银行卡号 | string | 32 | nvarchar(32) | 否 | 否 | 人民币账号/银行卡号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | LCYAMT | 结汇金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 结汇金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | METHOD | 结算方式 | string | 1 | nvarchar(1) | 否 | 否 | 结算方式 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | OPPACC | 付款人账号 | string | 32 | nvarchar(32) | 否 | 否 | 付款人账号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | OPPUSERNAME | 付款人名称 | string | 128 | nvarchar(128) | 否 | 否 | 付款人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | OPPUSERTYPE | 付款人类型 | string | 4 | nvarchar(4) | 否 | 否 | 付款人类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | OTHACC | 其它账号/银行卡号 | string | 32 | nvarchar(32) | 否 | 否 | 其它账号/银行卡号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | OTHAMT | 其他金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 其他金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | OUTCHARGEAMT | 国外银行扣费金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 国外银行扣费金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | OUTCHARGECCY | 国外银行扣费币种 | string | 3 | nvarchar(3) | 否 | 否 | 国外银行扣费币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | RPTNO | 申报号码 | string | 22 | nvarchar(22) | 否 | 否 | 申报号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | SUBFLAG | 报送标记：是否需要提交/报送申报信息 | int | 10 | int | 否 | 否 | 报送标记：是否需要提交/报送申报信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | TXAMT | 收入款金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 收入款金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | TXCCY | 收入款币种 | string | 3 | nvarchar(3) | 否 | 否 | 收入款币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | DECLARATIONMODE | 申报模式  1-普通申报  2-集中申报  3-还原申报 | string | 1 | nvarchar(1) | 否 | 否 | 申报模式  1-普通申报  2-集中申报  3-还原申报 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | MAINDEALNO | 主业务编码  在申报模式为还原申报时用于和主申报数据的银行编码进行关联 | string | 64 | nvarchar(64) | 否 | 否 | 主业务编码  在申报模式为还原申报时用于和主申报数据的银行编码进行关联 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | MAINBUSCODE | 集中申报业务编码 默认为空，如果申报模式为还原申报，则产生报文时候根据mainDealNo关联集中申报数据的bussCode找到申报号码rptNo更新此值，同时更新busCode | string | 22 | nvarchar(22) | 否 | 否 | 集中申报业务编码 默认为空，如果申报模式为还原申报，则产生报文时候根据mainDealNo关联集中申报数据的bussCode找到申报号码rptNo更新此值，同时更新busCode |  | SQL Server safe.sys.columns / extended_properties |  |
| 51 | SORT | 排序 | int | 10 | int | 否 | 否 | 排序 |  | SQL Server safe.sys.columns / extended_properties |  |
| 52 | TXAMTUSD | 收入款金额(折美金) | decimal | 22,8 | decimal(22,8) | 否 | 否 | 收入款金额(折美金) |  | SQL Server safe.sys.columns / extended_properties |  |
| 53 | BUSINESS_TYPE | 业务类型 | string | 100 | nvarchar(100) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 54 | UNIQUE_REF_NO | 业务主键 | string | 100 | nvarchar(100) | 否 | 否 | 业务主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 55 | CROSSGENERATEFLAG | 跨机构生成，用来处理那些机构branchId为A，申报号码为B，且A生成报文时需要将B数据生成的数据。 1-是 | decimal | 1,0 | decimal(1,0) | 否 | 否 | 跨机构生成，用来处理那些机构branchId为A，申报号码为B，且A生成报文时需要将B数据生成的数据。 1-是 |  | SQL Server safe.sys.columns / extended_properties |  |
| 56 | AMBRANCHCODE | am机构代码(fubon使用) | string | 64 | nvarchar(64) | 否 | 否 | am机构代码(fubon使用) |  | SQL Server safe.sys.columns / extended_properties |  |
| 57 | ACBRANCHCODE | ac机构代码(fubon使用) | string | 64 | nvarchar(64) | 否 | 否 | ac机构代码(fubon使用) |  | SQL Server safe.sys.columns / extended_properties |  |
| 58 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 59 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 60 | CREDIT_VALUE_DATE | 入账生效日 | datetime |  | datetime | 否 | 否 | 入账生效日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 61 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 62 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 63 | HANDLEID | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId | string | 100 | varchar(100) | 否 | 否 | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_BOPA_G

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BILLNO | 外汇局批件号/备案表号/业务编号 | string | 50 | nvarchar(50) | 否 | 否 | 外汇局批件号/备案表号/业务编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | BOPAID | 对应基础信息ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 对应基础信息ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | COUNTRY | 付款人常驻国家/地区代码 | string | 3 | nvarchar(3) | 否 | 否 | 付款人常驻国家/地区代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CRTUSER | 填报人 | string | 20 | nvarchar(20) | 否 | 否 | 填报人 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CUSTCOD | 组织机构代码:用作对公用户时与组织机构代码校验 | string | 18 | nvarchar(18) | 否 | 否 | 组织机构代码:用作对公用户时与组织机构代码校验 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | INPTELC | 填报人电话 | string | 20 | nvarchar(20) | 否 | 否 | 填报人电话 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | ISREF | 是否保税货物项下收汇 | string | 1 | nvarchar(1) | 否 | 否 | 是否保税货物项下收汇 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | PAYATTR | 收入类型 | string | 1 | nvarchar(1) | 否 | 否 | 收入类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | PAYTYPE | 收款性质 | string | 1 | nvarchar(1) | 否 | 否 | 收款性质 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | RPTDATE | 申请日期 | datetime |  | datetime2 | 否 | 否 | 申请日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | RPTNO | 申报号码 | string | 22 | nvarchar(22) | 否 | 否 | 申报号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | TC1AMT | 相应金额1 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 相应金额1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | TC2AMT | 相应金额2 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 相应金额2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | TX2REM | 交易附言2 | string | 256 | nvarchar(256) | 否 | 否 | 交易附言2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | TXCODE | 交易编码1 | string | 6 | nvarchar(6) | 否 | 否 | 交易编码1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | TXCODE2 | 交易编码2 | string | 6 | nvarchar(6) | 否 | 否 | 交易编码2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | TXREM | 交易附言1 | string | 256 | nvarchar(256) | 否 | 否 | 交易附言1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | SORT | 排序 | int | 10 | int | 否 | 否 | 排序 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | BUSINESS_TYPE | 业务类型 | string | 100 | nvarchar(100) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | TC1AMTUSD | 相应金额1(折美金) | decimal | 22,8 | decimal(22,8) | 否 | 否 | 相应金额1(折美金) |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | TC2AMTUSD | 相应金额2(折美金) | decimal | 22,8 | decimal(22,8) | 否 | 否 | 相应金额2(折美金) |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | CREDIT_VALUE_DATE | 入账生效日 | datetime |  | datetime | 否 | 否 | 入账生效日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | HANDLEID | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId | string | 100 | varchar(100) | 否 | 否 | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_BOPB

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSCODE | 银行业务编号 | string | 22 | nvarchar(22) | 否 | 否 | 银行业务编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CUSTYPE | C－对公用户，D－对私中国居民,F－对私中国非居民 需与申报号码中第19位字母所表明的含义一致 | string | 1 | nvarchar(1) | 否 | 否 | C－对公用户，D－对私中国居民,F－对私中国非居民 需与申报号码中第19位字母所表明的含义一致 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CUSTCOD | 组织机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 组织机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CUSTNM | 汇款人名称 | string | 128 | nvarchar(128) | 否 | 否 | 汇款人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | EXRATE | 购汇汇率 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 购汇汇率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | FCYACC | 外汇账号/银行卡号 | string | 32 | nvarchar(32) | 否 | 否 | 外汇账号/银行卡号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | FCYAMT | 现汇金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 现汇金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | IDCODE | 个人身份证号码 | string | 32 | nvarchar(32) | 否 | 否 | 个人身份证号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | LCYACC | 人民币账号/银行卡号 | string | 32 | nvarchar(32) | 否 | 否 | 人民币账号/银行卡号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | LCYAMT | 购汇金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 购汇金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | METHOD | 结算方式 | string | 1 | nvarchar(1) | 否 | 否 | 结算方式 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | OPPACC | 收款人账号 | string | 32 | nvarchar(32) | 否 | 否 | 收款人账号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | OPPUSERNAME | 收款人名称 | string | 128 | nvarchar(128) | 否 | 否 | 收款人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | OPPUSERTYPE | 汇款人类型 | string | 4 | nvarchar(4) | 否 | 否 | 汇款人类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | OTHACC | 其它账号/银行卡号 | string | 32 | nvarchar(32) | 否 | 否 | 其它账号/银行卡号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | OTHAMT | 其他金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 其他金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | RPTNO | 申报号码 | string | 22 | nvarchar(22) | 否 | 否 | 申报号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | SUBFLAG | 报送标记：是否需要提交/报送申报信息 | int | 10 | int | 否 | 否 | 报送标记：是否需要提交/报送申报信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | TXAMT | 汇款金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 汇款金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | TXCCY | 汇款币种 | string | 3 | nvarchar(3) | 否 | 否 | 汇款币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | DECLARATIONMODE | 申报模式  1-普通申报  2-集中申报  3-还原申报 | string | 1 | nvarchar(1) | 否 | 否 | 申报模式  1-普通申报  2-集中申报  3-还原申报 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | MAINDEALNO | 主业务编码  在申报模式为还原申报时用于和主申报数据的银行编码进行关联 | string | 64 | nvarchar(64) | 否 | 否 | 主业务编码  在申报模式为还原申报时用于和主申报数据的银行编码进行关联 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | MAINBUSCODE | 集中申报业务编码 默认为空，如果申报模式为还原申报，则产生报文时候根据mainDealNo关联集中申报数据的bussCode找到申报号码rptNo更新此值，同时更新busCode | string | 22 | nvarchar(22) | 否 | 否 | 集中申报业务编码 默认为空，如果申报模式为还原申报，则产生报文时候根据mainDealNo关联集中申报数据的bussCode找到申报号码rptNo更新此值，同时更新busCode |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | SORT | 排序 | int | 10 | int | 否 | 否 | 排序 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | TXAMTUSD | 汇款金额(折美金) | decimal | 22,8 | decimal(22,8) | 否 | 否 | 汇款金额(折美金) |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | BUSINESS_TYPE | 业务类型 | string | 100 | nvarchar(100) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | UNIQUE_REF_NO | 业务主键 | string | 100 | nvarchar(100) | 否 | 否 | 业务主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 51 | CROSSGENERATEFLAG | 跨机构生成，用来处理那些机构branchId为A，申报号码为B，且A生成报文时需要将B数据生成的数据。 1-是 | decimal | 1,0 | decimal(1,0) | 否 | 否 | 跨机构生成，用来处理那些机构branchId为A，申报号码为B，且A生成报文时需要将B数据生成的数据。 1-是 |  | SQL Server safe.sys.columns / extended_properties |  |
| 52 | AMBRANCHCODE | am机构代码(fubon使用) | string | 64 | nvarchar(64) | 否 | 否 | am机构代码(fubon使用) |  | SQL Server safe.sys.columns / extended_properties |  |
| 53 | ACBRANCHCODE | ac机构代码(fubon使用) | string | 64 | nvarchar(64) | 否 | 否 | ac机构代码(fubon使用) |  | SQL Server safe.sys.columns / extended_properties |  |
| 54 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 55 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 56 | CREDIT_VALUE_DATE | 入账生效日 | datetime |  | datetime | 否 | 否 | 入账生效日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 57 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 58 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 59 | HANDLEID | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId | string | 100 | varchar(100) | 否 | 否 | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_BOPB_H

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BOPBID | 对应基础信息ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 对应基础信息ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | COUNTRY | 收款人常驻国家/地区代码 | string | 3 | nvarchar(3) | 否 | 否 | 收款人常驻国家/地区代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CRTUSER | 申请人 | string | 20 | nvarchar(20) | 否 | 否 | 申请人 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CUSTCOD | 组织机构代码:用作对公用户时与组织机构代码校验 | string | 18 | nvarchar(18) | 否 | 否 | 组织机构代码:用作对公用户时与组织机构代码校验 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | INPTELC | 申请人电话 | string | 20 | nvarchar(20) | 否 | 否 | 申请人电话 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | ISREF | 是否保税货物项下付款 | string | 1 | nvarchar(1) | 否 | 否 | 是否保税货物项下付款 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | PAYTYPE | 付款类型 | string | 1 | nvarchar(1) | 否 | 否 | 付款类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | REGNO | 外汇局批件号/备案表号/业务编号 | string | 20 | nvarchar(20) | 否 | 否 | 外汇局批件号/备案表号/业务编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | RPDATE | 申请日期 | datetime |  | datetime2 | 否 | 否 | 申请日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | RPTNO | 申报号码 | string | 22 | nvarchar(22) | 否 | 否 | 申报号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | SUBFLAG | 报送标记：是否需要提交/报送管理信息 | int | 10 | int | 否 | 否 | 报送标记：是否需要提交/报送管理信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | TC1AMT | 相应金额1 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 相应金额1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | TC2AMT | 相应金额2 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 相应金额2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | TX2REM | 交易附言2 | string | 256 | nvarchar(256) | 否 | 否 | 交易附言2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | TXCODE | 交易编码1 | string | 6 | nvarchar(6) | 否 | 否 | 交易编码1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | TXCODE2 | 交易编码2 | string | 6 | nvarchar(6) | 否 | 否 | 交易编码2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | TXREM | 交易附言1 | string | 256 | nvarchar(256) | 否 | 否 | 交易附言1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | SORT | 排序 | int | 10 | int | 否 | 否 | 排序 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | BUSINESS_TYPE | 业务类型 | string | 100 | nvarchar(100) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | TC1AMTUSD | 相应金额1(折美金) | decimal | 22,8 | decimal(22,8) | 否 | 否 | 相应金额1(折美金) |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | TC2AMTUSD | 相应金额2(折美金) | decimal | 22,8 | decimal(22,8) | 否 | 否 | 相应金额2(折美金) |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | CREDIT_VALUE_DATE | 入账生效日 | datetime |  | datetime | 否 | 否 | 入账生效日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | HANDLEID | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId | string | 100 | varchar(100) | 否 | 否 | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_BOPB_N

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BOPBID | 对应基础信息ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 对应基础信息ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | BOPBHID | 对应申报信息ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 对应申报信息ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CONTRNO | 合同号 | string | 128 | nvarchar(128) | 否 | 否 | 合同号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CRTUSER | 填报人 | string | 20 | nvarchar(20) | 否 | 否 | 填报人 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CUSMNO | 报关单经营单位代码 | string | 20 | nvarchar(20) | 否 | 否 | 报关单经营单位代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | IMPDATE | 最迟装运日期 | datetime |  | datetime2 | 否 | 否 | 最迟装运日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | INPTELC | 填报人电话 | string | 20 | nvarchar(20) | 否 | 否 | 填报人电话 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | INVOINO | 发票号 | string | 128 | nvarchar(128) | 否 | 否 | 发票号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | REGNO | 外汇局批件/备案表号 | string | 20 | nvarchar(20) | 否 | 否 | 外汇局批件/备案表号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | RPDATE | 申报日期 | datetime |  | datetime2 | 否 | 否 | 申报日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | RPTNO | 申报号码 | string | 22 | nvarchar(22) | 否 | 否 | 申报号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | SORT | 排序 | int | 10 | int | 否 | 否 | 排序 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | BUSINESS_TYPE | 业务类型 | string | 100 | nvarchar(100) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | CREDIT_VALUE_DATE | 入账生效日 | datetime |  | datetime | 否 | 否 | 入账生效日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | HANDLEID | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId | string | 100 | varchar(100) | 否 | 否 | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_BOPC

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | ACTUAMT | 实际付款金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 实际付款金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | ACTUCCY | 实际付款币种 | string | 3 | nvarchar(3) | 否 | 否 | 实际付款币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | BUSCODE | 银行业务编号 | string | 22 | nvarchar(22) | 否 | 否 | 银行业务编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CUSTYPE | C－对公用户，D－对私中国居民,F－对私中国非居民 需与申报号码中第19位字母所表明的含义一致 | string | 1 | nvarchar(1) | 否 | 否 | C－对公用户，D－对私中国居民,F－对私中国非居民 需与申报号码中第19位字母所表明的含义一致 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CUSTCOD | 组织机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 组织机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CUSTNM | 付款人名称 | string | 128 | nvarchar(128) | 否 | 否 | 付款人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | EXRATE | 购汇汇率 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 购汇汇率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | FCYACC | 外汇账号/银行卡号 | string | 32 | nvarchar(32) | 否 | 否 | 外汇账号/银行卡号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | FCYAMT | 现汇金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 现汇金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | IDCODE | 个人身份证号码 | string | 32 | nvarchar(32) | 否 | 否 | 个人身份证号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | ISSDATE | 开证日期 | datetime |  | datetime2 | 否 | 否 | 开证日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | LCBGNO | 信用证/保函编号 | string | 20 | nvarchar(20) | 否 | 否 | 信用证/保函编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | LCYACC | 人民币账号/银行卡号 | string | 32 | nvarchar(32) | 否 | 否 | 人民币账号/银行卡号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | LCYAMT | 购汇金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 购汇金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | METHOD | 结算方式 | string | 1 | nvarchar(1) | 否 | 否 | 结算方式 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | OPPUSERNAME | 收款人名称 | string | 128 | nvarchar(128) | 否 | 否 | 收款人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | OPPUSERTYPE | 收款人类型 | string | 4 | nvarchar(4) | 否 | 否 | 收款人类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | OTHACC | 其它账号/银行卡号 | string | 32 | nvarchar(32) | 否 | 否 | 其它账号/银行卡号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | OTHAMT | 其他金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 其他金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | OUTCHARGEAMT | 扣费金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 扣费金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | OUTCHARGECCY | 扣费币种 | string | 3 | nvarchar(3) | 否 | 否 | 扣费币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | RPTNO | 申报号码 | string | 22 | nvarchar(22) | 否 | 否 | 申报号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | SUBFLAG | 报送标记：是否需要提交/报送申报信息 | int | 10 | int | 否 | 否 | 报送标记：是否需要提交/报送申报信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | TENOR | 期限  | decimal | 10,0 | decimal(10,0) | 否 | 否 | 期限  |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | TXAMT | 付款金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 付款金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | TXCCY | 付款币种 | string | 3 | nvarchar(3) | 否 | 否 | 付款币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | DECLARATIONMODE | 申报模式  1-普通申报  2-集中申报  3-还原申报 | string | 1 | nvarchar(1) | 否 | 否 | 申报模式  1-普通申报  2-集中申报  3-还原申报 |  | SQL Server safe.sys.columns / extended_properties |  |
| 51 | MAINDEALNO | 主业务编码  在申报模式为还原申报时用于和主申报数据的银行编码进行关联 | string | 64 | nvarchar(64) | 否 | 否 | 主业务编码  在申报模式为还原申报时用于和主申报数据的银行编码进行关联 |  | SQL Server safe.sys.columns / extended_properties |  |
| 52 | MAINBUSCODE | 集中申报业务编码 默认为空，如果申报模式为还原申报，则产生报文时候根据mainDealNo关联集中申报数据的bussCode找到申报号码rptNo更新此值，同时更新busCode | string | 22 | nvarchar(22) | 否 | 否 | 集中申报业务编码 默认为空，如果申报模式为还原申报，则产生报文时候根据mainDealNo关联集中申报数据的bussCode找到申报号码rptNo更新此值，同时更新busCode |  | SQL Server safe.sys.columns / extended_properties |  |
| 53 | SORT | 排序 | int | 10 | int | 否 | 否 | 排序 |  | SQL Server safe.sys.columns / extended_properties |  |
| 54 | TXAMTUSD | 付款金额(折美金) | decimal | 22,8 | decimal(22,8) | 否 | 否 | 付款金额(折美金) |  | SQL Server safe.sys.columns / extended_properties |  |
| 55 | BUSINESS_TYPE | 业务类型 | string | 100 | nvarchar(100) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 56 | UNIQUE_REF_NO | 业务主键 | string | 100 | nvarchar(100) | 否 | 否 | 业务主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 57 | CROSSGENERATEFLAG | 跨机构生成，用来处理那些机构branchId为A，申报号码为B，且A生成报文时需要将B数据生成的数据。 1-是 | decimal | 1,0 | decimal(1,0) | 否 | 否 | 跨机构生成，用来处理那些机构branchId为A，申报号码为B，且A生成报文时需要将B数据生成的数据。 1-是 |  | SQL Server safe.sys.columns / extended_properties |  |
| 58 | AMBRANCHCODE | am机构代码(fubon使用) | string | 64 | nvarchar(64) | 否 | 否 | am机构代码(fubon使用) |  | SQL Server safe.sys.columns / extended_properties |  |
| 59 | ACBRANCHCODE | ac机构代码(fubon使用) | string | 64 | nvarchar(64) | 否 | 否 | ac机构代码(fubon使用) |  | SQL Server safe.sys.columns / extended_properties |  |
| 60 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 61 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 62 | CREDIT_VALUE_DATE | 入账生效日 | datetime |  | datetime | 否 | 否 | 入账生效日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 63 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 64 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 65 | HANDLEID | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId | string | 100 | varchar(100) | 否 | 否 | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_BOPC_K

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BOPCID | 对应基础信息ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 对应基础信息ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | COUNTRY | 收款人常驻国家/地区代码 | string | 3 | nvarchar(3) | 否 | 否 | 收款人常驻国家/地区代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CRTUSER | 联系人 | string | 20 | nvarchar(20) | 否 | 否 | 联系人 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CUSTCOD | 组织机构代码:用作对公用户时与组织机构代码校验 | string | 18 | nvarchar(18) | 否 | 否 | 组织机构代码:用作对公用户时与组织机构代码校验 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | INPTELC | 联系人 | string | 20 | nvarchar(20) | 否 | 否 | 联系人 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | ISREF | 是否保税货物项下付款 | string | 1 | nvarchar(1) | 否 | 否 | 是否保税货物项下付款 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | PAYTYPE | 付款类型 | string | 1 | nvarchar(1) | 否 | 否 | 付款类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | REGNO | 外汇局批件号/备案表号/业务编号 | string | 20 | nvarchar(20) | 否 | 否 | 外汇局批件号/备案表号/业务编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | RPTDATE | 申报日期 | datetime |  | datetime2 | 否 | 否 | 申报日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | RPTNO | 申报号码 | string | 22 | nvarchar(22) | 否 | 否 | 申报号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | SUBFLAG | 报送标记：是否需要提交/报送管理信息 | int | 10 | int | 否 | 否 | 报送标记：是否需要提交/报送管理信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | TC1AMT | 相应金额1 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 相应金额1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | TC2AMT | 相应金额2 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 相应金额2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | TX2REM | 交易附言2 | string | 256 | nvarchar(256) | 否 | 否 | 交易附言2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | TXCODE | 交易编码1 | string | 6 | nvarchar(6) | 否 | 否 | 交易编码1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | TXCODE2 | 交易编码2 | string | 6 | nvarchar(6) | 否 | 否 | 交易编码2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | TXREM | 交易附言1 | string | 256 | nvarchar(256) | 否 | 否 | 交易附言1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | SORT | 排序 | int | 10 | int | 否 | 否 | 排序 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | BUSINESS_TYPE | 业务类型 | string | 100 | nvarchar(100) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | TC1AMTUSD | 相应金额1(折美金) | decimal | 22,8 | decimal(22,8) | 否 | 否 | 相应金额1(折美金) |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | TC2AMTUSD | 相应金额2(折美金) | decimal | 22,8 | decimal(22,8) | 否 | 否 | 相应金额2(折美金) |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | CREDIT_VALUE_DATE | 入账生效日 | datetime |  | datetime | 否 | 否 | 入账生效日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | HANDLEID | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId | string | 100 | varchar(100) | 否 | 否 | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_BOPC_P

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BILLNO | 提运单号 | string | 128 | nvarchar(128) | 否 | 否 | 提运单号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | BOPCID | 对应基础信息ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 对应基础信息ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | BOPKID | 对应申报信息ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 对应申报信息ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CONTAMT | 合同金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 合同金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CONTRNO | 合同号 | string | 128 | nvarchar(128) | 否 | 否 | 合同号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CRTUSER | 填报人 | string | 20 | nvarchar(20) | 否 | 否 | 填报人 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | IMPDATE | 最迟装运日期 | datetime |  | datetime2 | 否 | 否 | 最迟装运日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | INPTELC | 填报人电话 | string | 20 | nvarchar(20) | 否 | 否 | 填报人电话 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | INVOINO | 发票号 | string | 128 | nvarchar(128) | 否 | 否 | 发票号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | REGNO | 外汇局批件/备案表号 | string | 20 | nvarchar(20) | 否 | 否 | 外汇局批件/备案表号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | RPTDATE | 申报日期 | datetime |  | datetime2 | 否 | 否 | 申报日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | RPTNO | 申报号码 | string | 22 | nvarchar(22) | 否 | 否 | 申报号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | SORT | 待确认 | int | 10 | int | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | BUSINESS_TYPE | 业务类型 | string | 100 | nvarchar(100) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | CREDIT_VALUE_DATE | 入账生效日 | datetime |  | datetime | 否 | 否 | 入账生效日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | HANDLEID | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId | string | 100 | varchar(100) | 否 | 否 | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_BOPD

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSCODE | 银行业务编号 | string | 22 | nvarchar(22) | 否 | 否 | 银行业务编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CUSTYPE | C－对公用户，D－对私中国居民,F－对私中国非居民 需与申报号码中第19位字母所表明的含义一致 | string | 1 | nvarchar(1) | 否 | 否 | C－对公用户，D－对私中国居民,F－对私中国非居民 需与申报号码中第19位字母所表明的含义一致 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CUSTCOD | 组织机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 组织机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CUSTNM | 收款人名称 | string | 128 | nvarchar(128) | 否 | 否 | 收款人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | EXRATE | 结汇汇率 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 结汇汇率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | FCYACC | 外汇账号/银行卡号 | string | 32 | nvarchar(32) | 否 | 否 | 外汇账号/银行卡号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | FCYAMT | 现汇金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 现汇金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | IDCODE | 个人身份证号码 | string | 32 | nvarchar(32) | 否 | 否 | 个人身份证号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | INCHARGEAMT | 国内银行扣费金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 国内银行扣费金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | INCHARGECCY | 国内银行扣费币种 | string | 3 | nvarchar(3) | 否 | 否 | 国内银行扣费币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | LCYACC | 人民币账号/银行卡号 | string | 32 | nvarchar(32) | 否 | 否 | 人民币账号/银行卡号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | LCYAMT | 结汇金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 结汇金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | METHOD | 结算方式 | string | 1 | nvarchar(1) | 否 | 否 | 结算方式 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | OPPUSERNAME | 付款人名称 | string | 128 | nvarchar(128) | 否 | 否 | 付款人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | OPPUSERTYPE | 付款人类型 | string | 4 | nvarchar(4) | 否 | 否 | 付款人类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | OTHACC | 其它账号/银行卡号 | string | 32 | nvarchar(32) | 否 | 否 | 其它账号/银行卡号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | OTHAMT | 其他金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 其他金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | RPTNO | 申报号码 | string | 22 | nvarchar(22) | 否 | 否 | 申报号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | SUBFLAG | 报送标记：是否需要提交/报送申报信息 | int | 10 | int | 否 | 否 | 报送标记：是否需要提交/报送申报信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | TXAMT | 收入款金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 收入款金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | TXCCY | 收入款币种 | string | 3 | nvarchar(3) | 否 | 否 | 收入款币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | DECLARATIONMODE | 申报模式  1-普通申报  2-集中申报  3-还原申报 | string | 1 | nvarchar(1) | 否 | 否 | 申报模式  1-普通申报  2-集中申报  3-还原申报 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | MAINDEALNO | 主业务编码  在申报模式为还原申报时用于和主申报数据的银行编码进行关联 | string | 64 | nvarchar(64) | 否 | 否 | 主业务编码  在申报模式为还原申报时用于和主申报数据的银行编码进行关联 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | MAINBUSCODE | 集中申报业务编码 默认为空，如果申报模式为还原申报，则产生报文时候根据mainDealNo关联集中申报数据的bussCode找到申报号码rptNo更新此值，同时更新busCode | string | 22 | nvarchar(22) | 否 | 否 | 集中申报业务编码 默认为空，如果申报模式为还原申报，则产生报文时候根据mainDealNo关联集中申报数据的bussCode找到申报号码rptNo更新此值，同时更新busCode |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | SORT | 排序 | int | 10 | int | 否 | 否 | 排序 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | TXAMTUSD | 收入款金额(折美金) | decimal | 22,8 | decimal(22,8) | 否 | 否 | 收入款金额(折美金) |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | BUSINESS_TYPE | 业务类型 | string | 100 | nvarchar(100) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 51 | UNIQUE_REF_NO | 业务主键 | string | 100 | nvarchar(100) | 否 | 否 | 业务主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 52 | CROSSGENERATEFLAG | 跨机构生成，用来处理那些机构branchId为A，申报号码为B，且A生成报文时需要将B数据生成的数据。 1-是 | decimal | 1,0 | decimal(1,0) | 否 | 否 | 跨机构生成，用来处理那些机构branchId为A，申报号码为B，且A生成报文时需要将B数据生成的数据。 1-是 |  | SQL Server safe.sys.columns / extended_properties |  |
| 53 | AMBRANCHCODE | am机构代码(fubon使用) | string | 64 | nvarchar(64) | 否 | 否 | am机构代码(fubon使用) |  | SQL Server safe.sys.columns / extended_properties |  |
| 54 | ACBRANCHCODE | ac机构代码(fubon使用) | string | 64 | nvarchar(64) | 否 | 否 | ac机构代码(fubon使用) |  | SQL Server safe.sys.columns / extended_properties |  |
| 55 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 56 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 57 | CREDIT_VALUE_DATE | 入账生效日 | datetime |  | datetime | 否 | 否 | 入账生效日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 58 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 59 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 60 | HANDLEID | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId | string | 100 | varchar(100) | 否 | 否 | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_BOPD_R

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BOPDID | 对应基础信息ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 对应基础信息ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CHKAMT | 收汇总金额中用于出口核销的金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 收汇总金额中用于出口核销的金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CRTUSER | 填报人 | string | 20 | nvarchar(20) | 否 | 否 | 填报人 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CUSTCOD | 组织机构代码:用作对公用户时与组织机构代码校验 | string | 18 | nvarchar(18) | 否 | 否 | 组织机构代码:用作对公用户时与组织机构代码校验 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | INPTELC | 填报人电话 | string | 20 | nvarchar(20) | 否 | 否 | 填报人电话 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | ISREF | 是否保税货物项下收汇 | string | 1 | nvarchar(1) | 否 | 否 | 是否保税货物项下收汇 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | PAYATTR | 境内收入类型 | string | 1 | nvarchar(1) | 否 | 否 | 境内收入类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | PAYTYPE | 收款性质 | string | 1 | nvarchar(1) | 否 | 否 | 收款性质 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | REFNO | 出口收汇核销单编号 | string | 9 | nvarchar(9) | 否 | 否 | 出口收汇核销单编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | REGNO | 外汇局批件号 | string | 20 | nvarchar(20) | 否 | 否 | 外汇局批件号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | RPTDATE | 申报日期 | datetime |  | datetime2 | 否 | 否 | 申报日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | RPTNO | 申报号码 | string | 22 | nvarchar(22) | 否 | 否 | 申报号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | TC1AMT | 相应金额1 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 相应金额1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | TC2AMT | 相应金额2 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 相应金额2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | TX2REM | 交易附言2 | string | 256 | nvarchar(256) | 否 | 否 | 交易附言2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | TXCODE | 交易编码1 | string | 6 | nvarchar(6) | 否 | 否 | 交易编码1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | TXCODE2 | 交易编码2 | string | 6 | nvarchar(6) | 否 | 否 | 交易编码2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | TXREM | 交易附言1 | string | 256 | nvarchar(256) | 否 | 否 | 交易附言1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | SORT | 排序 | int | 10 | int | 否 | 否 | 排序 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | BUSINESS_TYPE | 业务类型 | string | 100 | nvarchar(100) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | TC1AMTUSD | 相应金额1(折美金) | decimal | 22,8 | decimal(22,8) | 否 | 否 | 相应金额1(折美金) |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | TC2AMTUSD | 相应金额2(折美金) | decimal | 22,8 | decimal(22,8) | 否 | 否 | 相应金额2(折美金) |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | CREDIT_VALUE_DATE | 入账生效日 | datetime |  | datetime | 否 | 否 | 入账生效日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 51 | HANDLEID | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId | string | 100 | varchar(100) | 否 | 否 | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_BOPE

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BUSCODE | 银行业务编号 | string | 22 | nvarchar(22) | 否 | 否 | 银行业务编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CUSTYPE | C－对公用户，D－对私中国居民,F－对私中国非居民 需与申报号码中第19位字母所表明的含义一致 | string | 1 | nvarchar(1) | 否 | 否 | C－对公用户，D－对私中国居民,F－对私中国非居民 需与申报号码中第19位字母所表明的含义一致 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CUSTCOD | 组织机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 组织机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CUSTNM | 付款人人名称 | string | 128 | nvarchar(128) | 否 | 否 | 付款人人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | EXRATE | 购汇汇率 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 购汇汇率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | FCYACC | 外汇账号/银行卡号 | string | 32 | nvarchar(32) | 否 | 否 | 外汇账号/银行卡号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | FCYAMT | 现汇金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 现汇金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | IDCODE | 个人身份证号码 | string | 32 | nvarchar(32) | 否 | 否 | 个人身份证号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | LCYACC | 人民币账号/银行卡号 | string | 32 | nvarchar(32) | 否 | 否 | 人民币账号/银行卡号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | LCYAMT | 购汇金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 购汇金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | METHOD | 结算方式 | string | 1 | nvarchar(1) | 否 | 否 | 结算方式 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | OPPACC | 收款人账号 | string | 32 | nvarchar(32) | 否 | 否 | 收款人账号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | OPPUSERNAME | 收款人名称 | string | 128 | nvarchar(128) | 否 | 否 | 收款人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | OPPUSERTYPE | 收款人类型 | string | 4 | nvarchar(4) | 否 | 否 | 收款人类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | OTHACC | 其它账号/银行卡号 | string | 32 | nvarchar(32) | 否 | 否 | 其它账号/银行卡号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | OTHAMT | 其他金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 其他金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | RPTNO | 申报号码 | string | 22 | nvarchar(22) | 否 | 否 | 申报号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | SUBFLAG | 报送标记：是否需要提交/报送申报信息 | int | 10 | int | 否 | 否 | 报送标记：是否需要提交/报送申报信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | TXAMT | 汇款金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 汇款金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | TXCCY | 汇款币种 | string | 3 | nvarchar(3) | 否 | 否 | 汇款币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | DECLARATIONMODE | 申报模式  1-普通申报  2-集中申报  3-还原申报 | string | 1 | nvarchar(1) | 否 | 否 | 申报模式  1-普通申报  2-集中申报  3-还原申报 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | MAINDEALNO | 主业务编码  在申报模式为还原申报时用于和主申报数据的银行编码进行关联 | string | 64 | nvarchar(64) | 否 | 否 | 主业务编码  在申报模式为还原申报时用于和主申报数据的银行编码进行关联 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | MAINBUSCODE | 集中申报业务编码 默认为空，如果申报模式为还原申报，则产生报文时候根据mainDealNo关联集中申报数据的bussCode找到申报号码rptNo更新此值，同时更新busCode | string | 22 | nvarchar(22) | 否 | 否 | 集中申报业务编码 默认为空，如果申报模式为还原申报，则产生报文时候根据mainDealNo关联集中申报数据的bussCode找到申报号码rptNo更新此值，同时更新busCode |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | SORT | 排序 | int | 10 | int | 否 | 否 | 排序 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | TXAMTUSD | 汇款金额(折美金) | decimal | 22,8 | decimal(22,8) | 否 | 否 | 汇款金额(折美金) |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | BUSINESS_TYPE | 业务类型 | string | 100 | nvarchar(100) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | UNIQUE_REF_NO | 业务主键 | string | 100 | nvarchar(100) | 否 | 否 | 业务主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 51 | CROSSGENERATEFLAG | 跨机构生成，用来处理那些机构branchId为A，申报号码为B，且A生成报文时需要将B数据生成的数据。 1-是 | decimal | 1,0 | decimal(1,0) | 否 | 否 | 跨机构生成，用来处理那些机构branchId为A，申报号码为B，且A生成报文时需要将B数据生成的数据。 1-是 |  | SQL Server safe.sys.columns / extended_properties |  |
| 52 | AMBRANCHCODE | am机构代码(fubon使用) | string | 64 | nvarchar(64) | 否 | 否 | am机构代码(fubon使用) |  | SQL Server safe.sys.columns / extended_properties |  |
| 53 | ACBRANCHCODE | ac机构代码(fubon使用) | string | 64 | nvarchar(64) | 否 | 否 | ac机构代码(fubon使用) |  | SQL Server safe.sys.columns / extended_properties |  |
| 54 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 55 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 56 | CREDIT_VALUE_DATE | 入账生效日 | datetime |  | datetime | 否 | 否 | 入账生效日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 57 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 58 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 59 | HANDLEID | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId | string | 100 | varchar(100) | 否 | 否 | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_BOPE_Q

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BOPEID | 基础信息Id | decimal | 19,0 | decimal(19,0) | 否 | 否 | 基础信息Id |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | CONTRNO | 合同号 | string | 128 | nvarchar(128) | 否 | 否 | 合同号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | COUNTRY | 收款人常驻国家/地区代码 | string | 3 | nvarchar(3) | 否 | 否 | 收款人常驻国家/地区代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CRTUSER | 填报人 | string | 20 | nvarchar(20) | 否 | 否 | 填报人 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CUSTCOD | 组织机构代码:用作对公用户时与组织机构代码校验 | string | 18 | nvarchar(18) | 否 | 否 | 组织机构代码:用作对公用户时与组织机构代码校验 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | IMPDATE | 最迟装运日期 | datetime |  | datetime2 | 否 | 否 | 最迟装运日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | INPTELC | 填报人电话 | string | 20 | nvarchar(20) | 否 | 否 | 填报人电话 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | INVOINO | 发票号 | string | 128 | nvarchar(128) | 否 | 否 | 发票号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | ISREF | 是否保税货物项下付款。Y-是，N-否 | string | 1 | nvarchar(1) | 否 | 否 | 是否保税货物项下付款。Y-是，N-否 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | PAYATTR | 付款性质。X－保税区,E－出口加工区,D－钻石交易所,A－其他特殊经济区,M－深加工结转,O－其他 | string | 1 | nvarchar(1) | 否 | 否 | 付款性质。X－保税区,E－出口加工区,D－钻石交易所,A－其他特殊经济区,M－深加工结转,O－其他 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | PAYTYPE | 付款类型。A－预付货款,P－货到付款,R－退款,O-其它 | string | 1 | nvarchar(1) | 否 | 否 | 付款类型。A－预付货款,P－货到付款,R－退款,O-其它 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | REGNO | 外汇局批件号/备案表号/业务编号 | string | 20 | nvarchar(20) | 否 | 否 | 外汇局批件号/备案表号/业务编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | RPTDATE | 申报日期 | datetime |  | datetime2 | 否 | 否 | 申报日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | RPTNO | 申报号码 | string | 22 | nvarchar(22) | 否 | 否 | 申报号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | TC1AMT | 相应金额1 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 相应金额1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | TC2AMT | 相应金额2 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 相应金额2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | TXCODE | 交易编码1 | string | 6 | nvarchar(6) | 否 | 否 | 交易编码1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | TXCODE2 | 交易编码2 | string | 6 | nvarchar(6) | 否 | 否 | 交易编码2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | TXREM | 交易附言1 | string | 256 | nvarchar(256) | 否 | 否 | 交易附言1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | TX2REM | 交易附言2 | string | 256 | nvarchar(256) | 否 | 否 | 交易附言2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | SORT | 排序 | int | 10 | int | 否 | 否 | 排序 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | BUSINESS_TYPE | 业务类型 | string | 100 | nvarchar(100) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | SPECIALCODE | 特殊代码 | string | 3 | nvarchar(3) | 否 | 否 | 特殊代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | INVOINOTEMP | 发票号 | string | 128 | nvarchar(128) | 否 | 否 | 发票号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | TC1AMTUSD | 相应金额1(折美金) | decimal | 22,8 | decimal(22,8) | 否 | 否 | 相应金额1(折美金) |  | SQL Server safe.sys.columns / extended_properties |  |
| 51 | TC2AMTUSD | 相应金额2(折美金) | decimal | 22,8 | decimal(22,8) | 否 | 否 | 相应金额2(折美金) |  | SQL Server safe.sys.columns / extended_properties |  |
| 52 | CREDIT_VALUE_DATE | 入账生效日 | datetime |  | datetime | 否 | 否 | 入账生效日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 53 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 54 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 55 | HANDLEID | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId | string | 100 | varchar(100) | 否 | 否 | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_BOPF

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | ACTUAMT | 实际付款金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 实际付款金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | ACTUCCY | 实际付款币种 | string | 3 | nvarchar(3) | 否 | 否 | 实际付款币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | BUSCODE | 银行业务编号 | string | 22 | nvarchar(22) | 否 | 否 | 银行业务编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CUSTYPE | C－对公用户，D－对私中国居民,F－对私中国非居民 需与申报号码中第19位字母所表明的含义一致 | string | 1 | nvarchar(1) | 否 | 否 | C－对公用户，D－对私中国居民,F－对私中国非居民 需与申报号码中第19位字母所表明的含义一致 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CUSTCOD | 组织机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 组织机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CUSTNM | 付款人名称 | string | 128 | nvarchar(128) | 否 | 否 | 付款人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | EXRATE | 购汇汇率 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 购汇汇率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | FCYACC | 外汇账号/银行卡号 | string | 32 | nvarchar(32) | 否 | 否 | 外汇账号/银行卡号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | FCYAMT | 现汇金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 现汇金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | IDCODE | 个人身份证号码 | string | 32 | nvarchar(32) | 否 | 否 | 个人身份证号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | ISSDATE | 开证日期 | datetime |  | datetime2 | 否 | 否 | 开证日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | LCBGNO | 信用证编号 | string | 20 | nvarchar(20) | 否 | 否 | 信用证编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | LCYACC | 人民币账号/银行卡号 | string | 32 | nvarchar(32) | 否 | 否 | 人民币账号/银行卡号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | LCYAMT | 购汇金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 购汇金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | METHOD | 结算方式 | string | 1 | nvarchar(1) | 否 | 否 | 结算方式 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | OPPUSERNAME | 收款人名称 | string | 128 | nvarchar(128) | 否 | 否 | 收款人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | OPPUSERTYPE | 收款人类型 | string | 4 | nvarchar(4) | 否 | 否 | 收款人类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | OTHACC | 其它账号/银行卡号 | string | 32 | nvarchar(32) | 否 | 否 | 其它账号/银行卡号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | OTHAMT | 其他金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 其他金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | OUTCHARGEAMT | 扣费金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 扣费金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | OUTCHARGECCY | 扣费币种 | string | 3 | nvarchar(3) | 否 | 否 | 扣费币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | RPTNO | 申报号码 | string | 22 | nvarchar(22) | 否 | 否 | 申报号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | SUBFLAG | 报送标记：是否需要提交/报送申报信息 | int | 10 | int | 否 | 否 | 报送标记：是否需要提交/报送申报信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | TENOR | 期限 | decimal | 10,0 | decimal(10,0) | 否 | 否 | 期限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | TXAMT | 付款金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 付款金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | TXCCY | 付款币种 | string | 3 | nvarchar(3) | 否 | 否 | 付款币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | DECLARATIONMODE | 申报模式  1-普通申报  2-集中申报  3-还原申报 | string | 1 | nvarchar(1) | 否 | 否 | 申报模式  1-普通申报  2-集中申报  3-还原申报 |  | SQL Server safe.sys.columns / extended_properties |  |
| 51 | MAINDEALNO | 主业务编码  在申报模式为还原申报时用于和主申报数据的银行编码进行关联 | string | 64 | nvarchar(64) | 否 | 否 | 主业务编码  在申报模式为还原申报时用于和主申报数据的银行编码进行关联 |  | SQL Server safe.sys.columns / extended_properties |  |
| 52 | MAINBUSCODE | 集中申报业务编码 默认为空，如果申报模式为还原申报，则产生报文时候根据mainDealNo关联集中申报数据的bussCode找到申报号码rptNo更新此值，同时更新busCode | string | 22 | nvarchar(22) | 否 | 否 | 集中申报业务编码 默认为空，如果申报模式为还原申报，则产生报文时候根据mainDealNo关联集中申报数据的bussCode找到申报号码rptNo更新此值，同时更新busCode |  | SQL Server safe.sys.columns / extended_properties |  |
| 53 | SORT | 排序 | int | 10 | int | 否 | 否 | 排序 |  | SQL Server safe.sys.columns / extended_properties |  |
| 54 | TXAMTUSD | 付款金额(折美金) | decimal | 22,8 | decimal(22,8) | 否 | 否 | 付款金额(折美金) |  | SQL Server safe.sys.columns / extended_properties |  |
| 55 | BUSINESS_TYPE | 业务类型 | string | 100 | nvarchar(100) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 56 | UNIQUE_REF_NO | 业务主键 | string | 100 | nvarchar(100) | 否 | 否 | 业务主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 57 | CROSSGENERATEFLAG | 跨机构生成，用来处理那些机构branchId为A，申报号码为B，且A生成报文时需要将B数据生成的数据。 1-是 | decimal | 1,0 | decimal(1,0) | 否 | 否 | 跨机构生成，用来处理那些机构branchId为A，申报号码为B，且A生成报文时需要将B数据生成的数据。 1-是 |  | SQL Server safe.sys.columns / extended_properties |  |
| 58 | AMBRANCHCODE | am机构代码(fubon使用) | string | 64 | nvarchar(64) | 否 | 否 | am机构代码(fubon使用) |  | SQL Server safe.sys.columns / extended_properties |  |
| 59 | ACBRANCHCODE | ac机构代码(fubon使用) | string | 64 | nvarchar(64) | 否 | 否 | ac机构代码(fubon使用) |  | SQL Server safe.sys.columns / extended_properties |  |
| 60 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 61 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 62 | CREDIT_VALUE_DATE | 入账生效日 | datetime |  | datetime | 否 | 否 | 入账生效日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 63 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 64 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 65 | HANDLEID | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId | string | 100 | varchar(100) | 否 | 否 | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_BOPF_S

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | BILLNO | 提运单号 | string | 128 | nvarchar(128) | 否 | 否 | 提运单号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | BOPFID | 基础信息Id | decimal | 19,0 | decimal(19,0) | 否 | 否 | 基础信息Id |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | CONTAMT | 合同金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 合同金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CONTRNO | 合同号 | string | 128 | nvarchar(128) | 否 | 否 | 合同号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | COUNTRY | 收款人常驻国家/地区代码 | string | 3 | nvarchar(3) | 否 | 否 | 收款人常驻国家/地区代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | CRTUSER | 填报人 | string | 20 | nvarchar(20) | 否 | 否 | 填报人 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | CUSTCOD | 组织机构代码:用作对公用户时与组织机构代码校验 | string | 18 | nvarchar(18) | 否 | 否 | 组织机构代码:用作对公用户时与组织机构代码校验 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | IMPDATE | 最迟装运日期 | datetime |  | datetime2 | 否 | 否 | 最迟装运日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | INPTELC | 填报人电话 | string | 20 | nvarchar(20) | 否 | 否 | 填报人电话 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | INVOINO | 发票号 | string | 128 | nvarchar(128) | 否 | 否 | 发票号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | ISREF | 是否保税货物项下付款。Y-是，N-否 | string | 1 | nvarchar(1) | 否 | 否 | 是否保税货物项下付款。Y-是，N-否 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | PAYATTR | 付款性质。X－保税区,E－出口加工区,D－钻石交易所,A－其他特殊经济区,M－深加工结转,O－其他 | string | 1 | nvarchar(1) | 否 | 否 | 付款性质。X－保税区,E－出口加工区,D－钻石交易所,A－其他特殊经济区,M－深加工结转,O－其他 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | PAYTYPE | 付款类型。A－预付货款,O-其它 | string | 1 | nvarchar(1) | 否 | 否 | 付款类型。A－预付货款,O-其它 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | REGNO | 外汇局批件号/备案表号/业务编号 | string | 20 | nvarchar(20) | 否 | 否 | 外汇局批件号/备案表号/业务编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | RPTDATE | 申报日期 | datetime |  | datetime2 | 否 | 否 | 申报日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | RPTNO | 申报号码 | string | 22 | nvarchar(22) | 否 | 否 | 申报号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | TC1AMT | 相应金额1 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 相应金额1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | TC2AMT | 相应金额2 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 相应金额2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | TXCODE | 交易编码1 | string | 6 | nvarchar(6) | 否 | 否 | 交易编码1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | TXCODE2 | 交易编码2 | string | 6 | nvarchar(6) | 否 | 否 | 交易编码2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | TXREM | 交易附言1 | string | 256 | nvarchar(256) | 否 | 否 | 交易附言1 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | TX2REM | 交易附言2 | string | 256 | nvarchar(256) | 否 | 否 | 交易附言2 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | SORT | 排序 | int | 10 | int | 否 | 否 | 排序 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | BUSINESS_TYPE | 业务类型 | string | 100 | nvarchar(100) | 否 | 否 | 业务类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | TC1AMTUSD | 相应金额1(折美金) | decimal | 22,8 | decimal(22,8) | 否 | 否 | 相应金额1(折美金) |  | SQL Server safe.sys.columns / extended_properties |  |
| 51 | TC2AMTUSD | 相应金额2(折美金) | decimal | 22,8 | decimal(22,8) | 否 | 否 | 相应金额2(折美金) |  | SQL Server safe.sys.columns / extended_properties |  |
| 52 | CREDIT_VALUE_DATE | 入账生效日 | datetime |  | datetime | 否 | 否 | 入账生效日 |  | SQL Server safe.sys.columns / extended_properties |  |
| 53 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 54 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 55 | HANDLEID | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId | string | 100 | varchar(100) | 否 | 否 | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_BOPU

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | CHECKBY | 审核人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 审核人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | CHECKTIME | 审核时间 | datetime |  | datetime2 | 否 | 否 | 审核时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CREATEDBY | 创建人用户名 | string | 64 | nvarchar(64) | 否 | 否 | 创建人用户名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | LASTMODIFIEDBY | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> | string | 64 | nvarchar(64) | 否 | 否 | 最后修改人用户名,针对业务数据来说，只有保存和提交操作会修改此字段。目前被系统用作<数据修改人> |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | LASTMODIFIEDTIME | 最后修改时间 | datetime |  | datetime2 | 否 | 否 | 最后修改时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 9 | ACTIONDESC | 修改/删除原因或申报无误理由 | string | 128 | nvarchar(128) | 否 | 否 | 修改/删除原因或申报无误理由 |  | SQL Server safe.sys.columns / extended_properties |  |
| 10 | ACTIONTYPE | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 | string | 1 | nvarchar(1) | 否 | 否 | 操作类型:A－新建,C－修改,D－删除,R-申报无误（银行反馈），预留，暂不用 |  | SQL Server safe.sys.columns / extended_properties |  |
| 11 | BRANCHID | 机构ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | 机构ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 12 | DATASOURCE | 数据来源0-手工录入，1-数据导入 | int | 10 | int | 否 | 否 | 数据来源0-手工录入，1-数据导入 |  | SQL Server safe.sys.columns / extended_properties |  |
| 13 | DATASTATUS | 数据状态 | int | 10 | int | 否 | 否 | 数据状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 14 | DEALNO | 业务编码 | string | 64 | nvarchar(64) | 否 | 否 | 业务编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 15 | ISFEEDBACK | 是否为反馈失败数据 | int | 10 | int | 否 | 否 | 是否为反馈失败数据 |  | SQL Server safe.sys.columns / extended_properties |  |
| 16 | REFUSEREASON | 审核不通过原因 | string | 128 | nvarchar(128) | 否 | 否 | 审核不通过原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 17 | RESETREASON | 重置原因 | string | 128 | nvarchar(128) | 否 | 否 | 重置原因 |  | SQL Server safe.sys.columns / extended_properties |  |
| 18 | SAFEBRANCHCODE | safe机构代码  仅为页面显示区分总行分行 | string | 32 | nvarchar(32) | 否 | 否 | safe机构代码  仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 19 | SAFEBRANCHNAME | safe机构名称 仅为页面显示区分总行分行 | string | 100 | nvarchar(100) | 否 | 否 | safe机构名称 仅为页面显示区分总行分行 |  | SQL Server safe.sys.columns / extended_properties |  |
| 20 | TNAME | 接口文件名 | string | 32 | nvarchar(32) | 否 | 否 | 接口文件名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 21 | AREACODE | 住所/营业场所 | string | 6 | nvarchar(6) | 否 | 否 | 住所/营业场所 |  | SQL Server safe.sys.columns / extended_properties |  |
| 22 | ATTRCODE | 经济类型代码 | string | 3 | nvarchar(3) | 否 | 否 | 经济类型代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 23 | BUSCODE | 银行业务编号 | string | 22 | nvarchar(22) | 否 | 否 | 银行业务编号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 24 | BUSDATE | 业务日期 | datetime |  | datetime2 | 否 | 否 | 业务日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 25 | CORSCOPE | 经营范围 | string | 128 | nvarchar(128) | 否 | 否 | 经营范围 |  | SQL Server safe.sys.columns / extended_properties |  |
| 26 | CORLMT | 经营期限 | string | 128 | nvarchar(128) | 否 | 否 | 经营期限 |  | SQL Server safe.sys.columns / extended_properties |  |
| 27 | COUNTRYCODE | 常驻国家代码 | string | 3 | nvarchar(3) | 否 | 否 | 常驻国家代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 28 | CREDITCODE | 统一社会信用代码 | string | 18 | nvarchar(18) | 否 | 否 | 统一社会信用代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 29 | CUSTYPE | C－对公用户，D－对私中国居民,F－对私中国非居民 需与申报号码中第19位字母所表明的含义一致 | string | 1 | nvarchar(1) | 否 | 否 | C－对公用户，D－对私中国居民,F－对私中国非居民 需与申报号码中第19位字母所表明的含义一致 |  | SQL Server safe.sys.columns / extended_properties |  |
| 30 | CUSTADDR | 单位地址 | string | 256 | nvarchar(256) | 否 | 否 | 单位地址 |  | SQL Server safe.sys.columns / extended_properties |  |
| 31 | CUSTCOD | 组织机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 组织机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 32 | CUSTCODE | 组织机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 组织机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 33 | CUSTCODEOLD | 原来的组织机构代码 | string | 18 | nvarchar(18) | 否 | 否 | 原来的组织机构代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 34 | CUSTCONTACT | 联系人姓名 | string | 128 | nvarchar(128) | 否 | 否 | 联系人姓名 |  | SQL Server safe.sys.columns / extended_properties |  |
| 35 | CUSTFAX | 传真 | string | 128 | nvarchar(128) | 否 | 否 | 传真 |  | SQL Server safe.sys.columns / extended_properties |  |
| 36 | CUSTNAME | 组织机构名称 | string | 128 | nvarchar(128) | 否 | 否 | 组织机构名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 37 | CUSTNM | 收款人名称 | string | 128 | nvarchar(128) | 否 | 否 | 收款人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 38 | CUSTTEL | 联系电话 | string | 128 | nvarchar(128) | 否 | 否 | 联系电话 |  | SQL Server safe.sys.columns / extended_properties |  |
| 39 | CUSTOMNO | 海关注册号 | string | 20 | nvarchar(20) | 否 | 否 | 海关注册号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 40 | CUSTOMERENGNAME | 组织机构英文名称 | string | 256 | nvarchar(256) | 否 | 否 | 组织机构英文名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 41 | ECEXADDR | 交易用eMail | string | 128 | nvarchar(128) | 否 | 否 | 交易用eMail |  | SQL Server safe.sys.columns / extended_properties |  |
| 42 | EMAIL | 外汇局联系用eMail | string | 128 | nvarchar(128) | 否 | 否 | 外汇局联系用eMail |  | SQL Server safe.sys.columns / extended_properties |  |
| 43 | EXRATE | 结汇汇率 | decimal | 13,8 | decimal(13,8) | 否 | 否 | 结汇汇率 |  | SQL Server safe.sys.columns / extended_properties |  |
| 44 | FCYACC | 外汇账号/银行卡号 | string | 32 | nvarchar(32) | 否 | 否 | 外汇账号/银行卡号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 45 | FCYAMT | 现汇金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 现汇金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 46 | IDCODE | 个人身份证号码 | string | 32 | nvarchar(32) | 否 | 否 | 个人身份证号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 47 | INCORPORATOR | 法定代表人 | string | 30 | nvarchar(30) | 否 | 否 | 法定代表人 |  | SQL Server safe.sys.columns / extended_properties |  |
| 48 | INCORPORATORIDCODE | 法定代表人身份证件号码 | string | 18 | nvarchar(18) | 否 | 否 | 法定代表人身份证件号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 49 | INDUSTRYCODE | 行业属性代码 | string | 4 | nvarchar(4) | 否 | 否 | 行业属性代码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 50 | ISTAXFREE | 是否特殊经济区内企业 | string | 1 | nvarchar(1) | 否 | 否 | 是否特殊经济区内企业 |  | SQL Server safe.sys.columns / extended_properties |  |
| 51 | LCYACC | 人民币账号/银行卡号 | string | 32 | nvarchar(32) | 否 | 否 | 人民币账号/银行卡号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 52 | LCYAMT | 结汇金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 结汇金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 53 | LEICODE | LEI编码 | string | 32 | nvarchar(32) | 否 | 否 | LEI编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 54 | METHOD | 结算方式T－电汇,D－票汇,M－信汇 | string | 1 | nvarchar(1) | 否 | 否 | 结算方式T－电汇,D－票汇,M－信汇 |  | SQL Server safe.sys.columns / extended_properties |  |
| 55 | OLDID | 待确认 | decimal | 19,0 | decimal(19,0) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 56 | OPPUSERNAME | 付款人名称 | string | 128 | nvarchar(128) | 否 | 否 | 付款人名称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 57 | OPPUSERTYPE | 付款人类型 | string | 4 | nvarchar(4) | 否 | 否 | 付款人类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 58 | ORGTYPE | 机构类型 | string | 1 | nvarchar(1) | 否 | 否 | 机构类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 59 | OTHACC | 其它账号/银行卡号 | string | 32 | nvarchar(32) | 否 | 否 | 其它账号/银行卡号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 60 | OTHAMT | 其他金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 其他金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 61 | POSTCODE | 邮政编码 | string | 6 | nvarchar(6) | 否 | 否 | 邮政编码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 62 | REGDATE | 注册/开业成立日期 | datetime |  | datetime2 | 否 | 否 | 注册/开业成立日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 63 | REMARKS | 备注 | string | 128 | nvarchar(128) | 否 | 否 | 备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 64 | RPTMETHOD | 企业申报方式 | string | 1 | nvarchar(1) | 否 | 否 | 企业申报方式 |  | SQL Server safe.sys.columns / extended_properties |  |
| 65 | RPTNO | 申报号码 | string | 22 | nvarchar(22) | 否 | 否 | 申报号码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 66 | SHORTNAME | 组织机构简称 | string | 128 | nvarchar(128) | 否 | 否 | 组织机构简称 |  | SQL Server safe.sys.columns / extended_properties |  |
| 67 | SUBFLAG | 报送标记：是否需要提交/报送申报信息 | int | 10 | int | 否 | 否 | 报送标记：是否需要提交/报送申报信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 68 | SWIFTCODE | SWIFTCODE | string | 20 | nvarchar(20) | 否 | 否 | SWIFTCODE |  | SQL Server safe.sys.columns / extended_properties |  |
| 69 | TAXFREECODE | 特殊经济区内企业类型 | string | 2 | nvarchar(2) | 否 | 否 | 特殊经济区内企业类型 |  | SQL Server safe.sys.columns / extended_properties |  |
| 70 | TXAMT | 收入款金额 | decimal | 22,0 | decimal(22,0) | 否 | 否 | 收入款金额 |  | SQL Server safe.sys.columns / extended_properties |  |
| 71 | TXCCY | 收入款币种 | string | 3 | nvarchar(3) | 否 | 否 | 收入款币种 |  | SQL Server safe.sys.columns / extended_properties |  |
| 72 | DECLAREUPDORDELTIME | 申报修改/申报删除时间 | datetime |  | datetime2 | 否 | 否 | 申报修改/申报删除时间 |  | SQL Server safe.sys.columns / extended_properties |  |
| 73 | BUSINESSCODE | 业务线Code | string | 30 | nvarchar(30) | 否 | 否 | 业务线Code |  | SQL Server safe.sys.columns / extended_properties |  |
| 74 | CUSTID | 客户号 | string | 256 | nvarchar(256) | 否 | 否 | 客户号 |  | SQL Server safe.sys.columns / extended_properties |  |
| 75 | SAFEERRINFO | SAFE反馈错误信息 | string | 1000 | nvarchar(1000) | 否 | 否 | SAFE反馈错误信息 |  | SQL Server safe.sys.columns / extended_properties |  |
| 76 | LOGFEEDBACKSTATUS | 日志反馈状态 | string | 64 | varchar(64) | 否 | 否 | 日志反馈状态 |  | SQL Server safe.sys.columns / extended_properties |  |
| 77 | MANUALFLAG | 人工操作标识 | string | 1 | varchar(1) | 否 | 否 | 人工操作标识 |  | SQL Server safe.sys.columns / extended_properties |  |
| 78 | OPERATEREMARK | 操作备注 | string | 1000 | nvarchar(1000) | 否 | 否 | 操作备注 |  | SQL Server safe.sys.columns / extended_properties |  |
| 79 | HANDLEID | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId | string | 100 | varchar(100) | 否 | 否 | 处理批次ID 由系统自行生成代表某个批次 花旗现场使用，对应批量操作时T_SAFE_BATCH_HANDLE_TEMP的handleId |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_BOPU_BANKINFO

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 物理主键 | bigint | 19 | bigint | 是 | 是 | 物理主键 |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | BOPU_ID | BOPU的ID | decimal | 19,0 | decimal(19,0) | 否 | 否 | BOPU的ID |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | BRANCHCODE | 金融机构标识码 | string | 12 | nvarchar(12) | 否 | 否 | 金融机构标识码 |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | CONTACT | 单位联系人 | string | 128 | nvarchar(128) | 否 | 否 | 单位联系人 |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | FAX | 建表日期 | string | 128 | nvarchar(128) | 否 | 否 | 建表日期 |  | SQL Server safe.sys.columns / extended_properties |  |
| 6 | INVALID | 数据是否有效 0有效，1无效 | int | 10 | int | 是 | 否 | 数据是否有效 0有效，1无效 |  | SQL Server safe.sys.columns / extended_properties |  |
| 7 | TEL | 单位联系电话 | string | 128 | nvarchar(128) | 否 | 否 | 单位联系电话 |  | SQL Server safe.sys.columns / extended_properties |  |
| 8 | CREATEDTIME | 创建时间 | datetime |  | datetime2 | 否 | 否 | 创建时间 |  | SQL Server safe.sys.columns / extended_properties |  |

### 表：T_SAFE_BOPU_INVCOUNTRYCODE

| 序号 | 英文字段名 | 中文字段名 | 类型 | 长度 | 格式 | 是否必填 | 是否主键 | 字段说明 | 码值说明 | 证据来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ID | 待确认 | bigint | 19 | bigint | 是 | 是 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 2 | BOPU_ID | 待确认 | decimal | 19,0 | decimal(19,0) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 3 | INVALID | 待确认 | int | 10 | int | 是 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 4 | INVCOUNTRYCODE | 待确认 | string | 3 | nvarchar(3) | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |
| 5 | CREATEDTIME | 待确认 | datetime |  | datetime2 | 否 | 否 |  |  | SQL Server safe.sys.columns / extended_properties |  |

## 4. Mapping

本版按用户要求暂不整理 Mapping 逻辑。

## 5. 待确认项

| 对象类型 | 对象名 | 属性 | 问题 | 需要补充的证据 |
| --- | --- | --- | --- | --- |
| 表元 | T_SAFE_EXDAA_PROJECT | 中文名/表口径 | 数据库表注释为空 | 数据库说明书、监管发文或业务确认 |
| 表元 | T_SAFE_EXDAB_PROJECT | 中文名/表口径 | 数据库表注释为空 | 数据库说明书、监管发文或业务确认 |
| 表元 | T_SAFE_EXDAG_PROJECT | 中文名/表口径 | 数据库表注释为空 | 数据库说明书、监管发文或业务确认 |
| 表元 | T_SAFE_FAL_E01 | 中文名/表口径 | 数据库表注释为空 | 数据库说明书、监管发文或业务确认 |
| 表元 | T_SAFE_FAL_E03 | 中文名/表口径 | 数据库表注释为空 | 数据库说明书、监管发文或业务确认 |
| 表元 | T_SAFE_BOPU_INVCOUNTRYCODE | 中文名/表口径 | 数据库表注释为空 | 数据库说明书、监管发文或业务确认 |
| 字段元 | T_SAFE_EXDA_S.ACCOAMOUNTUSD | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_EXDAA_PROJECT.ID | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_EXDAA_PROJECT.EXDAAID | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_EXDAB_PROJECT.ID | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_EXDAB_PROJECT.EXDABID | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_EXDAG_PROJECT.ID | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_EXDAG_PROJECT.EXDAGID | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.ID | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.CHECKBY | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.CHECKTIME | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.CREATEDBY | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.CREATEDTIME | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.INVALID | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.LASTMODIFIEDBY | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.LASTMODIFIEDTIME | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.ACTIONDESC | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.ACTIONTYPE | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.BRANCHID | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.DATASOURCE | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.DATASTATUS | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.DEALNO | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.ISFEEDBACK | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.REFUSEREASON | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.RESETREASON | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.SAFEBRANCHCODE | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.SAFEBRANCHNAME | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.TNAME | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.BUOCMONTH | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.E0101 | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.E0102 | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.E0103 | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.E0104 | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.OBJCODE | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.REMARK | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.SNOCODE | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.BUSDATE | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.DECLAREUPDORDELTIME | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.BUSINESSCODE | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.E0101CUR | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.SAFEERRINFO | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.LOGFEEDBACKSTATUS | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.MANUALFLAG | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E01.OPERATEREMARK | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E0202.REMARK | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.ID | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.CHECKBY | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.CHECKTIME | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.CREATEDBY | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.CREATEDTIME | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.INVALID | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.LASTMODIFIEDBY | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.LASTMODIFIEDTIME | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.BRANCHID | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.SAFEBRANCHCODE | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.SAFEBRANCHNAME | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.ISFEEDBACK | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.REFUSEREASON | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.RESETREASON | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.DATASOURCE | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.DATASTATUS | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.DEALNO | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.ACTIONTYPE | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.ACTIONDESC | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.SNOCODE | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.OBJCODE | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.BUOCMONTH | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.E0301 | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.E0302 | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.E0303 | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.E0304 | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.E0305 | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.E0306 | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.E0307 | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.TNAME | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.REMARK | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.BUSDATE | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.DECLAREUPDORDELTIME | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.BUSINESSCODE | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.SAFEERRINFO | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.LOGFEEDBACKSTATUS | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.MANUALFLAG | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FAL_E03.OPERATEREMARK | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_FALB_01.B0120 | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_JSHD.CROSSGENERATEFLAG | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_JSHE.CROSSGENERATEFLAG | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_BOPC_P.SORT | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_BOPU.OLDID | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_BOPU_INVCOUNTRYCODE.ID | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_BOPU_INVCOUNTRYCODE.BOPU_ID | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_BOPU_INVCOUNTRYCODE.INVALID | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_BOPU_INVCOUNTRYCODE.INVCOUNTRYCODE | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
| 字段元 | T_SAFE_BOPU_INVCOUNTRYCODE.CREATEDTIME | 中文字段名/字段说明 | 数据库字段注释为空 | 数据库说明书、监管发文、代码或业务确认 |
