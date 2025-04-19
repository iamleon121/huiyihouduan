# 无纸化会议系统前端组件文档

本文档详细描述了无纸化会议系统的前端组件结构、页面布局和交互逻辑。

## 目录

1. [整体架构](#1-整体架构)
2. [共享组件](#2-共享组件)
3. [会议管理页面](#3-会议管理页面)
4. [文件管理页面](#4-文件管理页面)
5. [系统管理页面](#5-系统管理页面)
6. [PDF转JPG页面](#6-pdf转jpg页面)
7. [样式指南](#7-样式指南)
8. [JavaScript模块](#8-javascript模块)

## 1. 整体架构

无纸化会议系统的前端采用传统的 HTML + CSS + JavaScript 架构，未使用前端框架。系统的页面结构如下：

```
static/
├── huiyi-meeting.html     # 会议管理页面
├── huiyi-document.html    # 文件管理页面
├── huiyi-system.html      # 系统管理页面
├── pdf2jpg.html           # PDF转JPG页面
├── index.html             # 首页（文件上传）
├── huiyi.css              # 共享CSS样式
├── huiyi-meeting.js       # 会议管理页面的JavaScript
├── huiyi-document.js      # 文件管理页面的JavaScript
├── huiyi-system.js        # 系统管理页面的JavaScript
├── index.js               # 首页的JavaScript
└── converted_images/      # PDF转换后的图片目录
```

所有页面共享相同的布局结构，包括侧边栏导航、顶部栏和主内容区域。

## 2. 共享组件

### 2.1 页面布局

所有主要页面（会议管理、文件管理、系统管理）共享相同的基本布局结构：

```html
<div class="app-container">
    <!-- 侧边栏 -->
    <aside class="sidebar">
        <div class="sidebar-header">
            <h2>阜新市政协</h2>
        </div>
        <nav class="sidebar-nav">
            <ul>
                <li><a href="huiyi-meeting.html"><span>会议管理</span></a></li>
                <li><a href="huiyi-document.html"><span>文件管理</span></a></li>
                <li><a href="huiyi-system.html"><span>系统管理</span></a></li>
            </ul>
        </nav>
    </aside>

    <!-- 主内容区域包装器 -->
    <div class="main-content-wrapper">
        <!-- 顶部栏 -->
        <header class="top-header">
            <div class="header-title">无纸化会议系统</div>
            <div class="user-info">
                管理员
            </div>
        </header>

        <!-- 主内容区域 -->
        <main class="content-area">
            <!-- 页面特定内容 -->
        </main>
    </div>
</div>
```

### 2.2 模态框

系统中的模态框使用以下结构：

```html
<div id="modalId" class="modal">
    <div class="modal-content">
        <span class="close">&times;</span>
        <h2>模态框标题</h2>
        <!-- 模态框内容 -->
    </div>
</div>
```

模态框的显示和隐藏通过 JavaScript 控制：

```javascript
// 显示模态框
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

// 隐藏模态框
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}
```

### 2.3 表格组件

数据表格使用以下结构：

```html
<div class="table-container">
    <table class="data-table">
        <thead>
            <tr>
                <th>列标题1</th>
                <th>列标题2</th>
                <!-- 更多列标题 -->
                <th>操作</th>
            </tr>
        </thead>
        <tbody>
            <!-- 表格数据行 -->
        </tbody>
    </table>
</div>
```

### 2.4 分页组件

分页控件使用以下结构：

```html
<div class="pagination-container">
    <span>共 X 条</span>
    <select>
        <option>10 条/页</option>
        <option>20 条/页</option>
    </select>
    <button><</button>
    <span>1</span>
    <button>></button>
</div>
```

### 2.5 按钮样式

系统使用以下按钮样式：

- 主要按钮：`btn btn-primary`
- 次要按钮：`btn btn-secondary`
- 轮廓按钮：`btn btn-outline`
- 操作按钮：`btn-action`（用于表格中的操作）

## 3. 会议管理页面

### 3.1 页面结构

会议管理页面 (`huiyi-meeting.html`) 包含以下主要部分：

1. 会议列表区域
2. 会议创建/编辑模态框
3. 会议详情查看模态框

### 3.2 会议列表

会议列表区域包含筛选控件、新增按钮和会议数据表格：

```html
<div class="controls-bar">
    <div class="filters">
        <input type="text" placeholder="会议名称">
        <select>
            <option value="">全部状态</option>
            <option value="未开始">未开始</option>
            <option value="进行中">进行中</option>
            <option value="已结束">已结束</option>
        </select>
        <button class="btn btn-secondary">查询</button>
        <button class="btn btn-outline">重置</button>
    </div>
    <button class="btn btn-primary" id="add-meeting-btn">新增会议</button>
</div>

<div class="table-container">
    <table class="data-table">
        <thead>
            <tr>
                <th>会议ID</th>
                <th>会议名称</th>
                <th>会议时间</th>
                <th>状态</th>
                <th>操作</th>
            </tr>
        </thead>
        <tbody>
            <!-- 会议数据行 -->
        </tbody>
    </table>
</div>
```

### 3.3 会议创建/编辑模态框

会议创建/编辑模态框包含会议基本信息表单和议程项管理：

```html
<div id="meetingModal" class="modal">
    <div class="modal-content">
        <span class="close">&times;</span>
        <h2>新增会议</h2>
        <form id="meetingForm">
            <!-- 会议基本信息 -->
            <div class="form-section">
                <h3>基本信息</h3>
                <div class="form-group">
                    <label for="meetingId">会议ID:</label>
                    <input type="text" id="meetingId" name="id" required>
                </div>
                <div class="form-group">
                    <label for="meetingTitle">会议名称:</label>
                    <input type="text" id="meetingTitle" name="title" required>
                </div>
                <div class="form-group">
                    <label for="meetingIntro">会议介绍:</label>
                    <textarea id="meetingIntro" name="intro"></textarea>
                </div>
                <div class="form-group">
                    <label for="meetingTime">会议时间:</label>
                    <input type="text" id="meetingTime" name="time">
                </div>
            </div>

            <!-- 议程项管理 -->
            <div class="form-section">
                <h3>议程项</h3>
                <div id="agendaItems">
                    <!-- 议程项表单将动态添加 -->
                </div>
                <button type="button" class="btn btn-outline" id="addAgendaItemBtn">添加议程项</button>
            </div>

            <div class="form-actions">
                <button type="submit" class="btn btn-primary">保存</button>
                <button type="button" class="btn btn-secondary" id="cancelMeetingBtn">取消</button>
            </div>
        </form>
    </div>
</div>
```

### 3.4 会议详情查看模态框

会议详情查看模态框用于显示会议的完整信息：

```html
<div id="viewMeetingModal" class="modal">
    <div class="modal-content">
        <span class="close">&times;</span>
        <h2>会议详情</h2>
        <div class="meeting-details">
            <!-- 会议详情内容将动态填充 -->
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" id="closeViewModalBtn">关闭</button>
        </div>
    </div>
</div>
```

### 3.5 JavaScript 功能

会议管理页面的主要 JavaScript 功能包括：

1. 获取会议列表并渲染表格
2. 处理会议创建和编辑
3. 动态管理议程项（添加、删除）
4. 处理会议状态变更（开始、结束、重新开始）
5. 处理会议删除
6. 文件上传和管理

## 4. 文件管理页面

### 4.1 页面结构

文件管理页面 (`huiyi-document.html`) 包含以下主要部分：

1. 文件列表区域
2. 文件上传模态框

### 4.2 文件列表

文件列表区域包含筛选控件和文件数据表格：

```html
<div class="controls-bar">
    <div class="filters">
        <input type="text" id="fileName" placeholder="文件名称">
        <button class="btn btn-secondary"><span class="icon">🔍</span> 查询</button>
        <button class="btn btn-outline"><span class="icon">🔄</span> 重置</button>
    </div>
    <div class="control-panel">
        <button id="cleanup-temp-btn" class="btn btn-secondary"><span class="icon">🧹</span> 一键删除所有可删除文件</button>
        <button id="force-cleanup-temp-btn" class="btn btn-danger"><span class="icon">⚠️</span> 强制清理所有临时文件</button>
    </div>
</div>

<div class="table-container">
    <table class="data-table">
        <thead>
            <tr>
                <th>文件名称</th>
                <th>文件类型</th>
                <th>文件大小</th>
                <th>上传时间</th>
                <th>所属会议</th>
                <th>操作</th>
            </tr>
        </thead>
        <tbody>
            <!-- 文件数据行 -->
        </tbody>
    </table>
</div>

<div class="pagination-container">
    <span>共 0 条</span>
    <select>
        <option>10 条/页</option>
        <option>20 条/页</option>
        <option>50 条/页</option>
    </select>
    <button>&lt;</button>
    <span>1</span>
    <button>&gt;</button>
</div>
```

### 4.3 JavaScript 功能

文件管理页面的主要 JavaScript 功能包括：

1. 获取文件列表并渲染表格
2. 客户端分页功能实现（分页、每页显示数量控制）
3. 处理文件查看、下载和删除
4. 临时文件和可删除文件的清理
5. 更新分页信息和导航按钮状态

#### 4.3.1 分页实现

分页功能通过以下JavaScript实现：

```javascript
// 翻页相关变量
let currentPage = 1;
let pageSize = 10;
let totalItems = 0;

// 初始化翻页事件
function initPaginationEvents() {
    // 上一页按钮
    const prevBtn = document.querySelector('.pagination-container button:nth-child(3)');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                fetchFiles(document.getElementById('fileName').value.trim());
            }
        });
    }

    // 下一页按钮
    const nextBtn = document.querySelector('.pagination-container button:nth-child(5)');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(totalItems / pageSize);
            if (currentPage < totalPages) {
                currentPage++;
                fetchFiles(document.getElementById('fileName').value.trim());
            }
        });
    }

    // 每页显示数量选择框
    const pageSizeSelect = document.querySelector('.pagination-container select');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            pageSize = parseInt(e.target.value);
            currentPage = 1; // 切换每页显示数量时重置到第一页
            fetchFiles(document.getElementById('fileName').value.trim());
        });
    }
}

// 更新分页信息
function updatePagination(total) {
    // 更新总条数
    const countSpan = document.querySelector('.pagination-container > span:first-child');
    if (countSpan) {
        countSpan.textContent = `共 ${total} 条`;
    }
    
    // 更新当前页码
    const pageSpan = document.querySelector('.pagination-container > span:nth-child(4)');
    if (pageSpan) {
        pageSpan.textContent = currentPage;
    }
    
    // 计算总页数
    const totalPages = Math.ceil(total / pageSize);
    
    // 更新上一页按钮状态
    const prevBtn = document.querySelector('.pagination-container button:nth-child(3)');
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }
    
    // 更新下一页按钮状态
    const nextBtn = document.querySelector('.pagination-container button:nth-child(5)');
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages || totalPages === 0;
    }
}
```

## 5. 系统管理页面

### 5.1 页面结构

系统管理页面 (`huiyi-system.html`) 是一个占位页面，目前包含基本的页面结构，但功能尚未实现。

```html
<main class="content-area">
    <h1>系统管理</h1>
    <div class="system-settings">
        <div class="settings-card">
            <h3>用户管理</h3>
            <p>管理系统用户和权限</p>
            <button class="btn btn-primary">进入</button>
        </div>
        <div class="settings-card">
            <h3>系统设置</h3>
            <p>配置系统参数和选项</p>
            <button class="btn btn-primary">进入</button>
        </div>
        <div class="settings-card">
            <h3>日志查询</h3>
            <p>查看系统操作日志</p>
            <button class="btn btn-primary">进入</button>
        </div>
    </div>
</main>
```

## 6. PDF转JPG页面

### 6.1 页面结构

PDF转JPG页面 (`pdf2jpg.html`) 包含文件上传表单和转换结果显示区域：

```html
<div class="container">
    <h1>PDF转JPG工具</h1>
    
    <div class="upload-form">
        <form id="convertForm" enctype="multipart/form-data">
            <div class="form-group">
                <label for="pdfFile">选择PDF文件:</label>
                <input type="file" id="pdfFile" name="file" accept=".pdf" required>
            </div>
            
            <div class="form-group">
                <label for="dpi">DPI设置:</label>
                <input type="number" id="dpi" name="dpi" value="200" min="72" max="600">
            </div>
            
            <div class="form-group">
                <label for="format">输出格式:</label>
                <select id="format" name="format">
                    <option value="jpg">JPG</option>
                    <option value="png">PNG</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>
                    <input type="checkbox" id="merge" name="merge">
                    合并所有页面为一张图片
                </label>
            </div>
            
            <button type="submit" class="btn btn-primary">转换</button>
        </form>
    </div>
    
    <div id="result" class="result-container" style="display: none;">
        <h2>转换结果</h2>
        <div id="imageContainer" class="image-container"></div>
    </div>
</div>
```

### 6.2 JavaScript 功能

PDF转JPG页面的主要 JavaScript 功能包括：

1. 处理文件上传和转换请求
2. 显示转换进度
3. 渲染转换结果图片
4. 提供图片下载功能

## 7. 样式指南

### 7.1 颜色方案

系统使用以下颜色方案：

- 主题色：`#1976d2`（蓝色）
- 次要色：`#f5f5f5`（浅灰色）
- 成功色：`#4caf50`（绿色）
- 警告色：`#ff9800`（橙色）
- 危险色：`#f44336`（红色）
- 文本色：`#333333`（深灰色）
- 浅文本色：`#666666`（中灰色）
- 背景色：`#ffffff`（白色）
- 边框色：`#e0e0e0`（浅灰色）

### 7.2 排版

系统使用以下字体和字号：

- 主要字体：`"Inter", "Noto Sans SC", sans-serif`
- 标题字号：
  - h1: 24px
  - h2: 20px
  - h3: 18px
- 正文字号：14px
- 小字号：12px

### 7.3 间距和布局

- 基础间距单位：8px
- 内边距：16px
- 外边距：16px
- 边框圆角：4px
- 阴影：`0 2px 4px rgba(0, 0, 0, 0.1)`

## 8. JavaScript 模块

### 8.1 共享功能

系统中的共享 JavaScript 功能包括：

- 用户认证和会话管理
- 模态框显示和隐藏
- API 请求封装
- 表单验证
- 错误处理和消息显示

### 8.2 会议管理模块 (huiyi-meeting.js)

会议管理模块包含以下主要功能：

- 会议列表获取和渲染
- 会议创建和编辑
- 议程项管理
- 会议状态控制
- 文件上传和管理

### 8.3 文件管理模块 (huiyi-document.js)

文件管理模块包含以下主要功能：

- 文件列表获取和渲染
- 文件上传
- 文件查看、下载和删除
- 会议关联

### 8.4 系统管理模块 (huiyi-system.js)

系统管理模块目前是一个占位模块，功能尚未实现。

### 8.5 PDF转JPG模块 (pdf2jpg.html 内嵌脚本)

PDF转JPG模块包含以下主要功能：

- 文件上传和验证
- 转换参数设置
- 转换请求处理
- 结果显示和下载
