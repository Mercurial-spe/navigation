/**
 * 三角剖分可视化页面脚本
 */
import { fetchMapData, fetchTriangulationData } from '../api/apiService.js';
import { generateSidebar } from '../utils/sidebar.js';
import { addConsoleMessage, createScaleInfo } from '../utils/uiUtils.js';
import { initTriangulationMapRender, initCircumcircleCanvas, setCircumcircleSigmaInstance, renderTriangulationCircumcircles, handleCircumcircleResize } from '../renderers/triangulationRenderers.js';

// 初始化全局变量
let triangulationCanvas;
let mapData = {}; // 用于存储地图实例和其他相关数据

/**
 * 初始化侧边栏切换功能
 */
function initTriangulationSidebar() {
  const toggleBtn = document.getElementById('toggle-sidebar'); // 假设侧边栏HTML结构与四叉树一致
  const showBtn = document.getElementById('show-sidebar');
  const sidebar = document.querySelector('.app-sidebar');
  const mainContent = document.querySelector('.app-main');

  if (!toggleBtn || !showBtn || !sidebar || !mainContent) {
    console.error('找不到侧边栏切换所需的DOM元素');
    addConsoleMessage('错误：找不到侧边栏切换按钮。', 'error');
    return;
  }

  toggleBtn.addEventListener('click', function() {
    sidebar.classList.add('hidden');
    mainContent.classList.add('full-width');
    showBtn.style.display = 'flex';
    addConsoleMessage('侧边栏已隐藏');
    window.dispatchEvent(new Event('resize'));
    setTimeout(() => handleCircumcircleResize(), 300);
  });

  showBtn.addEventListener('click', function() {
    sidebar.classList.remove('hidden');
    mainContent.classList.remove('full-width');
    showBtn.style.display = 'none';
    addConsoleMessage('侧边栏已显示');
    window.dispatchEvent(new Event('resize'));
    setTimeout(() => handleCircumcircleResize(), 300);
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
          sidebarContainer.innerHTML = generateSidebar('triangulation-viz'); // 使用新的页面标识
        }

        // 获取地图容器元素
        const mapContainer = document.getElementById('map-container');
        if (!mapContainer) {
            addConsoleMessage('错误: 地图容器 #map-container 未找到!', 'error');
            console.error('错误: 地图容器 #map-container 未找到!');
            return;
        }

        // 创建三角剖分Canvas
        triangulationCanvas = document.createElement('canvas');
        triangulationCanvas.id = 'triangulationCanvas';
        mapContainer.appendChild(triangulationCanvas);
        
        // 初始化三角剖分Canvas
        initCircumcircleCanvas(triangulationCanvas);

        // 获取地图数据
        const mapAPIData = await fetchMapData();
        if (!mapAPIData) {
            addConsoleMessage('错误: 未能获取地图数据。', 'error');
            return;
        }
        addConsoleMessage('地图数据已成功获取。', 'success');

        // 初始化地图渲染
        mapData = initTriangulationMapRender(mapAPIData);

        if (mapData && mapData.renderer) {
            // 设置Sigma实例供三角剖分使用
            setCircumcircleSigmaInstance(mapData.renderer);
            addConsoleMessage('Sigma 地图渲染器已成功初始化。', 'success');

            // 获取并渲染三角剖分数据
            try {
                const triangulationData = await fetchTriangulationData();
                if (triangulationData && triangulationData.circumcircles) {
                    renderTriangulationCircumcircles(triangulationData);
                    addConsoleMessage(`三角剖分外接圆数据已加载 (${triangulationData.circumcircles.length} 个圆)`, 'success');
                } else {
                    addConsoleMessage('三角剖分数据格式无效或为空。', 'warning');
                }
            } catch (error) {
                console.error("获取三角剖分数据失败:", error);
                addConsoleMessage('获取三角剖分数据时出错: ' + error.message, 'error');
            }

            // 初始化缩放信息提示 (如果适用，并确保 createScaleInfo 正确处理)
            if (mapContainer && createScaleInfo) {
                mapData.scaleInfo = createScaleInfo(mapContainer, mapData.renderer);
                 addConsoleMessage('比例尺信息已初始化。');
            }

            // 初始化侧边栏切换功能
            initTriangulationSidebar();

            // 添加窗口大小调整监听
            window.addEventListener('resize', handleCircumcircleResize);

            addConsoleMessage("三角剖分可视化布局及地图已准备就绪。", "success");
        } else {
            console.error("地图渲染器初始化失败。");
            addConsoleMessage("错误：地图渲染器初始化失败。请检查控制台获取更多信息。", "error");
            // alert("地图渲染器初始化失败。"); // 可以选择是否使用alert
            return; // 如果渲染失败，则停止执行
        }

        // 移除加载提示
        const loadingElement = document.querySelector(".loading");
        if (loadingElement) {
            loadingElement.remove();
        }
        console.log("Triangulation visualization layout and map initialized.");
        addConsoleMessage("三角剖分可视化系统框架加载完成。", "success");

    } catch (error) {
        console.error("应用初始化失败:", error);
        addConsoleMessage(`错误：应用初始化失败 - ${error.message}`, "error");
        const loadingElement = document.querySelector(".loading");
        if (loadingElement) {
             loadingElement.textContent = "初始化失败，请刷新页面或检查控制台。";
        }
        alert("应用初始化失败，详情请查看控制台。");
    }
}



document.addEventListener('DOMContentLoaded', function() {
    main();

    // 控制台清空按钮 (复用 quadtree.html 中的结构)
    const clearConsoleBtn = document.getElementById('clearConsole');
    const consoleOutput = document.getElementById('consoleOutput');
    if (clearConsoleBtn && consoleOutput) {
        clearConsoleBtn.addEventListener('click', () => {
            consoleOutput.innerHTML = '';
            addConsoleMessage('控制台已清空。');
        });
    }

    // 可折叠组件的交互逻辑 (如果侧边栏或其他地方用到)
    // 这部分可以考虑移到 uiUtils.js 如果多处复用
    const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
    collapsibleHeaders.forEach(header => {
        header.addEventListener('click', function() {
            this.classList.toggle('active');
            const content = this.nextElementSibling;
            if (content.classList.contains('show')) {
                content.classList.remove('show');
            } else {
                content.classList.add('show');
            }
        });
    });
});
