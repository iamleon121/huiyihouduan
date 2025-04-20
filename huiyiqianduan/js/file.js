// 添加页面分隔线的函数
function addPageDividers() {
    // 获取图片元素
    const img = document.querySelector('#fileContent img');
    if (!img || !img.complete) return;

    // 移除已有的分隔线（如果有）
    const existingDividers = document.querySelectorAll('.page-divider');
    existingDividers.forEach(divider => divider.remove());
    
    // 获取URL中的总页数参数
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');
    const totalPages = pageParam ? parseInt(pageParam) : 1;
    
    if (totalPages <= 1) return; // 如果只有一页，不需要添加分隔线
    
    // 计算每页高度
    const imgHeight = img.offsetHeight;
    const pageHeight = imgHeight / totalPages;
    
    // 获取图片容器
    const fileContent = document.getElementById('fileContent');
    
    // 为每个页面添加分隔线（包括第一页上方和各页之间，除了最后一页之后）
    for (let i = 0; i < totalPages; i++) {
        const divider = document.createElement('div');
        divider.className = 'page-divider';
        divider.style.cssText = `
            position: absolute;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(to right, transparent, #9c2424, transparent);
            z-index: 100;
            margin: 0 15px;
        `;
        
        // 计算分隔线位置（相对于图片顶部）
        const dividerPosition = i * pageHeight;
        
        // 设置分隔线位置
        divider.style.top = `${dividerPosition + img.offsetTop}px`;
        
        // 添加页码标签
        const pageLabel = document.createElement('div');
        pageLabel.className = 'page-label';
        pageLabel.style.cssText = `
            position: absolute;
            right: 20px;
            background-color: #9c2424;
            color: white;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 12px;
            transform: translateY(-50%);
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `;
        // 对于第一页上方的分隔线，显示第1页；对于其他分隔线，显示下一页的页码
        pageLabel.textContent = `第 ${i+1} 页`;
        divider.appendChild(pageLabel);
        
        // 将分隔线添加到文档中
        fileContent.appendChild(divider);
    }
}

// 显示错误信息的函数
function showErrorMessage(message) {
    const fileContent = document.getElementById('fileContent');
    fileContent.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div style="color: #666; margin-bottom: 20px;">${message}</div>
            <button onclick="goBack()" style="background-color: #ff6b00; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; transition: background-color 0.3s;" onmouseover="this.style.backgroundColor='#ff8533'" onmouseout="this.style.backgroundColor='#ff6b00'">返回列表</button>
        </div>
    `;
}

// 返回函数
function goBack() {
    if (typeof plus !== 'undefined') {
        console.log('返回list页面');
        // 获取当前webview并使用动画关闭
        var currentWebview = plus.webview.currentWebview();
        currentWebview.close('slide-out-right');
    } else {
        console.log('返回上一页');
        window.history.back();
    }
}

document.addEventListener('plusready', function() {
    // 检查并创建私有文档目录，同时列出目录中的文件
    plus.io.requestFileSystem(plus.io.PRIVATE_DOC, function(fs) {
        fs.root.getDirectory('documents', { create: true }, function(dirEntry) {
            console.log('私有文档目录已就绪');
            
            // 创建目录读取器
            const directoryReader = dirEntry.createReader();
            
            // 读取目录内容
            directoryReader.readEntries(function(entries) {
                console.log('documents目录文件列表：');
                const urlParams = new URLSearchParams(window.location.search);
                // 使用file参数，与下方代码保持一致
                const searchFilename = urlParams.get('file');
                // 处理文件名，如果包含.pdf后缀则去除
                let processedFilename = searchFilename;
                if (processedFilename && processedFilename.toLowerCase().endsWith('.pdf')) {
                    processedFilename = processedFilename.substring(0, processedFilename.length - 4);
                }
                
                // 从处理后的文件名中提取纯文件名（去掉路径部分）
                let pureFilename = processedFilename;
                if (pureFilename && pureFilename.includes('/')) {
                    pureFilename = pureFilename.substring(pureFilename.lastIndexOf('/') + 1);
                }
                
                const searchJpgFilename = pureFilename ? pureFilename + '.jpg' : null;
                
                // 添加更明确的日志信息
                console.log('正在查找的文件名：', searchJpgFilename || '未指定文件名');
                
                let fileFound = false;
                entries.forEach(function(entry) {
                    console.log(`目录中的文件：${entry.name}, 类型：${entry.isDirectory ? '目录' : '文件'}`);
                    
                    if (searchJpgFilename && entry.name === searchJpgFilename) {
                        fileFound = true;
                        console.log('找到匹配的文件！');
                    } else if (searchJpgFilename) {
                        console.log(`文件名差异：\n期望文件名：${searchJpgFilename}\n实际文件名：${entry.name}`);
                    }
                });
                
                if (searchJpgFilename && !fileFound) {
                    console.log('警告：未在目录中找到要查找的文件！');
                }
            }, function(error) {
                console.error('读取目录内容失败：', error);
            });
        }, function(error) {
            console.error('创建私有文档目录失败：', error);
            showErrorMessage('无法创建文件存储目录');
        });
    }, function(error) {
        console.error('获取文件系统失败：', error);
        showErrorMessage('无法访问文件系统');
    });

    // 禁止返回
    plus.key.addEventListener('backbutton', function() {
        console.log('返回list页面');
        // 获取当前webview并使用动画关闭
        var currentWebview = plus.webview.currentWebview();
        currentWebview.close('slide-out-right');
    }, false);

    // 从URL获取文件名和页码参数
    const urlParams = new URLSearchParams(window.location.search);
    const fileParam = urlParams.get('file');
    const pageParam = urlParams.get('page');
    const pageNum = pageParam ? parseInt(pageParam) : 1; // 默认页码为1
    console.log('获取到的页码参数：', pageNum);
    
    // 从本地存储获取文件内容的函数
    function tryReadFromStorage(filename) {
        if (typeof plus !== 'undefined' && plus.storage) {
            try {
                const fileContent = plus.storage.getItem(filename);
                if (fileContent) {
                    document.getElementById('fileContent').textContent = fileContent;
                } else {
                    showErrorMessage('未找到文件内容');
                }
            } catch (error) {
                console.error('读取本地存储文件内容失败：', error);
                showErrorMessage('读取文件内容失败');
            }
        } else {
            showErrorMessage('无法访问本地存储');
        }
    }
    
    if (fileParam) {
        // 获取纯文件名参数
        const pureFilename = decodeURIComponent(fileParam);
        console.log('获取到的文件参数：', pureFilename);
        
        // 提取文件名部分（去掉扩展名）
        let filename = pureFilename;
        
        // 去掉扩展名部分
        if (filename.includes('.')) {
            filename = filename.substring(0, filename.lastIndexOf('.'));
        }
        
        console.log('提取的文件名：', filename);
        
        // 更新标题显示文件名
        const headerTitle = document.querySelector('.header-title');
        if (headerTitle) {
            headerTitle.textContent = filename;
        }
        
        // 构建完整的文件路径，添加doc/documents/前缀
        const jpgFilename = filename + '.jpg';
        console.log('当前加载的文件名：', jpgFilename);
        
        // 移除总页数信息显示
        
        // 检查文件是否存在于documents目录
        plus.io.requestFileSystem(plus.io.PRIVATE_DOC, function(fs) {
            fs.root.getDirectory('documents', { create: false }, function(dirEntry) {
                const filePath = '_doc/documents/' + jpgFilename;
                plus.io.resolveLocalFileSystemURL(filePath, function(entry) {
                    console.log('文件存在：', jpgFilename);
                    // 读取文件内容
                    entry.file(function(file) {
                        const reader = new plus.io.FileReader();
                        reader.onloadend = function(e) {
                            // 读取完成，显示图片内容
                            const fileContent = document.getElementById('fileContent');
                            
                            // 不显示总页数
                            
                            fileContent.innerHTML = `<img src="${e.target.result}" style="width: 100%; height: auto; display: block; margin: 0; padding: 0;">`;
                            
                            // 添加图片加载完成事件，确保能正确执行自动跳转到第1页
                            const img = fileContent.querySelector('img');
                            if (img) {
                                img.onload = function() {
                                    console.log('图片加载完成，准备滚动到第1页');
                                    // 获取URL中的总页数参数
                                    const urlParams = new URLSearchParams(window.location.search);
                                    const pageParam = urlParams.get('page');
                                    const totalPages = pageParam ? parseInt(pageParam) : 1;
                                    
                                    // 如果有多页，滚动到第1页
                                    if (totalPages > 1) {
                                        setTimeout(() => scrollToPage(1), 300);
                                    }
                                };
                            }
                        };
                        reader.onerror = function(e) {
                            console.error('读取文件内容失败：', e);
                            tryReadFromStorage(filename);
                        };
                        reader.readAsDataURL(file);
                    }, function(error) {
                        console.error('获取文件对象失败：', error);
                        tryReadFromStorage(filename);
                    });
                }, function(error) {
                    console.error('文件不存在：', jpgFilename, error);
                    tryReadFromStorage(filename);
                });
            }, function(error) {
                console.error('访问documents目录失败：', error);
                tryReadFromStorage(filename);
            });
        }, function(error) {
            console.error('获取文件系统失败：', error);
            tryReadFromStorage(filename);
        });
    } else {
        showErrorMessage('未指定文件名');
    }
});

// 在非plus环境下的返回按钮事件处理已在goBack函数中实现

// 更新当前时间的函数
function updateCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeString = `${hours}:${minutes}`;
    document.getElementById('current-time').textContent = timeString;
}

// 在DOMContentLoaded事件中添加放大镜功能
document.addEventListener('DOMContentLoaded', function() {
    // 添加窗口大小变化和设备方向变化事件监听，用于重新计算分隔线位置
    const recalculateDividers = function(delay = 300) {
        // 移除现有的分隔线，避免旋转过程中出现位置错乱
        const existingDividers = document.querySelectorAll('.page-divider');
        existingDividers.forEach(divider => divider.remove());
        
        setTimeout(function() {
            const img = document.querySelector('#fileContent img');
            if (img && img.complete) {
                // 获取新的图片尺寸
                const imgHeight = img.offsetHeight;
                const imgWidth = img.offsetWidth;
                
                // 确保图片尺寸已更新
                if (imgHeight > 0 && imgWidth > 0) {
                    addPageDividers();
                } else {
                    // 如果尺寸未更新，增加延迟重试
                    recalculateDividers(500);
                }
            }
        }, delay);
    };

    window.addEventListener('resize', () => recalculateDividers(300));
    window.addEventListener('orientationchange', () => {
        // 设备旋转时使用更长的延迟时间，确保旋转动画完成
        const delay = 500;
        // 移除现有的分隔线，避免旋转过程中的视觉干扰
        const existingDividers = document.querySelectorAll('.page-divider');
        existingDividers.forEach(divider => divider.remove());
        
        // 等待设备旋转完成后重新计算
        setTimeout(() => {
            recalculateDividers(delay);
        }, delay);
    });
    
    // 禁用右键菜单和长按选择
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });
    document.addEventListener('touchstart', function(e) {
        // 移除preventDefault调用以允许触摸事件正常工作
    }, { passive: true });
    
    // 从URL获取总页数参数并更新页码选择器
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');
    const totalPages = pageParam ? parseInt(pageParam) : 1; // 默认页码为1
    
    // 更新总页数显示
    document.getElementById('totalPages').textContent = totalPages;
    
    // 生成页码选择器选项
    const pageSelect = document.getElementById('pageSelect');
    if (pageSelect) {
        // 清空现有选项
        pageSelect.innerHTML = '';
        
        // 添加页码选项
        for (let i = 1; i <= totalPages; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            pageSelect.appendChild(option);
        }
        
        // 设置当前页码为1
        pageSelect.value = 1;
        document.getElementById('currentPage').textContent = 1;
        
        // 添加页码切换事件
        pageSelect.addEventListener('change', function() {
            const selectedPage = parseInt(this.value);
            document.getElementById('currentPage').textContent = selectedPage;
            scrollToPage(selectedPage);
        });
        
        // 初始加载时，如果URL中有page参数，滚动到对应页面
        const urlPageParam = urlParams.get('page_num');
        if (urlPageParam) {
            const initialPage = parseInt(urlPageParam);
            if (initialPage > 0 && initialPage <= totalPages) {
                pageSelect.value = initialPage;
                document.getElementById('currentPage').textContent = initialPage;
                // 延迟滚动，确保图片已加载
                setTimeout(() => scrollToPage(initialPage), 500);
            }
        } else {
            // 如果没有指定页码参数，自动跳转到第1页
            setTimeout(() => scrollToPage(1), 500);
        }
    }

    // 绑定返回按钮事件
    const backButton = document.getElementById('backButton');
    if (backButton) {
        backButton.addEventListener('click', function() {
            if (typeof plus !== 'undefined') {
                console.log('返回list页面');
                // 获取当前webview并使用动画关闭
                var currentWebview = plus.webview.currentWebview();
                currentWebview.close('slide-out-right');
            } else {
                console.log('返回上一页');
                window.history.back();
            }
        });
    }
    
    // 初始化时间显示并设置定时器
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    
    // 添加滚动事件监听器，更新当前页码
    window.addEventListener('scroll', function() {
        // 获取图片元素
        const img = document.querySelector('#fileContent img');
        if (!img || !img.complete) return;
        
        // 获取URL中的总页数参数
        const urlParams = new URLSearchParams(window.location.search);
        const pageParam = urlParams.get('page');
        const totalPages = pageParam ? parseInt(pageParam) : 1;
        
        if (totalPages <= 1) return; // 如果只有一页，不需要更新页码
        
        // 计算每页高度
        const imgHeight = img.offsetHeight;
        const pageHeight = imgHeight / totalPages;
        
        // 获取当前滚动位置
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const headerHeight = 60; // header高度加上一些padding
        
        // 计算当前页码
        let currentPage = Math.floor((scrollTop - headerHeight) / pageHeight) + 1;
        
        // 确保页码在有效范围内
        if (currentPage < 1) currentPage = 1;
        if (currentPage > totalPages) currentPage = totalPages;
        
        // 更新当前页码显示
        document.getElementById('currentPage').textContent = currentPage;
        
        // 更新页码选择器的值
        const pageSelect = document.getElementById('pageSelect');
        if (pageSelect && pageSelect.value != currentPage) {
            pageSelect.value = currentPage;
        }
    }, { passive: true });
    
    // 添加放大镜功能
    initMagnifier();
});

// 滚动到指定页码的函数
function scrollToPage(pageNum) {
    // 获取图片元素
    const img = document.querySelector('#fileContent img');
    if (img) {
        // 确保图片已加载完成
        if (img.complete) {
            performScroll();
            addPageDividers(); // 添加页面分隔线
        } else {
            // 如果图片未加载完成，添加加载事件监听器
            img.onload = function() {
                performScroll();
                addPageDividers(); // 添加页面分隔线
            };
        }
        
        function performScroll() {
            // 获取URL中的总页数参数
            const urlParams = new URLSearchParams(window.location.search);
            const pageParam = urlParams.get('page');
            const totalPages = pageParam ? parseInt(pageParam) : 1;
            
            // 计算每页高度（假设图片是等分的）
            const imgHeight = img.offsetHeight;
            const pageHeight = imgHeight / totalPages;
            
            // 计算目标滚动位置（减去header高度）
            const headerHeight = 60; // header高度加上一些padding
            const scrollPosition = (pageNum - 1) * pageHeight + headerHeight;
            
            // 添加一个小的偏移量，确保滚动位置略微超过页面分隔线
            const offset = 10; // 5像素的偏移量
            
            // 平滑滚动到目标位置
            window.scrollTo({
                top: scrollPosition + offset,
                behavior: 'smooth'
            });
        }
        
        // 添加页面分隔线的函数
        // 添加页面分隔线的函数
function addPageDividers() {
    // 获取图片元素
    const img = document.querySelector('#fileContent img');
    if (!img || !img.complete) return;

    // 移除已有的分隔线（如果有）
    const existingDividers = document.querySelectorAll('.page-divider');
    existingDividers.forEach(divider => divider.remove());
    
    // 获取URL中的总页数参数
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');
    const totalPages = pageParam ? parseInt(pageParam) : 1;
    
    if (totalPages <= 1) return; // 如果只有一页，不需要添加分隔线
    
    // 计算每页高度
    const imgHeight = img.offsetHeight;
    const pageHeight = imgHeight / totalPages;
    
    // 获取图片容器
    const fileContent = document.getElementById('fileContent');
    
    // 为每个页面添加分隔线（包括第一页上方和各页之间，除了最后一页之后）
    for (let i = 0; i < totalPages; i++) {
        const divider = document.createElement('div');
        divider.className = 'page-divider';
        divider.style.cssText = `
            position: absolute;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(to right, transparent, #9c2424, transparent);
            z-index: 100;
            margin: 0 15px;
        `;
        
        // 计算分隔线位置（相对于图片顶部）
        const dividerPosition = i * pageHeight;
        
        // 设置分隔线位置
        divider.style.top = `${dividerPosition + img.offsetTop}px`;
        
        // 添加页码标签
        const pageLabel = document.createElement('div');
        pageLabel.className = 'page-label';
        pageLabel.style.cssText = `
            position: absolute;
            right: 20px;
            background-color: #9c2424;
            color: white;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 12px;
            transform: translateY(-50%);
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `;
        // 对于第一页上方的分隔线，显示第1页；对于其他分隔线，显示下一页的页码
        pageLabel.textContent = `第 ${i+1} 页`;
        divider.appendChild(pageLabel);
        
        // 将分隔线添加到文档中
        fileContent.appendChild(divider);
    }
}

// 显示错误信息的函数
function showErrorMessage(message) {
    const fileContent = document.getElementById('fileContent');
    fileContent.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div style="color: #666; margin-bottom: 20px;">${message}</div>
            <button onclick="goBack()" style="background-color: #ff6b00; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; transition: background-color 0.3s;" onmouseover="this.style.backgroundColor='#ff8533'" onmouseout="this.style.backgroundColor='#ff6b00'">返回列表</button>
        </div>
    `;
}

// 返回函数
function goBack() {
    if (typeof plus !== 'undefined') {
        console.log('返回list页面');
        // 获取当前webview并使用动画关闭
        var currentWebview = plus.webview.currentWebview();
        currentWebview.close('slide-out-right');
    } else {
        console.log('返回上一页');
        window.history.back();
    }
}

// 添加页面分隔线的函数
function addPageDividers() {
    // 获取图片元素
    const img = document.querySelector('#fileContent img');
    if (!img || !img.complete) return;

    // 移除已有的分隔线（如果有）
    const existingDividers = document.querySelectorAll('.page-divider');
    existingDividers.forEach(divider => divider.remove());
    
    // 获取URL中的总页数参数
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');
    const totalPages = pageParam ? parseInt(pageParam) : 1;
    
    if (totalPages <= 1) return; // 如果只有一页，不需要添加分隔线
    
    // 计算每页高度
    const imgHeight = img.offsetHeight;
    const pageHeight = imgHeight / totalPages;
    
    // 获取图片容器
    const fileContent = document.getElementById('fileContent');
    
    // 为每个页面添加分隔线（包括第一页上方和各页之间，除了最后一页之后）
    for (let i = 0; i < totalPages; i++) {
        const divider = document.createElement('div');
        divider.className = 'page-divider';
        divider.style.cssText = `
            position: absolute;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(to right, transparent, #9c2424, transparent);
            z-index: 100;
            margin: 0 15px;
        `;
        
        // 计算分隔线位置（相对于图片顶部）
        const dividerPosition = i * pageHeight;
        
        // 设置分隔线位置
        divider.style.top = `${dividerPosition + img.offsetTop}px`;
        
        // 添加页码标签
        const pageLabel = document.createElement('div');
        pageLabel.className = 'page-label';
        pageLabel.style.cssText = `
            position: absolute;
            right: 20px;
            background-color: #9c2424;
            color: white;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 12px;
            transform: translateY(-50%);
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `;
        // 对于第一页上方的分隔线，显示第1页；对于其他分隔线，显示下一页的页码
        pageLabel.textContent = `第 ${i+1} 页`;
        divider.appendChild(pageLabel);
        
        // 将分隔线添加到文档中
        fileContent.appendChild(divider);
    }
}
    }
}

// 初始化放大镜功能
function initMagnifier() {
    const fileContent = document.getElementById('fileContent');
    let longPressTimer;
    let magnifier = null;
    let isLongPress = false;
    let touchStartX = 0;
    let touchStartY = 0;
    const LONG_PRESS_DURATION = 1200; // 修改为2秒
    const MOVE_THRESHOLD = 10; // 移动阈值，超过这个距离则取消长按
    
    // 创建放大镜元素
    function createMagnifier() {
        if (magnifier) return;
        
        magnifier = document.createElement('div');
        magnifier.id = 'magnifier';
        magnifier.style.cssText = `
            position: absolute;
            width: 300px;
            height: 160px;
            background-repeat: no-repeat;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
            z-index: 1001;
            pointer-events: none;
            display: none;
            border: 2px solid #fff;
            overflow: hidden;
        `;
        document.body.appendChild(magnifier);
    }
    
    // 触摸开始事件
    fileContent.addEventListener('touchstart', function(e) {
        const img = fileContent.querySelector('img');
        if (!img) return;
        
        createMagnifier();
        
        clearTimeout(longPressTimer);
        isLongPress = false;
        
        // 记录初始触摸位置
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        
        longPressTimer = setTimeout(function() {
            isLongPress = true;
            updateMagnifier(touch, img);
            magnifier.style.display = 'block';
        }, LONG_PRESS_DURATION);
    }, { passive: false });
    
    // 触摸移动事件
    fileContent.addEventListener('touchmove', function(e) {
        if (isLongPress) {
            e.preventDefault(); // 阻止页面滚动
            
            const touch = e.touches[0];
            const img = fileContent.querySelector('img');
            if (!img) return;
            
            updateMagnifier(touch, img);
            return;
        }
        
        const touch = e.touches[0];
        const moveX = Math.abs(touch.clientX - touchStartX);
        const moveY = Math.abs(touch.clientY - touchStartY);
        
        // 如果移动距离超过阈值，取消长按
        if (moveX > MOVE_THRESHOLD || moveY > MOVE_THRESHOLD) {
            clearTimeout(longPressTimer);
            if (magnifier) {
                magnifier.style.display = 'none';
            }
            isLongPress = false;
        }
    }, { passive: false });
    
    // 触摸结束事件
    fileContent.addEventListener('touchend', function() {
        clearTimeout(longPressTimer);
        if (magnifier) {
            magnifier.style.display = 'none';
        }
        isLongPress = false;
    });
    
    // 触摸取消事件
    fileContent.addEventListener('touchcancel', function() {
        clearTimeout(longPressTimer);
        if (magnifier) {
            magnifier.style.display = 'none';
        }
        isLongPress = false;
    });
    
    // 更新放大镜位置和内容
    function updateMagnifier(touch, img) {
        const imgRect = img.getBoundingClientRect();
        const touchX = touch.clientX - imgRect.left;
        const touchY = touch.clientY - imgRect.top;
        
        if (touchX < 0 || touchX > imgRect.width || touchY < 0 || touchY > imgRect.height) {
            magnifier.style.display = 'none';
            return;
        }
        
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const magX = touch.clientX - 120;
        const magY = touch.clientY + scrollY - 200;
        
        magnifier.style.left = `${magX}px`;
        magnifier.style.top = `${magY}px`;
        
        const zoom = 2;
        const bgX = -touchX * zoom + 120;
        const bgY = -touchY * zoom + 80;
        
        magnifier.style.backgroundImage = `url(${img.src})`;
        magnifier.style.backgroundSize = `${imgRect.width * zoom}px ${imgRect.height * zoom}px`;
        magnifier.style.backgroundPosition = `${bgX}px ${bgY}px`;
    }
}