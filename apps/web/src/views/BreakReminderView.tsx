import { useEffect, useState } from "react";

function formatRemaining(until: number): string {
  const seconds = Math.max(0, Math.ceil((until - Date.now()) / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function BreakReminderView() {
  const [until] = useState(() => Number(new URLSearchParams(window.location.hash.split("?")[1]).get("until")) || Date.now());
  const [remaining, setRemaining] = useState(() => formatRemaining(until));

  useEffect(() => {
    document.documentElement.classList.add("is-break-reminder-window");
    const timer = window.setInterval(() => setRemaining(formatRemaining(until)), 250);
    return () => {
      document.documentElement.classList.remove("is-break-reminder-window");
      window.clearInterval(timer);
    };
  }, [until]);

  return (
    <main className="break-reminder" aria-label="休息提醒">
      <section className="break-reminder__panel">
        <span className="break-reminder__eyebrow">RICH · 休息时间</span>
        <h1>该休息一下了</h1>
        <p>离开屏幕，喝口水，活动一下身体。</p>
        <time>{remaining}</time>
        <small>休息倒计时</small>
      </section>
    </main>
  );
}
