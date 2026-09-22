import React, { type ReactNode } from "react";

export type SqlTokenKind = "plain" | "comment" | "string" | "identifier" | "keyword" | "number" | "punctuation";

export type SqlToken = { kind: SqlTokenKind; text: string };

const SQL_KEYWORDS = new Set([
  "ALL", "AND", "AS", "ASC", "BEGIN", "BY", "CASE", "CAST", "COALESCE", "CREATE", "CROSS", "DECLARE", "DELETE", "DESC", "DISTINCT", "DO", "DROP", "ELSE", "END", "EXCEPTION", "FALSE", "FETCH", "FOR", "FOREACH", "FROM", "FULL", "FUNCTION", "GROUP", "HAVING", "IF", "IN", "INNER", "INSERT", "INTO", "IS", "JOIN", "LANGUAGE", "LEFT", "LIKE", "LIMIT", "LOOP", "NOT", "NULL", "ON", "OR", "ORDER", "OUTER", "PROCEDURE", "RAISE", "REPLACE", "RETURN", "RETURNS", "RIGHT", "SELECT", "SET", "THEN", "TRUE", "UNION", "UPDATE", "USING", "VALUES", "WHEN", "WHERE", "WHILE", "WITH",
]);

const TOKEN_PATTERN = /\/\*[\s\S]*?\*\/|--[^\n]*|'(?:''|[^'])*'|"(?:""|[^"])*"|\b[A-Za-z_][A-Za-z0-9_$]*\b|\b\d+(?:\.\d+)?\b|[(),.;=<>+\-*/]/g;

function tokenKind(text: string): SqlTokenKind {
  if (text.startsWith("/*") || text.startsWith("--")) return "comment";
  if (text.startsWith("'")) return "string";
  if (text.startsWith('"')) return "identifier";
  if (/^\d/.test(text)) return "number";
  if (/^[(),.;=<>+\-*/]$/.test(text)) return "punctuation";
  return SQL_KEYWORDS.has(text.toUpperCase()) ? "keyword" : "plain";
}

export function tokenizeSql(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  let cursor = 0;

  for (const match of sql.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? cursor;
    if (index > cursor) tokens.push({ kind: "plain", text: sql.slice(cursor, index) });
    const text = match[0];
    tokens.push({ kind: tokenKind(text), text });
    cursor = index + text.length;
  }

  if (cursor < sql.length) tokens.push({ kind: "plain", text: sql.slice(cursor) });
  return tokens;
}

export function SqlSyntaxHighlight({ sql }: { sql: string }): ReactNode {
  return <>{tokenizeSql(sql).map((token, index) => (
    <span key={`${index}:${token.text}`} className={`dict-sql-token is-${token.kind}`}>{token.text}</span>
  ))}</>;
}
