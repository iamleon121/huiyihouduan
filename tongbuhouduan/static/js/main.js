// 全局变量
let serviceRunning = false;
let connectionStatus = false;
let startTime = null;
let configData = {
    mainServerIp: '192.168.110.10',
    mainServerPort: 80,
    syncInterval: 10
};

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 初始化页面
    initPage();

    // 绑定事件处理函数
    bindEvents();

    // 定时更新状态
    setInterval(updateStatus, 10000);
});

// 初始化页面
function initPage() {
    // 获取节点配置
    fetchConfig();

    // 获取节点状态
    fetchStatus();

    // 更新UI状态
    updateUI();
}

// 绑定事件处理函数
function bindEvents() {
    // 配置表单提交
    document.getElementById('configForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveConfig();
    });

    // 重置配置按钮
    document.getElementById('resetConfig').addEventListener('click', function() {
        resetConfig();
    });

    // 启动服务按钮
    document.getElementById('startService').addEventListener('click', function() {
        startService();
    });

    // 停止服务按钮
    document.getElementById('stopService').addEventListener('click', function() {
        stopService();
    });

    // 关闭通知按钮
    document.getElementById('closeNotification').addEventListener('click', function() {
        hideNotification();
    });
}

// 获取节点配置
function fetchConfig() {
    fetch('/api/config')
        .then(response => {
            if (!response.ok) {
                throw new Error('获取配置失败');
            }
            return response.json();
        })
        .then(data => {
            configData = data;
            updateConfigForm();
        })
        .catch(error => {
            showNotification(error.message, 'error');
            console.error('获取配置错误:', error);
        });
}

// 更新配置表单
function updateConfigForm() {
    document.getElementById('mainServerIp').value = configData.mainServerIp || '192.168.110.10';
    document.getElementById('mainServerPort').value = configData.mainServerPort || 80;
    document.getElementById('syncInterval').value = configData.syncInterval || 10;
}

// 保存配置
function saveConfig() {
    const mainServerIp = document.getElementById('mainServerIp').value.trim();
    const mainServerPort = parseInt(document.getElementById('mainServerPort').value);
    const syncInterval = parseInt(document.getElementById('syncInterval').value);

    if (!mainServerIp) {
        showNotification('请输入主控服务器IP', 'warning');
        return;
    }

    if (isNaN(mainServerPort) || mainServerPort < 1 || mainServerPort > 65535) {
        showNotification('请输入有效的端口号(1-65535)', 'warning');
        return;
    }

    const newConfig = {
        mainServerIp,
        mainServerPort,
        syncInterval
    };

    fetch('/api/config', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(newConfig)
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('保存配置失败');
            }
            return response.json();
        })
        .then(data => {
            configData = newConfig;
            showNotification('配置保存成功', 'success');
        })
        .catch(error => {
            showNotification(error.message, 'error');
            console.error('保存配置错误:', error);
        });
}

// 重置配置
function resetConfig() {
    updateConfigForm();
    showNotification('配置已重置', 'info');
}

// 获取节点状态
function fetchStatus() {
    fetch('/api/status')
        .then(response => {
            if (!response.ok) {
                throw new Error('获取状态失败');
            }
            return response.json();
        })
        .then(data => {
            updateStatusData(data);
        })
        .catch(error => {
            console.error('获取状态错误:', error);
            // 设置连接状态为离线
            connectionStatus = false;
            updateUI();
        });
}

// 更新状态数据
function updateStatusData(data) {
    // 更新节点ID
    document.getElementById('nodeId').textContent = data.node_id || '未知';

    // 更新运行状态
    serviceRunning = data.running || false;

    // 更新连接状态
    connectionStatus = data.connected || false;

    // 更新最近同步时间
    if (data.last_sync) {
        const lastSyncDate = new Date(data.last_sync * 1000);
        document.getElementById('lastSync').textContent = lastSyncDate.toLocaleString();
    } else {
        document.getElementById('lastSync').textContent = '未同步';
    }

    // 更新同步状态
    document.getElementById('syncStatus').textContent = data.sync_status || '未知';

    // 更新会议数量
    document.getElementById('meetingCount').textContent = data.meeting_count || 0;

    // 更新存储空间
    document.getElementById('storageUsage').textContent = formatBytes(data.storage_usage || 0);

    // 更新活动会议
    document.getElementById('activeMeeting').textContent = data.active_meeting || '无';

    // 更新运行时长
    if (data.start_time) {
        startTime = new Date(data.start_time * 1000);
        updateUptime();
    }

    // 更新UI
    updateUI();
}

// 更新UI状态
function updateUI() {
    // 更新运行状态指示器
    const runningStatusEl = document.getElementById('runningStatus');
    const runningIndicator = runningStatusEl.querySelector('.status-indicator');
    const runningText = runningStatusEl.querySelector('.status-text');

    if (serviceRunning) {
        runningIndicator.className = 'status-indicator online';
        runningText.textContent = '运行中';
    } else {
        runningIndicator.className = 'status-indicator offline';
        runningText.textContent = '已停止';
    }

    // 更新连接状态指示器
    const connectionStatusEl = document.getElementById('connectionStatus');
    const connectionIndicator = connectionStatusEl.querySelector('.status-indicator');
    const connectionText = connectionStatusEl.querySelector('.status-text');

    if (connectionStatus) {
        connectionIndicator.className = 'status-indicator online';
        connectionText.textContent = '已连接';
    } else {
        connectionIndicator.className = 'status-indicator offline';
        connectionText.textContent = '未连接';
    }

    // 更新按钮状态
    document.getElementById('startService').disabled = serviceRunning;
    document.getElementById('stopService').disabled = !serviceRunning;
}

// 启动服务
function startService() {
    fetch('/api/service/start', {
        method: 'POST'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('启动服务失败');
            }
            return response.json();
        })
        .then(data => {
            serviceRunning = true;
            updateUI();
            showNotification('服务已启动', 'success');
            fetchStatus();
        })
        .catch(error => {
            showNotification(error.message, 'error');
            console.error('启动服务错误:', error);
        });
}

// 停止服务
function stopService() {
    fetch('/api/service/stop', {
        method: 'POST'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('停止服务失败');
            }
            return response.json();
        })
        .then(data => {
            serviceRunning = false;
            updateUI();
            showNotification('服务已停止', 'warning');
            fetchStatus();
        })
        .catch(error => {
            showNotification(error.message, 'error');
            console.error('停止服务错误:', error);
        });
}

// 更新状态
function updateStatus() {
    fetchStatus();
    if (startTime) {
        updateUptime();
    }
}

// 更新运行时长
function updateUptime() {
    if (!startTime) return;

    const now = new Date();
    const diff = now - startTime;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    let uptimeText = '';
    if (days > 0) {
        uptimeText += `${days}天 `;
    }
    if (hours > 0 || days > 0) {
        uptimeText += `${hours}小时 `;
    }
    uptimeText += `${minutes}分钟`;

    document.getElementById('uptime').textContent = uptimeText;
}

// 显示通知
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notificationMessage');

    notification.className = 'notification ' + type;
    notificationMessage.textContent = message;

    // 移除隐藏类
    notification.classList.remove('hidden');

    // 5秒后自动隐藏
    setTimeout(hideNotification, 5000);
}

// 隐藏通知
function hideNotification() {
    const notification = document.getElementById('notification');
    notification.classList.add('hidden');
}

// 格式化字节数
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
