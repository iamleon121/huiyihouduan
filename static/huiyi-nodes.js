document.addEventListener('DOMContentLoaded', () => {
    // 检查用户登录状态
    checkLoginStatus();

    // 页面初始加载
    initNodesPage();

    // 节点管理页面初始化
    function initNodesPage() {
        // 初始加载
        refreshAll();
        
        // 刷新按钮点击事件
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', refreshAll);
        }
        
        // 退出按钮事件绑定
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
        
        // 定时刷新（每30秒）
        setInterval(refreshAll, 30000);
    }

    // 刷新所有数据
    async function refreshAll() {
        await Promise.all([
            loadNodes(),
            loadActiveMeeting()
        ]);
    }

    // 加载当前进行中的会议信息
    async function loadActiveMeeting() {
        try {
            const response = await fetch('/api/v1/meetings/status/token');
            if (!response.ok) {
                throw new Error('获取会议状态失败');
            }
            
            const data = await response.json();
            const container = document.getElementById('activeMeetingInfo');
            
            // 检查是否有进行中的会议
            let activeMeeting = null;
            if (data.meetings && data.meetings.length > 0) {
                // 查找状态为"进行中"的会议
                activeMeeting = data.meetings.find(meeting => meeting.status === "进行中");
            }
            
            if (!activeMeeting) {
                container.innerHTML = '<div class="no-meeting">暂无进行中的会议</div>';
                return;
            }
            
            // 格式化会议时间
            const meetingTime = new Date(activeMeeting.time);
            const formattedTime = meetingTime.toLocaleString();
            
            // 构建会议信息HTML
            container.innerHTML = `
                <div class="meeting-info">
                    <div class="meeting-header">
                        <div class="meeting-title">${activeMeeting.title}</div>
                        <div class="meeting-id">ID: ${activeMeeting.id}</div>
                    </div>
                    <div class="meeting-details">
                        <div class="meeting-detail-item">
                            <div class="meeting-detail-label">会议时间</div>
                            <div class="meeting-detail-value">${formattedTime}</div>
                        </div>
                        <div class="meeting-detail-item">
                            <div class="meeting-detail-label">议程项数量</div>
                            <div class="meeting-detail-value">${activeMeeting.agenda_items ? activeMeeting.agenda_items.length : 0}</div>
                        </div>
                        <div class="meeting-detail-item">
                            <div class="meeting-detail-label">状态</div>
                            <div class="meeting-detail-value">${activeMeeting.status}</div>
                        </div>
                        <div class="meeting-detail-item">
                            <div class="meeting-detail-label">下载链接</div>
                            <div class="meeting-detail-value">
                                <a href="/api/v1/meetings/${activeMeeting.id}/download-package" target="_blank">下载会议包</a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('加载会议信息错误:', error);
            document.getElementById('activeMeetingInfo').innerHTML = 
                '<div class="no-meeting">获取会议信息失败</div>';
        }
    }

    // 加载节点列表
    async function loadNodes() {
        try {
            const response = await fetch('/api/v1/nodes/list');
            if (!response.ok) {
                throw new Error('获取节点列表失败');
            }
            
            const nodes = await response.json();
            const container = document.getElementById('nodesContainer');
            
            // 更新统计信息
            updateStats(nodes);
            
            if (nodes.length === 0) {
                container.innerHTML = '<div class="no-nodes">暂无注册节点</div>';
                return;
            }
            
            container.innerHTML = '';
            
            nodes.forEach(node => {
                const nodeCard = document.createElement('div');
                nodeCard.className = 'node-card';
                
                const statusClass = node.status === 'online' ? 'status-online' : 'status-offline';
                const lastSeen = formatTime(node.last_seen);
                const uptime = formatDuration(node.uptime);
                
                // 检查节点是否有活动会议
                let activeMeetingInfo = '';
                if (node.active_meeting) {
                    activeMeetingInfo = `
                        <div class="info-item">
                            <div class="info-label">活动会议:</div>
                            <div>${node.active_meeting}</div>
                        </div>
                    `;
                }
                
                nodeCard.innerHTML = `
                    <div class="node-header">
                        <div class="node-id">${node.node_id}</div>
                        <div class="node-status ${statusClass}">${node.status === 'online' ? '在线' : '离线'}</div>
                    </div>
                    <div class="node-info">
                        <div class="info-item">
                            <div class="info-label">地址:</div>
                            <div>${node.address}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">最后活动:</div>
                            <div>${lastSeen}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">运行时长:</div>
                            <div>${uptime}</div>
                        </div>
                        ${activeMeetingInfo}
                    </div>
                `;
                
                container.appendChild(nodeCard);
            });
        } catch (error) {
            console.error('加载节点列表错误:', error);
            document.getElementById('nodesContainer').innerHTML = 
                '<div class="no-nodes">加载节点列表失败</div>';
        }
    }

    // 更新统计信息
    function updateStats(nodes) {
        const totalNodes = nodes.length;
        const onlineNodes = nodes.filter(node => node.status === 'online').length;
        const offlineNodes = totalNodes - onlineNodes;
        
        document.getElementById('totalNodes').textContent = totalNodes;
        document.getElementById('onlineNodes').textContent = onlineNodes;
        document.getElementById('offlineNodes').textContent = offlineNodes;
        document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
    }

    // 格式化时间戳为可读时间
    function formatTime(timestamp) {
        const date = new Date(timestamp * 1000);
        return date.toLocaleString();
    }
    
    // 格式化持续时间
    function formatDuration(seconds) {
        const days = Math.floor(seconds / (24 * 3600));
        const hours = Math.floor((seconds % (24 * 3600)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        let result = '';
        if (days > 0) result += `${days}天 `;
        if (hours > 0 || days > 0) result += `${hours}小时 `;
        result += `${minutes}分钟`;
        
        return result;
    }

    // 检查登录状态
    function checkLoginStatus() {
        // 这里可以添加登录状态检查逻辑
        // 如果未登录，可以重定向到登录页面
    }

    // 处理退出登录
    function handleLogout() {
        // 这里可以添加退出登录逻辑
        window.location.href = '/';
    }

    // 显示提示消息
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        const container = document.getElementById('toast-container');
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                container.removeChild(toast);
            }, 300);
        }, 3000);
    }
});
