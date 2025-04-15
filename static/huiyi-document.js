document.addEventListener('DOMContentLoaded', () => {
    // 检查用户登录状态
    checkLoginStatus();
    
    // 页面初始加载
    initDocumentPage();
    
    // 文件管理页面初始化
    function initDocumentPage() {
        fetchFiles();
        
        // 上传文件按钮事件绑定
        const addFileBtn = document.getElementById('add-file-btn');
        if (addFileBtn) {
            addFileBtn.addEventListener('click', openFileModal);
        }
        
        // 文件模态框关闭按钮事件绑定
        const closeFileBtn = document.querySelector('#fileModal .close');
        const cancelFileBtn = document.getElementById('cancelFileBtn');
        
        if (closeFileBtn) {
            closeFileBtn.addEventListener('click', closeFileModal);
        }
        
        if (cancelFileBtn) {
            cancelFileBtn.addEventListener('click', closeFileModal);
        }
        
        // 文件表单提交事件绑定
        const fileForm = document.getElementById('fileForm');
        if (fileForm) {
            fileForm.addEventListener('submit', handleFileFormSubmit);
        }
        
        // 加载关联会议选项
        loadMeetingsForSelect();
    }
    
    // 文件管理相关函数
    async function fetchFiles() {
        const tableBody = document.querySelector('.data-table tbody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-color-light);">加载中...</td></tr>';
        
        try {
            // 模拟从API获取文件数据
            // 实际项目中，这里会是真实的API调用
            await new Promise(resolve => setTimeout(resolve, 800)); // 模拟网络延迟
            
            const files = []; // 模拟空数据
            
            let tableBodyHtml = '';
            if (files.length === 0) {
                tableBodyHtml = '<tr><td colspan="5" style="text-align: center; color: var(--text-color-light);">暂无文件数据</td></tr>';
            } else {
                files.forEach(file => {
                    tableBodyHtml += `
                        <tr data-id="${file.id}">
                            <td>${file.name || '-'}</td>
                            <td>${file.type || '-'}</td>
                            <td>${file.size || '-'}</td>
                            <td>${file.upload_time || '-'}</td>
                            <td>
                                <button class="btn-action view" data-id="${file.id}">查看</button>
                                <button class="btn-action download" data-id="${file.id}">下载</button>
                                <button class="btn-action delete" data-id="${file.id}">删除</button>
                            </td>
                        </tr>
                    `;
                });
            }
            
            tableBody.innerHTML = tableBodyHtml;
            
            // 更新计数
            updatePaginationCount(files.length);
            
            // 附加操作按钮事件
            if (files.length > 0) {
                attachFileActionListeners(tableBody);
            }
            
        } catch (error) {
            console.error('Failed to load files:', error);
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger-color);">加载文件列表失败: ${error.message}</td></tr>`;
        }
    }
    
    // 文件操作按钮的事件监听器
    function attachFileActionListeners(container) {
        // 查看按钮
        container.querySelectorAll('.btn-action.view').forEach(button => {
            button.addEventListener('click', e => {
                const fileId = e.target.dataset.id;
                alert(`查看文件 ID: ${fileId} 的功能待实现`);
            });
        });
        
        // 下载按钮
        container.querySelectorAll('.btn-action.download').forEach(button => {
            button.addEventListener('click', e => {
                const fileId = e.target.dataset.id;
                alert(`下载文件 ID: ${fileId} 的功能待实现`);
            });
        });
        
        // 删除按钮
        container.querySelectorAll('.btn-action.delete').forEach(button => {
            button.addEventListener('click', e => {
                const row = e.target.closest('tr');
                const fileName = row.querySelector('td:first-child').textContent;
                const fileId = e.target.dataset.id;
                
                if (window.confirm(`确定要删除文件 "${fileName}" 吗？`)) {
                    // 模拟删除文件的API调用
                    console.log(`删除文件: ${fileName} (ID: ${fileId})`);
                    // 实际中这里会调用API删除文件
                    
                    // 模拟成功删除
                    row.remove();
                    
                    // 更新计数
                    const currentCount = document.querySelectorAll('.data-table tbody tr').length;
                    updatePaginationCount(currentCount > 0 ? currentCount : 0);
                    
                    // 如果删除后没有数据，显示无数据提示
                    if (currentCount === 0) {
                        document.querySelector('.data-table tbody').innerHTML = 
                            '<tr><td colspan="5" style="text-align: center; color: var(--text-color-light);">暂无文件数据</td></tr>';
                    }
                }
            });
        });
    }
    
    // 打开文件上传模态框
    function openFileModal() {
        const fileModal = document.getElementById('fileModal');
        if (fileModal) {
            // 重置表单
            document.getElementById('fileForm').reset();
            
            // 显示模态框
            fileModal.style.display = 'block';
        }
    }
    
    // 关闭文件上传模态框
    function closeFileModal() {
        const fileModal = document.getElementById('fileModal');
        if (fileModal) {
            fileModal.style.display = 'none';
        }
    }
    
    // 处理文件上传表单提交
    function handleFileFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        
        // 模拟文件上传
        console.log('文件上传数据:', Object.fromEntries(formData.entries()));
        
        // 模拟上传成功
        setTimeout(() => {
            alert('文件上传成功！');
            closeFileModal();
            fetchFiles(); // 刷新文件列表
        }, 800);
    }
    
    // 加载会议选项到下拉菜单
    async function loadMeetingsForSelect() {
        const meetingSelect = document.getElementById('fileMeeting');
        if (!meetingSelect) return;
        
        try {
            // 模拟从API获取会议数据
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 模拟会议数据
            const meetings = [
                { id: 1, title: "2023年政协全体会议" },
                { id: 2, title: "2023年第四季度工作总结会" },
                { id: 3, title: "2024年工作计划讨论会" }
            ];
            
            // 生成选项HTML
            let optionsHtml = '<option value="">-- 不关联会议 --</option>';
            
            meetings.forEach(meeting => {
                optionsHtml += `<option value="${meeting.id}">${meeting.title}</option>`;
            });
            
            // 更新下拉菜单
            meetingSelect.innerHTML = optionsHtml;
            
        } catch (error) {
            console.error('加载会议选项失败:', error);
            meetingSelect.innerHTML = '<option value="">-- 加载失败 --</option>';
        }
    }
    
    // 更新分页计数
    function updatePaginationCount(count) {
        const paginationSpan = document.querySelector('.pagination-container span');
        if (paginationSpan) {
            paginationSpan.textContent = `共 ${count} 条`;
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
        
        // 更新用户信息显示
        updateUserInfo(JSON.parse(currentUser));
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