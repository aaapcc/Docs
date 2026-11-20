
document.addEventListener('DOMContentLoaded', function() {
    const loadMoreBtn = document.getElementById('load-more-btn');
    const pageInfo = document.querySelector('.page-info');
    
    let isLoading = false;
    let hasNextPage = true;
    let currentPage = 1;
    let loadedUrls = new Set(); // 防止死循环

    const isMobile = window.innerWidth <= 768;

    // 初始化底部提示文字
    if (loadMoreBtn) {
        if (isMobile) {
            // 移动端：默认隐藏，由代码触发到底时再显示
            loadMoreBtn.style.display = 'none';
            loadMoreBtn.style.cursor = 'default';
            loadMoreBtn.style.pointerEvents = 'none';
        } else {
            // PC端：通过添加 class 来显示
            loadMoreBtn.classList.add('show');
            loadMoreBtn.innerText = '点击加载更多文章';
        }
    }

    function showEndTip() {
        hasNextPage = false;
        if (loadMoreBtn) {
            loadMoreBtn.innerText = '— 已经到底啦 —';
            loadMoreBtn.disabled = true;
            
            if (isMobile) {
                // 移动端：强制显示出来，并且去掉之前设置的隐藏
                loadMoreBtn.style.display = 'block'; 
                loadMoreBtn.style.pointerEvents = 'auto'; // 恢复事件，以便正常显示鼠标状态
            } else {
                // PC端：变淡
                loadMoreBtn.style.opacity = '0.5';
            }
        }
    }

    async function loadNextPage() {
        if (isLoading || !hasNextPage) return;
        
        // 核心：直接抓取当前页面底部的“下一页”链接
        const currentNextBtn = document.getElementById('real-next-btn');
        
        // 如果没找到下一页按钮，或者下一页还是个空链接(#)，就说明到底了
        if (!currentNextBtn || !currentNextBtn.href || currentNextBtn.href.endsWith('#')) {
            showEndTip();
            return;
        }

        let nextUrl = currentNextBtn.href;

        // 如果这个链接已经加载过了（说明服务器没给新的了），也判定到底
        if (loadedUrls.has(nextUrl)) {
            showEndTip();
            return;
        }

        isLoading = true;
        loadedUrls.add(nextUrl); 
        
        if (loadMoreBtn) {
            loadMoreBtn.innerText = '正在加载...';
            if (!isMobile) {
                loadMoreBtn.style.opacity = '0.5';
            } else {
                // 移动端：加载时把提示显示出来，加载完再隐藏
                loadMoreBtn.style.display = 'block'; 
            }
        }

        try {
            const response = await fetch(nextUrl, { cache: 'no-store' });
            const htmlText = await response.text();
            const parser = new DOMParser();
            // 把新页面解析成 DOM
            const doc = parser.parseFromString(htmlText, 'text/html');
            
            const newItems = doc.querySelectorAll('.list-item'); 
            
            if (newItems.length > 0) {
                // 1. 把新文章追加到列表
                const currentItems = document.querySelectorAll('.list-item');
                const lastItem = currentItems[currentItems.length - 1];
                
                newItems.forEach(item => {
                    if(lastItem) {
                        lastItem.parentNode.insertBefore(item, lastItem.nextSibling);
                    } else {
                        document.querySelector('.list-grid').appendChild(item);
                    }
                });

                // 2. 非移动端更新 URL
                if (!isMobile) {
                    window.history.pushState({}, '', nextUrl);
                }

                // 3. 更新页码显示（直接提取新页面里的页码文字）
                currentPage++;
                if (pageInfo) {
                    const newPageInfo = doc.querySelector('.page-info');
                    if (newPageInfo) {
                        // 把当前页面的“第 1 页”替换成新页面的“第 2 页”
                        pageInfo.innerText = newPageInfo.innerText;
                    } else {
                        // 如果新页面没有页码，兜底
                        currentPage++;
                        pageInfo.innerText = `第 ${currentPage} 页`;
                    }
                }
                
                // 4. 【终极方案】：把整个翻页条容器替换掉！
                const newPagination = doc.querySelector('.custom-pagination');
                const currentPagination = document.querySelector('.custom-pagination');
                
                if (newPagination && currentPagination) {
                    // 直接用新页面的翻页条，覆盖掉旧页面的翻页条
                    currentPagination.innerHTML = newPagination.innerHTML;
                    
                    // 替换完后，我们重新去新的DOM里找有没有“下一页”按钮
                    const updatedNextBtn = document.getElementById('real-next-btn');
                    
                    // 如果新翻页条里的下一页还可用（有链接且不是#），说明没到底
                    if (updatedNextBtn && updatedNextBtn.getAttribute('href') && !updatedNextBtn.getAttribute('href').endsWith('#')) {
                        if (loadMoreBtn) {
                            if (!isMobile) {
                                loadMoreBtn.innerText = '点击加载更多文章';
                                loadMoreBtn.style.opacity = '1';
                            } else {
                                // 移动端：加载完毕，恢复隐藏，把位置留给下一次触底
                                loadMoreBtn.style.display = 'none';
                            }
                        }
                    } else {
                        showEndTip();
                    }
                } else {
                    // 如果新页面里连翻页条都没有了，说明彻底到底
                    showEndTip();
                }
                
            } else {
                showEndTip();
            }
        } catch (error) {
            console.error('加载失败', error);
            if (loadMoreBtn && !isMobile) {
                loadMoreBtn.innerText = '加载失败，点击重试';
                loadMoreBtn.style.opacity = '1';
            }
            loadedUrls.delete(nextUrl); 
        } finally {
            isLoading = false;
        }
    }

    // PC 端
    if (!isMobile && loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadNextPage);
    }

    // 移动端
    if (isMobile) {
        window.addEventListener('scroll', function() {
            if (isLoading || !hasNextPage) return;
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 400) {
                loadNextPage();
            }
        });
        
        // 保底：如果一屏就显示完了，强制触发一次
        setTimeout(() => {
            if (document.body.offsetHeight <= window.innerHeight) {
                loadNextPage();
            }
        }, 500);
    }
});