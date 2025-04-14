/**
 * data-loader.js
 * Handles fetching data from the API and passing it to the renderers.
 */
import { renderMeetingsTable, renderFilesTable, renderUsersTable, renderDashboardStats } from '../views/content-loader.js';
import { showError as showNotificationError } from '../utils/notifications.js';
import { updateMeetingsCache } from './event-handlers.js';

// 用于取消之前的延迟渲染
let meetingsRenderTimeout = null;

/**
 * Fetches meetings from the API
 * @param {Object} [options] - Fetch options like pagination, sorting, etc.
 */
export async function fetchMeetings(options = {}) {
    console.log('Fetching meetings...');
    
    try {
        // 显示加载状态，但不使用延迟渲染
        // 这样可以避免与API返回数据后的渲染冲突
        const tableBody = document.querySelector('#meeting-table tbody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">加载中...</td></tr>';
        }
        
        // 从API获取会议数据
        const response = await fetch('/api/meetings/');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const meetings = await response.json();
        console.log('API返回的会议数据:', meetings);
        
        // 检查返回的数据是否为空数组
        if (!meetings || meetings.length === 0) {
            console.log('API返回的会议数据为空');
            renderMeetingsTable([]);
            return;
        }
        
        // 转换API返回的数据格式以匹配前端期望的格式
        const formattedMeetings = meetings.map(meeting => ({
            id: meeting.id,
            name: meeting.title,
            date: meeting.time ? meeting.time.split(' ')[0] : '',
            start_time: meeting.time ? meeting.time.split(' ')[1] : '',
            end_time: meeting.time ? meeting.time.split(' ')[1] : '', // 注意：API中没有单独的结束时间字段
            room_id: 1, // 注意：API中没有会议室字段，使用默认值
            room_name: '默认会议室',
            status: meeting.status || '未开始',
            description: meeting.intro || ''
        }));
        
        console.log('格式化后的会议数据:', formattedMeetings);
        
        // 更新会议缓存
        updateMeetingsCache(formattedMeetings);
        
        // 渲染会议表格，使用withSkeleton=false避免延迟渲染
        renderMeetingsTable(formattedMeetings, false);
    } catch (error) {
        console.error('Error fetching meetings:', error);
        showNotificationError('无法加载会议数据');
        renderMeetingsTable([]);
    }
}

/**
 * Fetches meeting rooms from the API
 * @param {Object} [options] - Fetch options
 */
export async function fetchRooms(options = {}) {
    console.log('Fetching meeting rooms...');
    
    try {
        // 在实际项目中，这里应该是API调用
        // 暂时使用模拟数据，因为后端API尚未实现会议室功能
        const rooms = generateMockRooms();
        return rooms;
    } catch (error) {
        console.error('Error fetching rooms:', error);
        showNotificationError('无法加载会议室数据');
        return [];
    }
}

/**
 * Fetches users from the API
 * @param {Object} [options] - Fetch options
 */
export async function fetchUsers(options = {}) {
    console.log('Fetching users...');
    
    try {
        // 在实际项目中，这里应该是API调用
        // 暂时使用模拟数据，因为后端API尚未实现用户管理功能
        setTimeout(() => {
            const users = generateMockUsers();
            renderUsersTable(users, true);
        }, 300);
    } catch (error) {
        console.error('Error fetching users:', error);
        showNotificationError('无法加载用户数据');
        renderUsersTable([]);
    }
}

/**
 * Fetches files from the API
 * @param {Object} [options] - Fetch options
 */
export async function fetchFiles(options = {}) {
    console.log('Fetching files...');
    
    try {
        // 在实际项目中，这里应该是API调用
        // 暂时使用模拟数据，因为后端API尚未实现文件管理功能
        setTimeout(() => {
            const files = generateMockFiles();
            renderFilesTable(files, true);
        }, 300);
    } catch (error) {
        console.error('Error fetching files:', error);
        showNotificationError('无法加载文件数据');
        renderFilesTable([]);
    }
}

/**
 * Fetches dashboard statistics from the API
 */
export async function fetchDashboardStats() {
    console.log('Fetching dashboard statistics...');
    
    try {
        // 首先获取会议数据
        const response = await fetch('/api/meetings/');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const meetings = await response.json();
        
        // 转换API返回的数据格式
        const formattedMeetings = meetings.map(meeting => ({
            status: meeting.status || '未开始'
        }));
        
        // 计算统计数据
        const stats = {
            totalMeetings: meetings.length,
            upcomingMeetings: formattedMeetings.filter(m => m.status === '未开始').length,
            ongoingMeetings: formattedMeetings.filter(m => m.status === '进行中').length,
            finishedMeetings: formattedMeetings.filter(m => m.status === '已结束').length,
            monthlyMeetings: [5, 8, 6, 10, 3, 7], // 示例数据，实际应该从API获取
        };
        
        renderDashboardStats(stats);
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        showNotificationError('无法加载统计数据');
    }
}

/**
 * Generates mock room data for demo purposes
 * @returns {Array} Array of mock room objects
 */
function generateMockRooms() {
    return [
        {
            id: 1,
            name: '大会议室',
            capacity: 50,
            location: '主楼3楼',
            available: true,
            facilities: '投影仪, 音响系统, 视频会议设备'
        },
        {
            id: 2,
            name: '中会议室',
            capacity: 30,
            location: '主楼2楼',
            available: true,
            facilities: '投影仪, 音响系统'
        },
        {
            id: 3,
            name: '小会议室',
            capacity: 15,
            location: '主楼2楼',
            available: true,
            facilities: '电视, 白板'
        },
        {
            id: 4,
            name: '多功能厅',
            capacity: 100,
            location: '主楼1楼',
            available: false,
            facilities: '投影仪, 音响系统, 舞台, 灯光'
        }
    ];
}

/**
 * Generates mock user data for demo purposes
 * @returns {Array} Array of mock user objects
 */
function generateMockUsers() {
    return [
        {
            id: 1,
            username: 'admin',
            email: 'admin@example.com',
            role: 'admin',
            fullname: '系统管理员',
            department: '信息技术部'
        },
        {
            id: 2,
            username: 'zhangwei',
            email: 'zhangwei@example.com',
            role: 'user',
            fullname: '张伟',
            department: '政协办公室'
        },
        {
            id: 3,
            username: 'liming',
            email: 'liming@example.com',
            role: 'user',
            fullname: '李明',
            department: '经济委员会'
        },
        {
            id: 4,
            username: 'wangjing',
            email: 'wangjing@example.com',
            role: 'user',
            fullname: '王静',
            department: '教育委员会'
        },
        {
            id: 5,
            username: 'zhaohong',
            email: 'zhaohong@example.com',
            role: 'admin',
            fullname: '赵红',
            department: '秘书处'
        }
    ];
}

/**
 * Generates mock file data for demo purposes
 * @returns {Array} Array of mock file objects
 */
function generateMockFiles() {
    return [
        {
            id: 1,
            name: '2025年政协工作计划.docx',
            upload_date: '2025-03-15T10:30:00',
            size: 1024 * 1024 * 2.5, // 2.5 MB
            type: 'doc',
            uploaded_by: '系统管理员'
        },
        {
            id: 2,
            name: '教育发展报告.pdf',
            upload_date: '2025-03-20T14:45:00',
            size: 1024 * 1024 * 5.2, // 5.2 MB
            type: 'pdf',
            uploaded_by: '王静'
        },
        {
            id: 3,
            name: '经济数据分析.xlsx',
            upload_date: '2025-03-22T09:15:00',
            size: 1024 * 1024 * 1.8, // 1.8 MB
            type: 'xls',
            uploaded_by: '李明'
        },
        {
            id: 4,
            name: '环保工作总结.pptx',
            upload_date: '2025-03-25T16:20:00',
            size: 1024 * 1024 * 8.5, // 8.5 MB
            type: 'ppt',
            uploaded_by: '张伟'
        },
        {
            id: 5,
            name: '会议室平面图.jpg',
            upload_date: '2025-03-30T11:10:00',
            size: 1024 * 1024 * 3.1, // 3.1 MB
            type: 'image',
            uploaded_by: '系统管理员'
        }
    ];
}
