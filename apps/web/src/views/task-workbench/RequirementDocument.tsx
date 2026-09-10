import { useMemo } from "react";
import { marked } from "marked";
import { requirementDocument, type WorkbenchTask } from "@ke/domain";

export function RequirementDocument({ task }: { task: Pick<WorkbenchTask, "title" | "requirement" | "acceptance" | "openQuestions" | "outputTarget" | "prd"> }) {
  const text = requirementDocument(task);
  const html = useMemo(() => {
    const document = new DOMParser().parseFromString(marked.parse(text, { async: false, gfm: true }) as string, "text/html");
    const allowed = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "P", "BR", "HR", "UL", "OL", "LI", "STRONG", "EM", "DEL", "BLOCKQUOTE", "PRE", "CODE", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "A"]);
    for (const element of Array.from(document.body.querySelectorAll("*"))) {
      if (!allowed.has(element.tagName)) { element.replaceWith(document.createTextNode(element.textContent ?? "")); continue; }
      const href = element.getAttribute("href");
      for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name);
      if (element.tagName === "A" && href && /^https?:\/\//i.test(href)) { element.setAttribute("href", href); element.setAttribute("target", "_blank"); element.setAttribute("rel", "noopener noreferrer"); }
    }
    return document.body.innerHTML;
  }, [text]);
  return <article className="tw-prd" dangerouslySetInnerHTML={{ __html: html }} />;
}
