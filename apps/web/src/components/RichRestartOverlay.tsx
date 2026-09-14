import { useEffect, useState } from "react";

type RichWindow = {
  restartLatestApp?: () => Promise<boolean>;
};

export function RichRestartOverlay() {
  const [countdown, setCountdown] = useState<number>();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const beginRestart = () => {
      setError(undefined);
      setStarting(false);
      setCountdown(3);
    };
    window.addEventListener("rich:restart-latest", beginRestart);
    return () => window.removeEventListener("rich:restart-latest", beginRestart);
  }, []);

  useEffect(() => {
    if (countdown === undefined) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setCountdown(undefined);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [countdown]);

  useEffect(() => {
    if (countdown === undefined) return;
    if (countdown === 0) {
      const restart = async () => {
        setStarting(true);
        try {
          const richWindow = (window as Window & { richWindow?: RichWindow }).richWindow;
          const started = await richWindow?.restartLatestApp?.();
          if (!started) throw new Error("未能启动部署进程");
        } catch {
          setStarting(false);
          setCountdown(undefined);
          setError("无法启动部署，请确认 Rich 源码目录仍在本机。");
        }
      };
      void restart();
      return;
    }
    const timer = window.setTimeout(() => setCountdown(value => value === undefined ? undefined : value - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  if (countdown === undefined && !error) return null;
  return <div role="dialog" aria-modal="true" aria-label="重启 Rich" style={{ position: "fixed", inset: 0, zIndex: 100000, display: "grid", placeItems: "center", background: "rgba(5, 8, 10, .88)", color: "#f2f6f7" }}>
    <section style={{ width: "min(440px, calc(100vw - 48px))", padding: "32px", border: "1px solid #3b474c", borderRadius: 18, background: "#151a1d", textAlign: "center", boxShadow: "0 20px 60px rgba(0, 0, 0, .5)" }}>
      {error ? <p role="alert" style={{ margin: 0, color: "#ffb4a9", fontWeight: 700 }}>{error}</p> : starting ? <p style={{ margin: 0, color: "#9ed2ff", fontWeight: 700 }}>正在退出 Rich 并部署最新版本…</p> : <><p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Rich 将在 {countdown} 秒后重启</p><p style={{ margin: "12px 0 0", color: "#aebbc0" }}>将关闭当前 Rich，再部署并启动最新版本。</p><p style={{ margin: "22px 0 0", color: "#ffca6b", fontSize: 13 }}>按 Esc 取消</p></>}
    </section>
  </div>;
}
