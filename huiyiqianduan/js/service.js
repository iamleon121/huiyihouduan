// service.js - 无纸化会议系统统一数据控制器

// 数据控制器对象
const MeetingService = {
    // 数据相关变量
    meetingData: null,
    isDataFetching: false,
    dataFetchTimer: null,
    isDataFetchEnabled: true,

    // 服务器配置
    serverBaseUrl: 'http://123.56.40.178', // 默认服务器基础URL
    meetingDataUrl: 'http://123.56.40.178/data.json', // 默认会议数据接口
    meetingStatusUrl: 'http://123.56.40.178/api/meetings/status/token', // 默认会议状态接口
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

        // 从本地存储初始化数据
        this.initializeFromStorage();

        // 设置定时数据获取
        this.setupDataFetchTimer();

        // 添加状态变更事件监听
        this.addEventListener('statusChanged', (data) => {
            console.log('收到状态变更事件:', data);
        });

        // 立即开始获取会议状态
        this.getMeetingStatus();

        // 立即开始数据获取
        this.getJsonData();
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
                        // 设置基础URL
                        this.serverBaseUrl = 'http://' + options.server;
                        console.log('已设置服务器基础URL:', this.serverBaseUrl);

                        // 设置会议数据接口URL
                        this.meetingDataUrl = this.serverBaseUrl + '/data.json';
                        console.log('已设置会议数据接口URL:', this.meetingDataUrl);

                        // 设置会议状态接口URL
                        this.meetingStatusUrl = this.serverBaseUrl + '/api/meetings/status/token';
                        console.log('已设置会议状态接口URL:', this.meetingStatusUrl);
                    }

                    // 更新刷新间隔
                    if (options.intertime) {
                        const interval = parseInt(options.intertime);
                        if (!isNaN(interval) && interval >= 5) {
                            this.updateInterval = interval * 1000; // 转换为毫秒
                            console.log('已设置刷新间隔:', this.updateInterval, '毫秒');
                        }
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
            const storedData = plus.storage.getItem('meetingData');
            if (storedData) {
                console.log('本地存储的数据内容:', storedData);
                const data = JSON.parse(storedData);
                console.log('从本地存储获取到数据');
                this.meetingData = data;
                this.triggerEvent('dataInit', data);
            }
        } catch (error) {
            console.error('读取本地存储数据失败：', error);
        }
    },

    // 获取JSON数据
    getJsonData: function() {
        if (this.isDataFetching) {
            return;
        }

        this.isDataFetching = true;
        console.log('开始获取会议数据，URL:', this.meetingDataUrl);

        // 使用plus.net.XMLHttpRequest直接获取JSON数据
        // 相比plus.downloader，这种方式不会生成临时文件，更加高效

        try {
            const xhr = new plus.net.XMLHttpRequest();

            // 设置超时时间
            xhr.timeout = 5000;

            // 设置事件处理
            xhr.onload = () => {
                if (xhr.status === 200) {
                    // 请求成功，直接解析JSON数据
                    this.parseJsonData(xhr.responseText);
                } else {
                    this.handleError('请求失败', { status: xhr.status });
                }
            };

            xhr.onerror = () => {
                this.handleError('网络请求错误');
            };

            xhr.ontimeout = () => {
                this.handleError('请求超时');
            };

            xhr.onabort = () => {
                this.handleError('请求被取消');
            };

            // 打开连接并发送请求
            xhr.open('GET', this.meetingDataUrl);
            xhr.send();
        } catch (error) {
            this.handleError('创建XMLHttpRequest失败', error);
        }
    },

    // 不再需要处理下载完成和读取下载文件的方法，因为现在直接使用XMLHttpRequest获取数据

    // 获取会议状态信息
    getMeetingStatus: function() {
        // 检查是否正在获取状态
        if (this.isStatusFetching) {
            return;
        }

        this.isStatusFetching = true;
        console.log('开始获取会议状态，URL:', this.meetingStatusUrl);

        try {
            const xhr = new plus.net.XMLHttpRequest();

            // 设置超时时间
            xhr.timeout = 5000;

            // 设置事件处理
            xhr.onload = () => {
                if (xhr.status === 200) {
                    // 请求成功，解析状态数据
                    this.parseStatusData(xhr.responseText);
                } else {
                    this.handleStatusError('获取状态失败', { status: xhr.status });
                }
            };

            xhr.onerror = () => {
                this.handleStatusError('状态请求网络错误');
            };

            xhr.ontimeout = () => {
                this.handleStatusError('状态请求超时');
            };

            xhr.onabort = () => {
                this.handleStatusError('状态请求被取消');
            };

            // 打开连接并发送请求
            xhr.open('GET', this.meetingStatusUrl);
            xhr.send();
        } catch (error) {
            this.handleStatusError('创建状态请求失败', error);
        }
    },

    // 解析状态数据
    parseStatusData: function(content) {
        try {
            const statusData = JSON.parse(content);

            // 检查状态数据是否有效
            if (statusData && statusData.token) {
                console.log('收到状态数据:', statusData);

                // 检查token是否变化
                if (this.statusToken !== statusData.token) {
                    console.log('会议状态变更，旧token:', this.statusToken, '新token:', statusData.token);

                    // 更新token
                    this.statusToken = statusData.token;

                    // 触发状态变更事件
                    this.triggerEvent('statusChanged', statusData);

                    // 状态变更后立即获取最新会议数据
                    this.getJsonData();
                } else {
                    console.log('会议状态未变更');
                }
            } else {
                console.error('无效的状态数据格式');
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
        console.error('状态错误:', message, error);
        this.triggerEvent('statusError', { error: message });
        this.isStatusFetching = false;
    },


    // 解析JSON数据
    parseJsonData: function(content) {
        try {
            const jsonData = JSON.parse(content);
            if (!this.meetingData || this.meetingData.id !== jsonData.id) {
                const jsonString = JSON.stringify(jsonData);
                console.log('更新本地存储的数据内容:', jsonString);
                plus.storage.setItem('meetingData', jsonString);
                this.updateData(jsonData);
            } else {
                this.triggerEvent('dataUpdate', jsonData);
            }
            console.log('JSON数据解析成功');
        } catch (error) {
            this.handleError('JSON解析错误', error);
        } finally {
            // 确保在请求完成后重置数据获取状态
            this.isDataFetching = false;
        }
    },

    // 不再需要处理下载状态变化的方法，因为现在使用XMLHttpRequest的事件处理


    // 统一错误处理
    handleError: function(message, error = null) {
        console.error(message, error);
        this.triggerEvent('dataUpdateError', { error: message });
        this.isDataFetching = false;
    },

    // 更新数据并触发事件
    updateData: function(jsonData) {
        if (!jsonData || !jsonData.id) {
            this.handleError('无效的会议数据');
            return;
        }

        const isNewData = !this.meetingData;
        const isIdChanged = !isNewData && this.meetingData.id !== jsonData.id;

        this.meetingData = jsonData;

        if (isNewData) {
            this.triggerEvent('dataInit', jsonData);
        } else if (isIdChanged) {
            this.triggerEvent('idChanged', jsonData);
            // 当会议ID变化时，自动打开loading.html页面
            console.log('会议ID已变化，打开loading.html页面');
            plus.webview.open('loading.html', 'loading', {
                scrollIndicator: 'none',
                scalable: false
            });
        } else {
            this.triggerEvent('dataUpdate', jsonData);
        }
    },

    // 设置数据获取定时器
    setupDataFetchTimer: function() {
        if (this.dataFetchTimer) {
            clearInterval(this.dataFetchTimer);
            this.dataFetchTimer = null;
        }

        console.log('设置数据获取定时器，间隔:', this.updateInterval, '毫秒');

        // 创建一个计数器，用于控制状态获取的频率
        let statusCounter = 0;

        this.dataFetchTimer = setInterval(() => {
            if (!this.isDataFetchEnabled) {
                return; // 如果数据获取被禁用，直接返回
            }

            // 每次定时器触发时增加计数器
            statusCounter++;

            // 每次定时器触发时获取会议状态
            // 状态获取不受isDataFetching影响，确保状态可以独立获取
            if (!this.isStatusFetching) {
                this.getMeetingStatus();
            }

            // 每三次状态获取才获取一次完整数据
            // 这样可以减少对服务器的负担，同时确保状态可以快速响应
            if (statusCounter >= 3) {
                statusCounter = 0; // 重置计数器

                if (!this.isDataFetching) {
                    try {
                        const storedData = plus.storage.getItem('meetingData');
                        if (storedData) {
                            console.log('定时检测时本地存储的数据内容:', storedData);
                        }
                    } catch (error) {
                        console.error('读取本地存储数据失败：', error);
                    }
                    this.getJsonData();
                } else {
                    console.log('已有数据获取任务正在进行，跳过本次定时检测');
                }
            }
        }, this.updateInterval / 3); // 将定时器间隔缩短为原来的1/3，以便更频繁地检查状态
    },

    // 获取当前会议数据
    getMeetingData: function() {
        return this.meetingData;
    },

    // 暂停数据检测
    pauseDataFetch: function() {
        this.isDataFetchEnabled = false;
    },

    // 恢复数据检测
    resumeDataFetch: function() {
        this.isDataFetchEnabled = true;
        this.getJsonData();
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
    }
};

// 在plusready事件中初始化服务
document.addEventListener('plusready', function() {
    // 尝试从设置中读取标题文字
    try {
        const storedSettings = plus.storage.getItem('option');
        if (storedSettings) {
            const parsedSettings = JSON.parse(storedSettings);
            if (parsedSettings && parsedSettings.option && parsedSettings.option.titleText) {
                const titleText = parsedSettings.option.titleText;
                console.log('从设置中读取的标题文字:', titleText);

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

    // 添加数据初始化完成事件监听，自动跳转到main页面
    MeetingService.addEventListener('dataInit', function() {
        console.log('数据初始化完成，自动跳转到main页面');
        setTimeout(function() {
            gotoMain();
        }, 2000); // 延迟2秒后跳转，确保数据完全加载
    });

    MeetingService.init();
});

// 导出服务对象
window.MeetingService = MeetingService;

// 添加进入系统功能
window.gotoMain = function() {
    plus.webview.open('main.html', 'main', {
        scrollIndicator: 'none',
        scalable: false
    });
};