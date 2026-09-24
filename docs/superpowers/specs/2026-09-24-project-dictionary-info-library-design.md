# Project Dictionary Information Library Design

## Decision

The data-dictionary toolbar receives an information-library icon immediately to the left of the Codex icon. Clicking it replaces the entire dictionary work area to the right of the table tree with one editable, project-scoped rich-text document. It does not add a side panel, sub-tabs, automatic headings, or a new table-level editor.

## Storage and API

Persist one document per project as the item titled `数据字典信息库` in the existing `dictionary` project-management module, with the HTML in `content.html`. A dedicated dictionary-info service and `GET`/`PUT /:projectId/dictionary/info` endpoints isolate this document’s lookup/upsert behavior from table metadata APIs.

## AI Context

The existing project dictionary Codex context loads the saved document and adds its plain text to the initial instruction when it is nonempty. The Codex still uses `rich_dictionary_manage` to read live dictionary tables and fields; the information library supplies the project’s maintained Mapping background.

## UI

`DictionarySection` keeps the left tree and top catalog controls. In information-library mode, the right area renders `ProjectRichTextEditor` across the available workspace and provides a compact save action. Returning to the tables or business-scenarios catalog restores the normal detail workspace.

## Verification

Service tests cover empty reads, first save creation, and later saves updating the same item. Context tests cover appending the information library when populated. UI source tests cover icon placement, whole-workspace mode, and use of the shared rich text editor. Server typecheck and web production build complete the verification.
