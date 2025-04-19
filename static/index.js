document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // 处理登录表单提交
    async function handleLogin(e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        // 简单验证
        if (!username || !password) {
            showError('请输入用户名和密码');
            return;
        }

        try {
            // 创建表单数据
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);

            // 显示加载状态
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = '登录中...';

            // 调用登录API
            const response = await fetch('/api/v1/users/login', {
                method: 'POST',
                body: formData
            });

            // 恢复按钮状态
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `登录失败，状态码: ${response.status}`);
            }

            // 获取用户信息
            const userData = await response.json();

            // 登录成功，保存用户信息到sessionStorage
            sessionStorage.setItem('currentUser', JSON.stringify({
                username: userData.username,
                role: userData.role
            }));

            // 跳转到会议管理页面
            window.location.href = '/static/huiyi-meeting.html';
        } catch (error) {
            console.error('登录失败:', error);
            showError(`登录失败: ${error.message}`);
        }
    }

    // 显示错误消息
    function showError(message) {
        // 检查是否已存在错误消息元素
        let errorElement = document.querySelector('.login-error');

        // 如果不存在，创建一个
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'login-error';
            errorElement.style.color = '#dc3545';
            errorElement.style.margin = '10px 0';
            errorElement.style.textAlign = 'center';

            // 插入到表单前面
            loginForm.prepend(errorElement);
        }

        // 设置错误消息
        errorElement.textContent = message;

        // 3秒后自动清除错误消息
        setTimeout(() => {
            errorElement.textContent = '';
        }, 3000);
    }

    // 检查是否已登录，如果已登录则直接跳转到系统主页
    function checkLoginStatus() {
        const currentUser = sessionStorage.getItem('currentUser');
        if (currentUser) {
            window.location.href = '/static/huiyi-meeting.html';
        }
    }

    // 页面加载时检查登录状态
    checkLoginStatus();
});