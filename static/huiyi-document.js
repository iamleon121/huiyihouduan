document.addEventListener('DOMContentLoaded', () => {
    // 检查用户登录状态
    checkLoginStatus();

    // 翻页相关变量
    let currentPage = 1;
    let pageSize = 10;
    let totalItems = 0;

    // 页面初始加载
    initDocumentPage();

    // 文件管理页面初始化
    function initDocumentPage() {
        fetchFiles();

        // 获取临时文件数量并更新按钮
        fetchTempFilesCount();

        // 清理临时文件按钮事件绑定
        const cleanupTempBtn = document.getElementById('cleanup-temp-btn');
        if (cleanupTempBtn) {
            console.log('绑定清理临时文件按钮事件');
            cleanupTempBtn.addEventListener('click', handleCleanupTempFiles);
        } else {
            console.error('未找到清理临时文件按钮元素');
        }

        // 强制清理临时文件按钮事件绑定
        const forceCleanupTempBtn = document.getElementById('force-cleanup-temp-btn');
        if (forceCleanupTempBtn) {
            console.log('绑定强制清理临时文件按钮事件');
            forceCleanupTempBtn.addEventListener('click', handleForceCleanupTempFiles);
        } else {
            console.error('未找到强制清理临时文件按钮元素');
        }

        // 查询和重置按钮事件绑定
        const queryBtn = document.querySelector('.filters .btn-secondary');
        if (queryBtn) {
            queryBtn.addEventListener('click', handleQueryFiles);
        }

        const resetBtn = document.querySelector('.filters .btn-outline');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                // 重置查询输入
                document.getElementById('fileName').value = '';
                // 重新加载所有文件
                currentPage = 1; // 重置为第一页
                fetchFiles();
            });
        }

        // 绑定翻页按钮事件
        initPaginationEvents();
    }

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

            // 设置默认选中值
            pageSizeSelect.innerHTML = `
                <option value="10" ${pageSize === 10 ? 'selected' : ''}>10 条/页</option>
                <option value="20" ${pageSize === 20 ? 'selected' : ''}>20 条/页</option>
                <option value="50" ${pageSize === 50 ? 'selected' : ''}>50 条/页</option>
            `;
        }
    }

    // 文件查询功能
    function handleQueryFiles() {
        const nameFilter = document.getElementById('fileName').value.trim();

        // 重置到第一页，使用过滤条件执行查询
        currentPage = 1;
        fetchFiles(nameFilter);
    }

    // 获取临时文件数量
    async function fetchTempFilesCount() {
        try {
            const response = await fetch('/api/v1/maintenance/temp-files-count');
            if (!response.ok) {
                console.error('获取临时文件数量失败', response.status);
                return;
            }

            const data = await response.json();
            console.log('临时文件数量', data);

            // 更新清理按钮的文本
            const cleanupTempBtn = document.getElementById('cleanup-temp-btn');
            if (cleanupTempBtn && data.count !== undefined) {
                cleanupTempBtn.textContent = `一键删除所有可删除文件 (${data.count})`;
            }

            // 更新强制清理按钮的文本
            const forceCleanupTempBtn = document.getElementById('force-cleanup-temp-btn');
            if (forceCleanupTempBtn && data.count !== undefined) {
                forceCleanupTempBtn.textContent = `强制清理所有临时文件 (${data.count})`;
            }
        } catch (error) {
            console.error('获取临时文件数量出错:', error);
        }
    }

    // 文件管理相关函数
    async function fetchFiles(nameFilter = '') {
        const tableBody = document.querySelector('.data-table tbody');
        if (!tableBody) return;

        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-color-light);">加载中...</td></tr>';

        try {
            // 从API获取文件数据 - 先获取所有数据，然后在客户端进行分页
            const response = await fetch('/api/v1/documents/');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            let allFiles = data.documents || [];

            // 处理文件URL - 从file.url中提取正确的相对路径
            allFiles = allFiles.map(file => {
                if (file.url) {
                    // 检查是否是file://开头的本地文件系统路径
                    if (file.url.startsWith('file:///')) {
                        // 从文件URL中提取uploads相关路径
                        const match = file.url.match(/uploads[\/\\](.+)/i);
                        if (match) {
                            // 构造正确的相对路径URL
                            file.relative_url = '/uploads/' + match[1].replace(/\\/g, '/');
                            // 同时更新原始url属性，确保所有地方都使用正确的URL
                            file.url = file.relative_url;
                        } else if (file.path) {
                            // 如果无法从文件URL中提取，尝试使用path属性
                            const pathMatch = file.path.match(/uploads[\/\\](.+)/i);
                            if (pathMatch) {
                                file.relative_url = '/uploads/' + pathMatch[1].replace(/\\/g, '/');
                                file.url = file.relative_url;
                            } else {
                                // 如果还是无法提取，尝试使用文件名
                                const pathParts = file.path.split(/[\/\\]/);
                                const fileName = pathParts[pathParts.length - 1];
                                file.relative_url = `/uploads/temp/${fileName}`;
                                file.url = file.relative_url;
                            }
                        } else {
                            // 如果无法解析，则使用默认值
                            file.relative_url = '#';
                            file.url = '#';
                        }
                    } else if (!file.url.startsWith('/') && !file.url.startsWith('http')) {
                        // 如果不是以/或http开头，添加/前缀
                        file.relative_url = '/' + file.url;
                        file.url = file.relative_url;
                    } else {
                        // 如果已经是网络路径，则保持原样
                        file.relative_url = file.url;
                    }
                } else if (file.path) {
                    // 如果没有URL但有path，尝试从路径构造URL
                    const pathMatch = file.path.match(/uploads[\/\\](.+)/i);
                    if (pathMatch) {
                        file.relative_url = '/uploads/' + pathMatch[1].replace(/\\/g, '/');
                        file.url = file.relative_url;
                    } else {
                        file.relative_url = '#';
                        file.url = '#';
                    }
                } else {
                    file.relative_url = '#';
                    file.url = '#';
                }
                return file;
            });

            // 客户端筛选
            let filteredFiles = allFiles;
            if (nameFilter) {
                filteredFiles = allFiles.filter(file =>
                    file.name && file.name.toLowerCase().includes(nameFilter.toLowerCase())
                );
            }

            // 更新总条数
            totalItems = filteredFiles.length;

            // 客户端分页
            const startIndex = (currentPage - 1) * pageSize;
            const endIndex = Math.min(startIndex + pageSize, filteredFiles.length);
            const files = filteredFiles.slice(startIndex, endIndex);

            // 统计可删除文件数量
            const deletableFilesCount = allFiles.filter(f => f.is_deletable).length;

            // 更新一键删除按钮文本
            const cleanupTempBtn = document.getElementById('cleanup-temp-btn');
            if (cleanupTempBtn) {
                cleanupTempBtn.textContent = `一键删除所有可删除文件 (${deletableFilesCount})`;
            }

            // 显示查询条件提示
            let tableBodyHtml = '';
            if (nameFilter) {
                const queryMessage = `当前查询条件: 文件名包含 "${nameFilter}" (共 ${totalItems} 条结果)`;
                tableBodyHtml += `<tr><td colspan="6" style="text-align: left; color: var(--primary-color); padding: 8px; background-color: #f5f5f5;">${queryMessage}</td></tr>`;
            }

            if (files.length === 0) {
                tableBodyHtml += '<tr><td colspan="6" style="text-align: center; color: var(--text-color-light);">暂无文件数据</td></tr>';
            } else {
                files.forEach(file => {
                    // 根据is_deletable决定删除按钮的禁用状态
                    const isDisabled = !file.is_deletable;
                    const disabledClass = isDisabled ? 'disabled' : '';
                    const disabledTitle = isDisabled ? 'title="此文件正在被会议使用，不能直接删除"' : '';

                    // 根据文件状态添加不同的标记
                    let statusClass = '';
                    let statusTitle = '';
                    let statusIndicator = '';

                    // 显示各种文件状态标记
                    if (file.file_status === "使用中") {
                        statusClass = 'in-use';
                        statusTitle = '此文件正在被会议使用';
                        statusIndicator = `<span class="status-badge ${statusClass}" title="${statusTitle}">${file.file_status}</span>`;
                    } else if (file.file_status === "会议已删除") {
                        statusClass = 'deleted-meeting';
                        statusTitle = '此文件所属会议已被删除';
                        statusIndicator = `<span class="status-badge ${statusClass}" title="${statusTitle}">${file.file_status}</span>`;
                    } else if (file.file_status === "已解绑") {
                        statusClass = 'unlinked';
                        statusTitle = '此文件已从会议的文件列表中移除';
                        statusIndicator = `<span class="status-badge ${statusClass}" title="${statusTitle}">${file.file_status}</span>`;
                    } else if (file.file_status === "临时文件") {
                        statusClass = 'temp-file';
                        statusTitle = '此文件是临时上传的文件，尚未关联到任何会议';
                        statusIndicator = `<span class="status-badge ${statusClass}" title="${statusTitle}">${file.file_status}</span>`;
                    }

                    // 构造带有状态标记的文件名和正确的URL路径
                    let fileUrl = file.url;
                    // 处理文件URL - 将file:///本地路径转换为相对路径
                    if (fileUrl && fileUrl.startsWith('file:///')) {
                        // 提取uploads及之后的部分
                        const match = fileUrl.match(/uploads[\/\\](.+)/i);
                        if (match) {
                            // 构造正确的相对路径URL
                            fileUrl = '/uploads/' + match[1].replace(/\\/g, '/');
                        } else {
                            // 如果无法提取，尝试使用path属性中的文件名
                            const pathParts = file.path ? file.path.split(/[\/\\]/) : [];
                            const fileName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : '';
                            if (fileName) {
                                fileUrl = `/uploads/temp/${fileName}`;
                            }
                        }
                    } else if (fileUrl && !fileUrl.startsWith('/')) {
                        // 如果URL不是以/开头，添加/前缀
                        fileUrl = '/' + fileUrl;
                    }

                    tableBodyHtml += `
                        <tr data-id="${file.id}" data-url="${file.url}" data-deletable="${file.is_deletable}">
                            <td>${file.name || '-'} ${statusIndicator}</td>
                            <td>${file.type || '-'}</td>
                            <td>${file.size_formatted || '-'}</td>
                            <td>${file.upload_time || '-'}</td>
                            <td>${file.meeting_title || '未绑定任何会议'}</td>
                            <td>
                                <a href="${fileUrl}" target="_blank" class="btn-action view">查看</a>
                                <button class="btn-action download" data-id="${file.id}" data-url="${fileUrl}">下载</button>
                                <button class="btn-action delete ${disabledClass}" data-id="${file.id}" ${disabledTitle}>删除</button>
                            </td>
                        </tr>
                    `;
                });
            }

            tableBody.innerHTML = tableBodyHtml;

            // 更新分页信息
            updatePagination(totalItems);

            // 附加操作按钮事件
            if (files.length > 0) {
                attachFileActionListeners(tableBody);
            }

        } catch (error) {
            console.error('Failed to load files:', error);
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger-color);">加载文件列表失败: ${error.message}</td></tr>`;
        }
    }

    // 处理删除未绑定文件
    async function handleDeleteUnboundFiles() {
        if (!confirm("确定要删除所有未绑定会议的文件吗？这个操作不可恢复！")) {
            return;
        }

        try {
            // 使用新的API端点
            const response = await fetch('/api/v1/documents/deletable', {
                method: 'DELETE'
            });

            if (!response.ok) {
                // 解析错误响应
                const errorData = await response.json();
                throw new Error(errorData.message || `删除失败，状态码: ${response.status}`);
            }

            const data = await response.json();

            // 创建详细的结果消息
            let resultMessage = data.message || "删除操作完成";
            if (data.deleted_files && data.deleted_files.length > 0) {
                resultMessage += `\n\n删除的文件 (${data.deleted_files.length}个):\n`;
                data.deleted_files.slice(0, 10).forEach(file => {
                    resultMessage += `- ${file.name}\n`;
                });

                if (data.deleted_files.length > 10) {
                    resultMessage += `... 以及其他 ${data.deleted_files.length - 10} 个文件\n`;
                }
            }

            if (data.errors && data.errors.length > 0) {
                resultMessage += `\n\n删除失败的文件 (${data.errors.length}个):\n`;
                data.errors.forEach(error => {
                    resultMessage += `- ${error.file}: ${error.error}\n`;
                });
            }

            alert(resultMessage);
            fetchFiles(); // 重新加载文件列表
            fetchTempFilesCount(); // 更新临时文件数量
        } catch (error) {
            console.error("删除未绑定文件失败:", error);
            alert(`删除未绑定文件失败: ${error.message || error}`);
        }
    }

    // 文件操作按钮的事件监听器
    function attachFileActionListeners(container) {
        // 下载按钮
        container.querySelectorAll('.btn-action.download').forEach(button => {
            button.addEventListener('click', e => {
                let fileUrl = e.target.dataset.url;
                if (fileUrl) {
                    // 确保文件URL是正确的相对路径
                    if (fileUrl.startsWith('file:///')) {
                        fileUrl = convertFilePathToWebUrl(fileUrl);
                    }

                    // 模拟下载链接点击
                    const link = document.createElement('a');
                    link.href = fileUrl;
                    link.download = '';
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } else {
                    alert('无法下载文件，文件URL不存在');
                }
            });
        });

        // 删除按钮
        container.querySelectorAll('.btn-action.delete').forEach(button => {
            button.addEventListener('click', async e => {
                if (e.target.classList.contains('disabled')) {
                    alert('该文件正在被会议使用，不能直接删除');
                    return;
                }

                const fileId = e.target.dataset.id;
                const fileName = e.target.closest('tr').querySelector('td:first-child').textContent.trim();

                if (confirm(`确定要删除文件 "${fileName}" 吗？此操作不可撤销！`)) {
                    try {
                        // 调用删除API
                        const response = await fetch(`/api/v1/documents/${fileId}`, {
                            method: 'DELETE'
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.message || errorData.detail || `删除失败 (${response.status})`);
                        }

                        // 删除成功，从表格中移除该行
                        e.target.closest('tr').remove();

                        // 显示成功消息
                        alert(`文件 "${fileName}" 已成功删除`);

                        // 重新获取文件列表和临时文件数量
                        totalItems = Math.max(0, totalItems - 1); // 减少总数，确保不会小于0

                        // 如果当前页已经没有数据了，且不是第一页，则回到上一页
                        const tableRows = document.querySelectorAll('.data-table tbody tr:not([class*="query-info"])');
                        if (tableRows.length <= 1 && currentPage > 1) {
                            currentPage--;
                        }

                        fetchFiles(document.getElementById('fileName').value.trim());
                        fetchTempFilesCount();
                    } catch (error) {
                        console.error('文件删除失败:', error);
                        alert(`文件删除失败: ${error.message}`);
                    }
                }
            });
        });
    }

    // 处理清理临时文件（现在是删除所有可删除文件）
    async function handleCleanupTempFiles() {
        if (!confirm("确定要删除所有可删除的文件吗？这个操作不可恢复！")) {
            return;
        }

        // 禁用按钮，防止重复点击
        const cleanupTempBtn = document.getElementById('cleanup-temp-btn');
        if (cleanupTempBtn) {
            cleanupTempBtn.disabled = true;
            cleanupTempBtn.textContent = "正在删除...";
        }

        try {
            // 调用新的API端点
            const response = await fetch('/api/v1/documents/deletable', {
                method: 'DELETE'
            });

            if (!response.ok) {
                // 解析错误响应
                const errorData = await response.json();
                throw new Error(errorData.message || `操作失败，状态码: ${response.status}`);
            }

            const data = await response.json();

            // 创建详细的结果消息
            let resultMessage = data.message || "删除操作完成";
            if (data.deleted_files && data.deleted_files.length > 0) {
                resultMessage += `\n\n删除的文件 (${data.deleted_files.length}个):\n`;
                data.deleted_files.slice(0, 10).forEach(file => {
                    resultMessage += `- ${file.name}\n`;
                });

                if (data.deleted_files.length > 10) {
                    resultMessage += `... 以及其他 ${data.deleted_files.length - 10} 个文件\n`;
                }
            }

            if (data.errors && data.errors.length > 0) {
                resultMessage += `\n\n删除失败的文件 (${data.errors.length}个):\n`;
                data.errors.forEach(error => {
                    resultMessage += `- ${error.file}: ${error.error}\n`;
                });
            }

            alert(resultMessage);

            // 重新加载文件列表
            currentPage = 1; // 批量删除后重置到第一页
            fetchFiles();
            // 更新临时文件数量
            fetchTempFilesCount();
        } catch (error) {
            console.error("删除可删除文件失败:", error);
            alert(`删除可删除文件失败: ${error.message || error}`);
        } finally {
            // 无论成功还是失败，都恢复按钮状态
            if (cleanupTempBtn) {
                cleanupTempBtn.disabled = false;
                cleanupTempBtn.textContent = "一键删除所有可删除文件";
                fetchTempFilesCount(); // 更新按钮上的文件数量
            }
        }
    }

    // 处理强制清理临时文件
    async function handleForceCleanupTempFiles() {
        console.log('强制清理临时文件按钮被点击');

        if (!confirm("确定要强制清理临时文件目录吗？所有未绑定会议的文件将被删除，不考虑创建时间！")) {
            console.log('用户取消了强制清理操作');
            return;
        }

        try {
            // 显示加载中的状态
            const forceCleanupTempBtn = document.getElementById('force-cleanup-temp-btn');
            if (forceCleanupTempBtn) {
                forceCleanupTempBtn.disabled = true;
                forceCleanupTempBtn.textContent = "清理中...";
            }

            console.log('发送强制清理请求到服务器');
            const response = await fetch('/api/maintenance/force-cleanup-temp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            console.log('收到服务器响应', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('服务器返回错误', errorData);
                alert(`强制清理失败: ${errorData.message || errorData.detail || '未知错误'}`);
                return;
            }

            const data = await response.json();
            console.log('强制清理成功', data);

            // 显示成功消息
            alert(data.message || "临时文件强制清理成功");

            // 刷新文件列表，以便显示清理后的结果
            currentPage = 1; // 强制清理后重置到第一页
            fetchFiles();

            // 获取最新的临时文件数量
            await fetchTempFilesCount();
        } catch (error) {
            console.error('强制清理临时文件时出错:', error);
            alert(`强制清理过程中出错: ${error.message || '未知错误'}`);
        } finally {
            // 恢复按钮状态
            const forceCleanupTempBtn = document.getElementById('force-cleanup-temp-btn');
            if (forceCleanupTempBtn) {
                forceCleanupTempBtn.disabled = false;
                forceCleanupTempBtn.textContent = "强制清理所有临时文件";
            }
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

    // 将本地文件系统路径转换为网站相对路径
    function convertFilePathToWebUrl(path) {
        // 检查是否是本地文件系统路径
        if (path && path.startsWith('file:///')) {
            // 提取uploads后面的部分
            const match = path.match(/uploads[\/\\](.+)/);
            if (match && match[1]) {
                // 统一使用正斜杠，直接使用捕获组中的第一个匹配项（uploads后面的部分）
                return '/uploads/' + match[1].replace(/\\/g, '/');
            }

            // 如果上面的方法失败，只提取文件名（最后一段路径）
            const parts = path.split(/[\/\\]/);
            const filename = parts[parts.length - 1];
            if (filename) {
                return '/uploads/temp/' + filename;
            }
        } else if (path && !path.startsWith('/') && !path.startsWith('http')) {
            // 如果路径不是以/或http开头，添加/前缀
            return '/' + path;
        }

        // 如果不是file://开头或无法解析，返回原始路径
        return path;
    }
});