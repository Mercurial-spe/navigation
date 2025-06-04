import Sigma from 'https://cdn.jsdelivr.net/npm/sigma@3.0.2/+esm';
/**
 * 初始化地图渲染，返回简化版的地图渲染数据，专为四叉树可视化使用
 * @param {Object} data - 包含节点和边数据的对象
 * @returns {Object} - 包含renderer等属性的对象
 */
export function initTriangulationMapRender(data) {
    
    // 获取地图节点和边数据
    const nodes = data.detailData?.nodes || [];
    const edges = data.detailData?.edges || [];
    
    // 创建容器
    const container = document.getElementById("map-container");
    
    // 确保容器存在
    if (!container) {
      console.error("地图容器不存在");
      return null;
    }
    
    // 创建graphology图实例
    const graph = new graphology.Graph();
    
    // 添加节点
    nodes.forEach(node => {
      graph.addNode(node.id, {
        label: node.label || `Node ${node.id}`,
        x: node.x,
        y: node.y,
        size: 2, // 使用较小的节点大小以便于四叉树可视化
        color: node.color || "rgb(120, 120, 180)",
        
      });
    });
    
    // 添加边
    edges.forEach(edge => {
      try {
        const source = edge.source !== undefined ? edge.source : edge.from;
        const target = edge.target !== undefined ? edge.target : edge.to;
        
        if (source === undefined || target === undefined) {
          console.warn("跳过边，缺少source或target:", edge);
          return;
        }
        
        graph.addEdge(source, target, {
          size: edge.size || 0.3,
          color: edge.color || "rgb(180, 180, 180)"
        });
      } catch (e) {
        console.error("添加边时出错:", e, edge);
      }
    });
    
    console.log(`地图已加载 ${nodes.length} 个节点和 ${edges.length} 条边`);
    
    // 创建Sigma实例
    const renderer = new Sigma(graph, container, {
      renderEdgeLabels: false,
      minCameraRatio: 0.01,
      maxCameraRatio: 2,
      zoomingRatio: 1.7,
      autoRescale: true,
    });
    
    // 设置初始缩放比例
    renderer.getCamera().ratio = 0.1;
    
    // 返回渲染器实例供四叉树可视化使用
    return {
      renderer,
      graph,
      container
    };
  }
  
// 全局变量，在模块范围内共享
let sigmaInstance = null;
let circumcircleCanvas, circumcircleCtx;
let allCircumcircles = [];

/**
 * 初始化外接圆渲染画布
 * @param {HTMLCanvasElement} canvas - 外接圆绘制的Canvas元素
 */
export function initCircumcircleCanvas(canvas) {
  circumcircleCanvas = canvas;
  circumcircleCtx = canvas.getContext('2d');
  
  // 获取map-container的大小
  const mapContainer = document.getElementById('map-container');
  if (mapContainer) {
    circumcircleCanvas.width = mapContainer.clientWidth;
    circumcircleCanvas.height = mapContainer.clientHeight;
  } else {
    console.warn('map-container不存在，使用默认大小');
    circumcircleCanvas.width = window.innerWidth;
    circumcircleCanvas.height = window.innerHeight;
  }
}

/**
 * 设置Sigma实例引用
 * @param {Object} renderer - Sigma渲染器实例
 */
export function setCircumcircleSigmaInstance(renderer) {
  sigmaInstance = renderer;
}

/**
 * 绘制德劳内三角剖分外接圆
 * @param {Array} circumcircles - 外接圆数据数组
 */
export function drawCircumcircles(circumcircles) {
  if (!circumcircleCtx || !sigmaInstance) return;
  
  circumcircleCtx.clearRect(0, 0, circumcircleCanvas.width, circumcircleCanvas.height);
  if (circumcircles.length === 0) return;
  
  circumcircles.forEach(circle => {
    const { center_x, center_y, radius } = circle;
    
    // 将图形坐标转换为视口坐标
    const centerViewport = sigmaInstance.graphToViewport({ x: center_x, y: center_y });
    
    // 计算视口上的半径（考虑缩放比例）
    const point = sigmaInstance.graphToViewport({ x: center_x + radius, y: center_y });
    const radiusViewport = Math.sqrt(
      Math.pow(point.x - centerViewport.x, 2) + Math.pow(point.y - centerViewport.y, 2)
    );
    
    // 绘制圆
    circumcircleCtx.beginPath();
    circumcircleCtx.arc(centerViewport.x, centerViewport.y, radiusViewport, 0, Math.PI * 2);
    circumcircleCtx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
    circumcircleCtx.lineWidth = 1;
    circumcircleCtx.stroke();
    
    // 标记圆心
    circumcircleCtx.beginPath();
    circumcircleCtx.arc(centerViewport.x, centerViewport.y, 2, 0, Math.PI * 2);
    circumcircleCtx.fillStyle = 'rgba(30, 0, 255, 0.2)';
    circumcircleCtx.fill();
  });
}

/**
 * 处理窗口大小调整
 */
export function handleCircumcircleResize() {
  if (!circumcircleCanvas) return;
  
  // 调整画布大小
  const mapContainer = document.getElementById('map-container');
  if (mapContainer) {
    circumcircleCanvas.width = mapContainer.clientWidth;
    circumcircleCanvas.height = mapContainer.clientHeight;
  } else {
    circumcircleCanvas.width = window.innerWidth;
    circumcircleCanvas.height = window.innerHeight;
  }
  
  // 重新绘制外接圆
  if (sigmaInstance && allCircumcircles.length > 0) {
    drawCircumcircles(allCircumcircles);
  }
}

/**
 * 渲染三角剖分外接圆
 * @param {Object} data - 三角剖分数据，包含外接圆信息
 */
export function renderTriangulationCircumcircles(data) {
  if (!data || !data.circumcircles || !Array.isArray(data.circumcircles)) {
    console.error("无效的三角剖分数据格式");
    return;
  }
  
  allCircumcircles = data.circumcircles;
  console.log(`加载了 ${allCircumcircles.length} 个外接圆数据`);
  
  drawCircumcircles(allCircumcircles);
  
  // 添加相机更新监听器，在缩放或平移时重新绘制
  if (sigmaInstance) {
    sigmaInstance.getCamera().on("updated", () => {
      drawCircumcircles(allCircumcircles);
    });
  }
}
  