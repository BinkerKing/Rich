/**
 * 30s 钢铁侠戏剧场景。纯 SVG + CSS，无外部素材依赖。
 *
 * Timeline (秒占整段比例 → CSS keyframe %)：
 *   00–04s  transform   armor pieces 从四周飞入组装 → 闪光合体
 *   04–08s  power-on    站姿 + 推进器点火 + arc reactor 充能
 *   08–22s  flight       上半屏自由飞行（横 8 字 + 螺旋），尾迹追随
 *   22–26s  dive         空中悬停 → 向下俯冲
 *   26–30s  landing      经典三点落地 + 地面冲击波 + 烟尘
 *
 * Choreography 通过 CSS keyframes 一次性绑定，组件本身只负责挂 SVG。
 * 重复触发：把组件 key 设成 mascot.startedAt（外部 HomeView 控制），
 * key 一变就重新挂载，重放动画。
 */
export function IronManFlight() {
  return (
    <div className="ironman" aria-hidden="true">
      <div className="ironman-stage">
        {/* 1) 装甲组装阶段：6 个红/金色长条从屏幕四周飞入中心 */}
        <span className="ironman-armor ironman-armor--top-l" />
        <span className="ironman-armor ironman-armor--top-r" />
        <span className="ironman-armor ironman-armor--mid-l" />
        <span className="ironman-armor ironman-armor--mid-r" />
        <span className="ironman-armor ironman-armor--bot-l" />
        <span className="ironman-armor ironman-armor--bot-r" />

        {/* 2) 闪光合体瞬间 */}
        <span className="ironman-flash" />

        {/* 3) 钢铁侠本体 — SVG + 推进器 + 尾迹 */}
        <div className="ironman-figure">
          <span className="ironman-trail" />
          <svg viewBox="0 0 120 160" className="ironman-svg">
            <defs>
              <linearGradient id="im-body" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="#d62828" />
                <stop offset="60%" stopColor="#9a1313" />
                <stop offset="100%" stopColor="#5b0a0a" />
              </linearGradient>
              <radialGradient id="im-reactor" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0%"  stopColor="#ffffff" />
                <stop offset="30%" stopColor="#9ff0ff" />
                <stop offset="100%" stopColor="#2aa3c7" />
              </radialGradient>
              <linearGradient id="im-gold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffe082" />
                <stop offset="100%" stopColor="#c89000" />
              </linearGradient>
            </defs>

            {/* helmet */}
            <ellipse cx="60" cy="28" rx="22" ry="24" fill="url(#im-body)" />
            {/* gold faceplate */}
            <path
              d="M40,22 Q60,12 80,22 L78,38 Q60,46 42,38 Z"
              fill="url(#im-gold)"
            />
            {/* glowing eye slits */}
            <rect x="46" y="26" width="11" height="3" rx="1.5" fill="#e0fbff" />
            <rect x="63" y="26" width="11" height="3" rx="1.5" fill="#e0fbff" />

            {/* neck */}
            <rect x="54" y="48" width="12" height="6" fill="#7a0b0b" />

            {/* torso */}
            <path
              d="M30,58 Q60,52 90,58 L88,108 Q60,116 32,108 Z"
              fill="url(#im-body)"
            />
            {/* arc reactor */}
            <circle cx="60" cy="78" r="9" fill="url(#im-reactor)" className="ironman-reactor" />

            {/* arms */}
            <rect x="20" y="60" width="14" height="42" rx="6" fill="url(#im-body)" />
            <rect x="86" y="60" width="14" height="42" rx="6" fill="url(#im-body)" />
            {/* gauntlets (palm forward — repulsor side) */}
            <rect x="18" y="98" width="18" height="14" rx="4" fill="url(#im-gold)" />
            <rect x="84" y="98" width="18" height="14" rx="4" fill="url(#im-gold)" />

            {/* legs */}
            <rect x="40" y="108" width="16" height="38" rx="5" fill="url(#im-body)" />
            <rect x="64" y="108" width="16" height="38" rx="5" fill="url(#im-body)" />
            {/* boots */}
            <rect x="38" y="142" width="20" height="14" rx="3" fill="url(#im-gold)" />
            <rect x="62" y="142" width="20" height="14" rx="3" fill="url(#im-gold)" />

            {/* repulsor glows (palms + feet) — visible only mid-flight via CSS */}
            <circle cx="27" cy="105" r="5" fill="#9ff0ff" className="ironman-glow ironman-glow--palm-l" />
            <circle cx="93" cy="105" r="5" fill="#9ff0ff" className="ironman-glow ironman-glow--palm-r" />
            <circle cx="48" cy="148" r="6" fill="#9ff0ff" className="ironman-glow ironman-glow--boot-l" />
            <circle cx="72" cy="148" r="6" fill="#9ff0ff" className="ironman-glow ironman-glow--boot-r" />
          </svg>

          {/* thruster flames under the feet — pure CSS gradient blobs */}
          <span className="ironman-flame ironman-flame--l" />
          <span className="ironman-flame ironman-flame--r" />
        </div>

        {/* 4) 落地冲击波 + 烟尘 */}
        <span className="ironman-impact" />
        <span className="ironman-dust ironman-dust--l" />
        <span className="ironman-dust ironman-dust--r" />
        <span className="ironman-dust ironman-dust--c" />
      </div>
    </div>
  );
}
