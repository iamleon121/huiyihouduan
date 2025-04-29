document.addEventListener('DOMContentLoaded', () => {
    // 检查用户登录状态
    checkLoginStatus();

    // 页面初始加载
    initSystemPage();

    // 系统管理页面初始化
    function initSystemPage() {
        fetchUsers();
        loadSystemSettings();

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

        // 退出按钮事件绑定
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }

        // PDF分辨率保存按钮事件绑定
        const savePdfResolutionBtn = document.getElementById('savePdfResolution');
        if (savePdfResolutionBtn) {
            savePdfResolutionBtn.addEventListener('click', savePdfResolution);
        }
    }

    // 加载系统设置
    async function loadSystemSettings() {
        try {
            // 加载PDF分辨率设置
            const response = await fetch('/api/v1/maintenance/settings/default_pdf_jpg_width');
            if (response.ok) {
                const data = await response.json();
                // 设置下拉框的默认值
                const resolutionSelect = document.getElementById('pdfResolution');
                if (resolutionSelect && data.value) {
                    resolutionSelect.value = data.value;
                }
            }
        } catch (error) {
            console.error('加载系统设置失败:', error);
            showToast('加载系统设置失败', 'error');
        }
    }

    // 保存PDF分辨率设置
    async function savePdfResolution() {
        const resolutionSelect = document.getElementById('pdfResolution');
        if (!resolutionSelect) return;

        const resolution = resolutionSelect.value;

        try {
            const response = await fetch('/api/v1/maintenance/settings/default_pdf_jpg_width', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ value: resolution })
            });

            if (response.ok) {
                showToast('PDF分辨率设置已保存', 'success');
            } else {
                throw new Error('保存设置失败');
            }
        } catch (error) {
            console.error('保存系统设置失败:', error);
            showToast('保存系统设置失败', 'error');
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
            // 从后端API获取用户数据
            const response = await fetch('/api/v1/users/');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const users = await response.json();

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

                    // 判断是否为admin用户
                    const isAdmin = user.username === 'admin';

                    tableBodyHtml += `
                        <tr data-id="${user.id}" ${isAdmin ? 'class="admin-user"' : ''}>
                            <td>${user.username || '-'} ${isAdmin ? '<span class="admin-badge">系统管理员</span>' : ''}</td>
                            <td>${user.real_name || '-'}</td>
                            <td><span class="role-badge ${roleBadgeClass}">${roleText}</span></td>
                            <td><span class="user-status ${statusClass}"></span> ${user.status || '正常'}</td>
                            <td>
                                <button class="btn-action edit" data-id="${user.id}">
                                    编辑
                                </button>
                                <button class="btn-action delete" data-id="${user.id}" ${isAdmin ? 'data-admin="true"' : ''}>
                                    删除
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
                    // 从后端获取用户详情
                    const response = await fetch(`/api/v1/users/${userId}`);

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const user = await response.json();

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
                    const usernameInput = document.getElementById('username');
                    const realnameInput = document.getElementById('realname');
                    const emailInput = document.getElementById('email');
                    const roleSelect = document.getElementById('role');

                    usernameInput.value = user.username || '';
                    realnameInput.value = user.real_name || '';
                    emailInput.value = user.email || '';

                    // 清空密码字段
                    document.getElementById('password').value = '';

                    // 编辑时密码可选
                    document.getElementById('password').required = false;

                    // 如果是admin用户，只允许修改密码和邮箱
                    if (user.username === 'admin') {
                        // 禁用用户名、姓名和角色选择
                        usernameInput.disabled = true;
                        realnameInput.disabled = true;
                        emailInput.disabled = false; // 允许编辑邮箱
                        roleSelect.disabled = true;

                        // 显示提示信息
                        showToast('admin用户只能修改密码和邮箱', 'info');
                    } else {
                        // 非admin用户可以编辑所有字段
                        usernameInput.disabled = false;
                        realnameInput.disabled = false;
                        emailInput.disabled = false;
                        roleSelect.disabled = false;
                    }

                    // 设置角色选择
                    if (roleSelect) {
                        roleSelect.value = user.role || 'user';
                    }

                    // 打开模态框
                    openUserModal();

                } catch (error) {
                    console.error('获取用户详情失败:', error);
                    showToast(`获取用户详情失败: ${error.message}`, 'error');
                }
            });
        });

        // 删除按钮
        container.querySelectorAll('.btn-action.delete').forEach(button => {
            button.addEventListener('click', async e => {
                const row = e.target.closest('tr');
                const userId = e.target.closest('.btn-action').dataset.id;
                const isAdmin = button.hasAttribute('data-admin');
                const userName = row.querySelector('td:nth-child(2)').textContent;

                // 如果是admin用户，显示警告提示
                if (isAdmin) {
                    showToast('admin用户不能被删除', 'warning');
                    return;
                }

                if (window.confirm(`确定要删除用户 "${userName}" 吗？`)) {
                    try {
                        // 调用后端API删除用户
                        const response = await fetch(`/api/v1/users/${userId}`, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });

                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }

                        // 成功删除，给用户反馈
                        showToast('用户删除成功！', 'success');

                        // 从DOM中移除行
                        row.remove();

                        // 如果删除后没有数据，显示无数据提示
                        if (document.querySelectorAll('.system-section:first-child .data-table tbody tr').length === 0) {
                            document.querySelector('.system-section:first-child .data-table tbody').innerHTML =
                                '<tr><td colspan="5" style="text-align: center; color: var(--text-color-light);">暂无用户数据</td></tr>';
                        }
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

                // 确保所有输入框都是启用状态
                document.getElementById('username').disabled = false;
                document.getElementById('realname').disabled = false;
                document.getElementById('email').disabled = false;
                document.getElementById('role').disabled = false;

                // 清空所有输入框，确保没有默认值
                document.getElementById('username').value = '';
                document.getElementById('realname').value = '';
                document.getElementById('email').value = '';
                document.getElementById('password').value = '';
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
    async function handleUserFormSubmit(e) {
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
        submitBtn.innerHTML = '保存中...';

        try {
            // 准备请求数据
            let userData = {};

            // 如果是admin用户且是编辑操作，只允许修改密码和邮箱
            if (isEdit && username === 'admin') {
                // 包含密码和邮箱字段
                userData = {
                    email: email // 允许编辑邮箱
                };

                // 如果提供了密码，添加到请求数据中
                if (password) {
                    userData.password = password;
                }
            } else {
                // 非admin用户或新建用户，包含所有字段
                userData = {
                    username: username,
                    real_name: realname,
                    role: role
                };

                // 如果提供了密码，添加到请求数据中
                if (password) {
                    userData.password = password;
                }
            }

            // 准备请求配置
            const requestOptions = {
                method: isEdit ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            };

            // 发送请求
            const url = isEdit ? `/api/v1/users/${userId}` : '/api/v1/users/';
            const response = await fetch(url, requestOptions);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            // 成功处理
            showToast(isEdit ? '用户更新成功！' : '用户创建成功！', 'success');

            // 关闭模态框
            closeUserModal();

            // 重新获取用户列表显示最新数据
            fetchUsers();

        } catch (error) {
            console.error('用户操作失败:', error);
            showToast(`操作失败: ${error.message || '未知错误'}`, 'error');
        } finally {
            // 恢复按钮状态
            submitBtn.disabled = false;
            submitBtn.innerHTML = '保存';
        }
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

        // 不使用图标
        let icon = '';

        toast.innerHTML = `${message}`;
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
