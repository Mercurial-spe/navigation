/**
 * 四叉树可视化页面脚本
 */
import { fetchMapData } from '../api/apiService.js';
import { 
  initQuadtreeMapRender, 
  initQuadtreeCanvas, 
  setQuadtreeSigmaInstance, 
  visualizeQuadtreeStepByStep, 
  handleResize 
} from '../renderers/quadtreeRenderers.js';
import { createScaleInfo, addConsoleMessage } from '../utils/uiUtils.js';
import { generateSidebar } from '../utils/sidebar.js';

// 初始化全局变量
let quadtreeCanvas;
let mapData = {};

/**
 * 初始化侧边栏切换功能
 * 代替使用完整的 eventHandlers.js 中的 initEventListeners，
 * 因为四叉树渲染器结构与主地图渲染器不同
 */
function initQuadtreeSidebar() {
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
    
    // 调整渲染器大小 - 特定于四叉树页面
    setTimeout(() => handleResize(), 300);
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
    
    // 调整渲染器大小 - 特定于四叉树页面
    setTimeout(() => handleResize(), 300);
  });
}

/**
 * 主程序入口
 */
async function main() {
    try {
        // 加载并插入侧边栏
        const sidebarContainer = document.getElementById('sidebar-container');
        if (sidebarContainer) {
          sidebarContainer.innerHTML = generateSidebar('quadtree-viz');
        }

        // 初始化 Canvas
        quadtreeCanvas = document.getElementById('quadtreeCanvas');
        initQuadtreeCanvas(quadtreeCanvas);
        
        // 获取地图数据
        const mapAPIData = await fetchMapData();
        
        // 初始化地图渲染，使用四叉树专用的渲染函数
        mapData = initQuadtreeMapRender(mapAPIData);
        
        if (mapData && mapData.renderer) {
            setQuadtreeSigmaInstance(mapData.renderer);
            visualizeQuadtreeStepByStep();
            
            // 初始化缩放信息提示
            mapData.scaleInfo = createScaleInfo(document.getElementById('map-container'));
            
            // 初始化侧边栏切换功能
            initQuadtreeSidebar();
            
            addConsoleMessage("四叉树可视化和交互功能已初始化");
        } else {
            console.error("Failed to initialize map renderer or get Sigma instance.");
            alert("Failed to initialize map renderer.");
            return;
        }
        
        // 移除加载提示
        const loadingElement = document.querySelector(".loading");
        if (loadingElement) {
            loadingElement.remove();
        }
        console.log("Application and Quadtree visualization initialized.");

    } catch (error) {
        console.error("Application initialization failed:", error);
        const loadingElement = document.querySelector(".loading");
        if (loadingElement) {
             loadingElement.textContent = "Application initialization failed, please refresh.";
        }
        alert("Application initialization failed. Check console.");
    }
}

// 初始化事件监听器
window.addEventListener('resize', handleResize);
document.addEventListener('DOMContentLoaded', function() {
    main();

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