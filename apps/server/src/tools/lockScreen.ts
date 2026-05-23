import { z } from "zod";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ToolDefinition } from "./types.js";

const execAsync = promisify(exec);

/**
 * Lock the screen on macOS. Two modes:
 *   - `display_only: false` (default) — full lock via Ctrl+Cmd+Q. The user
 *     has to enter their password to come back.
 *   - `display_only: true` — `pmset displaysleepnow`, screen off but no
 *     password required to wake.
 *
 * `delay_minutes` (or `delay_seconds`) defers the action so the user has
 * a window to grab a coffee, fire-and-forget. The toolbox runtime picks
 * up the field automatically and schedules via setTimeout.
 */
const Schema = z.object({
  delay_minutes: z.number().min(0).max(120).default(0)
    .describe("延迟多少分钟后再锁屏。0 = 立即。最大 120。"),
  display_only: z.boolean().default(false)
    .describe("仅熄屏（不锁，无需密码唤醒），还是完整锁屏（需要密码）。默认完整锁屏。"),
});

export const lockScreenTool: ToolDefinition<typeof Schema> = {
  name: "lock_screen",
  label: "锁屏",
  description:
    "锁屏小工具：N 分钟后让 Mac 进入锁屏（默认）或仅熄屏。" +
    "适合「我去倒杯水，10 分钟后锁」「现在马上锁」等场景。",
  icon: "gear",
  category: "system",
  schema: Schema,
  async handler(args, ctx) {
    ctx.log(`[lock_screen] mode=${args.display_only ? "displaysleep" : "lock"} (after ${args.delay_minutes}m delay)`);
    if (process.platform !== "darwin") {
      throw new Error("锁屏工具目前只支持 macOS");
    }
    if (args.display_only) {
      // pmset displaysleepnow — turns the screen off but keeps the session.
      // No password required to come back.
      await execAsync("/usr/bin/pmset displaysleepnow");
      return "已执行 pmset displaysleepnow，屏幕已熄灭";
    }
    // Full lock — sends Ctrl+Cmd+Q which is the modern macOS lock shortcut.
    // Requires the loginwindow Accessibility permission for Rich; if blocked
    // we fall back to CGSession which doesn't require Accessibility.
    const lockScript = `tell application "System Events" to keystroke "q" using {control down, command down}`;
    try {
      await execAsync(`osascript -e '${lockScript}'`);
      return "已发送 Ctrl+Cmd+Q，屏幕已锁";
    } catch {
      // Fallback: CGSession (built-in tool, no Accessibility prompt).
      const cgPath = "/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession";
      await execAsync(`"${cgPath}" -suspend`);
      return "已通过 CGSession 锁屏（osascript 路径不可用）";
    }
  },
};
