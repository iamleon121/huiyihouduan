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
        
        // 用户模态框关闭按钮事件绑定
        const closeUserBtn = document.querySelector('#userModal .close');
        const cancelUserBtn = document.getElementById('cancelUserBtn');
        
        if (closeUserBtn) {
            closeUserBtn.addEventListener('click', closeUserModal);
        }
        
        if (cancelUserBtn) {
            cancelUserBtn.addEventListener('click', closeUserModal);
        }
        
        // 用户表单提交事件绑定
        const userForm = document.getElementById('userForm');
        if (userForm) {
            userForm.addEventListener('submit', handleUserFormSubmit);
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
    }
    
    // 系统管理相关函数
    async function fetchUsers() {
        const tableBody = document.querySelector('.system-section:first-child .data-table tbody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-color-light);">加载中...</td></tr>';
        
        try {
            // 模拟从API获取用户数据
            await new Promise(resolve => setTimeout(resolve, 800)); // 模拟网络延迟
            
            // 模拟用户数据
            const users = [
                { id: 1, username: 'admin', name: '管理员', role: 'admin', status: '正常' },
                { id: 2, username: 'user1', name: '张三', role: 'user', status: '正常' },
                { id: 3, username: 'guest', name: '访客', role: 'guest', status: '禁用' }
            ];
            
            let tableBodyHtml = '';
            if (users.length === 0) {
                tableBodyHtml = '<tr><td colspan="5" style="text-align: center; color: var(--text-color-light);">暂无用户数据</td></tr>';
            } else {
                users.forEach(user => {
                    // 根据用户角色显示不同文本
                    let roleText = '未知';
                    switch (user.role) {
                        case 'admin': roleText = '管理员'; break;
                        case 'user': roleText = '普通用户'; break;
                        case 'guest': roleText = '访客'; break;
                    }
                    
                    // 根据状态显示不同类样式
                    const statusClass = user.status === '正常' ? 'status-ongoing' : 'status-finished';
                    
                    tableBodyHtml += `
                        <tr data-id="${user.id}">
                            <td>${user.username || '-'}</td>
                            <td>${user.name || '-'}</td>
                            <td>${roleText}</td>
                            <td><span class="status ${statusClass}">${user.status}</span></td>
                            <td>
                                <button class="btn-action edit" data-id="${user.id}">编辑</button>
                                <button class="btn-action delete" data-id="${user.id}">删除</button>
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
            
        } catch (error) {
            console.error('Failed to load users:', error);
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger-color);">加载用户列表失败: ${error.message}</td></tr>`;
        }
    }
    
    // 用户操作按钮的事件监听器
    function attachUserActionListeners(container) {
        // 编辑按钮
        container.querySelectorAll('.btn-action.edit').forEach(button => {
            button.addEventListener('click', e => {
                const userId = e.target.dataset.id;
                alert(`编辑用户 ID: ${userId} 的功能待实现`);
            });
        });
        
        // 删除按钮
        container.querySelectorAll('.btn-action.delete').forEach(button => {
            button.addEventListener('click', e => {
                const row = e.target.closest('tr');
                const userName = row.querySelector('td:nth-child(2)').textContent;
                const userId = e.target.dataset.id;
                
                if (window.confirm(`确定要删除用户 "${userName}" 吗？`)) {
                    // 模拟删除用户的API调用
                    console.log(`删除用户: ${userName} (ID: ${userId})`);
                    
                    // 模拟成功删除
                    row.remove();
                    
                    // 如果删除后没有数据，显示无数据提示
                    if (document.querySelectorAll('.system-section:first-child .data-table tbody tr').length === 0) {
                        document.querySelector('.system-section:first-child .data-table tbody').innerHTML = 
                            '<tr><td colspan="5" style="text-align: center; color: var(--text-color-light);">暂无用户数据</td></tr>';
                    }
                }
            });
        });
    }
    
    // 打开用户模态框
    function openUserModal() {
        const userModal = document.getElementById('userModal');
        if (userModal) {
            // 重置表单
            document.getElementById('userForm').reset();
            
            // 显示模态框
            userModal.style.display = 'block';
        }
    }
    
    // 关闭用户模态框
    function closeUserModal() {
        const userModal = document.getElementById('userModal');
        if (userModal) {
            userModal.style.display = 'none';
        }
    }
    
    // 处理用户表单提交
    function handleUserFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        
        // 密码验证
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');
        
        if (password !== confirmPassword) {
            alert('两次输入的密码不一致！');
            return;
        }
        
        // 模拟用户创建/更新
        console.log('用户数据:', Object.fromEntries(formData.entries()));
        
        // 模拟成功保存
        setTimeout(() => {
            alert('用户保存成功！');
            closeUserModal();
            fetchUsers(); // 刷新用户列表
        }, 600);
    }
    
    // 处理系统设置表单提交
    function handleSystemSettingsSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        
        // 获取当前选中的主题
        const selectedTheme = document.querySelector('.theme-option.active');
        const themeName = selectedTheme ? selectedTheme.querySelector('span').textContent : '蓝色';
        
        // 构建设置数据对象
        const settingsData = {
            systemName: formData.get('systemName'),
            organizationName: formData.get('organizationName'),
            theme: themeName
        };
        
        // 模拟设置保存
        console.log('系统设置数据:', settingsData);
        
        // 模拟上传Logo（如果有选择文件）
        const logoFile = formData.get('systemLogo');
        if (logoFile && logoFile.name) {
            console.log('Logo文件:', logoFile.name);
        }
        
        // 模拟成功保存
        setTimeout(() => {
            alert('系统设置保存成功！');
        }, 600);
    }
    
    // 主题选择处理
    function handleThemeSelection() {
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
        });
        this.classList.add('active');
        
        // 获取选中的主题颜色值
        const colorPreview = this.querySelector('.color-preview');
        const themeColor = colorPreview ? colorPreview.style.backgroundColor : null;
        
        if (themeColor) {
            console.log('选择的主题颜色:', themeColor);
            // 在实际应用中，这里可以应用主题颜色到整个应用
        }
    }
    
    // 检查登录状态
    function checkLoginStatus() {
        const currentUser = sessionStorage.getItem('currentUser');
        if (!currentUser) {
            // 未登录，重定向到登录页
            window.location.href = '/';
            return;
        }
        
        // 检查是否有管理员权限
        const userInfo = JSON.parse(currentUser);
        if (userInfo.role !== 'admin') {
            // 非管理员，重定向到会议管理页面
            alert('您没有权限访问系统管理页面');
            window.location.href = 'huiyi-meeting.html';
            return;
        }
        
        // 更新用户信息显示
        updateUserInfo(userInfo);
    }
    
    // 更新顶部用户信息显示
    function updateUserInfo(userInfo) {
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
}); 