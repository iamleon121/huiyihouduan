/**
 * content-loader.js
 * Renders content for different sections of the application
 */
import { renderStatus, renderActionButtons, renderRoleBadge, renderFileSize, renderTimestamp, renderFileType, createTableSkeleton, renderPagination } from '../utils/ui-renderer.js';
import { updateMeetingsCache, attachActionListeners, attachRoomActionListeners, attachUserActionListeners } from '../controllers/event-handlers.js';

/**
 * Renders the meetings table with the provided data
 * @param {Array} meetings - The meetings data to render
 * @param {boolean} [withSkeleton=false] - Whether to show skeleton loading first
 */
export function renderMeetingsTable(meetings, withSkeleton = false) {
    console.log('Rendering meetings table...');
    
    const tableBody = document.querySelector('#meeting-table tbody');
    if (!tableBody) {
        console.error('Meeting table body not found');
        return;
    }
    
    // Show loading state if requested
    if (withSkeleton) {
        tableBody.innerHTML = createTableSkeleton(5, 7);
        
        // Wait a short time to simulate loading
        setTimeout(() => {
            renderMeetingsTableContent(meetings, tableBody);
        }, 500);
    } else {
        renderMeetingsTableContent(meetings, tableBody);
    }
    
    // Update filter badges
    updateFilterBadges(meetings);
}

/**
 * Renders the meeting table content
 * @param {Array} meetings - The meetings data
 * @param {HTMLElement} tableBody - The table body element
 */
function renderMeetingsTableContent(meetings, tableBody) {
    // Cache the meetings data
    updateMeetingsCache(meetings);
    
    if (!meetings || meetings.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center;">没有找到会议记录</td>
            </tr>
        `;
        return;
    }
    
    let tableContent = '';
    
    meetings.forEach(meeting => {
        const { id, name, date, start_time, end_time, status } = meeting;
        
        tableContent += `
            <tr>
                <td>${id}</td>
                <td>${name}</td>
                <td>${date || 'N/A'}</td>
                <td>${start_time || 'N/A'}</td>
                <td>${end_time || 'N/A'}</td>
                <td>${renderStatus(status)}</td>
                <td>${renderActionButtons(meeting)}</td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = tableContent;
    
    // Attach action listeners
    attachActionListeners();
}

/**
 * Updates the filter badge counts
 * @param {Array} meetings - The meetings data
 */
function updateFilterBadges(meetings) {
    if (!meetings) return;
    
    // Count meetings by status
    const counts = {
        total: meetings.length,
        upcoming: meetings.filter(m => m.status === '未开始').length,
        ongoing: meetings.filter(m => m.status === '进行中').length,
        finished: meetings.filter(m => m.status === '已结束').length
    };
    
    // Update badges
    const allBadge = document.querySelector('.filter-all .badge');
    if (allBadge) allBadge.textContent = counts.total;
    
    const upcomingBadge = document.querySelector('.filter-upcoming .badge');
    if (upcomingBadge) upcomingBadge.textContent = counts.upcoming;
    
    const ongoingBadge = document.querySelector('.filter-ongoing .badge');
    if (ongoingBadge) ongoingBadge.textContent = counts.ongoing;
    
    const finishedBadge = document.querySelector('.filter-finished .badge');
    if (finishedBadge) finishedBadge.textContent = counts.finished;
}

/**
 * Renders the files table with the provided data
 * @param {Array} files - The files data to render
 * @param {boolean} [withSkeleton=false] - Whether to show skeleton loading first
 */
export function renderFilesTable(files, withSkeleton = false) {
    console.log('Rendering files table...');
    
    const tableBody = document.querySelector('#content-2 .data-table tbody');
    if (!tableBody) {
        console.error('Files table body not found');
        return;
    }
    
    // Show loading state if requested
    if (withSkeleton) {
        tableBody.innerHTML = createTableSkeleton(5, 6);
        
        // Wait a short time to simulate loading
        setTimeout(() => {
            renderFilesTableContent(files, tableBody);
        }, 500);
    } else {
        renderFilesTableContent(files, tableBody);
    }
}

/**
 * Renders the file table content
 * @param {Array} files - The files data
 * @param {HTMLElement} tableBody - The table body element
 */
function renderFilesTableContent(files, tableBody) {
    if (!files || files.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center;">没有找到文件记录</td>
            </tr>
        `;
        return;
    }
    
    let tableContent = '';
    
    files.forEach(file => {
        const { id, name, upload_date, size, type } = file;
        
        tableContent += `
            <tr>
                <td>${id}</td>
                <td>${name}</td>
                <td>${renderTimestamp(upload_date)}</td>
                <td>${renderFileSize(size)}</td>
                <td>${renderFileType(name)}</td>
                <td>
                    <button class="btn-action view" data-id="${id}">查看</button>
                    <button class="btn-action edit" data-id="${id}">编辑</button>
                    <button class="btn-action delete" data-id="${id}">删除</button>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = tableContent;
}

/**
 * Renders the users table with the provided data
 * @param {Array} users - The users data to render
 * @param {boolean} [withSkeleton=false] - Whether to show skeleton loading first
 */
export function renderUsersTable(users, withSkeleton = false) {
    console.log('Rendering users table...');
    
    const tableBody = document.querySelector('#user-table tbody');
    if (!tableBody) {
        console.error('Users table body not found');
        return;
    }
    
    // Show loading state if requested
    if (withSkeleton) {
        tableBody.innerHTML = createTableSkeleton(5, 5);
        
        // Wait a short time to simulate loading
        setTimeout(() => {
            renderUsersTableContent(users, tableBody);
        }, 500);
    } else {
        renderUsersTableContent(users, tableBody);
    }
}

/**
 * Renders the user table content
 * @param {Array} users - The users data
 * @param {HTMLElement} tableBody - The table body element
 */
function renderUsersTableContent(users, tableBody) {
    if (!users || users.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center;">没有找到用户记录</td>
            </tr>
        `;
        return;
    }
    
    let tableContent = '';
    
    users.forEach(user => {
        const { id, username, email, role } = user;
        
        tableContent += `
            <tr>
                <td>${id}</td>
                <td>${username}</td>
                <td>${email || 'N/A'}</td>
                <td>${renderRoleBadge(role)}</td>
                <td>
                    <button class="user-btn-view btn-action view" data-id="${id}">查看</button>
                    <button class="user-btn-edit btn-action edit" data-id="${id}">编辑</button>
                    <button class="user-btn-delete btn-action delete" data-id="${id}">删除</button>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = tableContent;
    
    // Attach user action listeners
    attachUserActionListeners();
}

/**
 * Renders the dashboard statistics
 * @param {Object} stats - The dashboard statistics
 */
export function renderDashboardStats(stats) {
    console.log('Rendering dashboard statistics...');
    
    if (!stats) return;
    
    // Update stat cards
    const totalElement = document.querySelector('.stat-total-meetings');
    if (totalElement) totalElement.textContent = stats.totalMeetings || '0';
    
    const upcomingElement = document.querySelector('.stat-upcoming-meetings');
    if (upcomingElement) upcomingElement.textContent = stats.upcomingMeetings || '0';
    
    const ongoingElement = document.querySelector('.stat-ongoing-meetings');
    if (ongoingElement) ongoingElement.textContent = stats.ongoingMeetings || '0';
    
    const finishedElement = document.querySelector('.stat-finished-meetings');
    if (finishedElement) finishedElement.textContent = stats.finishedMeetings || '0';
    
    // TODO: Render charts when charts library is implemented
    renderMeetingStatusChart(stats);
    renderMonthlyMeetingsChart(stats);
}

/**
 * Renders the meeting status distribution chart
 * @param {Object} stats - The dashboard statistics
 */
function renderMeetingStatusChart(stats) {
    const chartContainer = document.getElementById('status-chart');
    if (!chartContainer) return;
    
    // For now, just show a placeholder
    // In a real application, you would use a chart library like Chart.js
    const { upcomingMeetings, ongoingMeetings, finishedMeetings } = stats;
    
    chartContainer.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <p>会议状态分布</p>
            <div style="display: flex; justify-content: space-around; margin-top: 20px;">
                <div>
                    <div style="height: 20px; width: 100px; background-color: #17a2b8; margin: 0 auto;"></div>
                    <p>未开始: ${upcomingMeetings || 0}</p>
                </div>
                <div>
                    <div style="height: 20px; width: 100px; background-color: #28a745; margin: 0 auto;"></div>
                    <p>进行中: ${ongoingMeetings || 0}</p>
                </div>
                <div>
                    <div style="height: 20px; width: 100px; background-color: #6c757d; margin: 0 auto;"></div>
                    <p>已结束: ${finishedMeetings || 0}</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Renders the monthly meetings chart
 * @param {Object} stats - The dashboard statistics
 */
function renderMonthlyMeetingsChart(stats) {
    const chartContainer = document.getElementById('monthly-chart');
    if (!chartContainer) return;
    
    // For now, just show a placeholder
    // In a real application, you would use a chart library like Chart.js
    chartContainer.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <p>月度会议统计</p>
            <div style="display: flex; justify-content: space-around; align-items: flex-end; height: 150px; margin-top: 20px;">
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <div style="width: 30px; background-color: var(--primary-color); height: 50px;"></div>
                    <p>1月</p>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <div style="width: 30px; background-color: var(--primary-color); height: 80px;"></div>
                    <p>2月</p>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <div style="width: 30px; background-color: var(--primary-color); height: 65px;"></div>
                    <p>3月</p>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <div style="width: 30px; background-color: var(--primary-color); height: 100px;"></div>
                    <p>4月</p>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <div style="width: 30px; background-color: var(--primary-color); height: 30px;"></div>
                    <p>5月</p>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <div style="width: 30px; background-color: var(--primary-color); height: 70px;"></div>
                    <p>6月</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Shows an error message in the content area
 * @param {string} message - The error message
 * @param {string} containerId - The ID of the container
 */
export function showError(message, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div class="error-message">
            <p>${message}</p>
        </div>
    `;
}

/**
 * Shows a loading message in the content area
 * @param {string} containerId - The ID of the container
 */
export function showLoading(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div style="text-align: center; padding: 30px;">
            <p>加载中...</p>
        </div>
    `;
}
