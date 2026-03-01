# 项目架构文档

## 1. 项目概述

本项目是一个独立的 **Claude Code 插件市场（Plugin Marketplace）**，包含名为 **Thinking Smart** 的技能集合，以及一个用于展示技能的静态网站。

**核心定位：** 通过一组精心设计的技能（Skills），增强 Claude Code 的 AI 驱动开发工作流——涵盖头脑风暴、计划编写、计划执行、执行审计和错误恢复五大核心环节。

**技术栈：**

| 层次 | 技术 |
|------|------|
| 技能定义 | YAML frontmatter + Markdown（SKILL.md） |
| 钩子脚本 | Bash + JSON context injection |
| 配置格式 | TOML（网站配置）、JSON（插件元数据、钩子配置） |
| 网站框架 | Astro 5.x（静态站点生成） |
| 内容生成 | TypeScript + DeepSeek API（通过 OpenAI SDK） |
| 构建工具 | Node.js 22 + npm + tsx |
| 部署 | GitHub Actions + Cloudflare Pages |
| 版本管理 | Git pre-commit hook 自动补丁版本递增 |

---

## 2. 目录结构

```
skills/
├── .claude-plugin/
│   └── marketplace.json          # 市场注册表，声明所有插件
├── .claude/
│   └── settings.json             # 本地 Claude Code 设置
├── .github/
│   └── workflows/
│       └── deploy-website.yml    # CI/CD 部署流水线
├── .githooks/
│   └── pre-commit                # 自动版本递增钩子
├── claude/
│   └── thinking-smart/           # Thinking Smart 插件根目录
│       ├── .claude-plugin/
│       │   └── plugin.json       # 插件元数据（名称、版本）
│       ├── hooks/
│       │   ├── hooks.json        # 钩子事件配置
│       │   ├── session-start.sh  # 会话启动注入
│       │   ├── post-plan-mode.sh # 进入计划模式后注入
│       │   ├── post-plan-agent.sh# Plan 子代理停止后注入
│       │   └── post-tool-error.sh# 工具调用失败后注入
│       ├── skills/
│       │   ├── using-skills/SKILL.md      # 技能使用总纲
│       │   ├── brainstorming/SKILL.md     # 头脑风暴
│       │   ├── write-plan/SKILL.md        # 编写计划
│       │   ├── execute-plan/SKILL.md      # 执行计划
│       │   ├── audit-plan/SKILL.md        # 审计计划
│       │   └── recover-from-errors/SKILL.md # 错误恢复
│       ├── website.plugin.toml   # 插件网站展示配置
│       ├── website.skills.toml   # 技能网站展示配置
│       └── website.philosophy.toml # 设计哲学与图表配置
├── scripts/
│   └── setup.sh                  # 开发环境初始化
├── website/
│   ├── site.toml                 # 网站全局配置
│   ├── package.json              # 依赖与脚本
│   ├── astro.config.mjs          # Astro 配置
│   ├── scripts/
│   │   ├── generate-content.ts   # TOML → JSON 内容生成
│   │   └── generate-workflow-diagram.ts # 工作流图表数据生成
│   └── src/
│       ├── config/site.ts        # 站点配置加载器
│       ├── layouts/Base.astro    # 基础布局
│       ├── pages/
│       │   ├── index.astro       # 首页（插件列表）
│       │   └── claude/
│       │       ├── [plugin]/index.astro        # 插件详情页
│       │       └── [plugin]/skills/[skill].astro # 技能详情页
│       ├── components/           # Astro 组件
│       │   ├── Header.astro
│       │   ├── Footer.astro
│       │   ├── Breadcrumb.astro
│       │   ├── PluginCard.astro
│       │   ├── SkillCard.astro
│       │   ├── HighlightCard.astro
│       │   ├── WorkflowDiagram.astro
│       │   ├── WorkflowStep.astro
│       │   └── GitHubStars.astro
│       ├── content/generated/    # 生成的 JSON 内容（已提交到 Git）
│       │   ├── plugins/thinking-smart.json
│       │   ├── skills/*.json
│       │   └── workflow/thinking-smart.json
│       ├── styles/variables.css  # CSS 变量定义
│       └── types/toml.d.ts       # TOML 类型声明
└── README.md
```

---

## 3. 核心架构：技能系统

### 3.1 技能定义格式

每个技能以 `SKILL.md` 文件定义，使用 **YAML frontmatter + Markdown** 格式：

```markdown
---
name: skill-name
description: 触发条件描述，Claude 据此判断何时调用
---

# 技能标题

## Overview
技能目标与核心原则

## The Process
具体操作步骤

## Remember
关键注意事项
```

- `name`：技能标识符，用于 `/thinking-smart:<name>` 调用
- `description`：触发条件描述，告诉 Claude 在什么情况下**必须**调用此技能

技能通过 `Skill` 工具调用，命名空间格式为 `thinking-smart:<skill-name>`。

### 3.2 六个技能的详细工作流分析

#### (1) using-skills — 技能使用总纲

**定位：** 元技能，定义如何发现和使用所有其他技能。

**核心规则：** 在任何响应或行动之前，先检查是否有适用的技能。即使只有 1% 的可能性，也必须调用。

**工作流：**
1. 收到用户请求
2. 立即评估是否有适用技能
3. 使用 `Skill` 工具调用技能
4. 按技能指导执行任务

**关键机制：**
- 提供"红旗"对照表——列举 11 种常见的跳过技能的借口及其反驳
- 定义技能优先级：流程技能 → 实现技能 → 验证技能
- 区分刚性技能（严格遵循）与弹性技能（可适当调整）

#### (2) brainstorming — 头脑风暴

**定位：** 将模糊想法转化为完整设计的协作对话技能。

**工作流：**
1. **理解想法** — 检查项目状态（文件、文档、最近提交），逐个提问
2. **探索方案** — 提出 2-3 种方案及权衡，使用 `WebSearch` 获取最新信息
3. **验证信息** — 检查来源可信度、时效性，解决冲突
4. **呈现设计** — 分 200-300 字的小节呈现，逐节确认
5. **更新计划** — 若在计划模式中，调用 `thinking-smart:write-plan` 更新计划文件

**核心原则：** 一次只问一个问题；优先使用多选题；YAGNI 无情删减。

#### (3) write-plan — 编写计划

**定位：** 创建结构化的实现计划文件。

**工作流：**
1. 宣布启用技能
2. 按强制模板生成计划文件
3. 使用组件模板文档化项目结构、技术栈、架构变更
4. 识别需要人工验证的环节并优先排列
5. 识别计划中的假设并定义验证方法

**强制模板结构：**
```
# Plan of [Feature Name]
> 强制子技能声明
Goal → 上下文 → 自由规划内容 → Tasks → Verification
```

**人工验证门控的四个判定条件：**
- **无计算机使用** — 需要视觉检查、UI 外观确认
- **主观判断** — 需要人类意见或偏好评估
- **财务/信用授权** — 涉及付费 API 或云服务费用
- **安全敏感** — 影响真实凭证或生产环境访问

#### (4) execute-plan — 执行计划

**定位：** 加载计划文件并自动化执行。

**工作流：**
1. **检查是否可以执行** — 需要用户明确的"继续"信号
2. **加载计划文件** — 读取计划内容
3. **最大化并行执行** — 使用子代理并行执行独立任务，同时尊重依赖关系
4. **人工验证门控** — 在需要人工确认的节点暂停，使用 `AskUserQuestion`
5. **迭代推进** — 根据反馈调整，继续执行直到完成

**停止条件：** 遇到阻塞、发现计划有关键缺陷、不理解指令、验证反复失败时立即停止并请求帮助。

#### (5) audit-plan — 审计计划

**定位：** 计划执行完成后的验证技能，对比计划与实际状态。

**工作流：**
1. **加载计划文件** — 提取任务列表和文件引用
2. **验证每个任务** — 通过子代理并行检查：
   - 文件存在性检查
   - 文件内容匹配度检查
   - 删除操作确认
   - 验证命令执行
3. **生成报告** — 输出结构化审计表格

**状态定义：**
- **Done** — 所有计划变更已正确实现
- **Partial** — 部分变更存在，其他缺失或错误
- **Missing** — 任务未被实现

**核心原则：** 信任证据而非假设。仅报告问题，不自行修复。

#### (6) recover-from-errors — 错误恢复

**定位：** 防止工具调用失败时的目标漂移。

**工作流：**
1. **查看计划** — 立即查看会话计划文件，确认当前操作的上下文
2. **验证对齐** — 判断失败的工具调用是否属于当前计划任务
3. **重新对齐** —
   - 若属于计划：分析失败原因，修复具体问题
   - 若不属于计划：**停止重试**，重新阅读计划，回到正轨

**触发条件：** 连续 2 次以上失败或感觉陷入困境时触发。

### 3.3 技能优先级和分类

**调用优先级（从高到低）：**

1. **流程技能**（brainstorming, recover-from-errors）— 决定**如何**处理任务
2. **实现技能**（write-plan, execute-plan）— 指导执行
3. **验证技能**（audit-plan）— 确认执行结果

**技能类型：**

| 类型 | 技能 | 说明 |
|------|------|------|
| 刚性（Rigid） | execute-plan, recover-from-errors | 严格遵循，不可偏离 |
| 弹性（Flexible） | brainstorming | 原则可适应上下文调整 |

### 3.4 技能间的依赖与流转关系

典型完整工作流：

```
用户提出需求
    │
    ▼
using-skills（技能检查）
    │
    ▼
brainstorming（探索与设计）
    │
    ▼
write-plan（结构化计划）
    │
    ▼
execute-plan（并行执行）──── 遇到连续失败 ───▶ recover-from-errors
    │                                               │
    ▼                                               │
audit-plan（验证审计）◀─────────── 重新对齐后继续 ──┘
```

- `brainstorming` 完成后自动触发 `write-plan`（在计划模式下）
- `execute-plan` 完成后必须调用 `audit-plan` 验证
- `recover-from-errors` 可在 `execute-plan` 过程中随时触发

---

## 4. 钩子系统原理

### 4.1 hooks.json 配置结构与事件类型

钩子配置位于 `claude/thinking-smart/hooks/hooks.json`，结构如下：

```json
{
  "description": "插件描述",
  "hooks": {
    "<事件名>": [
      {
        "matcher": "<匹配模式>",
        "hooks": [
          {
            "type": "command",
            "command": "<脚本路径或命令>",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

- **事件名**：Claude Code 生命周期事件标识符
- **matcher**：正则表达式或管道分隔的匹配模式，用于过滤事件
- **type**：固定为 `"command"`，执行 shell 命令
- **timeout**：超时时间（秒）
- **`${CLAUDE_PLUGIN_ROOT}`**：插件根目录环境变量，运行时由 Claude Code 注入

### 4.2 五个生命周期事件的触发时机与行为

| 事件 | 匹配器 | 触发时机 | 行为 |
|------|--------|----------|------|
| `SessionStart` | `startup\|resume\|clear\|compact` | 会话启动、恢复、清除、压缩时 | 注入 `using-skills` 技能全文 |
| `PostToolUse` | `EnterPlanMode` | 成功调用 `EnterPlanMode` 工具后 | 提醒必须使用 `write-plan` 技能 |
| `SubagentStop` | `Plan` | Plan 类型子代理停止后 | 提醒必须使用 `write-plan` 技能 |
| `PostToolUseFailure` | `.*`（所有工具） | 任何工具调用失败后 | 建议使用 `recover-from-errors` 技能 |
| `UserPromptSubmit` | （无 matcher，全局） | 每次用户提交提示后 | 提醒使用子代理并行化独立任务 |

### 4.3 四个 shell 脚本的实现原理

所有钩子脚本采用相同的 **JSON context injection** 模式——输出符合 Claude Code 钩子协议的 JSON 结构：

```json
{
  "hookSpecificOutput": {
    "hookEventName": "<事件名>",
    "additionalContext": "<注入到对话中的文本>"
  }
}
```

Claude Code 读取此 JSON 后，将 `additionalContext` 注入到当前对话上下文中，作为系统级指令影响后续行为。

#### (1) session-start.sh

**功能：** 在会话启动时将 `using-skills` 技能的完整内容注入上下文。

**实现细节：**
- 读取 `skills/using-skills/SKILL.md` 文件内容
- 使用纯 Bash 的 `escape_for_json()` 函数转义特殊字符（`\`、`"`、`\n`、`\r`、`\t`）
- 用 `<EXTREMELY_IMPORTANT>` 标签包裹，确保 Claude 优先处理
- 这是唯一一个需要读取文件并动态构建 JSON 的脚本

#### (2) post-plan-mode.sh

**功能：** 在 `EnterPlanMode` 工具被调用后，提醒使用 `write-plan` 技能。

**实现：** 输出静态 JSON，要求在写入计划文件前必须先调用 `thinking-smart:write-plan`。

#### (3) post-plan-agent.sh

**功能：** 在 Plan 子代理停止后，同样提醒使用 `write-plan` 技能。

**实现：** 与 `post-plan-mode.sh` 输出完全相同的静态 JSON，形成双重保障。

#### (4) post-tool-error.sh

**功能：** 在任何工具调用失败后，建议使用错误恢复技能。

**实现：** 输出静态 JSON，提示当遇到连续失败（2 次以上）或感到困惑时，考虑使用 `thinking-smart:recover-from-errors`。

### 4.4 钩子如何驱动技能自动触发

钩子系统构成了一个**被动触发网络**，在关键时刻自动将技能注入到 Claude 的决策流程中：

```
会话启动
   │ SessionStart
   ▼
注入 using-skills ──▶ Claude 具备技能意识
   │
   │  用户提交提示
   │ UserPromptSubmit
   ▼
提醒并行化 ──▶ Claude 倾向使用子代理

   │  进入计划模式 / Plan 子代理停止
   │ PostToolUse(EnterPlanMode) / SubagentStop(Plan)
   ▼
提醒 write-plan ──▶ Claude 遵循计划模板

   │  工具调用失败
   │ PostToolUseFailure(.*)
   ▼
建议 recover-from-errors ──▶ Claude 避免目标漂移
```

这种设计确保了即使 Claude 在长对话中"遗忘"了技能规则，钩子也会在关键节点重新注入相应指令。

---

## 5. 网站生成流程

### 5.1 TOML 配置体系

网站内容由三个 TOML 配置文件驱动，位于 `claude/thinking-smart/` 目录：

| 文件 | 职责 | 关键字段 |
|------|------|----------|
| `website.plugin.toml` | 插件展示信息 | `display_name`、`tagline`、`repo` |
| `website.skills.toml` | 技能展示信息 | 每技能：`display_name`、`tagline`、`short_summary`、`full_summary`、`highlights[]`、`workflow[]` |
| `website.philosophy.toml` | 设计哲学与图表数据 | `philosophy.events[]`（图表事件）、`philosophy.sections[]`（哲学分节）、`skills.order`（展示顺序） |

此外，全局站点配置位于 `website/site.toml`，定义站点名称、hero 区域文案和页脚版权信息。

### 5.2 generate-content.ts 的内容生成流程

**入口命令：** `npm run generate`（执行 `tsx scripts/generate-content.ts`）

**核心流程：**

```
marketplace.json
       │
       ▼
 发现插件目录 ──▶ 扫描 claude/ 下的子目录
       │           查找 website.plugin.toml
       ▼
 发现技能 ──▶ 扫描 skills/ 子目录中的 SKILL.md
       │
       ▼
 检查缺失内容 ──▶ 对比 website.skills.toml 与磁盘技能
       │               若有缺失且 DEEPSEEK_API_KEY 可用
       ▼
 DeepSeek API 生成 ──▶ 发送 SKILL.md 内容
       │                   请求 JSON 格式的展示内容
       │                   追加写入 website.skills.toml
       ▼
 TOML → JSON 转换 ──▶ 计算源文件 SHA-256 哈希（前 16 位）
       │                 对比已有输出文件的哈希
       │                 若变更则生成新 JSON
       ▼
 输出文件
   ├── src/content/generated/plugins/<name>.json
   └── src/content/generated/skills/<name>.json
```

**DeepSeek API 调用细节：**
- 使用 OpenAI SDK，`baseURL` 设为 `https://api.deepseek.com/v1`
- 模型：`deepseek-chat`
- `temperature: 0`，`seed: 42`（确保可重现性）
- `response_format: { type: "json_object" }`
- 生成内容包括：display_name、tagline、short_summary、full_summary、3-4 个 highlights、3-5 个 workflow steps

### 5.3 generate-workflow-diagram.ts 的图表生成流程

**入口命令：** `npm run generate:workflow`（执行 `tsx scripts/generate-workflow-diagram.ts`）

**核心流程：**

```
hooks.json + website.philosophy.toml + 所有 SKILL.md
       │
       ▼
 计算联合哈希 ──▶ 所有源文件内容用 ---BOUNDARY--- 拼接
       │              计算 SHA-256 前 16 位
       ▼
 对比缓存 ──▶ 若哈希匹配且非 --force 则跳过
       │
       ▼
 构建图表事件 ──▶ 从 TOML 的 philosophy.events 读取
       │              每个事件有：id、edge（位于矩形的哪条边）、position（0-1 位置）、label
       ▼
 构建哲学分节 ──▶ 从 TOML 的 philosophy.sections 读取
       │              包含 additions（钩子标注）、highlight（功能亮点或对比）、related_skills
       ▼
 输出 JSON ──▶ src/content/generated/workflow/thinking-smart.json
```

输出 JSON 包含 `diagram`（事件坐标和矩形尺寸）和 `philosophies`（各哲学分节的展示数据），供 `WorkflowDiagram.astro` 组件渲染。

### 5.4 源文件哈希缓存机制

两个生成脚本都使用相同的缓存策略：

1. **计算当前哈希**：对源文件内容取 SHA-256，截取前 16 位十六进制字符
2. **读取已有哈希**：从输出 JSON 文件的 `sourceHash` 字段读取
3. **对比判断**：
   - 哈希相同 → 跳过生成，输出 "unchanged"
   - 哈希不同 → 重新生成并写入新文件
4. **强制重建**：`generate-workflow-diagram.ts` 支持 `--force` 参数

这确保了：
- 本地开发时仅在源文件变更后才调用 DeepSeek API
- CI 环境中（无 API Key）不会触发生成，直接使用已提交的 JSON 文件

### 5.5 Astro 页面路由与组件架构

**路由结构：**

| 路由 | 页面文件 | 内容 |
|------|---------|------|
| `/` | `pages/index.astro` | 首页，展示所有插件卡片 |
| `/claude/[plugin]/` | `pages/claude/[plugin]/index.astro` | 插件详情页，含技能列表与工作流图表 |
| `/claude/[plugin]/skills/[skill]` | `pages/claude/[plugin]/skills/[skill].astro` | 技能详情页，含亮点与工作流步骤 |

**组件层次：**

```
Base.astro（布局）
├── Header.astro          # 导航栏
├── Footer.astro          # 页脚
├── Breadcrumb.astro      # 面包屑导航
├── PluginCard.astro      # 插件卡片（首页）
├── SkillCard.astro       # 技能卡片（插件详情页）
├── HighlightCard.astro   # 功能亮点卡片（哲学对比）
├── WorkflowDiagram.astro # 工作流图表（SVG 矩形 + 事件标记）
├── WorkflowStep.astro    # 工作流步骤条目
└── GitHubStars.astro     # GitHub 星标展示
```

**数据流向：**

```
TOML 配置 → generate-content.ts → JSON 文件 → Astro 页面读取 → SSG 渲染为静态 HTML
```

所有生成的 JSON 文件位于 `src/content/generated/` 目录，已提交到 Git 仓库。Astro 在构建时直接用 `readFileSync` 读取这些 JSON 文件作为数据源。

---

## 6. CI/CD 与自动化

### 6.1 pre-commit 钩子的版本自动递增逻辑

**脚本位置：** `.githooks/pre-commit`

**启用方式：** 运行 `sh scripts/setup.sh`，将 `core.hooksPath` 指向 `.githooks/`。

**执行流程：**

```
git commit 触发
       │
       ▼
 Git LFS 委托 ──▶ 若已安装 git-lfs，调用 lfs pre-commit（防御性）
       │
       ▼
 Rebase 检测 ──▶ 若处于 rebase-merge 或 rebase-apply，直接退出
       │              避免多次版本递增
       ▼
 遍历 claude/* 插件目录
       │
       ▼
 检查暂存文件 ──▶ 是否有 claude/<plugin>/* 的文件变更
       │
       ▼
 版本比较
   ├── HEAD 版本不存在 → 新插件，保持初始版本
   ├── HEAD 版本 ≠ 当前版本 → 手动修改，尊重用户设置
   └── HEAD 版本 = 当前版本 → 自动递增补丁版本
       │
       ▼
 sed 修改 plugin.json ──▶ 1.0.25 → 1.0.26
       │
       ▼
 git add plugin.json ──▶ 将版本变更加入当前提交
```

**关键设计：**
- 尊重手动版本变更——若用户已手动修改版本号，钩子不会覆盖
- 通过比较 HEAD 版本和工作区版本来判断是否为手动变更
- 支持插件重命名场景——通过 `git diff --cached -M --diff-filter=R` 追踪旧路径

### 6.2 GitHub Actions 部署流水线

**配置文件：** `.github/workflows/deploy-website.yml`

**触发条件：**
- `push` 到 `main` 分支
- `workflow_dispatch` 手动触发

**并发控制：** `concurrency` 组 `deploy-website`，新推送会取消正在进行的部署。

**两阶段流程：**

```
阶段 1: changes（变更检测）
       │
       │  使用 dorny/paths-filter 检查以下路径：
       │  - website/**
       │  - claude/*/website.*.toml
       │  - claude/*/skills/*/SKILL.md
       │  - claude/*/hooks/**
       │  - .claude-plugin/marketplace.json
       │
       ▼
 仅在相关文件变更时（或手动触发时）进入下一阶段

阶段 2: deploy（构建与部署）
       │
       ├── setup-node@v4（Node.js 22）
       ├── npm ci（安装依赖）
       ├── npm run build
       │     ├── generate:all（内容生成，CI 中因哈希匹配而跳过）
       │     └── astro build（构建静态站点到 dist/）
       └── cloudflare/wrangler-action@v3
             └── pages deploy dist/ --project-name thinking-smart-website --branch main
```

### 6.3 Cloudflare Pages 部署

- 使用 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 作为 GitHub Secrets
- 通过 `wrangler pages deploy` 部署到 Cloudflare Pages
- 项目名称：`thinking-smart-website`
- 部署分支：`main`

---

## 7. 设计原则

1. **技能驱动（Skill-Driven）** — 所有开发活动通过结构化技能引导，而非自由发挥。钩子系统确保技能在关键时刻被自动触发。

2. **计划优先（Plan-First）** — 先头脑风暴、再编写计划、后执行。计划文件作为执行和审计的可追溯依据。

3. **信任证据（Evidence over Assumptions）** — 审计技能通过实际文件检查而非内存回忆验证执行结果。错误恢复技能通过重新对齐计划而非猜测来纠正方向。

4. **最大化并行（Maximize Parallelism）** — 通过 `UserPromptSubmit` 钩子不断提醒使用子代理并行化独立任务。`execute-plan` 技能要求在尊重依赖的前提下最大化并行度。

5. **人工验证门控（Human Verification Gates）** — 识别需要人工判断的环节（视觉检查、主观评估、财务授权、安全敏感），将其前置于计划开头，确保尽早获得反馈。

6. **防目标漂移（Anti-Drift）** — `recover-from-errors` 技能和 `PostToolUseFailure` 钩子形成双重保障，确保工具失败时 Claude 不会偏离原始目标。

7. **内容与展示分离** — 技能定义（SKILL.md）、网站展示配置（TOML）和生成内容（JSON）三层分离。TOML 作为人类可编辑的配置层，JSON 作为机器消费的数据层。

8. **增量生成与缓存** — 源文件哈希机制确保仅在内容变更时重新生成，CI 环境中零 API 调用，生成结果提交到 Git 供人工审核。
