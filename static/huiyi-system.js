document.addEventListener('DOMContentLoaded', () => {
    // 检查用户登录状态
    checkLoginStatus();
    
    // 页面初始加载
    initSystemPage();
    
    // 系统管理页面初始化
    function initSystemPage() {
        fetchUsers();
        
        // 新增用户按钮事件绑定
        const addUserBtn = document.getElementById('add-user-btn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', openUserModal);
        }
        
        // 用户表单提交事件绑定
        const userForm = document.getElementById('userForm');
        if (userForm) {
            userForm.addEventListener('submit', handleUserFormSubmit);
        }
        
        // 取消按钮事件绑定
        const cancelUserBtn = document.getElementById('cancelUserBtn');
        if (cancelUserBtn) {
            cancelUserBtn.addEventListener('click', closeUserModal);
        }
        
        // 系统设置表单提交事件绑定
        const systemSettingsForm = document.getElementById('systemSettingsForm');
        if (systemSettingsForm) {
            systemSettingsForm.addEventListener('submit', handleSystemSettingsSubmit);
        }
        
        // 主题选项点击事件绑定
        const themeOptions = document.querySelectorAll('.theme-option');
        themeOptions.forEach(option => {
            option.addEventListener('click', handleThemeSelection);
        });

        // 日志查询按钮事件绑定
        const logQueryBtn = document.querySelector('.log-filters .btn');
        if (logQueryBtn) {
            logQueryBtn.addEventListener('click', fetchLogs);
        }
        
        // 退出按钮事件绑定
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
    }
    
    // 登录状态检查
    function checkLoginStatus() {
        // 从sessionStorage获取当前用户信息
        const currentUser = sessionStorage.getItem('currentUser');
        
        if (!currentUser) {
            // 未登录，重定向到登录页
            window.location.href = '/login.html';
            return;
        }
        
        // 更新用户信息显示
        updateUserInfo(JSON.parse(currentUser));
    }
    
    // 更新用户信息显示
    function updateUserInfo(userInfo) {
        if (!userInfo) return;
        
        const userInfoElem = document.querySelector('.user-info');
        if (userInfoElem) {
            // 添加用户名和退出按钮
            userInfoElem.innerHTML = `
                ${userInfo.username} (${userInfo.role === 'admin' ? '管理员' : '普通用户'})
                <a href="#" id="logoutBtn" style="margin-left: 10px; color: var(--primary-color); text-decoration: none;">退出</a>
            `;

            // 绑定退出按钮事件
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', handleLogout);
            }
        }
    }
    
    // 处理退出登录
    function handleLogout(e) {
        e.preventDefault();
        
        if (confirm('确定要退出登录吗？')) {
            // 清除登录信息
            sessionStorage.removeItem('currentUser');
            
            // 重定向到登录页
            window.location.href = '/';
        }
    }
    
    // 系统管理相关函数
    async function fetchUsers() {
        const tableBody = document.querySelector('.system-section:first-child .data-table tbody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-color-light);">加载中...</td></tr>';
        
        try {
            // 模拟API获取用户数据
            setTimeout(() => {
                // 模拟用户数据
                const users = [
                    {id: 1, username: 'admin', real_name: '系统管理员', role: 'admin', status: '正常'},
                    {id: 2, username: 'user1', real_name: '张三', role: 'user', status: '正常'},
                    {id: 3, username: 'user2', real_name: '李四', role: 'user', status: '正常'}
                ];
                
                let tableBodyHtml = '';
                if (users.length === 0) {
                    tableBodyHtml = '<tr><td colspan="5" style="text-align: center; color: var(--text-color-light);">暂无用户数据</td></tr>';
                } else {
                    users.forEach(user => {
                        // 根据用户角色显示不同文本
                        let roleText = '未知';
                        let roleBadgeClass = '';
                        
                        switch (user.role) {
                            case 'admin': 
                                roleText = '管理员'; 
                                roleBadgeClass = 'role-admin';
                                break;
                            case 'user': 
                                roleText = '普通用户'; 
                                roleBadgeClass = 'role-user';
                                break;
                        }
                        
                        // 根据状态显示不同类样式
                        const statusClass = user.status === '正常' ? 'status-active' : 'status-inactive';
                        
                        tableBodyHtml += `
                            <tr data-id="${user.id}">
                                <td>${user.username || '-'}</td>
                                <td>${user.real_name || '-'}</td>
                                <td><span class="role-badge ${roleBadgeClass}">${roleText}</span></td>
                                <td><span class="user-status ${statusClass}"></span> ${user.status || '正常'}</td>
                                <td>
                                    <button class="btn-action edit" data-id="${user.id}">
                                        <span class="icon">✏️</span> 编辑
                                    </button>
                                    <button class="btn-action delete" data-id="${user.id}">
                                        <span class="icon">🗑️</span> 删除
                                    </button>
                                </td>
                            </tr>
                        `;
                    });
                }
                
                tableBody.innerHTML = tableBodyHtml;
                
                // 附加操作按钮事件
                if (users.length > 0) {
                    attachUserActionListeners(tableBody);
                }
            }, 500);
            
        } catch (error) {
            console.error('Failed to load users:', error);
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger-color);">加载用户列表失败: ${error.message}</td></tr>`;
        }
    }
    
    // 用户操作按钮的事件监听器
    function attachUserActionListeners(container) {
        // 编辑按钮
        container.querySelectorAll('.btn-action.edit').forEach(button => {
            button.addEventListener('click', async e => {
                const userId = e.target.closest('.btn-action').dataset.id;
                try {
                    // 模拟获取用户详情
                    const userRow = e.target.closest('tr');
                    const user = {
                        id: userId,
                        username: userRow.cells[0].textContent,
                        real_name: userRow.cells[1].textContent,
                        email: 'user' + userId + '@example.com',
                        role: userRow.querySelector('.role-badge').textContent === '管理员' ? 'admin' : 'user'
                    };
                    
                    // 填充表单数据
                    const userForm = document.getElementById('userForm');
                    
                    // 隐藏字段存储用户ID
                    document.getElementById('userId').value = user.id;
                    
                    // 设置表单标题
                    const modalTitle = document.getElementById('userModalTitle');
                    if (modalTitle) {
                        modalTitle.textContent = '编辑用户';
                    }
                    
                    // 填充其他表单字段
                    document.getElementById('username').value = user.username || '';
                    document.getElementById('realname').value = user.real_name || '';
                    document.getElementById('email').value = user.email || '';
                    
                    // 清空密码字段
                    document.getElementById('password').value = '';
                    
                    // 编辑时密码可选
                    document.getElementById('password').required = false;
                    
                    // 设置角色选择
                    const roleSelect = document.getElementById('role');
                    if (roleSelect) {
                        roleSelect.value = user.role || 'user';
                    }
                    
                    // 打开模态框
                    openUserModal();
                    
                } catch (error) {
                    console.error('获取用户详情失败:', error);
                    alert(`获取用户详情失败: ${error.message}`);
                }
            });
        });
        
        // 删除按钮
        container.querySelectorAll('.btn-action.delete').forEach(button => {
            button.addEventListener('click', async e => {
                const row = e.target.closest('tr');
                const userId = e.target.closest('.btn-action').dataset.id;
                const userName = row.querySelector('td:nth-child(2)').textContent;
                
                if (window.confirm(`确定要删除用户 "${userName}" 吗？`)) {
                    try {
                        // 模拟删除用户
                        setTimeout(() => {
                            // 成功删除，给用户反馈
                            showToast('用户删除成功！', 'success');
                            
                            // 从DOM中移除行
                            row.remove();
                            
                            // 如果删除后没有数据，显示无数据提示
                            if (document.querySelectorAll('.system-section:first-child .data-table tbody tr').length === 0) {
                                document.querySelector('.system-section:first-child .data-table tbody').innerHTML = 
                                    '<tr><td colspan="5" style="text-align: center; color: var(--text-color-light);">暂无用户数据</td></tr>';
                            }
                        }, 500);
                    } catch (error) {
                        console.error('删除用户失败:', error);
                        showToast(`删除用户失败: ${error.message}`, 'error');
                    }
                }
            });
        });
    }
    
    // 打开用户模态框
    function openUserModal() {
        const modal = document.getElementById('userModal');
        if (modal) {
            // 重置表单
            const form = document.getElementById('userForm');
            if (form && !document.getElementById('userId').value) {
                form.reset();
                
                // 重置表单标题
                const modalTitle = document.getElementById('userModalTitle');
                if (modalTitle) {
                    modalTitle.textContent = '添加用户';
                }
                
                // 新增用户时需要密码
                document.getElementById('password').required = true;
            }
            
            modal.style.display = 'flex';
        }
    }
    
    // 关闭用户模态框
    function closeUserModal() {
        const modal = document.getElementById('userModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    // 处理用户表单提交
    function handleUserFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        
        // 获取用户ID，判断是新增还是编辑
        const userId = document.getElementById('userId').value;
        const isEdit = userId && userId.trim() !== '';
        
        // 获取表单数据
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const realname = document.getElementById('realname').value;
        const email = document.getElementById('email').value;
        const role = document.getElementById('role').value;
        
        // 显示提交中状态
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="icon icon-spin">⏳</span> 保存中...';
        
        // 检查用户名是否已存在
        if (!isEdit) {
            const existingUsers = document.querySelectorAll('.data-table tbody tr');
            let usernameExists = false;
            
            existingUsers.forEach(row => {
                if (row.cells && row.cells[0] && row.cells[0].textContent === username) {
                    usernameExists = true;
                }
            });
            
            if (usernameExists) {
                // 恢复按钮状态
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span class="icon">💾</span> 保存';
                
                // 显示错误提示
                showToast('用户名已存在，请使用其他用户名', 'error');
                return;
            }
        }
        
        // 模拟API请求
        setTimeout(() => {
            try {
                // 成功处理
                showToast(isEdit ? '用户更新成功！' : '用户创建成功！', 'success');
                
                // 关闭模态框
                closeUserModal();
                
                // 模拟添加新用户到表格
                if (!isEdit) {
                    addUserToTable({
                        id: new Date().getTime(), // 模拟生成ID
                        username: username,
                        real_name: realname,
                        email: email,
                        role: role,
                        status: '正常'
                    });
                } else {
                    // 重新获取用户列表
                    fetchUsers();
                }
            } catch (error) {
                console.error('用户操作失败:', error);
                showToast(`操作失败: ${error.message || '未知错误'}`, 'error');
            } finally {
                // 恢复按钮状态
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span class="icon">💾</span> 保存';
            }
        }, 1000);
    }
    
    // 模拟添加用户到表格
    function addUserToTable(user) {
        const tableBody = document.querySelector('.system-section:first-child .data-table tbody');
        const emptyRow = tableBody.querySelector('tr td[colspan="5"]');
        
        if (emptyRow) {
            tableBody.innerHTML = ''; // 清空"暂无数据"行
        }
        
        // 根据用户角色显示不同文本
        let roleText = '未知';
        let roleBadgeClass = '';
        
        switch (user.role) {
            case 'admin': 
                roleText = '管理员'; 
                roleBadgeClass = 'role-admin';
                break;
            case 'user': 
                roleText = '普通用户'; 
                roleBadgeClass = 'role-user';
                break;
        }
        
        // 根据状态显示不同类样式
        const statusClass = user.status === '正常' ? 'status-active' : 'status-inactive';
        
        const newRow = document.createElement('tr');
        newRow.dataset.id = user.id;
        newRow.innerHTML = `
            <td>${user.username || '-'}</td>
            <td>${user.real_name || '-'}</td>
            <td><span class="role-badge ${roleBadgeClass}">${roleText}</span></td>
            <td><span class="user-status ${statusClass}"></span> ${user.status || '正常'}</td>
            <td>
                <button class="btn-action edit" data-id="${user.id}">
                    <span class="icon">✏️</span> 编辑
                </button>
                <button class="btn-action delete" data-id="${user.id}">
                    <span class="icon">🗑️</span> 删除
                </button>
            </td>
        `;
        
        tableBody.appendChild(newRow);
        
        // 添加事件监听器到新的操作按钮
        attachUserActionListeners(newRow);
    }
    
    // 处理系统设置表单提交
    function handleSystemSettingsSubmit(e) {
        e.preventDefault();
        const form = e.target;
        
        // 显示提交中状态
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="icon icon-spin">⏳</span> 保存中...';
        
        // 模拟提交成功
        setTimeout(() => {
            showToast('系统设置已保存！', 'success');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }, 1000);
    }
    
    // 处理主题选择
    function handleThemeSelection(e) {
        const selectedTheme = e.currentTarget;
        
        // 移除所有主题的active类
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
        });
        
        // 给选中的主题添加active类
        selectedTheme.classList.add('active');
        
        // 获取主题颜色
        const themeColor = selectedTheme.querySelector('.color-preview').style.backgroundColor;
        // 实际应用主题颜色的逻辑...
        
        showToast('主题已更改！', 'info');
    }
    
    // 获取系统日志
    function fetchLogs() {
        const logLevel = document.getElementById('logLevel').value;
        const logDate = document.getElementById('logDate').value;
        const logEntries = document.querySelector('.log-entries');
        
        // 显示加载状态
        logEntries.innerHTML = '<p style="color: var(--text-color-light);">获取日志中...</p>';
        
        // 模拟API请求
        setTimeout(() => {
            // 模拟日志数据
            const logs = [
                { time: '2024-06-10 10:15:32', level: 'info', message: '用户 admin 登录系统' },
                { time: '2024-06-10 10:30:21', level: 'info', message: '创建了新会议"市政府季度会议"' },
                { time: '2024-06-10 11:05:15', level: 'warning', message: '用户 user1 尝试访问未授权页面' },
                { time: '2024-06-10 11:15:42', level: 'info', message: '上传了文件 "report.pdf"' },
                { time: '2024-06-10 11:20:55', level: 'error', message: '文件 "plan.docx" 上传失败' }
            ];
            
            // 根据筛选条件过滤日志
            let filteredLogs = [...logs];
            
            if (logLevel) {
                filteredLogs = filteredLogs.filter(log => log.level === logLevel);
            }
            
            // 渲染日志
            if (filteredLogs.length === 0) {
                logEntries.innerHTML = '<p style="color: var(--text-color-light);">暂无匹配的日志数据</p>';
            } else {
                let logHtml = '';
                filteredLogs.forEach(log => {
                    const logClass = log.level === 'error' ? 'color: #d9534f;' : 
                                   log.level === 'warning' ? 'color: #f0ad4e;' : '';
                    
                    logHtml += `<p style="${logClass}">
                        [${log.time}] [${log.level.toUpperCase()}] ${log.message}
                    </p>`;
                });
                
                logEntries.innerHTML = logHtml;
            }
            
        }, 500);
    }
    
    // 显示提示消息
    function showToast(message, type = 'info') {
        // 检查是否已存在Toast容器
        let toastContainer = document.querySelector('.toast-container');
        
        if (!toastContainer) {
            // 创建Toast容器
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
            
            // 添加样式
            const style = document.createElement('style');
            style.textContent = `
                .toast-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                }
                .toast {
                    padding: 12px 20px;
                    margin-bottom: 10px;
                    border-radius: 4px;
                    color: white;
                    display: flex;
                    align-items: center;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.15);
                    animation: toast-in 0.3s ease forwards;
                    max-width: 350px;
                }
                .toast i {
                    margin-right: 10px;
                    font-size: 18px;
                }
                .toast.info {
                    background-color: #17a2b8;
                }
                .toast.success {
                    background-color: #28a745;
                }
                .toast.warning {
                    background-color: #ffc107;
                    color: #212529;
                }
                .toast.error {
                    background-color: #dc3545;
                }
                @keyframes toast-in {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes toast-out {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // 创建Toast元素
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        // 设置图标
        let icon = '';
        switch(type) {
            case 'success': icon = '✅'; break;
            case 'warning': icon = '⚠️'; break;
            case 'error': icon = '❌'; break;
            default: icon = 'ℹ️'; break;
        }
        
        toast.innerHTML = `<span class="icon">${icon}</span> ${message}`;
        toastContainer.appendChild(toast);
        
        // 自动消失
        setTimeout(() => {
            toast.style.animation = 'toast-out 0.3s ease forwards';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }
}); 