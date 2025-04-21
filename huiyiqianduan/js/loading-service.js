// loading-service.js - 负责会议数据获取和同步的服务

// 会议数据服务对象
const LoadingService = {
    // 数据相关变量
    meetingData: null,
    isDataFetching: false,

    // 服务器配置
    serverBaseUrl: 'http://192.168.110.10:8000', // 默认服务器基础URL
    meetingDataUrl: 'http://192.168.110.10:8000/data.json', // 默认会议数据接口
    activeMeetingsUrl: 'http://192.168.110.10:8000/api/v1/meetings/active/meetings', // 默认进行中会议列表接口
    meetingPackageUrl: 'http://192.168.110.10:8000/api/v1/meetings/active/download-package/', // 默认会议压缩包下载接口

    // 事件监听器集合
    eventListeners: {},

    // 初始化服务
    init: function() {
        console.log('初始化会议数据加载服务');

        // 确保plus环境完全就绪
        if (typeof plus === 'undefined') {
            console.error('plus环境未初始化');
            this.triggerEvent('error', { message: 'plus环境未初始化' });
            return false;
        }

        // 从本地存储加载配置
        this.loadConfig();

        // 从本地存储初始化数据
        this.initializeFromStorage();

        return true;
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
                        // 使用新的API路径
                        this.meetingDataUrl = this.serverBaseUrl + '/api/v1/meetings/';
                        this.activeMeetingsUrl = this.serverBaseUrl + '/api/v1/meetings/active/meetings';
                        this.meetingPackageUrl = this.serverBaseUrl + '/api/v1/meetings/active/download-package/';
                        console.log('已设置会议数据接口URL:', this.meetingDataUrl);
                        console.log('已设置进行中会议列表接口URL:', this.activeMeetingsUrl);
                        console.log('已设置会议压缩包下载接口URL:', this.meetingPackageUrl);
                    }
                }
            } else {
                console.log('未找到配置，使用默认设置');
            }
        } catch (error) {
            console.error('加载配置失败:', error);
            this.triggerEvent('error', { message: '加载配置失败', details: error });
        }
    },

    // 从本地存储初始化数据
    initializeFromStorage: function() {
        try {
            // 加载会议数据
            const storedData = plus.storage.getItem('meetingData');
            if (storedData) {
                console.log('从本地存储获取到会议数据');
                const data = JSON.parse(storedData);
                this.meetingData = data;
                this.triggerEvent('dataInit', data);
            }
        } catch (error) {
            console.error('读取本地存储数据失败：', error);
            this.triggerEvent('error', { message: '读取本地存储数据失败', details: error });
        }
    },

    // 获取会议数据
    fetchMeetingData: function() {
        if (this.isDataFetching) {
            console.log('已有数据获取任务正在进行，跳过');
            return;
        }

        this.isDataFetching = true;

        // 从本地存储中获取会议状态数据，以获取当前会议的ID
        try {
            const storedStatus = plus.storage.getItem('meetingStatus');
            if (!storedStatus) {
                this.handleError('未找到会议状态数据');
                return;
            }

            const statusData = JSON.parse(storedStatus);
            if (!statusData || !statusData.meeting_id) {
                this.handleError('会议状态数据不完整');
                return;
            }

            // 获取会议ID
            const meetingId = statusData.meeting_id;

            // 构建会议详情API URL
            const meetingUrl = this.meetingDataUrl + meetingId + '/package';
            console.log('开始获取会议数据，URL:', meetingUrl);

            // 使用plus.net.XMLHttpRequest获取JSON数据
            const xhr = new plus.net.XMLHttpRequest();

            // 设置超时时间
            xhr.timeout = 10000; // 增加超时时间到10秒，因为这个请求可能需要更长时间

            // 设置事件处理
            xhr.onload = () => {
                if (xhr.status === 200) {
                    // 请求成功，解析JSON数据
                    this.parseJsonData(xhr.responseText);
                } else {
                    this.handleError('请求失败', { status: xhr.status, responseText: xhr.responseText });
                }
            };

            xhr.onerror = (e) => {
                this.handleError('网络请求错误', e);
            };

            xhr.ontimeout = () => {
                this.handleError('请求超时');
            };

            xhr.onabort = () => {
                this.handleError('请求被取消');
            };

            // 打开连接并发送请求
            xhr.open('GET', meetingUrl);
            xhr.send();
        } catch (error) {
            this.handleError('获取会议数据失败', error);
        }
    },

    // 解析JSON数据
    parseJsonData: function(content) {
        try {
            console.log('开始解析会议数据包');
            const jsonData = JSON.parse(content);

            // 检查数据有效性
            if (!jsonData || !jsonData.id) {
                this.handleError('无效的会议数据包');
                return;
            }

            // 输出数据包结构信息便于调试
            console.log('会议数据包结构:', {
                id: jsonData.id,
                title: jsonData.title,
                time: jsonData.time,
                status: jsonData.status,
                agenda_items_count: jsonData.agenda_items ? jsonData.agenda_items.length : 0
            });

            // 检查数据是否有变化
            const isNewData = !this.meetingData;
            const isIdChanged = !isNewData && this.meetingData.id !== jsonData.id;

            // 更新数据
            this.meetingData = jsonData;

            // 保存到本地存储
            const jsonString = JSON.stringify(jsonData);
            console.log('更新本地存储的数据内容');
            plus.storage.setItem('meetingData', jsonString);

            // 触发相应事件
            if (isNewData) {
                console.log('新数据，触发dataInit事件');
                this.triggerEvent('dataInit', jsonData);
            } else if (isIdChanged) {
                console.log('数据ID变化，触发idChanged事件');
                this.triggerEvent('idChanged', jsonData);
            } else {
                console.log('数据更新，触发dataUpdate事件');
                this.triggerEvent('dataUpdate', jsonData);
            }

            console.log('会议数据包解析成功');

            // 触发数据获取完成事件
            this.triggerEvent('dataFetchComplete', jsonData);
        } catch (error) {
            this.handleError('JSON解析错误', error);
        } finally {
            // 确保在请求完成后重置数据获取状态
            this.isDataFetching = false;
        }
    },

    // 统一错误处理
    handleError: function(message, error = null) {
        // 输出更详细的错误信息
        console.error('错误类型:', message);
        console.error('错误详情:', error);
        console.error('请求URL:', this.meetingDataUrl);

        // 如果是请求失败，输出状态码
        if (message === '请求失败' && error && error.status) {
            console.error('状态码:', error.status);
        }

        this.triggerEvent('error', { message: message, details: error });
        this.isDataFetching = false;
    },

    // 获取当前会议数据
    getMeetingData: function() {
        return this.meetingData;
    },

    // 获取进行中的会议列表
    fetchActiveMeetings: function() {
        console.log('开始获取进行中的会议列表');

        return new Promise((resolve, reject) => {
            try {
                // 使用plus.net.XMLHttpRequest获取JSON数据
                const xhr = new plus.net.XMLHttpRequest();

                // 设置超时时间
                xhr.timeout = 5000;

                // 设置事件处理
                xhr.onload = () => {
                    if (xhr.status === 200) {
                        try {
                            // 请求成功，解析JSON数据
                            const meetings = JSON.parse(xhr.responseText);
                            console.log('获取到进行中的会议列表:', meetings);
                            resolve(meetings);
                        } catch (error) {
                            console.error('JSON解析错误:', error);
                            reject(new Error('JSON解析错误'));
                        }
                    } else {
                        console.error('请求失败:', xhr.status, xhr.responseText);
                        reject(new Error('请求失败: ' + xhr.status));
                    }
                };

                xhr.onerror = (e) => {
                    console.error('网络请求错误:', e);
                    reject(new Error('网络请求错误'));
                };

                xhr.ontimeout = () => {
                    console.error('请求超时');
                    reject(new Error('请求超时'));
                };

                xhr.onabort = () => {
                    console.error('请求被取消');
                    reject(new Error('请求被取消'));
                };

                // 打开连接并发送请求
                xhr.open('GET', this.activeMeetingsUrl);
                xhr.send();
            } catch (error) {
                console.error('获取进行中的会议列表失败:', error);
                reject(error);
            }
        });
    },

    // 获取指定会议的数据
    fetchMeetingById: function(meetingId) {
        console.log('开始获取会议数据, ID:', meetingId);

        if (this.isDataFetching) {
            console.log('已有数据获取任务正在进行，跳过');
            return Promise.reject(new Error('已有数据获取任务正在进行'));
        }

        this.isDataFetching = true;

        return new Promise((resolve, reject) => {
            try {
                // 构建会议详情API URL
                const meetingUrl = this.meetingDataUrl + meetingId + '/data';
                console.log('开始获取会议数据，URL:', meetingUrl);

                // 使用plus.net.XMLHttpRequest获取JSON数据
                const xhr = new plus.net.XMLHttpRequest();

                // 设置超时时间
                xhr.timeout = 10000; // 增加超时时间到10秒，因为这个请求可能需要更长时间

                // 设置事件处理
                xhr.onload = () => {
                    if (xhr.status === 200) {
                        try {
                            // 请求成功，解析JSON数据
                            const jsonData = JSON.parse(xhr.responseText);

                            // 检查数据有效性
                            if (!jsonData || !jsonData.id) {
                                this.isDataFetching = false;
                                reject(new Error('无效的会议数据包'));
                                return;
                            }

                            // 输出数据包结构信息便于调试
                            console.log('会议数据包结构:', {
                                id: jsonData.id,
                                title: jsonData.title,
                                time: jsonData.time,
                                status: jsonData.status,
                                agenda_items_count: jsonData.agenda_items ? jsonData.agenda_items.length : 0
                            });

                            // 更新数据
                            this.meetingData = jsonData;

                            // 保存到本地存储
                            const jsonString = JSON.stringify(jsonData);
                            console.log('更新本地存储的数据内容');
                            plus.storage.setItem('meetingData', jsonString);

                            // 触发数据初始化事件
                            this.triggerEvent('dataInit', jsonData);

                            console.log('会议数据包解析成功');

                            // 触发数据获取完成事件
                            this.triggerEvent('dataFetchComplete', jsonData);

                            this.isDataFetching = false;
                            resolve(jsonData);
                        } catch (error) {
                            console.error('JSON解析错误:', error);
                            this.isDataFetching = false;
                            reject(new Error('JSON解析错误'));
                        }
                    } else {
                        console.error('请求失败:', xhr.status, xhr.responseText);
                        this.isDataFetching = false;
                        reject(new Error('请求失败: ' + xhr.status));
                    }
                };

                xhr.onerror = (e) => {
                    console.error('网络请求错误:', e);
                    this.isDataFetching = false;
                    reject(new Error('网络请求错误'));
                };

                xhr.ontimeout = () => {
                    console.error('请求超时');
                    this.isDataFetching = false;
                    reject(new Error('请求超时'));
                };

                xhr.onabort = () => {
                    console.error('请求被取消');
                    this.isDataFetching = false;
                    reject(new Error('请求被取消'));
                };

                // 打开连接并发送请求
                xhr.open('GET', meetingUrl);
                xhr.send();
            } catch (error) {
                console.error('获取会议数据失败:', error);
                this.isDataFetching = false;
                reject(error);
            }
        });
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

// 导出服务对象
window.LoadingService = LoadingService;
