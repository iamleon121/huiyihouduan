/**
 * ui-renderer.js
 * Utility functions for rendering UI elements.
 */

/**
 * Renders a status badge with appropriate styling
 * @param {string} status - The meeting status ('未开始', '进行中', '已结束')
 * @returns {string} HTML for the status badge
 */
export function renderStatus(status) {
    let statusClass = '';
    
    switch (status) {
        case '未开始':
            statusClass = 'status-upcoming';
            break;
        case '进行中':
            statusClass = 'status-ongoing';
            break;
        case '已结束':
            statusClass = 'status-finished';
            break;
        default:
            statusClass = 'status-unknown';
    }
    
    return `<span class="status ${statusClass}">${status}</span>`;
}

/**
 * Renders action buttons for a meeting based on its status
 * @param {Object} meeting - The meeting data
 * @returns {string} HTML for action buttons
 */
export function renderActionButtons(meeting) {
    const { id, status } = meeting;
    let buttons = '';
    
    // View button is always available
    buttons += `<button class="btn-action view" data-id="${id}">查看</button>`;
    
    // Start button is only available for upcoming meetings
    if (status === '未开始') {
        buttons += `<button class="btn-action start" data-id="${id}">开始</button>`;
    }
    
    // Edit button is only available for upcoming meetings
    if (status === '未开始') {
        buttons += `<button class="btn-action edit" data-id="${id}">编辑</button>`;
    } else {
        buttons += `<button class="btn-action edit disabled" data-id="${id}" disabled>编辑</button>`;
    }
    
    // Delete button is only available for upcoming meetings
    if (status === '未开始') {
        buttons += `<button class="btn-action delete" data-id="${id}">删除</button>`;
    } else {
        buttons += `<button class="btn-action delete disabled" data-id="${id}" disabled>删除</button>`;
    }
    
    return buttons;
}

/**
 * Renders a user role badge
 * @param {string} role - The user role
 * @returns {string} HTML for the role badge
 */
export function renderRoleBadge(role) {
    let roleClass = '';
    let displayText = role || '用户';
    
    switch (role) {
        case 'admin':
            roleClass = 'role-admin';
            displayText = '管理员';
            break;
        case 'user':
            roleClass = 'role-user';
            displayText = '用户';
            break;
        default:
            roleClass = 'role-user';
    }
    
    return `<span class="role-badge ${roleClass}">${displayText}</span>`;
}

/**
 * Renders a file size in human-readable format
 * @param {number} bytes - The file size in bytes
 * @returns {string} Human-readable file size
 */
export function renderFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Renders a timestamp in a localized format
 * @param {string} timestamp - The timestamp to format
 * @returns {string} Formatted date and time
 */
export function renderTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    
    try {
        const date = new Date(timestamp);
        return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
        console.error('Error formatting timestamp:', error);
        return timestamp; // Return original if parsing fails
    }
}

/**
 * Renders a file type badge based on file extension
 * @param {string} fileName - The name of the file
 * @returns {string} HTML for the file type badge
 */
export function renderFileType(fileName) {
    if (!fileName) return '<span class="file-type unknown">未知</span>';
    
    const extension = fileName.split('.').pop().toLowerCase();
    let typeClass = '';
    let displayText = extension.toUpperCase();
    
    switch (extension) {
        case 'pdf':
            typeClass = 'file-pdf';
            break;
        case 'doc':
        case 'docx':
            typeClass = 'file-doc';
            displayText = 'DOC';
            break;
        case 'xls':
        case 'xlsx':
            typeClass = 'file-xls';
            displayText = 'XLS';
            break;
        case 'ppt':
        case 'pptx':
            typeClass = 'file-ppt';
            displayText = 'PPT';
            break;
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
            typeClass = 'file-image';
            displayText = '图片';
            break;
        default:
            typeClass = 'file-other';
    }
    
    return `<span class="file-type ${typeClass}">${displayText}</span>`;
}

/**
 * Creates a skeleton loading placeholder for tables
 * @param {number} [rows=5] - Number of skeleton rows to create
 * @param {number} [cols=5] - Number of columns in each row
 * @returns {string} HTML for skeleton loading effect
 */
export function createTableSkeleton(rows = 5, cols = 5) {
    let html = '';
    
    for (let i = 0; i < rows; i++) {
        html += '<tr>';
        for (let j = 0; j < cols; j++) {
            html += '<td><div class="skeleton-loader"></div></td>';
        }
        html += '</tr>';
    }
    
    return html;
}

/**
 * Renders pagination controls
 * @param {number} currentPage - The current page number
 * @param {number} totalPages - The total number of pages
 * @param {Function} onPageChange - Callback function when page changes
 * @returns {HTMLElement} The pagination control element
 */
export function renderPagination(currentPage, totalPages, onPageChange) {
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-container';
    
    const prevButton = document.createElement('button');
    prevButton.textContent = '上一页';
    prevButton.disabled = currentPage <= 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            onPageChange(currentPage - 1);
        }
    });
    
    const nextButton = document.createElement('button');
    nextButton.textContent = '下一页';
    nextButton.disabled = currentPage >= totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            onPageChange(currentPage + 1);
        }
    });
    
    const pageInfo = document.createElement('span');
    pageInfo.textContent = `第 ${currentPage} 页，共 ${totalPages} 页`;
    
    paginationContainer.appendChild(prevButton);
    paginationContainer.appendChild(pageInfo);
    paginationContainer.appendChild(nextButton);
    
    return paginationContainer;
}
