import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SqlSyntaxHighlight, tokenizeSql } from "./sqlSyntaxHighlight.js";

test("SQL 高亮保留原始文本，并区分关键字、字符串、注释、数字和标点", () => {
  const sql = "SELECT name, 42 FROM users -- active\nWHERE status = 'open';";
  const tokens = tokenizeSql(sql);

  assert.equal(tokens.map(token => token.text).join(""), sql);
  assert.deepEqual(tokens.filter(token => token.kind !== "plain").map(token => [token.kind, token.text]), [
    ["keyword", "SELECT"],
    ["punctuation", ","],
    ["number", "42"],
    ["keyword", "FROM"],
    ["comment", "-- active"],
    ["keyword", "WHERE"],
    ["punctuation", "="],
    ["string", "'open'"],
    ["punctuation", ";"],
  ]);

  const html = renderToStaticMarkup(<SqlSyntaxHighlight sql={sql} />);
  assert.match(html, /dict-sql-token is-keyword/);
  assert.match(html, /dict-sql-token is-comment/);
  assert.match(html, /dict-sql-token is-string/);
});
