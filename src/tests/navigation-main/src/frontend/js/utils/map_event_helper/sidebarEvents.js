import { resizeSigmaRenderers } from './resizerEvents.js';
import { addConsoleMessage } from '../uiUtils.js';
/**
 * 初始化侧边栏切换功能
 */
function initSidebarToggle() {
    const toggleBtn = document.getElementById('toggle-sidebar');
    const showBtn = document.getElementById('show-sidebar');
    const sidebar = document.querySelector('.app-sidebar');
    const mainContent = document.querySelector('.app-main');
    
    if (!toggleBtn || !showBtn || !sidebar || !mainContent) {
      console.error('找不到侧边栏切换所需的DOM元素');
      return;
    }
    
    // 点击隐藏侧边栏按钮
    toggleBtn.addEventListener('click', function() {
      sidebar.classList.add('hidden');
      mainContent.classList.add('full-width');
      
      // 显示"显示侧边栏"按钮
      showBtn.style.display = 'flex';
      
      // 添加到控制台
      addConsoleMessage('侧边栏已隐藏');
      
      // 触发窗口调整事件以确保所有元素正确调整大小
      window.dispatchEvent(new Event('resize'));
      
      // 调整渲染器大小
      setTimeout(() => {
        resizeSigmaRenderers(); // 使用全局函数
        
        if (window.mapData && window.mapData.clusterRenderer && window.mapData.originalRenderer) {
          // 刷新渲染器
          window.mapData.clusterRenderer.refresh();
          window.mapData.originalRenderer.refresh();
          console.log("隐藏侧边栏后刷新渲染器");
        }
      }, 300); // 等待过渡动画完成
    });
    
    // 点击显示侧边栏按钮
    showBtn.addEventListener('click', function() {
      sidebar.classList.remove('hidden');
      mainContent.classList.remove('full-width');
      
      // 隐藏"显示侧边栏"按钮
      showBtn.style.display = 'none';
      
      // 添加到控制台
      addConsoleMessage('侧边栏已显示');
      
      // 触发窗口调整事件以确保所有元素正确调整大小
      window.dispatchEvent(new Event('resize'));
      
      // 调整渲染器大小
      setTimeout(() => {
        resizeSigmaRenderers(); // 使用全局函数
        
        if (window.mapData && window.mapData.clusterRenderer && window.mapData.originalRenderer) {
          // 刷新渲染器
          window.mapData.clusterRenderer.refresh();
          window.mapData.originalRenderer.refresh();
          console.log("显示侧边栏后刷新渲染器");
        }
      }, 300); // 等待过渡动画完成
    });
  }

  export { initSidebarToggle };