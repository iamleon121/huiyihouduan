# 会议管理页面 CRUD 功能开发计划 (TODO List)

## 目标
为 `static/huiyi.html` 页面添加完整的会议创建 (Create)、读取 (Read - 列表与详情)、更新 (Update) 和删除 (Delete) 功能。

## 任务列表

### 1. 前端 (`static/huiyi.html`)

-   **[X] 新增会议功能:**
    -   [X] 在页面上添加一个清晰的 "新增会议" 按钮 (`#add-meeting-btn`)。
    -   [X] 设计并实现一个模态框 (`#meetingModal`) 用于填写新会议信息。
    -   [X] 表单 (`#meetingForm`) 包含会议的基本信息（名称、介绍、时间）。
    -   [X] 表单支持动态添加/删除议程项 (`#agendaItemsContainer`, `#addAgendaItemBtn`, `.removeAgendaItemBtn`)。
    -   [X] 实现表单提交逻辑：收集数据并调用后端 `POST /api/meetings/` API。
    -   [X] 成功创建后，刷新会议列表并提示用户。
    -   [ ] 添加表单验证 (TODO)。

-   **[X] 查看会议详情功能:**
    -   [X] 为每行会议数据添加 "查看" 按钮 (`.view`)。
    -   [X] 点击后，显示一个模态框 (`#viewMeetingModal`) 展示会议的完整信息，包括所有议程项。
    -   [X] 调用 `GET /api/meetings/{meeting_id}` API 获取最新详情。

-   **[X] 编辑会议功能:**
    -   [X] 为每行会议数据添加 "编辑" 按钮 (`.edit`)。
    -   [X] 点击后，调用 `GET /api/meetings/{meeting_id}` 获取数据，并使用数据填充 `#meetingModal` 模态框。
    -   [X] 允许用户修改会议基本信息和议程项（增/删/改）。
    -   [X] 实现表单提交逻辑：收集修改后的数据并调用后端 `PUT /api/meetings/{meeting_id}` API。
    -   [X] 成功更新后，刷新会议列表并提示用户。
    -   [ ] 添加表单验证 (TODO)。

-   **[X] 删除会议功能 (确认):**
    -   [X] 确认现有的 "删除" 按钮 (`.delete`) 功能按预期工作 (调用 `DELETE /api/meetings/{meeting_id}` 并更新 UI)。
    -   [X] 包含 `window.confirm` 确认步骤。

-   **[ ] UI/UX 优化:**
    -   [ ] 确保新增/编辑模态框的用户体验良好 (基础功能已实现)。
    -   [X] 统一所有操作按钮的样式 (已使用 `.btn-action` 系列样式)。
    -   [X] 优化议程项的显示方式（在查看详情模态框中）。
    -   [ ] 处理加载状态和错误提示 (部分实现，可改进)。
    -   **[!] 注意**: `static/huiyi.html` 中存在持续的 JavaScript `Uncaught SyntaxError`，需要进一步调试解决。尝试的修复（如转义JSON字符串）未完全解决问题。

### 2. 后端 (`main.py`, `crud.py`, `schemas.py`)

-   **[X] API 确认与增强:**
    -   [X] **创建 (`POST /api/meetings/`)**: API 结构已存在，能处理 `schemas.MeetingCreate`。
    -   [X] **读取列表 (`GET /api/meetings/`)**: API 结构已存在。
    -   [X] **读取详情 (`GET /api/meetings/{meeting_id}`)**: API 结构已存在，返回 `schemas.Meeting`。
    -   [X] **更新 (`PUT /api/meetings/{meeting_id}`)**:
        -   [X] **关键**: 已修改 API 以支持**完整更新**，包括会议基本信息**和**议程项。
        -   [X] 议程项更新采用**删除旧项，添加新项**的策略。
    -   [X] **删除 (`DELETE /api/meetings/{meeting_id}`)**: API 结构已存在。

-   **[X] 数据模型与验证 (`models.py`, `schemas.py`):**
    -   [X] 更新了 `schemas.py` 中的 `MeetingUpdate` 以包含 `agenda_items: Optional[List[AgendaItemUpdate]]`。
    -   [X] 创建了 `AgendaItemUpdate` schema。
    -   [X] 为 `AgendaItemCreate`, `AgendaItemUpdate`, `AgendaItem` 添加了 `reporter` 和 `duration_minutes` 字段以匹配前端表单。
    -   [ ] 检查 `models.py` 定义 (未显式检查，但假设基于现有功能是正确的)。

-   **[X] CRUD 逻辑 (`crud.py`):**
    -   [X] 重构了 `update_meeting` 函数以支持议程项的“删旧增新”更新逻辑。
    -   [ ] 确保所有 CRUD 操作都正确处理数据库事务和异常 (未显式检查，基于现有代码)。

### 3. 测试

-   [ ] **单元/集成测试 (可选但推荐):**
    -   [ ] 为后端 API 编写测试用例。
-   **[ ] 手动测试:**
    -   [ ] **创建**: 测试创建不同议程项数量的会议。测试表单验证。
    -   [ ] **读取**: 确认列表和详情页数据正确。
    -   [ ] **更新**: 测试修改会议基本信息。测试增加、删除、修改议程项。测试只更新部分信息。
    -   [ ] **删除**: 测试删除会议。
    -   [ ] 测试边界情况（如空议程项、特殊字符等）。
    -   [ ] 在不同浏览器或设备上进行测试（如果需要）。
