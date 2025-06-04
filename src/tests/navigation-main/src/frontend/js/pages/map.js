/**
 * 主模块 - 应用程序入口点
 */
import { fetchMapData } from '../api/apiService.js';
import { initMapRender } from '../renderers/mapRenderer.js';
import { initEventListeners} from '../utils/eventHandlers.js';
import { createScaleInfo, createControlButton } from '../utils/uiUtils.js';
import { generateSidebar } from '../utils/sidebar.js';

/**
 * 初始化应用程序
 */
async function initApp() {
  try {
    // 加载并插入侧边栏
    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer) {
      sidebarContainer.innerHTML = generateSidebar('map');
    }

    // 获取地图数据
    const data = await fetchMapData();
    
    // 初始化地图渲染
    const mapData = initMapRender(data);
    
    // 创建缩放信息提示
    mapData.scaleInfo = createScaleInfo(mapData.container);
    
    // 初始化事件监听器
    initEventListeners(mapData);
    
    // 创建控制按钮容器
    const controlContainer = document.createElement('div');
    controlContainer.id = 'map-controls';
    mapData.container.appendChild(controlContainer);
    
    // 按钮配置数组
    const buttons = [
      {
        id: 'reset-view-button',
        text: '重置视图',
        handler: () => mapData.originalRenderer.getCamera().animatedReset()
      },
      {
        id: 'zoom-in-button',
        text: '增大',
        handler: () => mapData.originalRenderer.getCamera().animatedZoom(1.1)
      },
      {
        id: 'zoom-out-button',
        text: '减小',
        handler: () => mapData.originalRenderer.getCamera().animatedUnzoom(1.1)
      }
    ];
    
    // 循环创建按钮
    buttons.forEach(btn => {
      createControlButton(controlContainer, btn.id, btn.text, btn.handler);
    });
    
    // 移除加载提示
    const loadingElement = document.querySelector(".loading");
    if (loadingElement) {
      loadingElement.remove();
    }
    
    console.log("应用程序初始化完成");
  } catch (error) {
    console.error("应用程序初始化失败:", error);
    document.querySelector(".loading").textContent = "应用程序初始化失败，请刷新重试";
  }
}

// 页面加载后初始化应用程序
document.addEventListener('DOMContentLoaded', function() {
    initApp();

    // 添加可折叠组件的交互逻辑
    const collapsibleHeaders = document.querySelectorAll('.collapsible-header');

    collapsibleHeaders.forEach(header => {
        header.addEventListener('click', function() {
            // 切换header的active类
            this.classList.toggle('active');

            // 获取对应的内容区域
            const content = this.nextElementSibling;

            // 切换内容的显示/隐藏
            if (content.classList.contains('show')) {
                content.classList.remove('show');
            } else {
                content.classList.add('show');
            }
        });
    });
}); 