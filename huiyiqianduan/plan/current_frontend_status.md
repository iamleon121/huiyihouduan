# 无纸化会议系统前端当前状态

本文档详细描述了无纸化会议系统前端的当前状态、实现细节和最近的改进。

## 目录

1. [系统架构](#系统架构)
2. [核心模块](#核心模块)
3. [数据流程](#数据流程)
4. [最近改进](#最近改进)
5. [已知问题](#已知问题)
6. [下一步计划](#下一步计划)

## 系统架构

无纸化会议系统前端采用HTML5+技术开发，主要由以下几个部分组成：

### 页面结构

- **init.html**: 初始化页面，负责系统启动和初始配置
- **service.html**: 服务页面，负责后台数据轮询和状态监控
- **main.html**: 主页面，显示会议信息和提供会议入口
- **list.html**: 会议列表页面，显示会议议题和文件
- **file.html**: 文件查看页面，用于查看会议文档
- **option.html**: 设置页面，用于配置系统参数

### 技术栈

- **UI框架**: 原生HTML/CSS
- **脚本语言**: JavaScript
- **存储**: LocalStorage、HTML5+ FileSystem
- **网络请求**: XMLHttpRequest
- **设备API**: HTML5+ API

## 核心模块

### 1. 初始化模块 (init.js)

初始化模块负责系统启动和初始配置，主要功能包括：

- 检查本地存储是否存在
- 创建默认配置和数据
- 初始化会议状态存储
- 跳转到服务页面

```javascript
// 检查本地存储是否存在
function checkLocalStorage() {
    try {
        // 检查meetingData是否存在
        const meetingData = plus.storage.getItem('meetingData');
        // 检查meetingStatus是否存在
        const statusData = plus.storage.getItem('meetingStatus');
        // 检查option是否存在
        const optionData = plus.storage.getItem('option');

        // 如果option不存在，创建默认option数据
        if (!optionData) {
            createOptionStorage();
        }

        // 检查会议数据和状态数据是否存在
        if (meetingData && statusData) {
            // 如果本地存储存在，直接跳转到service页面
            navigateToService();
        } else {
            // 如果本地存储不存在，直接创建默认数据
            createLocalStorage();
        }
    } catch (e) {
        console.error('检查本地存储失败:', e);
        createLocalStorage();
        createOptionStorage();
    }
}
```

### 2. 服务模块 (service.js)

服务模块是系统的核心，负责与后端通信、数据同步和状态监控，主要功能包括：

- 定期轮询会议状态
- 检测状态变化并触发事件
- 管理本地数据存储
- 处理网络错误和恢复

```javascript
// 设置数据获取定时器
setupStatusTimer: function() {
    // 清除现有的定时器
    if (this.statusTimer) {
        clearInterval(this.statusTimer);
        this.statusTimer = null;
    }

    console.log('设置状态获取定时器，间隔:', this.updateInterval, '毫秒');

    // 状态获取定时器 - 严格按照配置的间隔时间
    this.statusTimer = setInterval(() => {
        if (!this.isServiceEnabled) {
            return; // 如果服务被禁用，直接返回
        }

        // 只在没有正在进行的状态获取时才获取状态
        if (!this.isStatusFetching) {
            console.log('定时器触发，获取会议状态，间隔:', this.updateInterval, '毫秒');
            this.getMeetingStatus();
        }
    }, this.updateInterval); // 严格使用配置的间隔时间
}
```

### 3. 主页面模块 (main.js)

主页面模块负责显示会议信息和提供会议入口，主要功能包括：

- 显示会议标题和介绍
- 显示当前时间
- 提供参加会议入口
- 监听会议状态变化

```javascript
// 初始化主页面
function initMainPage() {
    // 从本地存储获取会议数据
    const meetingData = getMeetingDataFromStorage();
    if (meetingData) {
        // 更新页面显示
        updateMeetingInfo(meetingData);
        // 设置页面事件监听
        setupEventListeners();
    } else {
        console.error('无法获取会议数据');
    }
}
```

### 4. 设置模块 (option.js)

设置模块负责系统配置管理，主要功能包括：

- 服务器地址配置
- 服务器端口配置
- 更新间隔设置
- 标题文字设置
- 配置保存和加载

```javascript
// 保存设置到本地存储
saveSettings: function() {
    try {
        // 从UI获取设置值
        const serverUrlInput = document.getElementById('server-url');
        const serverPortInput = document.getElementById('server-port');
        const updateIntervalInput = document.getElementById('update-interval');
        const titleTextInput = document.getElementById('title-text');

        // 验证输入
        const server = serverUrlInput.value.trim();
        const port = serverPortInput ? serverPortInput.value.trim() : this.defaultSettings.port;
        const intertime = updateIntervalInput.value.trim();
        const titleText = titleTextInput ? titleTextInput.value.trim() : this.defaultSettings.titleText;

        // 更新当前设置
        this.currentSettings = {
            server: server,
            port: port,
            intertime: intertime,
            titleText: titleText
        };

        // 保存到本地存储
        const optionData = {
            option: this.currentSettings
        };

        const settingsString = JSON.stringify(optionData);
        plus.storage.setItem('option', settingsString);
        
        // 立即更新main页面的标题文字
        this.updateMainPageTitle();

        return true;
    } catch (error) {
        console.error('保存设置失败:', error);
        return false;
    }
}
```

## 数据流程

### 启动流程

1. 应用启动，加载init.html
2. init.js检查本地存储
3. 如果本地存储不存在，创建默认数据
4. 跳转到service.html
5. service.js初始化，开始轮询会议状态
6. 跳转到main.html，显示会议信息

### 状态更新流程

1. service.js定期轮询会议状态API
2. 检测到状态变化时，更新本地存储
3. 触发statusChanged事件
4. main.js监听statusChanged事件，更新UI显示

### 设置更新流程

1. 用户在option.html中修改设置
2. 点击保存按钮，option.js将设置保存到本地存储
3. 更新main页面的标题文字
4. service.js在下次初始化时加载新设置

## 最近改进

### 1. 添加会议状态本地存储

为了支持会议状态的监控和同步，我们添加了会议状态的本地存储：

```javascript
// 创建默认会议状态数据
plus.storage.setItem('meetingStatus', JSON.stringify({token: "initial", status: "not_started"}));
```

### 2. 优化状态轮询机制

修改了service.js中的状态轮询机制，使其严格按照配置中设定的间隔时间执行：

```javascript
// 状态获取定时器 - 严格按照配置的间隔时间
this.statusTimer = setInterval(() => {
    if (!this.isServiceEnabled) {
        return; // 如果服务被禁用，直接返回
    }

    // 只在没有正在进行的状态获取时才获取状态
    if (!this.isStatusFetching) {
        console.log('定时器触发，获取会议状态，间隔:', this.updateInterval, '毫秒');
        this.getMeetingStatus();
    }
}, this.updateInterval); // 严格使用配置的间隔时间
```

### 3. 添加端口号设置

在设置页面添加了服务器端口号设置，默认值为8000：

```html
<div class="option-item">
    <label class="option-label" for="server-port">服务器端口</label>
    <input type="number" id="server-port" class="option-input" min="1" max="65535" placeholder="请输入服务器端口">
</div>
```

### 4. 改进页面跳转机制

添加了备用跳转机制，确保即使在网络错误或其他问题的情况下，应用也能从init页面跳转到service页面：

```javascript
// 添加备用跳转机制，确保即使其他方式失败也能跳转
window.onload = function() {
    // 5秒后如果还在init页面，尝试直接跳转
    setTimeout(function() {
        // 检查是否仍然在init页面
        if (document.querySelector('.loading-text')) {
            console.log('备用跳转机制触发，直接跳转到service页面');
            try {
                if (typeof plus !== 'undefined') {
                    plus.webview.open('service.html', 'service');
                } else {
                    window.location.href = 'service.html';
                }
            } catch (e) {
                console.error('备用跳转失败:', e);
                window.location.href = 'service.html';
            }
        }
    }, 5000);
};
```

### 5. 修复UI层叠问题

修复了option页面中设置弹出框被会议标题文字遮挡的问题：

```css
.option-container {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 80%;
    max-width: 500px;
    background-color: rgba(255, 255, 255, 0.9);
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    z-index: 2000; /* 确保设置弹出框在标题文字之上，比logo的z-index更高 */
}
```

## 已知问题

1. **网络错误处理**: 当网络不可用时，状态轮询会持续失败，需要更好的错误处理和重试机制
2. **多设备同步**: 当多个设备同时使用时，可能会出现数据不一致的情况
3. **大文件处理**: 大型会议文件的下载和显示可能会导致性能问题
4. **缓存管理**: 本地缓存的文件可能会占用大量存储空间，需要更好的缓存管理策略

## 下一步计划

1. **实现与后端API的完整集成**: 完成所有API接口的对接，实现真实数据的获取和同步
2. **优化离线支持**: 增强离线模式下的功能，确保在网络不可用时仍能查看会议文档
3. **改进用户界面**: 优化UI设计，提升用户体验
4. **增强安全性**: 实现更安全的数据传输和存储机制
5. **性能优化**: 优化大文件处理和页面渲染性能

更新日期：2025年04月21日
