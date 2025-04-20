// loading.js - 专门为loading.html提供的JS文件，支持5+app plus模块

// 初始化plus对象的函数
function initializePlus() {
    if (typeof plus === 'undefined') {
        console.error('plus对象未初始化');
        showError('系统环境未就绪，请重启应用');
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

// 加载进度
let loadingProgress = 0;

// 进度条更新定时器
let progressTimer = null;

// 更新本地存储数据的函数
function updateLocalStorage() {
    if (!initializePlus()) {
        console.error('plus初始化失败，无法更新本地存储');
        showError('初始化失败，请重启应用');
        return;
    }

    // 更新加载文本和进度条
    updateLoadingText('正在更新数据...');
    setProgress(20);

    // 启动进度条动画
    startProgressAnimation(20, 80, 10000); // 从20%到80%，持续10秒

    // 使用MeetingService获取数据
    if (typeof MeetingService !== 'undefined') {
        // 设置数据更新完成的回调
        const dataUpdateHandler = function(jsonData) {
            console.log('数据更新成功');

            // 停止进度条动画
            stopProgressAnimation();

            // 设置进度为100%
            setProgress(100);

            // 更新完成，显示返回按钮
            dataUpdateCompleted = true;
            showButtons();

            // 更新加载文本
            updateLoadingText('数据更新完成');

            // 移除事件监听器，避免重复处理
            MeetingService.removeEventListener('dataUpdate', dataUpdateHandler);

            // 如果有数据，输出日志
            if (jsonData) {
                console.log('获取到的数据:', jsonData.title || '无标题');
            }
        };

        // 设置数据更新错误的回调
        const errorHandler = function(error) {
            console.error('数据更新失败:', error);

            // 停止进度条动画
            stopProgressAnimation();

            // 设置进度为20%，表示失败
            setProgress(20);

            // 即使失败也标记为完成
            dataUpdateCompleted = true;

            // 显示返回按钮
            showButtons();

            // 显示错误消息
            showError('数据更新失败，请重试');

            // 移除事件监听器，避免重复处理
            MeetingService.removeEventListener('dataUpdateError', errorHandler);
        };

        // 添加事件监听器
        MeetingService.addEventListener('dataUpdate', dataUpdateHandler);
        MeetingService.addEventListener('dataUpdateError', errorHandler);

        // 触发数据获取
        try {
            MeetingService.getJsonData();
        } catch (error) {
            console.error('触发数据获取失败:', error);
            showError('数据服务调用失败，请重试');
            stopProgressAnimation();
            setProgress(20);
            showButtons();
        }
    } else {
        console.error('MeetingService未初始化');

        // 停止进度条动画
        stopProgressAnimation();

        // 设置进度为20%，表示失败
        setProgress(20);

        // 标记为完成
        dataUpdateCompleted = true;

        // 显示返回按钮
        showButtons();

        // 显示错误消息
        showError('数据服务未初始化，请重试');
    }
}

// 进度条动画函数
function startProgressAnimation(startPercent, endPercent, duration) {
    // 停止现有的定时器
    stopProgressAnimation();

    // 设置起始进度
    loadingProgress = startPercent;
    setProgress(loadingProgress);

    // 计算每次更新的增量
    const totalSteps = 50; // 总步数
    const stepDuration = duration / totalSteps; // 每步时间
    const stepIncrement = (endPercent - startPercent) / totalSteps; // 每步增量

    // 创建定时器
    progressTimer = setInterval(() => {
        // 增加进度
        loadingProgress += stepIncrement;

        // 确保不超过结束进度
        if (loadingProgress >= endPercent) {
            loadingProgress = endPercent;
            stopProgressAnimation();
        }

        // 更新进度条
        setProgress(loadingProgress);
    }, stepDuration);
}

// 停止进度条动画
function stopProgressAnimation() {
    if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
    }
}

// 设置进度条函数
function setProgress(percent) {
    const progressBar = document.getElementById('loadingProgress');
    if (progressBar) {
        progressBar.style.width = percent + '%';
    }
}

// 更新加载文本函数
function updateLoadingText(text) {
    const loadingText = document.querySelector('.loading-text');
    if (loadingText) {
        loadingText.textContent = text;
    }
}

// 显示错误消息函数
function showError(message) {
    const errorText = document.querySelector('.error-text');
    if (errorText) {
        errorText.textContent = message || '加载过程中出现错误';
        errorText.style.display = 'block';
        // 显示重试按钮
        const retryButton = document.querySelector('.retry-button');
        if (retryButton) {
            retryButton.style.display = 'block';
        }
    }
}

// 隐藏错误消息函数
function hideError() {
    const errorText = document.querySelector('.error-text');
    if (errorText) {
        errorText.style.display = 'none';
    }
}

// 显示所有按钮函数
function showButtons() {
    const returnButton = document.querySelector('.return-button');
    const closeButton = document.querySelector('.close-button');

    if (returnButton) {
        returnButton.style.display = 'block';
    }

    if (closeButton) {
        closeButton.style.display = 'block';
    }

    console.log('按钮已显示');
}

// 保留原来的showReturnButton函数以兼容现有代码
function showReturnButton() {
    showButtons();
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

    // 从配置中读取并更新标题文字
    console.log('从配置中读取标题文字');
    updateTitleFromConfig();

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

// 从配置中读取标题文字并更新页面
function updateTitleFromConfig() {
    if (typeof plus !== 'undefined' && plus.storage) {
        try {
            // 从设置中获取标题文字
            const storedSettings = plus.storage.getItem('option');
            if (storedSettings) {
                const parsedSettings = JSON.parse(storedSettings);
                if (parsedSettings && parsedSettings.option && parsedSettings.option.titleText) {
                    const titleText = parsedSettings.option.titleText;

                    // 更新页面上的标题文字
                    const logoTextElement = document.querySelector('.logo-text');
                    if (logoTextElement) {
                        logoTextElement.textContent = titleText;
                        console.log('从配置中读取并更新标题文字:', titleText);
                    } else {
                        console.error('找不到logo-text元素');
                    }
                } else {
                    console.log('设置中没有标题文字配置');
                }
            } else {
                console.log('未找到设置数据');
            }
        } catch (error) {
            console.error('读取标题文字设置失败:', error);
        }
    } else {
        console.log('plus对象或storage不可用，无法读取标题文字设置');
    }
}

// 添加页面可见性变化监听，在页面显示时更新标题文字
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && typeof plus !== 'undefined' && plus.storage) {
        // 页面变为可见时，更新标题文字
        console.log('页面变为可见，更新标题文字');
        updateTitleFromConfig();
    }
});

// 页面加载完成后的处理
document.addEventListener('DOMContentLoaded', function() {
    console.log('loading页面DOM加载完成');

    // 初始化进度条
    setProgress(5);

    // 更新加载文本
    updateLoadingText('正在初始化系统...');

    // 隐藏错误消息
    hideError();

    // 初始隐藏所有按钮
    document.querySelectorAll('.loading-button').forEach(button => {
        button.style.display = 'none';
        console.log('按钮已初始化并隐藏:', button.className);
    });

    // 尝试从本地存储中读取标题文字
    // 即使plus对象还没有准备好，也先尝试读取
    if (typeof plus !== 'undefined' && plus.storage) {
        updateTitleFromConfig();
    } else {
        console.log('DOM加载时plus对象未就绪，等待plusready事件更新标题');
    }

    // 添加测试按钮（只在开发环境下显示）
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        // 创建测试按钮容器
        const testButtonContainer = document.createElement('div');
        testButtonContainer.style.position = 'fixed';
        testButtonContainer.style.top = '10px';
        testButtonContainer.style.right = '10px';
        testButtonContainer.style.zIndex = '10000';

        // 创建测试成功按钮
        const testSuccessButton = document.createElement('button');
        testSuccessButton.textContent = '测试成功';
        testSuccessButton.style.marginRight = '10px';
        testSuccessButton.style.padding = '5px 10px';
        testSuccessButton.style.backgroundColor = '#4CAF50';
        testSuccessButton.style.color = 'white';
        testSuccessButton.style.border = 'none';
        testSuccessButton.style.borderRadius = '4px';
        testSuccessButton.style.cursor = 'pointer';
        testSuccessButton.onclick = function() {
            stopProgressAnimation();
            setProgress(100);
            updateLoadingText('测试成功');
            showButtons();
        };

        // 创建测试失败按钮
        const testErrorButton = document.createElement('button');
        testErrorButton.textContent = '测试失败';
        testErrorButton.style.padding = '5px 10px';
        testErrorButton.style.backgroundColor = '#f44336';
        testErrorButton.style.color = 'white';
        testErrorButton.style.border = 'none';
        testErrorButton.style.borderRadius = '4px';
        testErrorButton.style.cursor = 'pointer';
        testErrorButton.onclick = function() {
            stopProgressAnimation();
            setProgress(20);
            showError('测试错误消息');
            showButtons();
        };

        // 添加按钮到容器
        testButtonContainer.appendChild(testSuccessButton);
        testButtonContainer.appendChild(testErrorButton);

        // 添加容器到页面
        document.body.appendChild(testButtonContainer);
    }
});