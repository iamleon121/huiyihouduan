document.addEventListener('DOMContentLoaded', () => {
    // 检查用户登录状态
    checkLoginStatus();
    
    // 页面初始加载
    initMeetingPage();
    
    // 会议管理页面初始化
    function initMeetingPage() {
        fetchMeetings();
        
        // 添加会议按钮事件绑定
        const addMeetingBtn = document.getElementById('add-meeting-btn');
        if (addMeetingBtn) {
            addMeetingBtn.addEventListener('click', () => openEditView());
        }
        
        // 返回列表按钮事件绑定
        const backToListBtn = document.getElementById('back-to-list-btn');
        if (backToListBtn) {
            backToListBtn.addEventListener('click', returnToListView);
        }
        
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', returnToListView);
        }
        
        // 添加议程项按钮事件绑定
        const addAgendaItemBtn = document.getElementById('addAgendaItemBtn');
        if (addAgendaItemBtn) {
            addAgendaItemBtn.addEventListener('click', () => addAgendaItem());
        }
        
        // 会议表单提交事件绑定
        const meetingForm = document.getElementById('meetingForm');
        if (meetingForm) {
            meetingForm.addEventListener('submit', handleMeetingFormSubmit);
        }
        
        // 查看会议模态框关闭按钮事件绑定
        const closeViewModalElements = document.querySelectorAll('#viewMeetingModal .close, #closeViewModalBtn');
        closeViewModalElements.forEach(element => {
            element.addEventListener('click', closeViewModal);
        });
    }
    
    // --- Helper function to render status span ---
    function renderStatus(status) {
        let className = '';
        switch (status) {
            case '未开始': className = 'status-upcoming'; break;
            case '进行中': className = 'status-ongoing'; break;
            case '已结束': className = 'status-finished'; break;
            default: className = 'status-unknown'; status = '未知'; // Handle unexpected status
        }
        return `<span class="status ${className}">${status}</span>`;
    }

    // --- Helper function to render action buttons ---
    function renderActionButtons(meeting) {
        const isUpcoming = meeting.status === '未开始';
        const isOngoing = meeting.status === '进行中';
        const isFinished = meeting.status === '已结束';

        let buttons = '';
        if (isUpcoming) {
            buttons += `<button class="btn-action start" data-id="${meeting.id}">开始会议</button> `;
        }
        buttons += `<button class="btn-action view" data-id="${meeting.id}">查看</button> `;
        if (!isOngoing && !isFinished) { // Can edit only if not started or finished
             buttons += `<button class="btn-action edit" data-id="${meeting.id}">编辑</button> `;
        } else {
             buttons += `<button class="btn-action edit disabled" data-id="${meeting.id}" disabled>编辑</button> `;
        }
         if (!isOngoing) { // Can delete only if not ongoing
             buttons += `<button class="btn-action delete" data-id="${meeting.id}">删除</button>`;
         } else {
             buttons += `<button class="btn-action delete disabled" data-id="${meeting.id}" disabled>删除</button>`;
         }
        return buttons;
    }
    
    // --- Function to attach listeners to buttons within a container (or row) ---
    function attachActionListeners(container) {
        // Start Button Listener
        container.querySelectorAll('.btn-action.start:not(.listener-attached)').forEach(button => {
            button.classList.add('listener-attached'); // Mark as attached
            button.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const meetingName = row.querySelector('td:first-child').textContent;
                const meetingId = e.target.dataset.id;

                if (window.confirm(`确定要开始会议 "${meetingName}" 吗？此操作将同步文件并更新状态。`)) {
                    console.log(`开始会议: ${meetingName} (ID: ${meetingId})`);
                    fetch(`/api/meetings/${meetingId}/status`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: '进行中' })
                    })
                    .then(response => {
                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                        return response.json();
                    })
                    .then(updatedMeeting => {
                        console.log('Meeting status updated:', updatedMeeting);
                        const statusCell = row.querySelector('td:nth-child(4)'); // 4th cell is status
                        if (statusCell) statusCell.innerHTML = renderStatus(updatedMeeting.status);
                        const actionCell = row.querySelector('td:last-child');
                        if (actionCell) {
                             actionCell.innerHTML = renderActionButtons(updatedMeeting);
                             // Re-attach listeners ONLY to the newly rendered buttons in this specific row
                             attachActionListeners(actionCell);
                        }
                    })
                    .catch(error => {
                        console.error('Error starting meeting:', error);
                        alert(`开始会议失败: ${error.message}`);
                    });
                } else {
                    console.log(`取消开始会议: ${meetingName}`);
                }
            });
        });

        // Delete Button Listener
        container.querySelectorAll('.btn-action.delete:not(.disabled):not(.listener-attached)').forEach(button => {
            button.classList.add('listener-attached');
            button.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const meetingName = row.querySelector('td:first-child').textContent;
                const meetingId = e.target.dataset.id;
                if (window.confirm(`确定要删除会议 "${meetingName}" 吗？`)) {
                    console.log(`删除会议: ${meetingName} (ID: ${meetingId})`);
                    fetch(`/api/meetings/${meetingId}`, { method: 'DELETE' })
                    .then(response => {
                        if (!response.ok && response.status !== 204) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        console.log('Meeting deleted successfully');
                        row.remove();
                        // Update total count
                        updatePaginationCount(document.querySelectorAll('.data-table tbody tr').length);
                    })
                    .catch(error => {
                        console.error('Error deleting meeting:', error);
                        alert(`删除会议失败: ${error.message}`);
                    });
                }
            });
        });

        // View Button Listener
        container.querySelectorAll('.btn-action.view:not(.listener-attached)').forEach(button => {
             button.classList.add('listener-attached');
             button.addEventListener('click', async (e) => {
                 const meetingId = e.target.dataset.id;
                 console.log(`Attempting to view meeting ID: ${meetingId}`);
                 openViewModal(meetingId);
             });
        });

        // Edit Button Listener
        container.querySelectorAll('.btn-action.edit:not(.disabled):not(.listener-attached)').forEach(button => {
            button.classList.add('listener-attached');
            button.addEventListener('click', async (e) => {
                const meetingId = e.target.dataset.id;
                console.log(`Attempting to edit meeting ID: ${meetingId}`);
                try {
                    const response = await fetch(`/api/meetings/${meetingId}`);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const meetingData = await response.json();
                    console.log('Fetched meeting data for edit:', meetingData);
                    openEditView(meetingData);
                } catch (error) {
                    console.error('Error fetching meeting details for edit:', error);
                    alert(`加载会议详情失败: ${error.message}`);
                }
            });
        });
    }
    
    // 会议管理页面函数
    async function fetchMeetings() {
        const tableBody = document.querySelector('.data-table tbody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-color-light);">加载中...</td></tr>';
        
        try {
            const response = await fetch('/api/meetings/');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const meetings = await response.json();
            
            let tableBodyHtml = '';
            if (meetings.length === 0) {
                tableBodyHtml = '<tr><td colspan="5" style="text-align: center; color: var(--text-color-light);">暂无会议</td></tr>';
            } else {
                meetings.forEach(meeting => {
                    tableBodyHtml += `
                        <tr data-id="${meeting.id}">
                            <td>${meeting.title || '-'}</td>
                            <td>${meeting.intro || '-'}</td>
                            <td>${meeting.time || '-'}</td>
                            <td>${renderStatus(meeting.status)}</td>
                            <td>${renderActionButtons(meeting)}</td>
                        </tr>
                    `;
                });
            }
            
            tableBody.innerHTML = tableBodyHtml;
            
            // 更新计数
            updatePaginationCount(meetings.length);
            
            // 附加操作按钮事件
            attachActionListeners(tableBody);
            
        } catch (error) {
            console.error('Failed to load meetings:', error);
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger-color);">加载会议列表失败: ${error.message}</td></tr>`;
        }
    }

    // 页面视图切换相关函数
    function openEditView(meetingData = null) {
        const meetingListView = document.getElementById('meeting-list-view');
        const meetingEditView = document.getElementById('meeting-edit-view');
        const meetingForm = document.getElementById('meetingForm');
        const agendaItemsContainer = document.getElementById('agendaItemsContainer');
        const editViewTitle = document.getElementById('edit-view-title');
        const meetingIdInput = document.getElementById('meetingId');
        
        meetingForm.reset(); // 清除之前的数据
        agendaItemsContainer.innerHTML = ''; // 清除之前的议程项
        meetingIdInput.value = ''; // 清除ID

        if (meetingData) {
            // 填充表单进行编辑
            editViewTitle.textContent = '编辑会议';
            meetingIdInput.value = meetingData.id;
            document.getElementById('meetingTitle').value = meetingData.title || '';
            document.getElementById('meetingIntro').value = meetingData.intro || '';
            
            // 格式化日期时间 (需要 YYYY-MM-DDTHH:mm 格式)
            if (meetingData.time) {
                try {
                    const date = new Date(meetingData.time);
                    // 用前导零填充月、日、小时、分钟
                    const pad = (num) => num.toString().padStart(2, '0');
                    const formattedDateTime = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
                    document.getElementById('meetingTime').value = formattedDateTime;
                } catch (e) {
                    console.error("解析会议时间出错:", meetingData.time, e);
                    document.getElementById('meetingTime').value = ''; // 无效则清除
                }
            } else {
                document.getElementById('meetingTime').value = '';
            }

            // 填充议程项
            if (meetingData.agenda_items && meetingData.agenda_items.length > 0) {
                meetingData.agenda_items.forEach((item, index) => addAgendaItem(item, index));
            }
        } else {
            // 设置新会议
            editViewTitle.textContent = '新增会议';
            addAgendaItem(); // 默认为新会议添加一个空的议程项
        }
        
        // 切换视图
        meetingListView.style.display = 'none';
        meetingEditView.style.display = 'block';
    }

    // 返回列表视图
    function returnToListView() {
        const meetingListView = document.getElementById('meeting-list-view');
        const meetingEditView = document.getElementById('meeting-edit-view');
        
        meetingEditView.style.display = 'none';
        meetingListView.style.display = 'block';
    }

    // 添加议程项
    function addAgendaItem(itemData = null, index = null) {
        const agendaItemsContainer = document.getElementById('agendaItemsContainer');
        const itemIndex = (index !== null) ? index : agendaItemsContainer.children.length;
        const newItemHtml = `
            <div class="agenda-item" data-index="${itemIndex}">
                <h4>议程 ${itemIndex + 1}</h4>
                <input type="hidden" name="agenda[${itemIndex}][id]" value="${itemData?.id || ''}" />

                <label for="agendaTitle_${itemIndex}">标题:</label>
                <input type="text" id="agendaTitle_${itemIndex}" name="agenda[${itemIndex}][title]" value="${itemData?.title || ''}" required />

                <label for="agendaReporter_${itemIndex}">议程文件上传:</label>
                
                <div class="file-upload-container">
                    <div class="file-upload-area" id="fileUploadArea_${itemIndex}">
                        <div class="file-upload-prompt">
                            <i class="upload-icon">📄</i>
                            <p>拖拽文件到此处或</p>
                            <button type="button" class="btn btn-outline file-select-btn" id="fileSelectBtn_${itemIndex}">选择文件</button>
                            <p class="file-hint">支持PDF文件，可多选</p>
                        </div>
                        <input type="file" id="agendaFiles_${itemIndex}" name="agenda[${itemIndex}][files]" accept=".pdf" multiple style="display: none;" />
                    </div>
                    <div class="selected-files" id="selectedFiles_${itemIndex}">
                        <div class="file-queue-header" style="display: none;">
                            <h5>待上传文件</h5>
                            <button type="button" class="btn btn-primary upload-files-btn" id="uploadFilesBtn_${itemIndex}">上传全部</button>
                        </div>
                        <ul class="file-queue" id="fileQueue_${itemIndex}"></ul>
                    </div>
                </div>

                ${itemIndex > 0 ? `<button type="button" class="btn removeAgendaItemBtn" data-index="${itemIndex}">移除此议程</button>` : ''}
            </div>
        `;
        
        // Add the new item to the container
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newItemHtml.trim();
        const newItem = tempDiv.firstChild;
        agendaItemsContainer.appendChild(newItem);
        
        // Attach event listener to the remove button if present
        const removeButton = newItem.querySelector('.removeAgendaItemBtn');
        if (removeButton) {
            removeButton.addEventListener('click', function(e) {
                const index = parseInt(this.dataset.index);
                if (!isNaN(index)) {
                    agendaItemsContainer.querySelector(`.agenda-item[data-index="${index}"]`).remove();
                }
            });
        }
        
        // 添加文件上传相关事件监听器
        const fileInput = newItem.querySelector(`#agendaFiles_${itemIndex}`);
        const selectedFilesDiv = newItem.querySelector(`#selectedFiles_${itemIndex}`);
        const fileUploadArea = newItem.querySelector(`#fileUploadArea_${itemIndex}`);
        const fileSelectBtn = newItem.querySelector(`#fileSelectBtn_${itemIndex}`);
        const fileQueueHeader = selectedFilesDiv.querySelector('.file-queue-header');
        const fileQueue = newItem.querySelector(`#fileQueue_${itemIndex}`);
        const uploadFilesBtn = newItem.querySelector(`#uploadFilesBtn_${itemIndex}`);
        
        // 存储待上传文件的数组
        const pendingFiles = [];
        
        // 更新文件队列显示
        function updateFileQueue() {
            if (pendingFiles.length > 0) {
                fileQueueHeader.style.display = 'flex';
                
                let fileListHTML = '';
                pendingFiles.forEach((file, idx) => {
                    fileListHTML += `
                    <li class="file-item" data-index="${idx}">
                        <div class="file-info">
                            <span class="file-name">${file.name}</span>
                            <span class="file-size">${(file.size / 1024).toFixed(2)} KB</span>
                        </div>
                        <button type="button" class="btn-remove-file" data-index="${idx}">×</button>
                    </li>`;
                });
                fileQueue.innerHTML = fileListHTML;
                
                // 添加删除文件事件
                fileQueue.querySelectorAll('.btn-remove-file').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const idx = parseInt(this.dataset.index);
                        if (!isNaN(idx) && idx >= 0 && idx < pendingFiles.length) {
                            pendingFiles.splice(idx, 1);
                            updateFileQueue();
                        }
                    });
                });
            } else {
                fileQueueHeader.style.display = 'none';
                fileQueue.innerHTML = '';
            }
        }
        
        // 处理文件选择
        function handleFileSelect(files) {
            if (files && files.length) {
                for (let i = 0; i < files.length; i++) {
                    // 检查是否为PDF文件
                    if (files[i].type === 'application/pdf') {
                        pendingFiles.push(files[i]);
                    }
                }
                updateFileQueue();
            }
        }
        
        // 文件选择按钮点击事件
        if (fileSelectBtn) {
            fileSelectBtn.addEventListener('click', function(e) {
                e.preventDefault();
                fileInput.click();
            });
        }
        
        // 文件选择变化事件
        if (fileInput) {
            fileInput.addEventListener('change', function() {
                handleFileSelect(this.files);
                // 重置input以允许选择相同文件
                this.value = '';
            });
        }
        
        // 拖拽相关事件
        if (fileUploadArea) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                fileUploadArea.addEventListener(eventName, function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                }, false);
            });
            
            // 拖拽样式
            fileUploadArea.addEventListener('dragenter', function() {
                this.classList.add('drag-over');
            }, false);
            
            fileUploadArea.addEventListener('dragover', function() {
                this.classList.add('drag-over');
            }, false);
            
            fileUploadArea.addEventListener('dragleave', function() {
                this.classList.remove('drag-over');
            }, false);
            
            // 处理文件拖放
            fileUploadArea.addEventListener('drop', function(e) {
                this.classList.remove('drag-over');
                handleFileSelect(e.dataTransfer.files);
            }, false);
        }
        
        // 上传按钮点击事件
        if (uploadFilesBtn) {
            uploadFilesBtn.addEventListener('click', function() {
                // 这里实现文件上传逻辑
                alert(`准备上传 ${pendingFiles.length} 个文件`);
                // 上传成功后清空队列
                // pendingFiles.length = 0;
                // updateFileQueue();
            });
        }
    }

    // 处理会议表单提交
    function handleMeetingFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const meetingId = formData.get('id');
        
        // 使用FormData直接提交，因为包含文件
        const agendaElements = form.querySelectorAll('.agenda-item');
        
        // 添加基本会议信息到FormData
        // FormData已经包含了基本字段，不需要重新添加
        
        // 处理文件上传
        agendaElements.forEach(element => {
            const index = element.dataset.index;
            const fileInput = element.querySelector(`#agendaFiles_${index}`);
            
            if (fileInput && fileInput.files.length > 0) {
                // 多个文件需要单独处理
                for (let i = 0; i < fileInput.files.length; i++) {
                    formData.append(`agenda[${index}][files]`, fileInput.files[i]);
                }
            }
        });
        
        console.log('Submitting meeting with files');
        
        // 确定是创建还是更新
        const method = meetingId ? 'PUT' : 'POST';
        const url = meetingId ? `/api/meetings/${meetingId}` : '/api/meetings/';
        
        fetch(url, {
            method,
            body: formData // 直接提交FormData，不设置Content-Type，浏览器会自动设置为multipart/form-data
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Success:', data);
            returnToListView();
            fetchMeetings(); // 刷新会议列表
        })
        .catch(error => {
            console.error('Error saving meeting:', error);
            alert(`保存会议失败: ${error.message}`);
        });
    }

    // 查看会议详情
    async function openViewModal(meetingId) {
        const viewMeetingModal = document.getElementById('viewMeetingModal');
        const viewMeetingDetails = document.getElementById('viewMeetingDetails');
        
        // Show modal with loading state
        viewMeetingModal.style.display = 'block';
        viewMeetingDetails.innerHTML = '<p>加载中...</p>';
        
        try {
            const response = await fetch(`/api/meetings/${meetingId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const meeting = await response.json();
            console.log('Fetched meeting for view:', meeting);
            
            // Format the meeting date and time
            let formattedTime = 'N/A';
            if (meeting.time) {
                try {
                    const date = new Date(meeting.time);
                    formattedTime = date.toLocaleString('zh-CN');
                } catch (e) {
                    console.error('Error formatting time:', e);
                }
            }
            
            // Build the HTML for agenda items
            let agendaItemsHtml = '';
            if (meeting.agenda_items && meeting.agenda_items.length > 0) {
                agendaItemsHtml = '<h3>会议议程</h3><ul>';
                meeting.agenda_items.forEach((item, index) => {
                    let filesHtml = '';
                    if (item.files && item.files.length > 0) {
                        filesHtml = '<p><strong>相关文件:</strong></p><ul class="file-list">';
                        item.files.forEach(file => {
                            filesHtml += `<li><a href="${file.url}" target="_blank">${file.name}</a> (${(file.size / 1024).toFixed(2)} KB)</li>`;
                        });
                        filesHtml += '</ul>';
                    }
                    
                    agendaItemsHtml += `
                        <li class="agenda-detail">
                            <h4>议程 ${index + 1}: ${item.title || '无标题'}</h4>
                            ${filesHtml}
                        </li>
                    `;
                });
                agendaItemsHtml += '</ul>';
            } else {
                agendaItemsHtml = '<p><em>未设置议程项</em></p>';
            }
            
            // Populate the details view
            viewMeetingDetails.innerHTML = `
                <h3>${meeting.title || '未命名会议'}</h3>
                <p><strong>介绍:</strong> ${meeting.intro || '无介绍'}</p>
                <p><strong>时间:</strong> ${formattedTime}</p>
                <p><strong>状态:</strong> ${meeting.status || '未知'}</p>
                ${agendaItemsHtml}
            `;
            
        } catch (error) {
            console.error('Error fetching meeting details:', error);
            viewMeetingDetails.innerHTML = `<p style="color: var(--danger-color);">加载会议详情失败: ${error.message}</p>`;
        }
    }

    // 关闭查看会议详情模态框
    function closeViewModal() {
        const viewMeetingModal = document.getElementById('viewMeetingModal');
        viewMeetingModal.style.display = 'none';
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