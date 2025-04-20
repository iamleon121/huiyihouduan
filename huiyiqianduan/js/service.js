// service.js - 无纸化会议系统状态轮询服务

// 状态轮询服务对象
const MeetingService = {
    // 定时器相关变量
    dataFetchTimer: null,
    isDataFetchEnabled: true,

    // 状态相关变量
    isStatusFetching: false,
    statusTimer: null, // 状态获取定时器
    lastStatusFetchTime: null, // 上次获取状态的时间

    // 服务器配置
    serverBaseUrl: 'http://192.168.110.10:8000', // 默认服务器基础URL
    meetingDataUrl: 'http://192.168.110.10:8000/data.json', // 默认会议数据接口
    meetingStatusUrl: 'http://192.168.110.10:8000/api/v1/meetings/status/token', // 默认会议状态接口
    updateInterval: 10000, // 默认更新间隔（毫秒）
    statusToken: null, // 当前状态标记

    // 事件监听器集合
    eventListeners: {},

    // 初始化服务
    init: function() {
        console.log('初始化会议数据服务');

        // 确保plus环境完全就绪
        if (!this.initializePlus()) {
            setTimeout(() => this.init(), 500);
            return;
        }

        // 添加网络状态监听
        window.addEventListener('online', () => {
            console.log('网络已连接，恢复数据获取');
            this.resumeDataFetch();
        });

        window.addEventListener('offline', () => {
            console.log('网络已断开，暂停数据获取');
            this.pauseDataFetch();
            this.triggerEvent('networkUnavailable');
        });

        // 从本地存储加载配置
        this.loadConfig();

        // 检查服务器连接
        console.log('初始化时检查服务器连接');
        this.checkServerConnection();

        // 从本地存储初始化数据
        this.initializeFromStorage();

        // 设置定时数据获取
        this.setupDataFetchTimer();

        // 添加状态变更事件监听
        this.addEventListener('statusChanged', (data) => {
            console.log('收到状态变更事件:', data);
        });

        // 立即开始获取会议状态
        console.log('初始化时获取会议状态');
        this.getMeetingStatus(); // 使用原来的方法名
    },

    // 从本地存储加载配置
    loadConfig: function() {
        try {
            const storedSettings = plus.storage.getItem('option');
            if (storedSettings) {
                console.log('从本地存储加载配置:', storedSettings);
                const parsedSettings = JSON.parse(storedSettings);

                // 确保数据格式正确
                if (parsedSettings && parsedSettings.option) {
                    const options = parsedSettings.option;

                    // 更新服务器基础URL
                    if (options.server) {
                        // 获取服务器地址和端口号
                        const serverAddress = options.server;
                        const serverPort = options.port || '8000';

                        // 设置基础URL
                        this.serverBaseUrl = 'http://' + serverAddress + ':' + serverPort;
                        console.log('已设置服务器基础URL:', this.serverBaseUrl);

                        // 设置会议数据接口URL
                        this.meetingDataUrl = this.serverBaseUrl + '/data.json';
                        console.log('已设置会议数据接口URL:', this.meetingDataUrl);

                        // 设置会议状态接口URL - 使用v1版本
                        this.meetingStatusUrl = this.serverBaseUrl + '/api/v1/meetings/status/token';
                        console.log('已设置会议状态接口URL:', this.meetingStatusUrl);
                    }

                    // 更新刷新间隔
                    if (options.intertime) {
                        const interval = parseInt(options.intertime);
                        console.log('配置中的间隔时间:', options.intertime, '秒，解析结果:', interval);

                        if (!isNaN(interval) && interval >= 5) {
                            // 将秒转换为毫秒，并确保是整数
                            const milliseconds = Math.floor(interval * 1000);
                            this.updateInterval = milliseconds;
                            console.log('已设置刷新间隔:', this.updateInterval, '毫秒');
                        } else {
                            console.warn('无效的间隔时间配置，使用默认值:', this.updateInterval, '毫秒');
                        }
                    } else {
                        console.log('未找到间隔时间配置，使用默认值:', this.updateInterval, '毫秒');
                    }
                }
            } else {
                console.log('未找到配置，使用默认设置');
            }
        } catch (error) {
            console.error('加载配置失败:', error);
        }
    },

    // 初始化plus环境
    initializePlus: function() {
        if (typeof plus === 'undefined' || typeof plus.net === 'undefined') {
            console.error('plus环境未完全初始化');
            return false;
        }
        return true;
    },

    // 从本地存储初始化数据
    initializeFromStorage: function() {
        try {
            // 加载会议状态数据
            const storedStatus = plus.storage.getItem('meetingStatus');
            if (storedStatus) {
                console.log('本地存储的会议状态数据内容:', storedStatus);
                const statusData = JSON.parse(storedStatus);
                console.log('从本地存储获取到会议状态数据');

                // 如果状态数据包含token，则更新当前状态token
                if (statusData && statusData.token) {
                    this.statusToken = statusData.token;
                    console.log('从本地存储加载会议状态token:', this.statusToken);
                }
            }
        } catch (error) {
            console.error('读取本地存储数据失败：', error);
        }
    },

    // 不再获取会议数据，该功能已移至loading模块

    // 获取会议状态信息
    getMeetingStatus: function() {
        // 检查是否正在获取状态
        if (this.isStatusFetching) {
            console.log('已有状态获取任务正在进行，跳过本次获取');
            return;
        }

        this.isStatusFetching = true;
        const startTime = new Date();
        console.log('开始获取会议状态，URL:', this.meetingStatusUrl, '开始时间:', startTime.toLocaleTimeString());

        try {
            const xhr = new plus.net.XMLHttpRequest();

            // 设置超时时间
            xhr.timeout = 5000;

            // 设置事件处理
            xhr.onload = () => {
                const endTime = new Date();
                const duration = endTime - startTime;
                console.log('状态请求完成，状态码:', xhr.status, '耗时:', duration, 'ms');

                if (xhr.status === 200) {
                    // 记录响应内容的前100个字符，便于调试
                    const responsePreview = xhr.responseText.length > 100 ?
                        xhr.responseText.substring(0, 100) + '...' :
                        xhr.responseText;
                    console.log(`[状态请求] 成功响应内容预览: ${responsePreview}`);

                    // 请求成功，解析状态数据
                    this.parseStatusData(xhr.responseText);
                } else {
                    console.error(`[状态请求] 失败状态码: ${xhr.status}, 响应内容: ${xhr.responseText}`);
                    this.handleStatusError('获取状态失败', { status: xhr.status, responseText: xhr.responseText });
                }
            };

            xhr.onerror = (e) => {
                console.error('状态请求网络错误详情:', e);
                this.handleStatusError('状态请求网络错误', e);
            };

            xhr.ontimeout = () => {
                console.error('状态请求超时，超时时间:', xhr.timeout, 'ms');
                this.handleStatusError('状态请求超时');
            };

            xhr.onabort = () => {
                this.handleStatusError('状态请求被取消');
            };

            // 打开连接并发送请求
            xhr.open('GET', this.meetingStatusUrl);

            // 添加请求头，指定接受JSON响应
            xhr.setRequestHeader('Accept', 'application/json');

            console.log('发送状态请求...');
            xhr.send();
        } catch (error) {
            console.error('创建状态请求失败详情:', error);
            this.handleStatusError('创建状态请求失败', error);
        }
    },

    // 解析状态数据
    parseStatusData: function(content) {
        try {
            // 记录当前时间戳
            const timestamp = new Date().toISOString();

            // 输出原始响应内容的前100个字符，便于调试
            const contentPreview = content.length > 100 ?
                content.substring(0, 100) + '...' :
                content;
            console.log(`[解析] ${timestamp} - 状态接口原始响应预览: ${contentPreview}`);

            const statusData = JSON.parse(content);
            console.log(`[解析] ${timestamp} - 解析后的状态数据类型: ${Array.isArray(statusData) ? '数组' : '对象'}, 内容:`, statusData);

            // 适应不同的数据格式
            // 检查是否有token字段，或者是否有其他可用作标识的字段
            let token = null;
            let meetingId = null;

            // 如果有token字段
            if (statusData && statusData.token) {
                token = statusData.token;
                meetingId = statusData.meeting_id;
            }
            // 如果有id字段，使用id作为token
            else if (statusData && statusData.id) {
                token = statusData.id.toString();
                meetingId = statusData.id;
            }
            // 如果是数组并且有元素
            else if (Array.isArray(statusData) && statusData.length > 0 && statusData[0]) {
                // 使用第一个元素的id或其他字段作为token
                if (statusData[0].id) {
                    token = statusData[0].id.toString();
                    meetingId = statusData[0].id;
                } else if (statusData[0].token) {
                    token = statusData[0].token;
                    meetingId = statusData[0].meeting_id || statusData[0].id;
                }
            }

            // 如果成功提取到token
            if (token) {
                console.log('成功提取到token:', token);

                // 创建标准格式的状态数据
                const normalizedStatusData = {
                    token: token,
                    meeting_id: meetingId,
                    original_data: statusData // 保存原始数据以便后续处理
                };

                console.log('标准化后的状态数据:', normalizedStatusData);

                // 将状态数据保存到本地存储
                const statusString = JSON.stringify(normalizedStatusData);
                plus.storage.setItem('meetingStatus', statusString);
                console.log('已将状态数据保存到本地存储');

                // 检查token是否变化
                if (this.statusToken !== token) {
                    console.log('会议状态变更，旧token:', this.statusToken, '新token:', token);

                    // 更新token
                    this.statusToken = token;

                    // 触发状态变更事件
                    this.triggerEvent('statusChanged', normalizedStatusData);

                    // 当状态变化时，打开loading页面获取新数据
                    console.log('状态变化，打开loading页面获取新数据');

                    // 检查loading页面是否已经存在
                    const existingLoading = plus.webview.getWebviewById('loading');
                    if (existingLoading) {
                        console.log('loading页面已存在，显示已有页面');
                        existingLoading.show();
                    } else {
                        console.log('loading页面不存在，创建新页面');
                        plus.webview.open('loading.html', 'loading', {
                            scrollIndicator: 'none',
                            scalable: false
                        });
                    }
                } else {
                    console.log('会议状态未变更');
                }
            } else {
                console.error('无效的状态数据格式，无法提取token');
            }
        } catch (error) {
            console.error('解析状态数据失败:', error);
        } finally {
            // 确保在请求完成后重置状态获取状态
            this.isStatusFetching = false;
        }
    },

    // 状态错误处理
    handleStatusError: function(message, error = null) {
        // 输出更详细的错误信息
        console.error('状态错误类型:', message);
        console.error('状态错误详情:', error);
        console.error('状态请求URL:', this.meetingStatusUrl);

        // 如果是请求失败，输出状态码
        if (message === '获取状态失败' && error && error.status) {
            console.error('状态码:', error.status);
        }

        this.triggerEvent('statusError', { error: message, details: error });
        this.isStatusFetching = false;
    },


    // 不再解析会议数据，该功能已移至loading模块

    // 设置状态轮询定时器
    setupDataFetchTimer: function() {
        // 清除现有的定时器
        if (this.dataFetchTimer) {
            console.log('清除现有的数据获取定时器');
            clearInterval(this.dataFetchTimer);
            this.dataFetchTimer = null;
        }

        if (this.statusTimer) {
            console.log('清除现有的状态获取定时器');
            clearInterval(this.statusTimer);
            this.statusTimer = null;
        }

        // 确保间隔时间是有效的整数
        if (typeof this.updateInterval !== 'number' || isNaN(this.updateInterval) || this.updateInterval < 5000) {
            console.warn('无效的更新间隔:', this.updateInterval, '毫秒，重置为默认值 10000 毫秒');
            this.updateInterval = 10000; // 默认为10秒
        }

        console.log('设置状态轮询定时器，间隔:', this.updateInterval, '毫秒');

        // 状态获取定时器 - 严格按照配置的间隔时间
        console.log('创建状态获取定时器，间隔:', this.updateInterval, '毫秒');
        this.statusTimer = setInterval(() => {
            if (!this.isDataFetchEnabled) {
                console.log('数据获取已禁用，跳过本次状态获取');
                return; // 如果数据获取被禁用，直接返回
            }

            // 只在没有正在进行的状态获取时才获取状态
            if (!this.isStatusFetching) {
                // 记录当前时间，用于计算实际间隔
                const now = new Date();
                if (this.lastStatusFetchTime) {
                    const actualInterval = now - this.lastStatusFetchTime;
                    const timestamp = now.toISOString();
                    console.log(`[状态定时器] ${timestamp} - 设定间隔: ${this.updateInterval}ms, 实际间隔: ${actualInterval}ms, 偏差: ${actualInterval - this.updateInterval}ms`);

                    // 如果实际间隔与设定间隔相差超过2秒，记录警告
                    if (Math.abs(actualInterval - this.updateInterval) > 2000) {
                        console.warn(`[状态定时器] 警告: 实际间隔(${actualInterval}ms)与设定间隔(${this.updateInterval}ms)相差过大!`);
                    }
                } else {
                    const timestamp = now.toISOString();
                    console.log(`[状态定时器] ${timestamp} - 首次触发, 设定间隔: ${this.updateInterval}ms`);
                }
                this.lastStatusFetchTime = now;
                this.getMeetingStatus(); // 使用原来的方法名
            }
        }, this.updateInterval); // 严格使用配置的间隔时间

        // 创建一个定时器用于检查并管理页面
        console.log('创建页面管理定时器，间隔:', this.updateInterval, '毫秒');
        this.dataFetchTimer = setInterval(() => {
            if (!this.isDataFetchEnabled) {
                console.log('数据获取已禁用，跳过本次页面管理');
                return; // 如果数据获取被禁用，直接返回
            }

            // 检查并管理service实例，确保只有一个service页面
            checkAndManageServiceInstance();

            // 检查并管理main页面，确保只有一个main页面存在
            this.checkAndManageMainPage();

            // 检查本地存储的状态数据
            try {
                const storedStatus = plus.storage.getItem('meetingStatus');
                if (storedStatus) {
                    const statusData = JSON.parse(storedStatus);
                    if (statusData && statusData.token) {
                        // 如果本地存储的token与当前token不同，更新token
                        if (this.statusToken !== statusData.token) {
                            console.log('本地存储的token与当前token不同，更新token');
                            this.statusToken = statusData.token;
                        }
                    }
                }
            } catch (error) {
                console.error('读取本地存储状态数据失败：', error);
            }
        }, this.updateInterval); // 严格使用配置的间隔时间
    },

    // 不再提供会议数据获取功能，该功能已移至loading模块
    getMeetingData: function() {
        console.warn('该方法已弃用，请使用LoadingService.getMeetingData()获取会议数据');
        return null;
    },

    // 暂停数据检测
    pauseDataFetch: function() {
        console.log('暂停数据和状态获取');
        this.isDataFetchEnabled = false;

        // 可以选择完全暂停定时器，以节省资源
        /*
        if (this.dataFetchTimer) {
            clearInterval(this.dataFetchTimer);
            this.dataFetchTimer = null;
        }

        if (this.statusTimer) {
            clearInterval(this.statusTimer);
            this.statusTimer = null;
        }
        */
    },

    // 恢复数据检测
    resumeDataFetch: function() {
        console.log('恢复数据和状态获取');
        this.isDataFetchEnabled = true;

        // 如果定时器被清除，重新设置
        if (!this.dataFetchTimer || !this.statusTimer) {
            this.setupDataFetchTimer();
        }

        // 立即获取状态
        this.getMeetingStatus(); // 使用原来的方法名
    },

    // 事件注册
    addEventListener: function(eventName, callback) {
        if (!this.eventListeners[eventName]) {
            this.eventListeners[eventName] = [];
        }
        this.eventListeners[eventName].push(callback);
    },

    // 事件移除
    removeEventListener: function(eventName, callback) {
        if (!this.eventListeners[eventName]) return;
        this.eventListeners[eventName] = this.eventListeners[eventName].filter(
            listener => listener !== callback
        );
    },

    // 触发事件
    triggerEvent: function(eventName, data) {
        if (!this.eventListeners[eventName]) return;
        this.eventListeners[eventName].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`事件处理器错误 (${eventName}):`, error);
            }
        });
    },

    // 检查服务器连接
    checkServerConnection: function() {
        console.log('开始检查服务器连接:', this.serverBaseUrl);

        try {
            const xhr = new plus.net.XMLHttpRequest();
            xhr.timeout = 5000;

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    console.log('服务器连接成功:', this.serverBaseUrl);
                } else {
                    console.error('服务器连接失败，状态码:', xhr.status);
                }
            };

            xhr.onerror = () => {
                console.error('服务器连接错误:', this.serverBaseUrl);
            };

            xhr.ontimeout = () => {
                console.error('服务器连接超时:', this.serverBaseUrl);
            };

            // 使用HEAD请求检查服务器连接，不下载实际内容
            xhr.open('HEAD', this.serverBaseUrl);
            xhr.send();

            return true;
        } catch (error) {
            console.error('创建服务器连接检查请求失败:', error);
            return false;
        }
    },

    // 检查并管理main页面
    checkAndManageMainPage: function() {
        try {
            // 获取所有已打开的页面
            const allWebviews = plus.webview.all();

            // 过滤出所有main页面
            const mainPages = allWebviews.filter(webview => webview.id === 'main');

            // 如果有多个main页面，只保留第一个，关闭其他的
            if (mainPages.length > 1) {
                console.log(`发现${mainPages.length}个main页面，关闭多余页面`);

                // 保留第一个，关闭其他的
                for (let i = 1; i < mainPages.length; i++) {
                    console.log(`关闭多余main页面: ${mainPages[i].id}`);
                    mainPages[i].close();
                }

                // 确保第一个页面显示
                mainPages[0].show();
            }

            return mainPages.length > 0 ? mainPages[0] : null;
        } catch (error) {
            console.error('检查main页面时出错:', error);
            return null;
        }
    }
};

// 检查并管理service页面，确保只有一个service实例
function checkAndManageServiceInstance() {
    try {
        // 获取当前页面
        const currentWebview = plus.webview.currentWebview();

        // 如果当前页面不是service，直接返回
        if (currentWebview.id !== 'service') {
            console.log('当前页面不是service页面，跳过单例检查');
            return false;
        }

        // 获取所有已打开的页面
        const allWebviews = plus.webview.all();

        // 过滤出所有service页面
        const servicePages = allWebviews.filter(webview => webview.id === 'service');

        // 如果有多个service页面，只保留当前的，关闭其他的
        if (servicePages.length > 1) {
            console.warn(`发现${servicePages.length}个service页面，关闭多余页面`);

            // 保留当前页面，关闭其他的
            for (let i = 0; i < servicePages.length; i++) {
                if (servicePages[i].id === 'service' && servicePages[i] !== currentWebview) {
                    console.log(`关闭多余service页面: ${servicePages[i].id}`);
                    servicePages[i].close();
                }
            }

            return true; // 返回真表示进行了清理
        }

        return false; // 返回假表示没有进行清理
    } catch (error) {
        console.error('检查service页面时出错:', error);
        return false;
    }
}

// 在plusready事件中初始化服务
document.addEventListener('plusready', function() {
    // 检查并管理service实例，确保只有一个service页面
    const cleaned = checkAndManageServiceInstance();
    if (cleaned) {
        console.log('service页面单例检查完成，已清理多余实例');
    } else {
        console.log('service页面单例检查完成，无需清理');
    }

    // 尝试从设置中读取标题文字
    try {
        const storedSettings = plus.storage.getItem('option');
        if (storedSettings) {
            const parsedSettings = JSON.parse(storedSettings);
            if (parsedSettings && parsedSettings.option && parsedSettings.option.titleText) {
                const titleText = parsedSettings.option.titleText;
                // 不输出标题文字相关提示

                // 更新页面上的标题文字
                const logoTextElement = document.querySelector('.logo-text');
                if (logoTextElement) {
                    logoTextElement.textContent = titleText;
                }
            }
        }
    } catch (error) {
        console.error('读取标题文字设置失败:', error);
    }

    // 不再处理数据初始化事件，该功能已移至loading模块

    MeetingService.init();
});

// 导出服务对象
window.MeetingService = MeetingService;

// 添加进入系统功能
window.gotoMain = function() {
    // 首先检查并管理现有的main页面
    const mainPage = MeetingService.checkAndManageMainPage();

    if (mainPage) {
        console.log('main页面已存在，显示已有页面');
        mainPage.show();
    } else {
        console.log('main页面不存在，创建新页面');
        plus.webview.open('main.html', 'main', {
            scrollIndicator: 'none',
            scalable: false
        });
    }
};