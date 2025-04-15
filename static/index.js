document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // 处理登录表单提交
    function handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        // 简单验证
        if (!username || !password) {
            showError('请输入用户名和密码');
            return;
        }
        
        // 模拟登录验证
        if (simulateLogin(username, password)) {
            // 登录成功
            window.location.href = '/static/huiyi-meeting.html';
        } else {
            // 登录失败
            showError('用户名或密码错误');
        }
    }
    
    // 模拟登录验证
    function simulateLogin(username, password) {
        // 这里是模拟的用户验证
        // 在实际应用中，这里应该发送请求到服务器验证用户凭据
        
        // 模拟的用户数据
        const users = [
            { username: 'admin', password: 'admin123', role: 'admin' },
            { username: 'user', password: 'user123', role: 'user' }
        ];
        
        // 查找匹配的用户
        const user = users.find(u => u.username === username && u.password === password);
        
        if (user) {
            // 将用户信息存储在sessionStorage中
            sessionStorage.setItem('currentUser', JSON.stringify({
                username: user.username,
                role: user.role
            }));
            return true;
        }
        
        return false;
    }
    
    // 显示错误信息
    function showError(message) {
        // 检查是否已存在错误提示元素
        let errorElement = document.querySelector('.login-error');
        
        if (!errorElement) {
            // 创建错误提示元素
            errorElement = document.createElement('div');
            errorElement.className = 'login-error';
            errorElement.style.backgroundColor = 'rgba(220, 53, 69, 0.1)';
            errorElement.style.color = '#dc3545';
            errorElement.style.padding = '10px';
            errorElement.style.borderRadius = 'var(--border-radius)';
            errorElement.style.marginBottom = '15px';
            errorElement.style.textAlign = 'center';
            
            // 插入到表单前面
            loginForm.insertAdjacentElement('afterbegin', errorElement);
        }
        
        // 设置错误信息
        errorElement.textContent = message;
        
        // 添加动画效果（轻微抖动）
        errorElement.style.animation = 'shake 0.5s';
        
        // 定义抖动动画
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                20%, 40%, 60%, 80% { transform: translateX(5px); }
            }
        `;
        document.head.appendChild(style);
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