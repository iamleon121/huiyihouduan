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
    meetingPackageUrl: 'http://192.168.110.10:8000/api/v1/meetings/', // 会议基础路径

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
                        this.meetingPackageUrl = this.serverBaseUrl + '/api/v1/meetings/';
                        console.log('已设置会议数据接口URL:', this.meetingDataUrl);
                        console.log('已设置进行中会议列表接口URL:', this.activeMeetingsUrl);
                        console.log('已设置会议基础路径:', this.meetingPackageUrl);
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

                            // 下载并解压会议ZIP压缩包
                            this.downloadAndExtractMeetingPackage(meetingId)
                                .then(() => {
                                    console.log('会议ZIP压缩包下载并解压成功');
                                    // 触发数据获取完成事件
                                    this.triggerEvent('dataFetchComplete', jsonData);
                                    this.isDataFetching = false;
                                    resolve(jsonData);
                                })
                                .catch(error => {
                                    console.error('会议ZIP压缩包下载或解压失败:', error);
                                    // 即使ZIP包处理失败，也继续完成数据获取流程
                                    this.triggerEvent('dataFetchComplete', jsonData);
                                    this.isDataFetching = false;
                                    resolve(jsonData);
                                });
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

    // 下载并解压会议ZIP压缩包
    downloadAndExtractMeetingPackage: function(meetingId) {
        return new Promise((resolve, reject) => {
            console.log('开始下载会议ZIP压缩包, ID:', meetingId);

            // 触发下载开始事件
            this.triggerEvent('downloadStart', { meetingId: meetingId });

            // 构建下载URL
            const downloadUrl = this.meetingPackageUrl + meetingId + '/download-package';
            console.log('下载URL:', downloadUrl);

            // 确保下载文件夹存在
            this.ensureDirectoryExists('_doc/download/')
                .then(() => {
                    // 创建下载任务
                    const dtask = plus.downloader.createDownload(downloadUrl, {
                        filename: '_doc/download/meeting_' + meetingId + '.zip',
                        timeout: 30, // 超时时间，单位为秒
                        retry: 3 // 重试次数
                    }, (d, status) => {
                        if (status === 200) {
                            console.log('下载成功:', d.filename);

                            // 触发下载完成事件
                            this.triggerEvent('downloadComplete', { meetingId: meetingId, filename: d.filename });

                            // 触发解压开始事件
                            this.triggerEvent('extractStart', { meetingId: meetingId, filename: d.filename });

                            // 清理下载文件夹中的其他压缩包
                            console.log('开始清理下载文件夹，保留文件:', d.filename);
                            this.cleanupDownloadFolder(d.filename)
                                .then(() => {
                                    console.log('清理其他压缩包成功');

                                    // 解压文件
                                    return this.extractZipFile(d.filename, meetingId);
                                })
                                .then(() => {
                                    console.log('解压成功');

                                    // 触发解压完成事件
                                    this.triggerEvent('extractComplete', { meetingId: meetingId });

                                    resolve();
                                })
                                .catch(error => {
                                    console.error('清理或解压失败:', error);

                                    // 触发解压失败事件
                                    this.triggerEvent('extractError', { meetingId: meetingId, error: error.message || String(error) });

                                    // 即使解压失败也算成功，不中断整体流程
                                    resolve();
                                });
                        } else {
                            console.error('下载失败, 状态码:', status);

                            // 触发下载失败事件
                            this.triggerEvent('downloadError', { meetingId: meetingId, status: status });

                            // 即使下载失败也算成功，不中断整体流程
                            resolve();
                        }
                    });

                    // 监听下载进度
                    let lastPercent = -1; // 上次触发事件的进度百分比
                    dtask.addEventListener('statechanged', (task, _status) => {
                        if (task.state === 3) { // 下载进行中
                            const totalSize = task.totalSize;
                            const downloadedSize = task.downloadedSize;
                            const percent = totalSize > 0 ? Math.round(downloadedSize / totalSize * 100) : 0;

                            // 只在进度变化时触发事件，避免过多的日志输出
                            if (percent !== lastPercent) {
                                lastPercent = percent;

                                // 触发下载进度事件
                                this.triggerEvent('downloadProgress', {
                                    meetingId: meetingId,
                                    percent: percent,
                                    downloadedSize: downloadedSize,
                                    totalSize: totalSize
                                });
                            }
                        }
                    });

                    // 开始下载任务
                    dtask.start();
                });
        });
    },

    // 解压ZIP文件
    extractZipFile: function(zipPath, meetingId) {
        return new Promise((resolve, reject) => {
            console.log('开始解压ZIP文件:', zipPath);

            // 创建会议文件夹路径
            const meetingFolderPath = '_doc/meeting_files/';
            const extractPath = meetingFolderPath + 'meeting_' + meetingId + '/';

            // 确保目标文件夹存在
            this.ensureDirectoryExists(meetingFolderPath)
                .then(() => {
                    // 先清空整个meeting_files文件夹，删除所有子文件夹
                    return this.cleanAllMeetingFolders(meetingFolderPath);
                })
                .then(() => {
                    // 确保解压目标文件夹存在
                    return this.ensureDirectoryExists(extractPath);
                })
                .then(() => {
                    // 使用plus.zip模块解压文件
                    try {
                        console.log('准备解压文件:', zipPath, '到', extractPath);

                        // 检查源文件是否存在
                        plus.io.resolveLocalFileSystemURL(zipPath, zipEntry => {
                            console.log('源ZIP文件存在，大小:', zipEntry.size, '字节');

                            // 直接使用plus.zip.decompress解压文件
                            console.log('开始调用plus.zip.decompress解压文件');
                            plus.zip.decompress(zipPath, extractPath, status => {
                                console.log('解压返回状态码:', status);
                                if (status === 0) {
                                    console.log('解压完成，路径:', extractPath);

                                    // 检查解压后的目录是否存在
                                    plus.io.resolveLocalFileSystemURL(extractPath, extractEntry => {
                                        console.log('解压目录存在，内容如下:');

                                        // 列出解压目录中的文件
                                        const reader = extractEntry.createReader();
                                        reader.readEntries(entries => {
                                            entries.forEach(entry => {
                                                console.log(' - ' + entry.name + (entry.isDirectory ? '/' : ''));
                                            });

                                            // 保存当前会议文件夹路径到本地存储
                                            plus.storage.setItem('currentMeetingFolder', extractPath);

                                            // 删除下载的ZIP文件
                                            plus.io.resolveLocalFileSystemURL(zipPath, entry => {
                                                entry.remove(() => {
                                                    console.log('ZIP文件已删除:', zipPath);
                                                    resolve(); // 成功完成所有操作
                                                }, error => {
                                                    console.error('删除ZIP文件失败:', error);
                                                    // 即使删除失败也算成功
                                                    resolve();
                                                });
                                            }, error => {
                                                console.error('解析ZIP文件路径失败:', error);
                                                // 即使解析失败也算成功
                                                resolve();
                                            });
                                        }, error => {
                                            console.error('读取解压目录内容失败:', error);
                                            // 即使读取失败也算成功
                                            resolve();
                                        });
                                    }, error => {
                                        console.error('解压目录不存在或无法访问:', error);
                                        // 即使解压目录不存在也算成功
                                        resolve();
                                    });
                                } else {
                                    console.error('解压失败, 状态码:', status);
                                    // 尝试使用其他方法解压
                                    console.log('尝试使用其他方法解压...');
                                    // 即使解压失败也算成功，不中断整体流程
                                    resolve();
                                }
                            });
                        }, error => {
                            console.error('源ZIP文件不存在或无法访问:', zipPath, error);
                            // 即使源文件不存在也算成功，不中断整体流程
                            resolve();
                        });
                    } catch (error) {
                        console.error('解压过程中发生异常:', error);
                        // 即使发生异常也算成功，不中断整体流程
                        resolve();
                    }
                })
                .catch(error => {
                    console.error('准备解压环境失败:', error);
                    reject(error);
                });
        });
    },

    // 确保目录存在
    ensureDirectoryExists: function(dirPath) {
        return new Promise((resolve, reject) => {
            plus.io.resolveLocalFileSystemURL(dirPath, entry => {
                // 目录已存在
                console.log('目录已存在:', dirPath);
                resolve();
            }, error => {
                // 目录不存在，创建它
                console.log('目录不存在，创建:', dirPath);
                plus.io.resolveLocalFileSystemURL('_doc/', entry => {
                    // 从_doc/路径开始创建子目录
                    const dirs = dirPath.replace('_doc/', '').split('/');
                    this.createSubDirectories(entry, dirs, 0)
                        .then(resolve)
                        .catch(reject);
                }, reject);
            });
        });
    },

    // 递归创建子目录
    createSubDirectories: function(parentEntry, dirs, index) {
        return new Promise((resolve, reject) => {
            if (index >= dirs.length) {
                resolve();
                return;
            }

            // 跳过空目录名
            if (!dirs[index]) {
                this.createSubDirectories(parentEntry, dirs, index + 1)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            parentEntry.getDirectory(dirs[index], { create: true, exclusive: false }, dirEntry => {
                this.createSubDirectories(dirEntry, dirs, index + 1)
                    .then(resolve)
                    .catch(reject);
            }, reject);
        });
    },

    // 清理下载文件夹中的其他压缩包
    cleanupDownloadFolder: function(keepFilePath) {
        return new Promise((resolve, reject) => {
            console.log('清理下载文件夹中的其他压缩包，保留:', keepFilePath);

            try {
                // 获取要保留的文件名
                const keepFileName = keepFilePath.substring(keepFilePath.lastIndexOf('/') + 1);
                console.log('要保留的文件名:', keepFileName);

                // 获取下载文件夹路径
                const downloadFolderPath = '_doc/download/';

                // 确保下载文件夹存在
                this.ensureDirectoryExists(downloadFolderPath)
                    .then(() => {
                        // 获取文件夹中的所有文件
                        plus.io.resolveLocalFileSystemURL(downloadFolderPath, entry => {
                            const reader = entry.createReader();
                            reader.readEntries(entries => {
                                // 过滤出压缩包文件
                                const zipFiles = entries.filter(entry => {
                                    // 输出每个文件的名称便于调试
                                    console.log('检查文件:', entry.name, '是否与保留文件名相同:', entry.name === keepFileName);
                                    return !entry.isDirectory && entry.name.endsWith('.zip') && entry.name !== keepFileName;
                                });

                                console.log('找到', zipFiles.length, '个其他压缩包需要删除');

                                // 如果没有需要删除的文件，直接完成
                                if (zipFiles.length === 0) {
                                    resolve();
                                    return;
                                }

                                // 删除所有其他压缩包
                                let deletedCount = 0;
                                zipFiles.forEach(file => {
                                    console.log('删除压缩包:', file.name);
                                    file.remove(() => {
                                        console.log('压缩包已删除:', file.name);
                                        deletedCount++;
                                        if (deletedCount === zipFiles.length) {
                                            resolve();
                                        }
                                    }, error => {
                                        console.error('删除压缩包失败:', file.name, error);
                                        deletedCount++;
                                        if (deletedCount === zipFiles.length) {
                                            resolve();
                                        }
                                    });
                                });
                            }, error => {
                                console.error('读取下载文件夹失败:', error);
                                // 即使读取失败，也继续执行
                                resolve();
                            });
                        }, error => {
                            console.error('解析下载文件夹路径失败:', error);
                            // 即使解析失败，也继续执行
                            resolve();
                        });
                    })
                    .catch(error => {
                        console.error('创建下载文件夹失败:', error);
                        // 即使创建失败，也继续执行
                        resolve();
                    });
            } catch (error) {
                console.error('清理下载文件夹时出错:', error);
                // 即使出错，也继续执行
                resolve();
            }
        });
    },

    // 清空所有会议文件夹
    cleanAllMeetingFolders: function(basePath) {
        return new Promise((resolve, reject) => {
            console.log('清空所有会议文件夹:', basePath);

            plus.io.resolveLocalFileSystemURL(basePath, entry => {
                const reader = entry.createReader();
                reader.readEntries(entries => {
                    // 过滤出所有文件夹
                    const folders = entries.filter(entry => entry.isDirectory);

                    console.log('找到', folders.length, '个文件夹需要删除');

                    // 如果没有需要删除的文件夹，直接完成
                    if (folders.length === 0) {
                        resolve();
                        return;
                    }

                    // 删除所有文件夹
                    let deletedCount = 0;
                    folders.forEach(folder => {
                        console.log('删除文件夹:', folder.name);
                        folder.removeRecursively(() => {
                            console.log('文件夹已删除:', folder.name);
                            deletedCount++;
                            if (deletedCount === folders.length) {
                                resolve();
                            }
                        }, error => {
                            console.error('删除文件夹失败:', folder.name, error);
                            deletedCount++;
                            if (deletedCount === folders.length) {
                                resolve();
                            }
                        });
                    });
                }, error => {
                    console.error('读取目录失败:', error);
                    // 即使读取失败，也继续执行
                    resolve();
                });
            }, error => {
                console.error('解析基础路径失败:', error);
                // 即使解析失败，也继续执行
                resolve();
            });
        });
    },

    // 清理旧的会议文件夹
    cleanupOldMeetingFolders: function(basePath, exceptFolderName) {
        return new Promise((resolve, reject) => {
            console.log('清理旧的会议文件夹，保留:', exceptFolderName);

            plus.io.resolveLocalFileSystemURL(basePath, entry => {
                const reader = entry.createReader();
                reader.readEntries(entries => {
                    // 过滤出会议文件夹
                    const meetingFolders = entries.filter(entry => {
                        return entry.isDirectory && entry.name.startsWith('meeting_') && entry.name !== exceptFolderName;
                    });

                    console.log('找到', meetingFolders.length, '个旧会议文件夹需要删除');

                    // 如果没有需要删除的文件夹，直接完成
                    if (meetingFolders.length === 0) {
                        resolve();
                        return;
                    }

                    // 删除所有旧的会议文件夹
                    let deletedCount = 0;
                    meetingFolders.forEach(folder => {
                        console.log('删除文件夹:', folder.name);
                        folder.removeRecursively(() => {
                            console.log('文件夹已删除:', folder.name);
                            deletedCount++;
                            if (deletedCount === meetingFolders.length) {
                                resolve();
                            }
                        }, error => {
                            console.error('删除文件夹失败:', folder.name, error);
                            deletedCount++;
                            if (deletedCount === meetingFolders.length) {
                                resolve();
                            }
                        });
                    });
                }, error => {
                    console.error('读取目录失败:', error);
                    reject(error);
                });
            }, error => {
                console.error('解析基础路径失败:', error);
                reject(error);
            });
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
