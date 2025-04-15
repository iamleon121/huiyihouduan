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
            addMeetingBtn.addEventListener('click', () => openModal());
        }
        
        // 模态框关闭按钮事件绑定
        const closeModalBtn = document.querySelector('#meetingModal .close');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeModal);
        }
        
        const cancelModalBtn = document.getElementById('cancelModalBtn');
        if (cancelModalBtn) {
            cancelModalBtn.addEventListener('click', closeModal);
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
                    openModal(meetingData);
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

    // 模态框相关函数
    function openModal(meetingData = null) {
        const meetingModal = document.getElementById('meetingModal');
        const meetingForm = document.getElementById('meetingForm');
        const agendaItemsContainer = document.getElementById('agendaItemsContainer');
        const modalTitle = document.getElementById('modalTitle');
        const meetingIdInput = document.getElementById('meetingId');
        
        meetingForm.reset(); // Clear previous data
        agendaItemsContainer.innerHTML = ''; // Clear previous agenda items
        meetingIdInput.value = ''; // Clear ID

        if (meetingData) {
            // Populate form for editing
            modalTitle.textContent = '编辑会议';
            meetingIdInput.value = meetingData.id;
            document.getElementById('meetingTitle').value = meetingData.title || '';
            document.getElementById('meetingIntro').value = meetingData.intro || '';
            
            // Format datetime-local (requires YYYY-MM-DDTHH:mm)
            if (meetingData.time) {
                try {
                    const date = new Date(meetingData.time);
                    // Pad month, day, hours, minutes with leading zeros if necessary
                    const pad = (num) => num.toString().padStart(2, '0');
                    const formattedDateTime = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
                    document.getElementById('meetingTime').value = formattedDateTime;
                } catch (e) {
                    console.error("Error parsing meeting time:", meetingData.time, e);
                    document.getElementById('meetingTime').value = ''; // Clear if invalid
                }
            } else {
                document.getElementById('meetingTime').value = '';
            }

            // Populate agenda items
            if (meetingData.agenda_items && meetingData.agenda_items.length > 0) {
                meetingData.agenda_items.forEach((item, index) => addAgendaItem(item, index));
            }
        } else {
            // Setup for new meeting
            modalTitle.textContent = '新增会议';
            addAgendaItem(); // Add one empty agenda item by default for new meetings
        }
        meetingModal.style.display = 'block';
    }

    // 关闭模态框
    function closeModal() {
        const meetingModal = document.getElementById('meetingModal');
        meetingModal.style.display = 'none';
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

                <label for="agendaReporter_${itemIndex}">报告人:</label>
                <input type="text" id="agendaReporter_${itemIndex}" name="agenda[${itemIndex}][reporter]" value="${itemData?.reporter || ''}" />

                <label for="agendaContent_${itemIndex}">内容:</label>
                <textarea id="agendaContent_${itemIndex}" name="agenda[${itemIndex}][content]">${itemData?.content || ''}</textarea>

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
    }

    // 处理会议表单提交
    function handleMeetingFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const meetingId = formData.get('id');
        
        // Convert FormData to JSON structure
        const meetingData = {
            title: formData.get('title'),
            intro: formData.get('intro'),
            time: formData.get('time')
        };
        
        // Process agenda items
        const agendaItems = [];
        const agendaElements = form.querySelectorAll('.agenda-item');
        
        agendaElements.forEach(element => {
            const index = element.dataset.index;
            const id = formData.get(`agenda[${index}][id]`);
            const title = formData.get(`agenda[${index}][title]`);
            const reporter = formData.get(`agenda[${index}][reporter]`);
            const content = formData.get(`agenda[${index}][content]`);
            
            agendaItems.push({
                id: id || undefined,
                title,
                reporter,
                content
            });
        });
        
        meetingData.agenda_items = agendaItems;
        console.log('Submitting meeting data:', meetingData);
        
        // Determine if we're creating or updating
        const method = meetingId ? 'PUT' : 'POST';
        const url = meetingId ? `/api/meetings/${meetingId}` : '/api/meetings/';
        
        fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(meetingData),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Success:', data);
            closeModal();
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
                    agendaItemsHtml += `
                        <li class="agenda-detail">
                            <h4>议程 ${index + 1}: ${item.title || '无标题'}</h4>
                            <p>${item.reporter ? `<strong>报告人:</strong> ${item.reporter}` : ''}</p>
                            <p>${item.content ? `<strong>内容:</strong> ${item.content}` : ''}</p>
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