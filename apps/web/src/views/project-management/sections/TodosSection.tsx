import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { Element } from "@ke/domain";
import { api, type ProjectManagementSummary, type ProjectModuleItem } from "../../../api/client.js";
import { normalizeTodoStatus, recordValue, textValue } from "../ProjectManagementModules.js";

type TodoStatus = "todo" | "doing" | "done";

export function TodosSection({ project, summary }: { project: Element; summary: ProjectManagementSummary | null }) {
  const [todos, setTodos] = useState<ProjectModuleItem[]>([]);
  const [draggedId, setDraggedId] = useState("");
  const [dropLane, setDropLane] = useState<TodoStatus | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = () => api.listProjectManagementModuleItems(project.id, "todos").then(next => {
    setTodos(next);
  });

  useEffect(() => {
    let cancelled = false;
    void reload()
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [project.id]);

  const count = summary?.modules.find(module => module.key === "todos")?.count ?? todos.length;
  const lanes = [
    { id: "todo", title: "待办", accent: "#7aa7ff" },
    { id: "doing", title: "进行中", accent: "#fbbf24" },
    { id: "done", title: "已完成", accent: "#4ade80" },
  ] as const;
  const createTodo = async (status: TodoStatus) => {
    setBusy(true);
    setError(null);
    try {
      const created = await api.createProjectManagementModuleItem(project.id, "todos", {
        title: "新待办",
        subtitle: status,
        sortOrder: todos.length,
        content: { original: { id: `todo-${Date.now()}`, title: "新待办", owner: "", priority: "普通", dueAt: "", description: "", status } },
      });
      setTodos(current => [...current, created]);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const deleteTodo = async (todo: ProjectModuleItem) => {
    if (!window.confirm(`删除代办「${todo.title}」？`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteProjectManagementModuleItem(project.id, todo.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const editTodoLocal = (todoId: string, patch: Record<string, unknown>) => {
    setTodos(current => current.map(todo => {
      if (todo.id !== todoId) return todo;
      const original = { ...recordValue(todo.content.original), ...patch };
      const title = textValue(original, "title") || todo.title;
      return {
        ...todo,
        title,
        subtitle: [textValue(original, "status"), textValue(original, "owner")].filter(Boolean).join(" · "),
        content: { ...todo.content, original },
      };
    }));
  };
  const persistTodo = async (todoId: string) => {
    const todo = todos.find(item => item.id === todoId);
    if (!todo) return;
    const original = recordValue(todo.content.original);
    const title = textValue(original, "title") || todo.title || "未命名待办";
    setError(null);
    try {
      await api.updateProjectManagementModuleItem(project.id, todo.id, {
        title,
        subtitle: [textValue(original, "status"), textValue(original, "owner")].filter(Boolean).join(" · "),
        content: { ...todo.content, original: { ...original, title } },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await reload();
    }
  };
  const moveTodoToLane = async (todoId: string, targetStatus: TodoStatus, beforeId = "") => {
    const moving = todos.find(todo => todo.id === todoId);
    if (!moving) return;
    const withoutMoving = todos.filter(todo => todo.id !== todoId);
    const movedOriginal = { ...recordValue(moving.content.original), status: targetStatus };
    const moved = {
      ...moving,
      subtitle: [targetStatus, textValue(movedOriginal, "owner")].filter(Boolean).join(" · "),
      content: { ...moving.content, original: movedOriginal },
    };
    const beforeIndex = beforeId ? withoutMoving.findIndex(todo => todo.id === beforeId) : -1;
    const next = [...withoutMoving];
    if (beforeIndex >= 0) {
      next.splice(beforeIndex, 0, moved);
    } else {
      let insertIndex = next.length;
      for (let index = next.length - 1; index >= 0; index -= 1) {
        if (normalizeTodoStatus(recordValue(next[index].content.original)) === targetStatus) {
          insertIndex = index + 1;
          break;
        }
      }
      next.splice(insertIndex, 0, moved);
    }
    setTodos(next);
    setDraggedId("");
    setDropLane("");
    try {
      await api.updateProjectManagementModuleItem(project.id, moved.id, {
        title: moved.title,
        subtitle: moved.subtitle,
        content: moved.content,
      });
      await api.reorderProjectManagementModuleItems(project.id, "todos", next.map(item => item.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await reload();
    }
  };

  return (
    <div className="kanban todo-board prj-pm-legacy-skin">
      {error && <div className="prj-pm-error">{error}</div>}
      <div className="todo-board-summary">
        <div>
          <p className="prj-pm-eyebrow">Project Tasks</p>
          <h2>项目代办</h2>
        </div>
        <div className="todo-board-summary__count">
          <strong>{count}</strong>
          <span>待办事项</span>
        </div>
      </div>
      {lanes.map(lane => {
        const laneTodos = todos.filter(todo => normalizeTodoStatus(recordValue(todo.content.original)) === lane.id);
        return (
          <section
            key={lane.id}
            className={`lane todo-lane${dropLane === lane.id ? " is-drop-target" : ""}`}
            style={{ "--todo-accent": lane.accent } as CSSProperties}
            onDragOver={event => {
              event.preventDefault();
              setDropLane(lane.id);
            }}
            onDragLeave={event => {
              if (event.currentTarget === event.target) setDropLane("");
            }}
            onDrop={event => {
              event.preventDefault();
              const todoId = event.dataTransfer.getData("text/plain") || draggedId;
              const beforeId = (event.target as HTMLElement).closest<HTMLElement>("[data-todo-card]")?.dataset.todoCard || "";
              if (todoId && beforeId !== todoId) void moveTodoToLane(todoId, lane.id, beforeId);
            }}>
            <header className="todo-lane-head">
              <div><h3>{lane.title}</h3><span>{laneTodos.length} 项</span></div>
              <button type="button" onClick={() => void createTodo(lane.id)} disabled={busy}>+ 新增</button>
            </header>
            <div className="todo-list">
              {laneTodos.length === 0 ? <p className="empty-note">暂无</p> : laneTodos.map(todo => {
                const original = recordValue(todo.content.original);
                return (
                  <article key={todo.id} className={`todo${draggedId === todo.id ? " is-dragging" : ""}`} data-todo-card={todo.id}>
                    <button
                      type="button"
                      className="todo-drag-handle"
                      draggable
                      onDragStart={event => {
                        setDraggedId(todo.id);
                        event.dataTransfer.setData("text/plain", todo.id);
                      }}
                      onDragEnd={() => {
                        setDraggedId("");
                        setDropLane("");
                      }}
                      aria-label={`拖拽调整 ${todo.title}`}>⠿</button>
                    <div className="todo-fields">
                      <textarea
                        value={textValue(original, "title") || todo.title}
                        aria-label="待办标题"
                        onChange={event => editTodoLocal(todo.id, { title: event.target.value })}
                        onBlur={() => void persistTodo(todo.id)}
                      />
                      <input
                        value={textValue(original, "owner")}
                        aria-label="负责人"
                        placeholder="负责人"
                        onChange={event => editTodoLocal(todo.id, { owner: event.target.value })}
                        onBlur={() => void persistTodo(todo.id)}
                      />
                    </div>
                    <button type="button" className="todo-delete" onClick={() => void deleteTodo(todo)} aria-label="删除待办">×</button>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
