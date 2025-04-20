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

    // 在这里可以添加loading页面特定的plus相关功能
    // 例如：显示加载进度、自动跳转到主页面等
    
    // 用于跟踪是否已经执行过跳转的标志
    let redirectExecuted = false;
    
    // 10秒后自动跳转到主页面
    setTimeout(function() {
        // 如果已经执行过跳转，则跳过
        if (redirectExecuted) {
            console.log('已经执行过跳转，跳过');
            return;
        }
        
        if (initializePlus()) {
            console.log('10秒后跳转到主页面');
            redirectExecuted = true;
            
            // 检查main页面是否已存在
            const mainView = plus.webview.getWebviewById('main');
            if (mainView) {
                // 如果main页面已存在，则显示它而不是重新创建
                console.log('找到已存在的main页面，显示它');
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
    }, 10000);
});

// 页面加载完成后的处理
document.addEventListener('DOMContentLoaded', function() {
    console.log('loading页面DOM加载完成');
    // 这里可以添加页面初始化的代码，不依赖plus对象
    
    // 更新加载文本示例
    const loadingText = document.querySelector('.loading-text');
    if (loadingText) {
        loadingText.textContent = '正在初始化...';
    }
});