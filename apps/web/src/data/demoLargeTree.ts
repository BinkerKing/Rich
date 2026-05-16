import type { Element, LearningPath, Relation } from "@ke/domain";

const now = "2026-05-16T00:00:00.000Z";

const branches = [
  ["感知", "信息如何被感觉器官接收与识别"],
  ["记忆", "信息如何编码、储存与提取"],
  ["注意力", "如何选择、分配与维持注意资源"],
  ["语言", "语言如何理解、产生与交流"],
  ["推理", "如何进行推理、问题解决与判断"],
  ["决策", "如何评估选项并做出选择"],
  ["情绪", "情绪如何影响认知与行为"],
  ["学习", "知识如何形成、迁移与巩固"],
  ["实战", "如何把认知机制用于真实项目"],
  ["复盘", "如何总结经验并改进学习策略"],
  ["专家", "如何形成高阶判断与专业直觉"],
] as const;

const levelNames = [
  "总览",
  "入口层",
  "框架层",
  "机制层",
  "方法层",
  "案例层",
  "练习层",
  "项目层",
  "复盘层",
  "专家层",
] as const;

const l3Directions = [
  ["基础定义", "先把概念边界说清楚"],
  ["组成结构", "拆出内部模块与关系"],
  ["运行机制", "理解它如何发生与运转"],
  ["关键变量", "识别影响结果的核心因素"],
  ["典型案例", "用真实情境校验理解"],
  ["实践入口", "转成一个可执行的小练习"],
] as const;

const l4Directions = [
  ["判断标准", "明确什么情况下算理解到位"],
  ["操作步骤", "把理解转成连续动作"],
  ["对比辨析", "区分相近概念和常见混淆"],
  ["练习任务", "用小任务检验掌握程度"],
] as const;

const l5Directions = [
  ["方法选择", "选择适合当前问题的处理方法"],
  ["应用场景", "识别它最适合落地的真实场景"],
] as const;

const l6Directions = [
  ["执行清单", "拆成可以逐项完成的行动清单"],
  ["反馈指标", "设计判断学习结果的反馈指标"],
] as const;

export interface DemoTree {
  rootId: string;
  elements: Element[];
  relations: Relation[];
  paths: LearningPath[];
}

function metadata(richness: 1 | 2 | 3 | 4 | 5 = 3) {
  return {
    createdAt: now,
    updatedAt: now,
    generatedBy: "ai" as const,
    richness,
  };
}

function contentFor(level: number, title: string, branchTitle: string, focus: string) {
  return {
    oneSentence: `${title} 是「${branchTitle}」在第 ${level} 层的学习元，帮助你把抽象主题压成可行动的理解。`,
    coreExplain: `这一层重点不是堆知识点，而是明确「${focus}」如何影响学习路径。先掌握边界，再看组成，最后用一个小任务检验是否真的理解。`,
    whyMatters: `当知识树扩展到 100 个元以上时，${title} 可以帮助你保持定位感，不被大量分支淹没。`,
    beginnerExplain: `把它想成一个路标：你现在不用看完整棵树，只要知道它从哪里来、解决什么问题、下一步通向哪里。`,
    keyPoints: [
      `知道它属于 ${levelNames[level - 1]}`,
      `能说清它和上层元的关系`,
      `能找到下一个可展开方向`,
      `能用一个例子验证理解`,
    ],
    examples: [
      `学习「${branchTitle}」时，用 ${title} 判断当前该看概念、方法还是案例。`,
      `做项目时，把 ${title} 转成一个可执行的小任务。`,
    ],
    misconceptions: [
      "只看标题，不看它在路径中的位置。",
      "一次展开过多层级，导致注意力被稀释。",
    ],
    nextSteps: [
      `继续进入 ${branchTitle} 的下一层。`,
    ],
  };
}

export function createDemoLargeTree(): DemoTree {
  const elements: Element[] = [
    {
      id: "demo-root",
      type: "topic",
      title: "Know Everything 学习宇宙",
      subtitle: "10 层结构 · 多分支六级测试树 · 中心化学习视角",
      domain: "学习系统",
      content: {
        intro: "这是用于检验前台界面的压力知识树：它模拟 10 个层级，让每个二级元都有 6 个三级方向、每个三级元都有 4 个四级方向，并让每个四级元继续拥有五级、六级方向，用来测试无限下钻、横向滚动、真实连线和中心化学习视角。",
        learningGoals: [
          "只显示当前学习真正需要的结构",
          "保持上层、同级、下层的定位感",
          "让知识元内容区承载真正学习内容",
          "支持持续设为中心、向下学习",
        ],
        coreModules: branches.slice(0, 8).map(([title, description]) => ({
          id: title,
          title,
          description,
          focus: "从当前中心进入可学习路径",
        })),
      },
      metadata: metadata(4),
    },
  ];
  const relations: Relation[] = [];

  branches.forEach(([branchTitle, focus], branchIndex) => {
    const branchNo = branchIndex + 1;
    const l2Id = `demo-l2-${branchNo}`;
    elements.push({
      id: l2Id,
      type: "concept",
      title: branchTitle,
      subtitle: `${focus} · 第 2 层`,
      domain: "学习系统",
      tags: ["L2", branchTitle],
      content: contentFor(2, branchTitle, branchTitle, focus),
      metadata: metadata(3),
    });
    relations.push({
      id: `demo-root->${l2Id}`,
      from: "demo-root",
      to: l2Id,
      kind: "child",
      strength: 1,
      reason: "第 2 层核心分支",
      createdAt: now,
    });

    l3Directions.forEach(([direction, directionFocus], directionIndex) => {
      const l3Id = `demo-l3-${branchNo}-${directionIndex + 1}`;
      const l3Title = `${branchTitle} · ${direction}`;
      elements.push({
        id: l3Id,
        type: "concept",
        title: l3Title,
        subtitle: `${directionFocus} · 第 3 层`,
        domain: "学习系统",
        tags: ["L3", branchTitle, direction],
        content: contentFor(3, l3Title, branchTitle, `${focus}，并${directionFocus}`),
        metadata: metadata(directionIndex >= 4 ? 4 : 3),
      });
      relations.push({
        id: `${l2Id}->${l3Id}`,
        from: l2Id,
        to: l3Id,
        kind: "child",
        strength: 1,
        reason: `第 3 层：${direction}`,
        createdAt: now,
      });

      l4Directions.forEach(([l4Direction, l4Focus], l4Index) => {
        const l4Id = `demo-l4-${branchNo}-${directionIndex + 1}-${l4Index + 1}`;
        const l4Title = `${branchTitle} · ${direction} · ${l4Direction}`;
        elements.push({
          id: l4Id,
          type: l4Index === 3 ? "step" : "concept",
          title: l4Title,
          subtitle: `${l4Focus} · 第 4 层`,
          domain: "学习系统",
          tags: ["L4", branchTitle, direction, l4Direction],
          content: contentFor(4, l4Title, branchTitle, `${focus}，并${directionFocus}，继续${l4Focus}`),
          metadata: metadata(l4Index === 3 ? 4 : 3),
        });
        relations.push({
          id: `${l3Id}->${l4Id}`,
          from: l3Id,
          to: l4Id,
          kind: "child",
          strength: 1,
          reason: `第 4 层：${l4Direction}`,
          createdAt: now,
        });

        l5Directions.forEach(([l5Direction, l5Focus], l5Index) => {
          const l5Id = `demo-l5x-${branchNo}-${directionIndex + 1}-${l4Index + 1}-${l5Index + 1}`;
          const l5Title = `${l4Title} · ${l5Direction}`;
          elements.push({
            id: l5Id,
            type: "step",
            title: l5Title,
            subtitle: `${l5Focus} · 第 5 层`,
            domain: "学习系统",
            tags: ["L5", branchTitle, direction, l4Direction, l5Direction],
            content: contentFor(5, l5Title, branchTitle, `${focus}，并${directionFocus}，继续${l4Focus}，再${l5Focus}`),
            metadata: metadata(4),
          });
          relations.push({
            id: `${l4Id}->${l5Id}`,
            from: l4Id,
            to: l5Id,
            kind: "child",
            strength: 1,
            reason: `第 5 层：${l5Direction}`,
            createdAt: now,
          });

          l6Directions.forEach(([l6Direction, l6Focus], l6Index) => {
            const l6Id = `demo-l6x-${branchNo}-${directionIndex + 1}-${l4Index + 1}-${l5Index + 1}-${l6Index + 1}`;
            const l6Title = `${l5Title} · ${l6Direction}`;
            elements.push({
              id: l6Id,
              type: l6Index === 0 ? "step" : "practice",
              title: l6Title,
              subtitle: `${l6Focus} · 第 6 层`,
              domain: "学习系统",
              tags: ["L6", branchTitle, direction, l4Direction, l5Direction, l6Direction],
              content: contentFor(6, l6Title, branchTitle, `${focus}，并${directionFocus}，继续${l4Focus}，再${l5Focus}，最后${l6Focus}`),
              metadata: metadata(4),
            });
            relations.push({
              id: `${l5Id}->${l6Id}`,
              from: l5Id,
              to: l6Id,
              kind: "child",
              strength: 1,
              reason: `第 6 层：${l6Direction}`,
              createdAt: now,
            });
          });
        });
      });
    });

    let parent = `demo-l4-${branchNo}-1-1`;
    for (let level = 5; level <= 10; level += 1) {
      const id = `demo-l${level}-${branchNo}`;
      const title = `${branchTitle} · ${levelNames[level - 1]}`;
      elements.push({
        id,
        type: level >= 8 ? "practice" : level >= 5 ? "step" : "concept",
        title,
        subtitle: `${focus} · 第 ${level} 层`,
        domain: "学习系统",
        tags: [`L${level}`, branchTitle],
        content: contentFor(level, title, branchTitle, focus),
        metadata: metadata(level >= 8 ? 4 : 3),
      });
      relations.push({
        id: `${parent}->${id}`,
        from: parent,
        to: id,
        kind: "child",
        strength: 1,
        reason: `第 ${level} 层延伸`,
        createdAt: now,
      });
      parent = id;
    }
  });

  const paths: LearningPath[] = [
    {
      id: "demo.quick",
      centerElementId: "demo-root",
      kind: "quick",
      label: "快速入门",
      color: "gold",
      steps: ["demo-l2-1", "demo-l3-1-1", "demo-l4-1-1-1", "demo-l5x-1-1-1-1", "demo-l6x-1-1-1-1-1"],
      estimatedTime: "25 min",
      generatedBy: "ai",
      createdAt: now,
    },
    {
      id: "demo.academic",
      centerElementId: "demo-root",
      kind: "academic",
      label: "深度理解",
      color: "cyan",
      steps: ["demo-l2-4", "demo-l3-4-2", "demo-l4-4-2-2", "demo-l5x-4-2-2-1", "demo-l6x-4-2-2-1-2"],
      estimatedTime: "2 h",
      generatedBy: "ai",
      createdAt: now,
    },
    {
      id: "demo.practice",
      centerElementId: "demo-root",
      kind: "practice",
      label: "实战应用",
      color: "pink",
      steps: ["demo-l2-8", "demo-l3-8-6", "demo-l4-8-6-4", "demo-l5x-8-6-4-2", "demo-l6x-8-6-4-2-1"],
      estimatedTime: "4 h",
      generatedBy: "ai",
      createdAt: now,
    },
  ];

  return { rootId: "demo-root", elements, relations, paths };
}
