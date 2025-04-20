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
    
    // 使用MeetingService获取数据
    if (typeof MeetingService !== 'undefined') {
        // 设置数据更新完成的回调
        const dataUpdateHandler = function(data) {
            console.log('数据更新成功');
            // 更新完成，显示返回按钮
            dataUpdateCompleted = true;
            showReturnButton();
            
            if (loadingText) {
                loadingText.textContent = '数据更新完成';
            }
            
            // 移除事件监听器，避免重复处理
            MeetingService.removeEventListener('dataUpdate', dataUpdateHandler);
        };
        
        // 设置数据更新错误的回调
        const errorHandler = function() {
            console.error('数据更新失败');
            dataUpdateCompleted = true; // 即使失败也标记为完成
            showReturnButton();
            
            if (loadingText) {
                loadingText.textContent = '数据更新失败，请返回重试';
            }
            
            // 移除事件监听器，避免重复处理
            MeetingService.removeEventListener('dataUpdateError', errorHandler);
        };
        
        // 添加事件监听器
        MeetingService.addEventListener('dataUpdate', dataUpdateHandler);
        MeetingService.addEventListener('dataUpdateError', errorHandler);
        
        // 触发数据获取
        MeetingService.getJsonData();
    } else {
        console.error('MeetingService未初始化');
        dataUpdateCompleted = true; // 标记为完成
        showReturnButton();
        
        if (loadingText) {
            loadingText.textContent = '数据服务未初始化，请返回重试';
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
                // 恢复main页面的数据检测
                try {
                    // 使用plus.webview.evalJS方法执行main页面中的代码
                    mainView.evalJS('if (typeof MeetingService !== "undefined") { MeetingService.resumeDataFetch(); console.log("数据检测已恢复"); }');
                } catch (error) {
                    console.error('恢复数据检测失败：', error);
                    // 尝试多次恢复数据检测
                    setTimeout(function() {
                        try {
                            mainView.evalJS('if (typeof MeetingService !== "undefined") { MeetingService.resumeDataFetch(); console.log("数据检测已通过延迟方式恢复"); }');
                        } catch (retryError) {
                            console.error('重试恢复数据检测失败：', retryError);
                        }
                    }, 500);
                }
                mainView.show();
                // 关闭当前loading页面
                const currentWebview = plus.webview.currentWebview();
                currentWebview.close();
            } else {
                // 如果main页面不存在，则创建新的main页面
                console.log('未找到main页面，创建新页面');
                // 创建新页面时，需要等待页面创建完成后再设置isDataFetchEnabled
                const newMainView = plus.webview.open('main.html', 'main', {});
                // 监听页面加载完成事件
                newMainView.addEventListener('loaded', function() {
                    try {
                        // 在新页面加载完成后恢复数据检测
                        newMainView.evalJS('if (typeof MeetingService !== "undefined") { MeetingService.resumeDataFetch(); console.log("数据检测已在新页面中启用"); }');
                    } catch (error) {
                        console.error('在新页面中启用数据检测失败：', error);
                    }
                });
                
                // 添加额外的显示事件监听，确保在页面显示时也设置标志
                newMainView.addEventListener('show', function() {
                    try {
                        // 确保在页面显示时也恢复数据检测
                        newMainView.evalJS('if (typeof MeetingService !== "undefined") { MeetingService.resumeDataFetch(); console.log("数据检测已在页面显示时启用"); }');
                    } catch (error) {
                        console.error('在页面显示时启用数据检测失败：', error);
                    }
                });
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