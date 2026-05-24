import { useEffect, useState } from "react";
import { useStore, type AppView } from "../state/store.js";
import { Icon, type IconName } from "./Icon.js";
import walk0 from "../assets/mascot/walk-0.png";
import walk1 from "../assets/mascot/walk-1.png";
import walk2 from "../assets/mascot/walk-2.png";
import walk3 from "../assets/mascot/walk-3.png";
import { useMascotState } from "../lib/useMascotState.js";
import { startBreathScheduler } from "../lib/mascotBreathScheduler.js";
import "./MascotDock.css";

/**
 * Bottom-left mascot dock — Rich's mini Transformer pacing in the corner.
 * Hovering pops out a horizontal rail of view-switch icons (replaces the
 * old right-side SystemPanel "视图系统" mode).
 *
 * Implementation:
 *   - 4-frame walk cycle, swapped on a JS interval (180ms/frame). Could be
 *     a pure CSS `steps()` animation, but the same 4 PNGs are re-used at
 *     different sprite sizes (32px in the dock, larger elsewhere), so a
 *     React state cycle is the simplest portable shape.
 *   - Flyout is a CSS-only sibling that animates on `:hover` of the parent
 *     dock. No JS listeners → keyboard / touch users see it via tap on
 *     the mascot button (focus state also opens it).
 */
type View = { id: AppView; label: string; icon: IconName; desc: string };

const VIEWS: View[] = [
  { id: "home",    label: "首页",     icon: "center",   desc: "跟 Rich 自由对话的驾驶舱首页" },
  { id: "tree",    label: "知识树",   icon: "branch",   desc: "选择 / 新建一棵知识树" },
  { id: "news",    label: "AI 早报", icon: "calendar", desc: "每日 AI 能力进展与应用速览" },
  { id: "mindmap", label: "导图 PPT", icon: "diamond",  desc: "把元 / 文稿一键拆成可播放导图" },
  { id: "greatme", label: "计划管理", icon: "target",   desc: "AI 拆解 · 目标跟进 · 日报反馈" },
  { id: "practice", label: "项目实战", icon: "card",    desc: "拆解 · PRD · 效果图" },
  { id: "toolbox", label: "工具箱",   icon: "rocket",   desc: "锁屏 · 定时器 · 其它小工具" },
  { id: "admin",   label: "后台",     icon: "gear",     desc: "AI 引擎 · 操作日志 · 提示词" },
];

const WALK_FRAMES = [walk0, walk1, walk2, walk3];

export function MascotDock() {
  const appView = useStore(s => s.appView);
  const setAppView = useStore(s => s.setAppView);
  const exitToHome = useStore(s => s.exitToHome);
  const mascotState = useMascotState();
  const [frame, setFrame] = useState(0);
  /** 微动作 once 动画：随机插入的 800ms 单次动作（抓头/翻白眼/看左/看右） */
  const [microAction, setMicroAction] = useState<string | null>(null);

  // 每态自带的帧切换速度
  const frameMs = (
    mascotState === "talking" ? 120 :
    mascotState === "thinking" ? 220 :
    mascotState === "proud" ? 100 :
    mascotState === "confused" ? 260 :
    mascotState === "embarrassed" ? 200 :
    180   // idle = 漫步
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setFrame(f => (f + 1) % WALK_FRAMES.length);
    }, frameMs);
    return () => window.clearInterval(id);
  }, [frameMs]);

  // T08 呼吸态调度器：thinking ≥ 1s 期间，每 3-5s 随机插一个 800ms 微动作
  useEffect(() => {
    if (mascotState !== "thinking") {
      setMicroAction(null);
      return;
    }
    const stop = startBreathScheduler({
      onTriggerMicro: (action) => setMicroAction(action),
      onClearMicro: () => setMicroAction(null),
    });
    return stop;
  }, [mascotState]);

  // CSS 类聚合
  const stateClass = `mascot-dock__sprite-wrap--${mascotState}`;
  const microClass = microAction ? `mascot-dock__sprite-wrap--micro-${microAction}` : "";

  return (
    <div className="mascot-dock" aria-label="Rich · 视图切换" data-state={mascotState}>
      <button
        type="button"
        className="mascot-dock__mascot"
        title="视图系统"
        aria-haspopup="true"
      >
        <span className={`mascot-dock__sprite-wrap ${stateClass} ${microClass}`}>
          <img
            src={WALK_FRAMES[frame]}
            alt=""
            className="mascot-dock__sprite"
            aria-hidden="true"
          />
        </span>
      </button>
      <div className="mascot-dock__flyout" role="menu" aria-label="视图">
        {VIEWS.map(v => {
          const active = appView === v.id;
          return (
            <button
              key={v.id}
              type="button"
              role="menuitem"
              className={`mascot-dock__item${active ? " is-active" : ""}`}
              onClick={() => {
                // "tree" defaults to home — clear rootId so we land on InputView.
                if (v.id === "tree") exitToHome();
                setAppView(v.id);
              }}
              title={v.desc}
            >
              <Icon name={v.icon} />
              <span>{v.label}</span>
              {active && <em className="mascot-dock__active-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
