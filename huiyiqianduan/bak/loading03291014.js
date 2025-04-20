// loading.js - 专门为loading.html提供的JS文件，支持5+app plus模块

// 初始化plus对象的函数
function initializePlus() {
    if (typeof plus === 'undefined') {
        console.error('plus对象未初始化');
        return false;
    }
    return true;
}

// 所有涉及plus的操作都放在plusready事件中
let plusReadyInitialized = false;

// 标记数据是否已更新完成
let dataUpdateCompleted = false;

// 用于跟踪是否已经执行过跳转的标志
let redirectExecuted = false;

// 更新本地存储数据的函数
function updateLocalStorage() {
    if (!initializePlus()) {
        console.error('plus初始化失败，无法更新本地存储');
        return;
    }
    
    const loadingText = document.querySelector('.loading-text');
    if (loadingText) {
        loadingText.textContent = '正在更新数据...';
    }
    
    try {
        const url = 'http://123.56.40.178/data.json';
        const dtask = plus.downloader.createDownload(url, {
            timeout: 5000,  // 设置5秒超时
            retry: 1        // 允许重试1次
        }, function(d, status) {
            if (status == 200) {
                plus.io.resolveLocalFileSystemURL(d.filename, function(entry) {
                    entry.file(function(file) {
                        const reader = new plus.io.FileReader();
                        reader.onloadend = function(e) {
                            try {
                                const jsonData = JSON.parse(e.target.result);
                                // 存储新的数据到storage
                                plus.storage.setItem('meetingData', JSON.stringify(jsonData));
                                console.log('数据更新成功');
                                
                                // 更新完成，显示返回按钮
                                dataUpdateCompleted = true;
                                showReturnButton();
                                
                                if (loadingText) {
                                    loadingText.textContent = '数据更新完成';
                                }
                            } catch (error) {
                                console.error('JSON解析错误：', error);
                                dataUpdateCompleted = true; // 即使失败也标记为完成
                                showReturnButton();
                                
                                if (loadingText) {
                                    loadingText.textContent = '数据更新失败，请返回重试';
                                }
                            }
                        };
                        reader.readAsText(file);
                    }, function(error) {
                        console.error('读取文件失败：', error);
                        dataUpdateCompleted = true; // 即使失败也标记为完成
                        showReturnButton();
                        
                        if (loadingText) {
                            loadingText.textContent = '数据更新失败，请返回重试';
                        }
                    });
                }, function(error) {
                    console.error('解析文件URL失败：', error);
                    dataUpdateCompleted = true; // 即使失败也标记为完成
                    showReturnButton();
                    
                    if (loadingText) {
                        loadingText.textContent = '数据更新失败，请返回重试';
                    }
                });
            } else {
                console.error('下载JSON文件失败，状态码：' + status);
                dataUpdateCompleted = true; // 即使失败也标记为完成
                showReturnButton();
                
                if (loadingText) {
                    loadingText.textContent = '数据更新失败，请返回重试';
                }
            }
        });
        
        dtask.start();
    } catch (error) {
        console.error('下载任务创建失败：', error);
        dataUpdateCompleted = true; // 即使失败也标记为完成
        showReturnButton();
        
        if (loadingText) {
            loadingText.textContent = '数据更新失败，请返回重试';
        }
    }
}

// 显示返回按钮的函数
function showReturnButton() {
    const returnButton = document.querySelector('.return-button');
    if (returnButton) {
        returnButton.style.display = 'block';
        console.log('返回按钮已显示');
    }
}

// 使用一次性事件监听器，确保plusready事件只被处理一次
document.addEventListener('plusready', function plusReadyHandler() {
    // 防止重复初始化
    if (plusReadyInitialized) {
        console.log('plusready已经初始化过，跳过');
        return;
    }
    
    console.log('plusready事件触发，初始化loading页面');
    plusReadyInitialized = true;
    
    // 移除事件监听器，确保只执行一次
    document.removeEventListener('plusready', plusReadyHandler);

    if (!initializePlus()) {
        console.error('plus初始化失败');
        return;
    }

    // 开始更新本地存储数据
    console.log('开始更新本地存储数据');
    updateLocalStorage();
    
    // 创建返回main页面的函数
    window.returnToMain = function() {
        // 如果已经执行过跳转，则跳过
        if (redirectExecuted) {
            console.log('已经执行过跳转，跳过');
            return;
        }
        
        if (initializePlus()) {
            console.log('点击返回按钮，跳转到主页面');
            redirectExecuted = true;
            
            // 检查main页面是否已存在
            const mainView = plus.webview.getWebviewById('main');
            if (mainView) {
                // 如果main页面已存在，则显示它而不是重新创建
                console.log('找到已存在的main页面，显示它');
                // 恢复main页面的ID定时检测
                try {
                    // 使用plus.webview.evalJS方法执行main页面中的代码
                    mainView.evalJS('isDataFetchEnabled = true; console.log("ID定时检测已恢复");');
                } catch (error) {
                    console.error('恢复ID定时检测失败：', error);
                }
                mainView.show();
                // 关闭当前loading页面
                const currentWebview = plus.webview.currentWebview();
                currentWebview.close();
            } else {
                // 如果main页面不存在，则创建新的main页面
                console.log('未找到main页面，创建新页面');
                plus.webview.open('main.html', 'main', {});
            }
        } else {
            console.error('plus未初始化，无法跳转');
        }
    };
});

// 页面加载完成后的处理
document.addEventListener('DOMContentLoaded', function() {
    console.log('loading页面DOM加载完成');
    
    // 更新加载文本
    const loadingText = document.querySelector('.loading-text');
    if (loadingText) {
        loadingText.textContent = '正在初始化...';
    }
    
    // 初始隐藏返回按钮，等数据更新完成后再显示
    const returnButton = document.querySelector('.return-button');
    if (returnButton) {
        returnButton.style.display = 'none';
        console.log('返回按钮已初始化并隐藏');
    }
});