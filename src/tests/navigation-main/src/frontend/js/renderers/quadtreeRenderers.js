/**
 * 四叉树渲染模块 - 提供简化版的地图渲染功能，专为四叉树可视化设计
 */
import {fetchQuadtreeData} from '../api/apiService.js';

// 全局变量，在模块范围内共享
let sigmaInstance = null;
let quadtreeCanvas, quadtreeCtx;
let allQuadtreeBoundaries = [];
let currentlyDrawingQuadtree = false;

/**
 * 初始化四叉树渲染组件
 * @param {HTMLCanvasElement} canvas - 四叉树绘制的Canvas元素
 */
export function initQuadtreeCanvas(canvas) {
  quadtreeCanvas = canvas;
  quadtreeCtx = canvas.getContext('2d');
  
  // 获取map-container的大小，而不是window的大小
  const mapContainer = document.getElementById('map-container');
  if (mapContainer) {
    quadtreeCanvas.width = mapContainer.clientWidth;
    quadtreeCanvas.height = mapContainer.clientHeight;
  } else {
    console.warn('map-container不存在，使用默认大小');
    quadtreeCanvas.width = window.innerWidth;
    quadtreeCanvas.height = window.innerHeight;
  }
}

/**
 * 设置Sigma实例引用
 * @param {Object} renderer - Sigma渲染器实例
 */
export function setQuadtreeSigmaInstance(renderer) {
  sigmaInstance = renderer;
}

/**
 * 绘制四叉树边界
 * @param {Array} boundaries - 四叉树边界数据
 */
export function drawQuadtreeBoundaries(boundaries) {
    if (!quadtreeCtx) return;
    
    quadtreeCtx.clearRect(0, 0, quadtreeCanvas.width, quadtreeCanvas.height);
    if (!sigmaInstance || boundaries.length === 0) return;

    boundaries.forEach(boundary => {
        const { x_min, y_min, x_max, y_max, level } = boundary;
        
        const p1 = sigmaInstance.graphToViewport({ x: x_min, y: y_min });
        const p2 = sigmaInstance.graphToViewport({ x: x_max, y: y_max });
        
        const screen_x_min = Math.min(p1.x, p2.x);
        const screen_y_min = Math.min(p1.y, p2.y);
        const screen_x_max = Math.max(p1.x, p2.x);
        const screen_y_max = Math.max(p1.y, p2.y);

        quadtreeCtx.strokeStyle = `rgba(0,0,255,${0.2 + 0.8/(level+1)})`;
        quadtreeCtx.lineWidth = 1;
        quadtreeCtx.strokeRect(screen_x_min, screen_y_min, screen_x_max - screen_x_min, screen_y_max - screen_y_min);
    });
}

/**
 * 逐步可视化四叉树
 * @returns {Promise<void>}
 */
export async function visualizeQuadtreeStepByStep() {
    if (currentlyDrawingQuadtree) return;
    currentlyDrawingQuadtree = true;

    allQuadtreeBoundaries = await fetchQuadtreeData();
    if (!sigmaInstance) {
        console.warn("Sigma instance not ready for quadtree drawing.");
        currentlyDrawingQuadtree = false;
        return;
    }

    const boundariesByLevel = {};
    allQuadtreeBoundaries.forEach(b => {
        if (!boundariesByLevel[b.level]) boundariesByLevel[b.level] = [];
        boundariesByLevel[b.level].push(b);
    });
    const maxLevel = Math.max(...Object.keys(boundariesByLevel).map(Number).filter(k => !isNaN(k)), -1);
    
    let currentLevel = 0;
    const drawnBoundaries = [];

    function drawNextLevel() {
        if (currentLevel <= maxLevel) {
            const boundariesToDraw = boundariesByLevel[currentLevel] || [];
            drawnBoundaries.push(...boundariesToDraw);
            drawQuadtreeBoundaries(drawnBoundaries); // Draw cumulative boundaries
            currentLevel++;
            setTimeout(drawNextLevel, 500);
        } else {
            console.log("Quadtree drawing complete.");
            currentlyDrawingQuadtree = false;
        
            if (sigmaInstance) {
                sigmaInstance.getCamera().on("updated", () => {
                     drawQuadtreeBoundaries(drawnBoundaries); // Redraw all drawn boundaries
                });
            }
        }
    }
    drawNextLevel();
}

/**
 * 窗口大小调整处理
 */
export function handleResize() {
    if (!quadtreeCanvas) return;
    
    // 获取map-container的大小，而不是window的大小
    const mapContainer = document.getElementById('map-container');
    if (mapContainer) {
      quadtreeCanvas.width = mapContainer.clientWidth;
      quadtreeCanvas.height = mapContainer.clientHeight;
    } else {
      quadtreeCanvas.width = window.innerWidth;
      quadtreeCanvas.height = window.innerHeight;
    }
    
    if (sigmaInstance && allQuadtreeBoundaries.length > 0) {
        drawQuadtreeBoundaries(allQuadtreeBoundaries);
    }
}

/**
 * 初始化地图渲染，返回简化版的地图渲染数据，专为四叉树可视化使用
 * @param {Object} data - 包含节点和边数据的对象
 * @returns {Object} - 包含renderer等属性的对象
 */
export function initQuadtreeMapRender(data) {
  console.time('四叉树地图初始化时间');
  
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
    minCameraRatio: 0.1,
    maxCameraRatio: 2,
    zoomingRatio: 1.2,
    autoRescale: true,
  });
  
  // 设置初始缩放比例
  renderer.getCamera().ratio = 0.3;
  
  console.timeEnd('四叉树地图初始化时间');
  console.log("四叉树地图渲染完成");
  
  // 返回渲染器实例供四叉树可视化使用
  return {
    renderer,
    graph,
    container
  };
}
