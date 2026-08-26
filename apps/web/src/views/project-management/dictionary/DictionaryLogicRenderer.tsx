import { Fragment, type ReactNode } from "react";
import type {
  DictionaryCaliberExpression,
  DictionaryCaliberOrderExpression,
  DictionaryCaliberRule,
  DictionaryCaliberSelectLatest,
  DictionaryMappingJsonCondition,
  DictionaryMappingJsonRule,
  DictionaryMappingJsonRuleValue,
} from "@ke/domain";
import type { ProjectDictionaryFieldHit } from "../../../api/client.js";
import { DictionarySourceRefTag, DictionaryTableRefTag, type DictionaryTableRef } from "./DictionaryReferenceTags.js";
import {
  buildDictionaryLogicRefCandidates,
  dictionaryRuntimeParamName,
  findNextDictionaryLogicRefMatch,
  formatDictionaryCaliberTable,
  formatDictionaryJoinType,
  normalizeDictionaryJsonOp,
  normalizeDictionaryRefKey,
  parseDictionaryJsonRuleStrict,
  type DictionarySourceRef,
} from "./sqlRuleEngine.js";

type DictionaryMappingJsonValue = DictionaryMappingJsonRuleValue;
type DictionaryCaliberJsonRule = DictionaryCaliberRule;

export function renderDictionaryLogicWithRefs(
  text: string,
  refs: DictionarySourceRef[],
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void,
): ReactNode {
  if (!text) return "-";
  const parsed = parseDictionaryJsonRuleStrict(text);
  if (parsed.rule) return renderDictionaryJsonLogic(parsed.rule, refs, onOpenFieldRef);
  return <DictionaryInvalidLogicText text={text} reason={parsed.error || "逻辑必须填写标准 JSON"} />;
}

function DictionaryInvalidLogicText({ text, reason }: { text: string; reason: string }) {
  return (
    <code className="prj-pm-dict-logic-invalid" title={reason}>
      {text}
    </code>
  );
}

function renderDictionaryLooseTextWithRefs(
  text: string,
  refs: DictionarySourceRef[],
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void,
): ReactNode {
  if (!text || refs.length === 0) return text || "-";
  const candidates = buildDictionaryLogicRefCandidates(refs);
  if (candidates.length === 0) return text;

  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  while (cursor < text.length) {
    const match = findNextDictionaryLogicRefMatch(text, cursor, candidates);
    if (!match) {
      nodes.push(text.slice(cursor));
      break;
    }
    if (match.start > cursor) nodes.push(text.slice(cursor, match.start));
    nodes.push(
      <DictionarySourceRefTag
        key={`ref-${key}`}
        refItem={match.ref}
        onOpenFieldRef={onOpenFieldRef}>
        {match.text}
      </DictionarySourceRefTag>,
    );
    key += 1;
    cursor = match.end;
  }
  return nodes;
}

function renderDictionaryLooseTextWithRefsCn(
  text: string,
  refs: DictionarySourceRef[],
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void,
): ReactNode {
  if (!text || refs.length === 0) return text || "-";
  const candidates = buildDictionaryLogicRefCandidates(refs);
  if (candidates.length === 0) return text;

  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  while (cursor < text.length) {
    const match = findNextDictionaryLogicRefMatch(text, cursor, candidates);
    if (!match) {
      nodes.push(text.slice(cursor));
      break;
    }
    if (match.start > cursor) nodes.push(text.slice(cursor, match.start));
    nodes.push(
      <DictionarySourceRefTag
        key={`ref-cn-${key}`}
        refItem={match.ref}
        onOpenFieldRef={onOpenFieldRef}>
        {getDictionarySourceRefDisplayCn(match.ref)}
      </DictionarySourceRefTag>,
    );
    key += 1;
    cursor = match.end;
  }
  return nodes;
}

function renderDictionaryJsonLogic(
  rule: DictionaryMappingJsonRule,
  refs: DictionarySourceRef[],
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void,
): ReactNode {
  if (rule.op === "none" || rule.op === "未赋值" || rule.op === "-") return "-";
  const action = dictionaryJsonOpLabel(rule.op);
  const nodes: ReactNode[] = [
    <span key="action" className="prj-pm-dict-logic-action" data-op-tone={dictionaryLogicActionTone(rule.op)}>{action}</span>,
  ];
  const renderSource = (source: string, key: string) => nodes.push(renderDictionarySourceToken(source, refs, onOpenFieldRef, key));
  if (rule.op === "direct" && rule.source) {
    nodes.push(" ");
    renderSource(rule.source, "source");
  } else if (rule.op === "random") {
    nodes.push(` ${[rule.type, rule.length ? `${rule.length}位` : ""].filter(Boolean).join(" / ") || "数字ID"}`);
  } else if (rule.op === "null" || rule.op === "empty") {
    nodes.push(" 空");
  } else if (rule.op === "literal" || rule.op === "default" || rule.op === "const") {
    nodes.push(" ");
    nodes.push(renderDictionaryJsonValue({ value: rule.value }, refs, onOpenFieldRef, "literal-value"));
  } else if (rule.op === "db_generated" || rule.op === "databasegenerated") {
    nodes.push(" 主键");
  } else if (rule.op === "cast" && rule.source) {
    nodes.push(" ");
    renderSource(rule.source, "source");
    if (rule.to) nodes.push(` AS ${rule.to}`);
  } else if (rule.op === "abs_cast" && rule.source) {
    nodes.push(" ");
    renderSource(rule.source, "source");
    if (rule.to) nodes.push(` 取绝对值后转 ${rule.to}`);
  } else if (rule.op === "coalesce_cast" && rule.source) {
    nodes.push(" ");
    renderSource(rule.source, "source");
    nodes.push(` 空值按 ${rule.emptyAs ?? "0"} 后转 ${rule.to || "-"}`);
  } else if (rule.op === "coalesce" && rule.source) {
    nodes.push(" ");
    renderSource(rule.source, "source");
    nodes.push(" 为空则 ");
    nodes.push(renderDictionaryJsonDisplayValue(rule.default, refs, onOpenFieldRef, "coalesce-default"));
  } else if (rule.op === "date_parse" && rule.source) {
    nodes.push(" ");
    renderSource(rule.source, "source");
    if (rule.from) nodes.push(` ${rule.from}`);
  } else if (rule.op === "param") {
    nodes.push(` ${rule.name || "-"}`);
  } else if (rule.op === "runtime_context") {
    nodes.push(` ${rule.name || "依赖运行时上下文"}`);
  } else if ((rule.op === "required_lookup" || rule.op === "lookup_or_error") && rule.source && rule.lookup) {
    nodes.push(" ");
    renderSource(rule.source, "source");
    nodes.push(" 匹配码表 ");
    renderSource(rule.lookup, "lookup");
    nodes.push("，未命中则报错");
  } else if (rule.op === "substring_marker" && rule.source) {
    nodes.push(" ");
    nodes.push("从 ");
    renderSource(rule.source, "source");
    nodes.push(" 中 ");
    if (rule.marker) {
      nodes.push(<span key="marker-literal" className="prj-pm-dict-logic-literal">{rule.marker}</span>);
    } else {
      nodes.push("标记");
    }
    nodes.push(` 第一次出现位置开始截取 ${rule.length || "-"} 位${rule.stripQuotes ? "，并去双引号" : ""}`);
  } else if ((rule.op === "split_part" || rule.op === "分隔取段") && rule.source) {
    nodes.push(" ");
    renderSource(rule.source, "source");
    nodes.push(` / 分隔符 ${rule.delimiter ?? ""} / 第 ${rule.index ?? ""} 段`);
  } else if (["round", "四舍五入", "divide", "除法", "multiply", "乘法", "add", "加法", "subtract", "减法", "nullif", "空值保护"].includes(rule.op)) {
    nodes.push(" ");
    nodes.push(renderDictionaryJsonValue(rule, refs, onOpenFieldRef, "expr"));
  } else if ((rule.op === "code_mapping" || rule.op === "码值映射") && rule.source) {
    nodes.push(" ");
    renderSource(rule.source, "source");
    const entries = Object.entries(rule.map ?? {});
    if (entries.length) {
      nodes.push(`：${entries.map(([from, to]) => `${from}->${String(to)}`).join("，")}`);
    }
    if (rule.else !== undefined) {
      nodes.push("；否则 ");
      nodes.push(renderDictionaryJsonValue(rule.else, refs, onOpenFieldRef, "code-mapping-else"));
    }
  } else if ((rule.op === "sql" || rule.op === "expr") && (rule.sql || rule.expr)) {
    nodes.push(" ");
    nodes.push(renderDictionaryLooseTextWithRefs(rule.sql || rule.expr || "", refs, onOpenFieldRef));
  } else if (rule.op === "case") {
    nodes.push(" ");
    (rule.when ?? []).forEach((branch, index) => {
      if (index > 0) nodes.push("；");
      nodes.push(`若 `);
      nodes.push(renderDictionaryJsonCondition(branch.if, refs, onOpenFieldRef, `case-if-${index}`));
      nodes.push(" 则 ");
      nodes.push(renderDictionaryJsonValue(branch.then, refs, onOpenFieldRef, `case-then-${index}`));
    });
    if (rule.else !== undefined) {
      nodes.push("；否则 ");
      nodes.push(renderDictionaryJsonValue(rule.else, refs, onOpenFieldRef, "case-else"));
    }
  } else {
    nodes.push(` ${JSON.stringify(rule)}`);
  }
  return nodes;
}

export function renderDictionaryCaliberLogic(
  rule: DictionaryCaliberJsonRule,
  refs: DictionarySourceRef[],
  tableRefs: DictionaryTableRef[],
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void,
  onOpenTableRef: (tableId: string) => void,
): ReactNode {
  const rows: Array<{ key: string; keyword: string; body: ReactNode; comment?: string }> = [];
  const usedAliases = new Set<string>();
  const from = formatDictionaryCaliberTable(rule.from, undefined, usedAliases);
  if (from) {
    rows.push({
      key: "from",
      keyword: "FROM",
      body: (
        <>
          {rule.op === "full_extract" || rule.op === "全表抽取" ? <b>全表抽取</b> : <b>从</b>}{" "}
          {renderDictionaryTableTokenCn(from, tableRefs, onOpenTableRef, "caliber-from")} 抽取
        </>
      ),
    });
  }
  (rule.joins ?? []).forEach((join, index) => {
    const table = formatDictionaryCaliberTable(join.table, undefined, usedAliases);
    rows.push({
      key: `join-${index}`,
      keyword: `${formatDictionaryJoinType(join.type)} JOIN`,
      body: (
        <>
          {table ? renderDictionaryTableTokenCn(table, tableRefs, onOpenTableRef, `caliber-join-table-${index}`) : "-"}
          {join.select_latest ? <> <b>按分组取最新一条</b></> : null}
        </>
      ),
    });
    rows.push({
      key: `join-${index}-on`,
      keyword: "ON",
      body: renderDictionaryJsonConditionCn(join.on, refs, onOpenFieldRef, `caliber-join-${index}`),
      comment: getDictionaryConditionComment(join.on),
    });
    if (join.select_latest) {
      rows.push({
        key: `join-${index}-latest`,
        keyword: "限流",
        body: renderDictionaryCaliberSelectLatestNodes(join.select_latest, refs, onOpenFieldRef, `caliber-join-${index}-latest`),
        comment: "这是限流关联，不是一对多普通关联。",
      });
    }
  });
  if (rule.where) {
    rows.push(...renderDictionaryCaliberConditionRows("WHERE", rule.where, refs, onOpenFieldRef, "caliber-where"));
  }
  if (rule.group_by?.length) {
    rows.push({
      key: "group-by",
      keyword: "GROUP BY",
      body: renderDictionaryCaliberExpressionNodesCn(rule.group_by, refs, onOpenFieldRef, "caliber-group"),
    });
  }
  if (rule.order_by?.length) {
    rows.push({
      key: "order-by",
      keyword: "ORDER BY",
      body: renderDictionaryCaliberOrderNodesCn(rule.order_by, refs, onOpenFieldRef),
    });
  }
  if (rule.limit) {
    rows.push({ key: "limit", keyword: "LIMIT", body: rule.limit });
  }
  if (rows.length === 0) return <code className="prj-pm-dict-logic-invalid">{JSON.stringify(rule)}</code>;
  return (
    <div className="prj-pm-dict-caliber-lines">
      {rows.map(row => (
        <div key={row.key} className="prj-pm-dict-caliber-line">
          <b className="prj-pm-dict-caliber-line__keyword">{row.keyword}</b>
          <span className="prj-pm-dict-caliber-line__body">
            {row.body}
            {row.comment ? <em className="prj-pm-dict-caliber-line__comment">-- {row.comment}</em> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

function renderDictionaryCaliberSelectLatestNodes(
  rule: DictionaryCaliberSelectLatest,
  refs: DictionarySourceRef[],
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void,
  keyPrefix: string,
): ReactNode {
  return (
    <>
      <b>按分组取最新一条</b>
      {rule.partition_by?.length ? (
        <>
          {"，分组："}
          {renderDictionaryCaliberExpressionNodesCn(rule.partition_by, refs, onOpenFieldRef, `${keyPrefix}-partition`)}
        </>
      ) : null}
      {rule.order_by?.length ? (
        <>
          {"，排序："}
          {renderDictionaryCaliberOrderNodesCn(rule.order_by, refs, onOpenFieldRef)}
        </>
      ) : null}
      {"，取 "}
      {rule.limit && rule.limit > 0 ? rule.limit : 1}
      {" 条"}
    </>
  );
}

function renderDictionaryCaliberConditionRows(
  keyword: string,
  condition: DictionaryMappingJsonCondition,
  refs: DictionarySourceRef[],
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void,
  keyPrefix: string,
): Array<{ key: string; keyword: string; body: ReactNode; comment?: string }> {
  if (condition.and?.length) {
    return condition.and.map((item, index) => ({
      key: `${keyPrefix}-and-${index}`,
      keyword: index === 0 ? keyword : "AND",
      body: renderDictionaryJsonConditionCn(item, refs, onOpenFieldRef, `${keyPrefix}-and-${index}`),
      comment: getDictionaryConditionComment(item),
    }));
  }
  if (condition.or?.length) {
    return condition.or.map((item, index) => ({
      key: `${keyPrefix}-or-${index}`,
      keyword: index === 0 ? keyword : "OR",
      body: renderDictionaryJsonConditionCn(item, refs, onOpenFieldRef, `${keyPrefix}-or-${index}`),
      comment: getDictionaryConditionComment(item),
    }));
  }
  return [{
    key: keyPrefix,
    keyword,
    body: renderDictionaryJsonConditionCn(condition, refs, onOpenFieldRef, keyPrefix),
    comment: getDictionaryConditionComment(condition),
  }];
}

function getDictionaryConditionComment(condition?: DictionaryMappingJsonCondition): string {
  return (condition?.comment || condition?.remark || condition?.description || "").trim();
}

function renderDictionaryCaliberExpressionNodes(
  values: DictionaryCaliberExpression[],
  refs: DictionarySourceRef[],
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void,
  keyPrefix: string,
): ReactNode {
  return values.map((value, index) => (
    <Fragment key={`${keyPrefix}-${index}`}>
      {index > 0 ? "，" : ""}
      {typeof value === "string"
        ? renderDictionarySourceToken(value, refs, onOpenFieldRef, `${keyPrefix}-${index}-source`)
        : Array.isArray(value.source)
          ? value.source.map((source, sourceIndex) => (
            <Fragment key={`${keyPrefix}-${index}-source-${sourceIndex}`}>
              {sourceIndex > 0 ? "，" : ""}
              {renderDictionarySourceToken(source, refs, onOpenFieldRef, `${keyPrefix}-${index}-source-${sourceIndex}`)}
            </Fragment>
          ))
          : value.source
            ? renderDictionarySourceToken(value.source, refs, onOpenFieldRef, `${keyPrefix}-${index}-source`)
            : renderDictionaryLooseTextWithRefs(value.expr || value.sql || "", refs, onOpenFieldRef)}
    </Fragment>
  ));
}

function renderDictionaryCaliberExpressionNodesCn(
  values: DictionaryCaliberExpression[],
  refs: DictionarySourceRef[],
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void,
  keyPrefix: string,
): ReactNode {
  return values.map((value, index) => (
    <Fragment key={`${keyPrefix}-${index}`}>
      {index > 0 ? "，" : ""}
      {typeof value === "string"
        ? renderDictionarySourceTokenCn(value, refs, onOpenFieldRef, `${keyPrefix}-${index}-source`)
        : Array.isArray(value.source)
          ? value.source.map((source, sourceIndex) => (
            <Fragment key={`${keyPrefix}-${index}-source-${sourceIndex}`}>
              {sourceIndex > 0 ? "，" : ""}
              {renderDictionarySourceTokenCn(source, refs, onOpenFieldRef, `${keyPrefix}-${index}-source-${sourceIndex}`)}
            </Fragment>
          ))
          : value.source
            ? renderDictionarySourceTokenCn(value.source, refs, onOpenFieldRef, `${keyPrefix}-${index}-source`)
            : renderDictionaryLooseTextWithRefsCn(value.expr || value.sql || "", refs, onOpenFieldRef)}
    </Fragment>
  ));
}

function renderDictionaryCaliberOrderNodes(
  values: DictionaryCaliberOrderExpression[],
  refs: DictionarySourceRef[],
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void,
): ReactNode {
  return values.map((value, index) => (
    <Fragment key={`caliber-order-${index}`}>
      {index > 0 ? "，" : ""}
      {renderDictionaryCaliberExpressionNodes([value], refs, onOpenFieldRef, `caliber-order-${index}`)}
      {typeof value === "object" && value.direction ? ` ${value.direction.toUpperCase()}` : ""}
    </Fragment>
  ));
}

function renderDictionaryCaliberOrderNodesCn(
  values: DictionaryCaliberOrderExpression[],
  refs: DictionarySourceRef[],
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void,
): ReactNode {
  return values.map((value, index) => (
    <Fragment key={`caliber-order-${index}`}>
      {index > 0 ? "，" : ""}
      {renderDictionaryCaliberExpressionNodesCn([value], refs, onOpenFieldRef, `caliber-order-${index}`)}
      {typeof value === "object" && value.direction ? ` ${value.direction.toUpperCase()}` : ""}
    </Fragment>
  ));
}

function renderDictionaryJsonCondition(
  condition: DictionaryMappingJsonCondition | undefined,
  refs: DictionarySourceRef[],
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void,
  keyPrefix: string,
): ReactNode {
  if (!condition) return "-";
  if (condition.and?.length) {
    return condition.and.map((item, index) => (
      <Fragment key={`${keyPrefix}-and-${index}`}>
        {index > 0 ? " 且 " : ""}
        {renderDictionaryJsonCondition(item, refs, onOpenFieldRef, `${keyPrefix}-and-${index}`)}
      </Fragment>
    ));
  }
  if (condition.or?.length) {
    return condition.or.map((item, index) => (
      <Fragment key={`${keyPrefix}-or-${index}`}>
        {index > 0 ? " 或 " : ""}
        {renderDictionaryJsonCondition(item, refs, onOpenFieldRef, `${keyPrefix}-or-${index}`)}
      </Fragment>
    ));
  }
  if (condition.not) return <>非 {renderDictionaryJsonCondition(condition.not, refs, onOpenFieldRef, `${keyPrefix}-not`)}</>;
  const left = condition.left ?? (condition.source ? { source: condition.source } : undefined);
  if (condition.eq === null || condition.ne === null) {
    return (
      <>
        {renderDictionaryJsonValue(left, refs, onOpenFieldRef, `${keyPrefix}-left`)}
        {condition.eq === null ? " 为空" : " 不为空"}
      </>
    );
  }
  const operator = condition.eq !== undefined ? "="
    : condition.ne !== undefined ? "<>"
      : condition.gt !== undefined ? ">"
        : condition.gte !== undefined ? ">="
          : condition.lt !== undefined ? "<"
            : condition.lte !== undefined ? "<="
              : condition.like !== undefined ? "LIKE"
                : condition.in !== undefined ? "在"
                  : condition.not_in !== undefined ? "不在"
                : "";
  const right = condition.eq !== undefined ? condition.eq
    : condition.ne !== undefined ? condition.ne
      : condition.gt !== undefined ? condition.gt
        : condition.gte !== undefined ? condition.gte
          : condition.lt !== undefined ? condition.lt
            : condition.lte !== undefined ? condition.lte
              : condition.like;
  const listRight = condition.in ?? condition.not_in;
  return (
    <>
      {renderDictionaryJsonValue(left, refs, onOpenFieldRef, `${keyPrefix}-left`)}
      {operator ? ` ${operator} ` : ""}
      {listRight
        ? (
          <>
            [
            {listRight.map((value, index) => (
              <Fragment key={`${keyPrefix}-list-${index}`}>
                {index > 0 ? "，" : ""}
                {renderDictionaryJsonValue(value, refs, onOpenFieldRef, `${keyPrefix}-list-${index}`)}
              </Fragment>
            ))}
            ]
          </>
        )
        : operator ? renderDictionaryJsonValue(right, refs, onOpenFieldRef, `${keyPrefix}-right`) : null}
    </>
  );
}

function renderDictionaryJsonConditionCn(
  condition: DictionaryMappingJsonCondition | undefined,
  refs: DictionarySourceRef[],
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void,
  keyPrefix: string,
): ReactNode {
  if (!condition) return "-";
  if (condition.and?.length) {
    return condition.and.map((item, index) => (
      <Fragment key={`${keyPrefix}-and-${index}`}>
        {index > 0 ? " 且 " : ""}
        {renderDictionaryJsonConditionCn(item, refs, onOpenFieldRef, `${keyPrefix}-and-${index}`)}
      </Fragment>
    ));
  }
  if (condition.or?.length) {
    return condition.or.map((item, index) => (
      <Fragment key={`${keyPrefix}-or-${index}`}>
        {index > 0 ? " 或 " : ""}
        {renderDictionaryJsonConditionCn(item, refs, onOpenFieldRef, `${keyPrefix}-or-${index}`)}
      </Fragment>
    ));
  }
  if (condition.not) return <>非 {renderDictionaryJsonConditionCn(condition.not, refs, onOpenFieldRef, `${keyPrefix}-not`)}</>;
  const left = condition.left ?? (condition.source ? { source: condition.source } : undefined);
  if (condition.eq === null || condition.ne === null) {
    return (
      <>
        {renderDictionaryJsonValueCn(left, refs, onOpenFieldRef, `${keyPrefix}-left`)}
        {condition.eq === null ? " 为空" : " 不为空"}
      </>
    );
  }
  const operator = condition.eq !== undefined ? "="
    : condition.ne !== undefined ? "<>"
      : condition.gt !== undefined ? ">"
        : condition.gte !== undefined ? ">="
          : condition.lt !== undefined ? "<"
            : condition.lte !== undefined ? "<="
              : condition.like !== undefined ? "LIKE"
                : condition.in !== undefined ? "在"
                  : condition.not_in !== undefined ? "不在"
                : "";
  const right = condition.eq !== undefined ? condition.eq
    : condition.ne !== undefined ? condition.ne
      : condition.gt !== undefined ? condition.gt
        : condition.gte !== undefined ? condition.gte
          : condition.lt !== undefined ? condition.lt
            : condition.lte !== undefined ? condition.lte
              : condition.like;
  const listRight = condition.in ?? condition.not_in;
  return (
    <>
      {renderDictionaryJsonValueCn(left, refs, onOpenFieldRef, `${keyPrefix}-left`)}
      {operator ? ` ${operator} ` : ""}
      {listRight
        ? (
          <>
            [
            {listRight.map((value, index) => (
              <Fragment key={`${keyPrefix}-list-${index}`}>
                {index > 0 ? "，" : ""}
                {renderDictionaryJsonValueCn(value, refs, onOpenFieldRef, `${keyPrefix}-list-${index}`)}
              </Fragment>
            ))}
            ]
          </>
        )
        : operator ? renderDictionaryJsonValueCn(right, refs, onOpenFieldRef, `${keyPrefix}-right`) : null}
    </>
  );
}

function renderDictionaryJsonValue(
  value: DictionaryMappingJsonValue | undefined,
  refs: DictionarySourceRef[],
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void,
  keyPrefix: string,
): ReactNode {
  if (value === undefined) return "";
  if (value === null) return "空";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return value;
  if ("op" in value && typeof value.op === "string") {
    const op = value.op;
    if ((op === "direct" || op === "直取") && value.source) {
      return renderDictionarySourceToken(value.source, refs, onOpenFieldRef, `${keyPrefix}-direct-source`);
    }
    if (op === "param") {
      return <span className="prj-pm-dict-ref-chip">入参 {value.name || "-"}</span>;
    }
    if ((op === "split_part" || op === "分隔取段") && value.source) {
      return <>{renderDictionarySourceToken(value.source, refs, onOpenFieldRef, `${keyPrefix}-split-source`)} 按 {value.delimiter} 取第 {value.index} 段</>;
    }
    if ((op === "substring_marker" || op === "标记截取") && value.source) {
      return (
        <>
          从 {renderDictionarySourceToken(value.source, refs, onOpenFieldRef, `${keyPrefix}-marker-source`)}
          {" 中 "}
          {value.marker ? <span className="prj-pm-dict-logic-literal">{value.marker}</span> : "标记"}
          {" 第一次出现位置开始截取 "}
          {value.length ?? "-"} 位
        </>
      );
    }
    if (op === "cast" && value.to) {
      return <>CAST({renderDictionaryJsonValue(value.value as DictionaryMappingJsonValue | undefined ?? (value.source ? { source: value.source } : undefined), refs, onOpenFieldRef, `${keyPrefix}-cast-value`)} AS {value.to})</>;
    }
    if (op === "abs_cast" || op === "绝对值转换") {
      return <>ABS({renderDictionaryJsonValue(value.value as DictionaryMappingJsonValue | undefined ?? (value.source ? { source: value.source } : undefined), refs, onOpenFieldRef, `${keyPrefix}-abs-value`)}{value.to ? ` 转 ${value.to}` : ""})</>;
    }
    if (op === "coalesce_cast" || op === "空值转换") {
      return <>{renderDictionaryJsonValue(value.source ? { source: value.source } : value.value as DictionaryMappingJsonValue | undefined, refs, onOpenFieldRef, `${keyPrefix}-coalesce-value`)} 空值按 {value.emptyAs ?? "0"} 后转 {value.to || "-"}</>;
    }
    if (op === "coalesce" || op === "空值兜底") {
      return <>{value.source ? renderDictionarySourceToken(value.source, refs, onOpenFieldRef, `${keyPrefix}-coalesce-source`) : "值"} 为空则 {renderDictionaryJsonDisplayValue(value.default, refs, onOpenFieldRef, `${keyPrefix}-coalesce-default`)}</>;
    }
    if (op === "round") {
      return <>ROUND({renderDictionaryJsonValue(value.value as DictionaryMappingJsonValue | undefined, refs, onOpenFieldRef, `${keyPrefix}-round-value`)}, {value.scale ?? 0})</>;
    }
    if (op === "divide" || op === "除法" || op === "multiply" || op === "乘法" || op === "subtract" || op === "减法") {
      const operator = op === "divide" || op === "除法" ? "/" : op === "multiply" || op === "乘法" ? "*" : "-";
      return <>{renderDictionaryJsonValue(value.left, refs, onOpenFieldRef, `${keyPrefix}-left`)} {operator} {renderDictionaryJsonValue(value.right, refs, onOpenFieldRef, `${keyPrefix}-right`)}</>;
    }
    if (op === "add" || op === "加法") {
      const pieces = value.sources?.length ? value.sources.map((source, index) => (
        <Fragment key={`${keyPrefix}-source-${index}`}>
          {index > 0 ? " + " : ""}
          {renderDictionarySourceToken(source, refs, onOpenFieldRef, `${keyPrefix}-source-${index}`)}
        </Fragment>
      )) : [
        renderDictionaryJsonValue(value.left, refs, onOpenFieldRef, `${keyPrefix}-left`),
        " + ",
        renderDictionaryJsonValue(value.right, refs, onOpenFieldRef, `${keyPrefix}-right`),
      ];
      return <>{pieces}</>;
    }
    if (op === "nullif") {
      return <>NULLIF({renderDictionaryJsonValue(value.value as DictionaryMappingJsonValue | undefined, refs, onOpenFieldRef, `${keyPrefix}-nullif-value`)}, {renderDictionaryJsonValue(value.compare ?? 0, refs, onOpenFieldRef, `${keyPrefix}-nullif-compare`)})</>;
    }
    return `${dictionaryJsonOpLabel(value.op)} ${JSON.stringify(value)}`;
  }
  if ("source" in value && value.source) return renderDictionarySourceToken(value.source, refs, onOpenFieldRef, `${keyPrefix}-source`);
  if ("expr" in value && value.expr) return renderDictionaryLooseTextWithRefs(value.expr, refs, onOpenFieldRef);
  if ("sql" in value && value.sql) return renderDictionaryLooseTextWithRefs(value.sql, refs, onOpenFieldRef);
  return value.value === null ? "空" : String(value.value ?? "");
}

function renderDictionaryJsonDisplayValue(
  value: DictionaryMappingJsonValue | undefined,
  refs: DictionarySourceRef[],
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void,
  keyPrefix: string,
): ReactNode {
  if (value === "") return <span className="prj-pm-dict-logic-literal">""</span>;
  return renderDictionaryJsonValue(value, refs, onOpenFieldRef, keyPrefix);
}

function renderDictionaryJsonDisplayValueCn(
  value: DictionaryMappingJsonValue | undefined,
  refs: DictionarySourceRef[],
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void,
  keyPrefix: string,
): ReactNode {
  if (value === "") return <span className="prj-pm-dict-logic-literal">""</span>;
  return renderDictionaryJsonValueCn(value, refs, onOpenFieldRef, keyPrefix);
}

function renderDictionaryJsonValueCn(
  value: DictionaryMappingJsonValue | undefined,
  refs: DictionarySourceRef[],
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void,
  keyPrefix: string,
): ReactNode {
  if (value === undefined) return "";
  if (value === null) return "空";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return value;
  if ("op" in value && typeof value.op === "string") {
    const op = value.op;
    if ((op === "direct" || op === "直取") && value.source) {
      return renderDictionarySourceTokenCn(value.source, refs, onOpenFieldRef, `${keyPrefix}-direct-source`);
    }
    if (op === "param") {
      return <span className="prj-pm-dict-ref-chip">入参 {value.name || "-"}</span>;
    }
    if ((op === "split_part" || op === "分隔取段") && value.source) {
      return <>{renderDictionarySourceTokenCn(value.source, refs, onOpenFieldRef, `${keyPrefix}-split-source`)} 按 {value.delimiter} 取第 {value.index} 段</>;
    }
    if ((op === "substring_marker" || op === "标记截取") && value.source) {
      return (
        <>
          从 {renderDictionarySourceTokenCn(value.source, refs, onOpenFieldRef, `${keyPrefix}-marker-source`)}
          {" 中 "}
          {value.marker ? <span className="prj-pm-dict-logic-literal">{value.marker}</span> : "标记"}
          {" 第一次出现位置开始截取 "}
          {value.length ?? "-"} 位
        </>
      );
    }
    if (op === "cast" && value.to) {
      return <>CAST({renderDictionaryJsonValueCn(value.value as DictionaryMappingJsonValue | undefined ?? (value.source ? { source: value.source } : undefined), refs, onOpenFieldRef, `${keyPrefix}-cast-value`)} AS {value.to})</>;
    }
    if (op === "abs_cast" || op === "绝对值转换") {
      return <>ABS({renderDictionaryJsonValueCn(value.value as DictionaryMappingJsonValue | undefined ?? (value.source ? { source: value.source } : undefined), refs, onOpenFieldRef, `${keyPrefix}-abs-value`)}{value.to ? ` 转 ${value.to}` : ""})</>;
    }
    if (op === "coalesce_cast" || op === "空值转换") {
      return <>{renderDictionaryJsonValueCn(value.source ? { source: value.source } : value.value as DictionaryMappingJsonValue | undefined, refs, onOpenFieldRef, `${keyPrefix}-coalesce-value`)} 空值按 {value.emptyAs ?? "0"} 后转 {value.to || "-"}</>;
    }
    if (op === "coalesce" || op === "空值兜底") {
      return <>{value.source ? renderDictionarySourceTokenCn(value.source, refs, onOpenFieldRef, `${keyPrefix}-coalesce-source`) : "值"} 为空则 {renderDictionaryJsonDisplayValueCn(value.default, refs, onOpenFieldRef, `${keyPrefix}-coalesce-default`)}</>;
    }
    if (op === "round") {
      return <>ROUND({renderDictionaryJsonValueCn(value.value as DictionaryMappingJsonValue | undefined, refs, onOpenFieldRef, `${keyPrefix}-round-value`)}, {value.scale ?? 0})</>;
    }
    if (op === "divide" || op === "除法" || op === "multiply" || op === "乘法" || op === "subtract" || op === "减法") {
      const operator = op === "divide" || op === "除法" ? "/" : op === "multiply" || op === "乘法" ? "*" : "-";
      return <>{renderDictionaryJsonValueCn(value.left, refs, onOpenFieldRef, `${keyPrefix}-left`)} {operator} {renderDictionaryJsonValueCn(value.right, refs, onOpenFieldRef, `${keyPrefix}-right`)}</>;
    }
    if (op === "add" || op === "加法") {
      const pieces = value.sources?.length ? value.sources.map((source, index) => (
        <Fragment key={`${keyPrefix}-source-${index}`}>
          {index > 0 ? " + " : ""}
          {renderDictionarySourceTokenCn(source, refs, onOpenFieldRef, `${keyPrefix}-source-${index}`)}
        </Fragment>
      )) : [
        renderDictionaryJsonValueCn(value.left, refs, onOpenFieldRef, `${keyPrefix}-left`),
        " + ",
        renderDictionaryJsonValueCn(value.right, refs, onOpenFieldRef, `${keyPrefix}-right`),
      ];
      return <>{pieces}</>;
    }
    if (op === "nullif") {
      return <>NULLIF({renderDictionaryJsonValueCn(value.value as DictionaryMappingJsonValue | undefined, refs, onOpenFieldRef, `${keyPrefix}-nullif-value`)}, {renderDictionaryJsonValueCn(value.compare ?? 0, refs, onOpenFieldRef, `${keyPrefix}-nullif-compare`)})</>;
    }
    return `${dictionaryJsonOpLabel(value.op)} ${JSON.stringify(value)}`;
  }
  if ("source" in value && value.source) return renderDictionarySourceTokenCn(value.source, refs, onOpenFieldRef, `${keyPrefix}-source`);
  if ("expr" in value && value.expr) return renderDictionaryLooseTextWithRefsCn(value.expr, refs, onOpenFieldRef);
  if ("sql" in value && value.sql) return renderDictionaryLooseTextWithRefsCn(value.sql, refs, onOpenFieldRef);
  return value.value === null ? "空" : String(value.value ?? "");
}

function dictionaryJsonOpLabel(op: string): string {
  const labels: Record<string, string> = {
    direct: "直取",
    none: "-",
    random: "随机生成",
    null: "置空",
    empty: "置空",
    db_generated: "数据库生成",
    databasegenerated: "数据库生成",
    literal: "常量",
    default: "默认值",
    const: "常量",
    sql: "SQL",
    expr: "计算",
    cast: "类型转换",
    abs_cast: "绝对值转换",
    coalesce_cast: "空值转换",
    coalesce: "空值兜底",
    date_parse: "日期解析",
    param: "参数",
    required_lookup: "必填码表匹配",
    lookup_or_error: "必填码表匹配",
    substring_marker: "标记截取",
    runtime_context: "运行时上下文",
    split_part: "分隔取段",
    concat: "拼接",
    code_mapping: "码值映射",
    case: "判断",
    round: "四舍五入",
    divide: "除法",
    multiply: "乘法",
    add: "加法",
    subtract: "减法",
    nullif: "空值保护",
  };
  return labels[op] || op;
}

function dictionaryLogicActionTone(op: string): string {
  const normalized = normalizeDictionaryJsonOp(op);
  if (["direct", "直取", "直接取数", "源字段直取", "按涉及字段直取", "按源字段直取", "字段直取"].includes(normalized)) return "direct";
  if (["case", "判断", "condition", "条件"].includes(normalized)) return "condition";
  if (["sql", "expr", "计算"].includes(normalized)) return "sql";
  if (["code_mapping", "码值映射", "codemapping"].includes(normalized)) return "code";
  if (["required_lookup", "lookup_or_error"].includes(normalized)) return "code";
  if (["cast", "abs_cast", "coalesce_cast", "coalesce", "date_parse", "substring_marker", "split_part", "类型转换", "绝对值转换", "空值转换", "空值兜底", "日期解析", "标记截取", "分隔取段"].includes(normalized)) return "transform";
  if (["round", "divide", "multiply", "add", "subtract", "nullif", "四舍五入", "除法", "乘法", "加法", "减法", "空值保护"].includes(normalized)) return "math";
  if (["literal", "default", "const", "默认值", "常量"].includes(normalized)) return "literal";
  if (["null", "empty", "置空"].includes(normalized)) return "empty";
  if (["random", "随机生成"].includes(normalized)) return "random";
  if (["db_generated", "databasegenerated", "runtime_context", "数据库生成", "运行时上下文", "param", "参数"].includes(normalized)) return "system";
  return "other";
}

function renderDictionarySourceToken(
  label: string,
  refs: DictionarySourceRef[],
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void,
  key: string,
): ReactNode {
  const paramName = dictionaryRuntimeParamName(label);
  if (paramName) return <span key={key} className="prj-pm-dict-ref-chip">入参 {paramName}</span>;
  const candidates = buildDictionaryLogicRefCandidates(refs);
  const ref = candidates.find(candidate => normalizeDictionaryRefKey(candidate.token) === normalizeDictionaryRefKey(label))?.ref;
  return ref ? (
    <DictionarySourceRefTag key={key} refItem={ref} onOpenFieldRef={onOpenFieldRef}>
      {label}
    </DictionarySourceRefTag>
  ) : (
    <span key={key} className="prj-pm-dict-ref-chip">{label}</span>
  );
}

function renderDictionarySourceTokenCn(
  label: string,
  refs: DictionarySourceRef[],
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void,
  key: string,
): ReactNode {
  const paramName = dictionaryRuntimeParamName(label);
  if (paramName) return <span key={key} className="prj-pm-dict-ref-chip">入参 {paramName}</span>;
  const candidates = buildDictionaryLogicRefCandidates(refs);
  const ref = candidates.find(candidate => normalizeDictionaryRefKey(candidate.token) === normalizeDictionaryRefKey(label))?.ref;
  const text = ref ? getDictionarySourceRefDisplayCn(ref) : label;
  return ref ? (
    <DictionarySourceRefTag key={key} refItem={ref} onOpenFieldRef={onOpenFieldRef}>
      {text}
    </DictionarySourceRefTag>
  ) : (
    <span key={key} className="prj-pm-dict-ref-chip">{text}</span>
  );
}

function renderDictionaryTableToken(
  label: string,
  refs: DictionaryTableRef[],
  onOpenTableRef: (tableId: string) => void,
  key: string,
): ReactNode {
  const ref = findDictionaryTableRefByLabel(label, refs);
  return ref ? (
    <DictionaryTableRefTag key={key} refItem={ref} onOpenTableRef={onOpenTableRef}>
      {label}
    </DictionaryTableRefTag>
  ) : (
    <span key={key} className="prj-pm-dict-ref-chip">{label}</span>
  );
}

function renderDictionaryTableTokenCn(
  label: string,
  refs: DictionaryTableRef[],
  onOpenTableRef: (tableId: string) => void,
  key: string,
): ReactNode {
  const ref = findDictionaryTableRefByLabel(label, refs);
  const text = ref ? getDictionaryTableRefDisplayCn(label, ref) : label;
  return ref ? (
    <DictionaryTableRefTag key={key} refItem={ref} onOpenTableRef={onOpenTableRef}>
      {text}
    </DictionaryTableRefTag>
  ) : (
    <span key={key} className="prj-pm-dict-ref-chip">{text}</span>
  );
}

function findDictionaryTableRefByLabel(label: string, refs: DictionaryTableRef[]): DictionaryTableRef | undefined {
  const normalized = normalizeDictionaryRefKey(label);
  const tableName = label.split(/\s+/)[0] || label;
  return refs.find(candidate => {
    const keys = [candidate.label, candidate.table?.tableName, candidate.table?.tableCn].filter(Boolean);
    return keys.some(candidateLabel => {
      const candidateKey = normalizeDictionaryRefKey(candidateLabel);
      return candidateKey === normalized || candidateKey === normalizeDictionaryRefKey(tableName);
    });
  });
}

function getDictionaryTableRefDisplayCn(label: string, ref: DictionaryTableRef): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  const alias = parts.length > 1 ? parts.slice(1).join(" ") : "";
  const tableName = ref.table?.tableCn || ref.table?.tableName || parts[0] || ref.label;
  return [tableName, alias].filter(Boolean).join(" ");
}

function getDictionarySourceRefDisplayCn(ref: DictionarySourceRef): string {
  if (!ref.field) return ref.label;
  const table = ref.field.tableCn || ref.field.tableName;
  const field = ref.field.fieldCn || ref.field.fieldName || ref.field.mappedField;
  return [table, field].filter(Boolean).join(".") || ref.label;
}

function renderDictionaryDslLogic(
  action: { keyword: string; body: string },
  refs: DictionarySourceRef[],
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void,
): ReactNode {
  const nodes: ReactNode[] = [
    <span key="action" className="prj-pm-dict-logic-action" data-op-tone={dictionaryLogicActionTone(action.keyword)}>【{action.keyword}】</span>,
  ];
  if (!action.body) return nodes;
  const candidates = buildDictionaryLogicRefCandidates(refs);
  const pattern = /\{([^}]+)\}/g;
  let cursor = 0;
  let index = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(action.body)) !== null) {
    if (match.index > cursor) nodes.push(action.body.slice(cursor, match.index));
    const label = match[1].trim();
    const ref = candidates.find(candidate => normalizeDictionaryRefKey(candidate.token) === normalizeDictionaryRefKey(label))?.ref;
    nodes.push(ref ? (
      <DictionarySourceRefTag key={`field-${index}`} refItem={ref} onOpenFieldRef={onOpenFieldRef}>
        {label}
      </DictionarySourceRefTag>
    ) : (
      <span key={`field-${index}`} className="prj-pm-dict-ref-chip">{label}</span>
    ));
    cursor = match.index + match[0].length;
    index += 1;
  }
  if (cursor < action.body.length) nodes.push(action.body.slice(cursor));
  return nodes;
}
