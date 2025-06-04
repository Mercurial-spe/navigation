/**
 * 节点处理模块 - 负责处理节点和边的样式、状态变化等
 */

// 节点颜色常量
const COLORS = {
  SELECTED_NODE: "#FF5733", // 选中节点颜色
  NEARBY_NODE: "#33FF57",   // 附近节点颜色
  ORIGINAL_NODE: "#66ccff", // 原始节点颜色
  NEARBY_EDGE: "#33FF57",   // 附近边颜色
  ORIGINAL_EDGE: "#848484", // 原始边颜色
  DIMMED_NODE: "#cccccc",   // 暗淡节点颜色
  DIMMED_EDGE: "#dddddd",    // 暗淡边颜色
  // 新增颜色定义以满足特定高亮需求
  TARGET_NODE: "#FF0000",    // 目标节点: 红色
  RELATED_NODE: "#000000",   // 相关(邻近)节点: 黑色
  RELATED_EDGE: "#800080",    // 相关(邻近)边: 紫色
  // 添加路径颜色
  SHORTEST_PATH: "#FF8C00",   // 最短路径: 橙色
  FASTEST_PATH: "#4169E1",    // 最快路径: 蓝色
  PATH_NODE: "#8A2BE2",      // 路径节点: 紫色
  LOCATION_EDGE: "#FFD700" // 特殊地点边: 金色
};

// 存储节点和边的状态
let nodeState = {}; 
let edgeState = {}; 

/**
 * 高亮节点和边
 * @param {Object} graph - graphology图实例
 * @param {Array} nodes - 需要高亮的节点数组
 * @param {Array} edges - 需要高亮的边数组
 */
function highlightNearbyNodes(graph, nodes, edges) {
  // 保存所有节点的原始颜色
  graph.forEachNode((nodeId, attributes) => {
    if (!nodeState[nodeId]) {
      nodeState[nodeId] = {
        originalColor: attributes.color,
        originalSize: attributes.size
      };
    }
    
    // 默认所有节点都变暗淡
    graph.setNodeAttribute(nodeId, "color", COLORS.DIMMED_NODE);
    graph.setNodeAttribute(nodeId, "size", attributes.size * 0.8);
  });
  
  // 保存所有边的原始颜色
  graph.forEachEdge((edgeId, attributes) => {
    if (!edgeState[edgeId]) {
      edgeState[edgeId] = {
        originalColor: attributes.color,
        originalSize: attributes.size
      };
    }
    
    // 默认所有边都变暗淡
    graph.setEdgeAttribute(edgeId, "color", COLORS.DIMMED_EDGE);
    graph.setEdgeAttribute(edgeId, "size", attributes.size * 0.5);
  });
  
  // 高亮传入的节点
  // 假设 nodes 数组的第一个元素是"目标点"，其余是"相关点"
  nodes.forEach((node, index) => {
    const nodeId = node.id.toString();
    let highlightColor;

    // 第一个节点视为目标节点 (如果nodes数组不为空)
    if (nodes.length > 0 && index === 0) { 
      highlightColor = COLORS.TARGET_NODE; 
    } else { // 其他节点视为相关节点
      highlightColor = COLORS.RELATED_NODE; 
    }
    
    if (graph.hasNode(nodeId)) {
      // 如果已存在于图中，修改颜色和大小
      graph.setNodeAttribute(nodeId, "color", highlightColor);
      graph.setNodeAttribute(nodeId, "size", (nodeState[nodeId]?.originalSize || 5) * 1.2);
    } else {
      // 如果是新节点，添加到图中
      graph.addNode(nodeId, {
        label: node.label || `Node ${nodeId}`,
        x: node.x,
        y: node.y,
        size: 6, 
        color: highlightColor
      });
    }
  });
  
  // 高亮传入的边
  edges.forEach(edge => {
    const source = edge.source.toString();
    const target = edge.target.toString();
    
    // 只处理source和target都在图中的边
    if (graph.hasNode(source) && graph.hasNode(target)) {
      const edgeId = graph.edge(source, target) || `${source}-${target}`;
      
      if (graph.hasEdge(edgeId)) {
        // 如果边已存在，修改颜色和大小
        graph.setEdgeAttribute(edgeId, "color", COLORS.RELATED_EDGE); // 相关边用紫色
        graph.setEdgeAttribute(edgeId, "size", (edgeState[edgeId]?.originalSize || 1) * 1.5);
      } else {
        // 如果是新边，添加到图中
        try {
          graph.addEdge(source, target, {
            size: 1.5, 
            color: COLORS.RELATED_EDGE // 相关边用紫色
          });
        } catch (e) {
          console.warn("添加边时出错:", e, edge);
        }
      }
    }
  });
}

/**
 * 清除附近点和边的高亮
 * @param {Object} graph - graphology图实例
 */
function clearNearbyHighlights(graph) {
  // 重置节点颜色
  graph.forEachNode((nodeId, attributes) => {
    if (nodeState[nodeId]) {
      graph.setNodeAttribute(nodeId, "color", nodeState[nodeId].originalColor || COLORS.ORIGINAL_NODE);
      graph.setNodeAttribute(nodeId, "size", nodeState[nodeId].originalSize || 5);
    }
  });

  // 重置边颜色
  graph.forEachEdge((edgeId, attributes) => {
    if (edgeState[edgeId]) {
      graph.setEdgeAttribute(edgeId, "color", edgeState[edgeId].originalColor || COLORS.ORIGINAL_EDGE);
      graph.setEdgeAttribute(edgeId, "size", edgeState[edgeId].originalSize || 1);
    }
  });

  // 清空状态记录
  nodeState = {};
  edgeState = {};
}

/**
 * 清除路径高亮
 * @param {Object} graph - graphology图实例
 */
function clearPathHighlights(graph) {
  if (window.mapData && window.mapData.state && window.mapData.state.highlightedPaths) {
    const paths = window.mapData.state.highlightedPaths;

    // 重置最短路径
    paths.shortestPath.edgeIds.forEach(edgeId => {
      if (graph.hasEdge(edgeId)) {
        graph.setEdgeAttribute(edgeId, "color", edgeState[edgeId]?.originalColor || COLORS.ORIGINAL_EDGE);
        graph.setEdgeAttribute(edgeId, "size", edgeState[edgeId]?.originalSize || 3);
      }
    });
    paths.shortestPath.nodeIds.forEach(nodeId => {
      if (graph.hasNode(nodeId)) {
        graph.setNodeAttribute(nodeId, "color", nodeState[nodeId]?.originalColor || COLORS.ORIGINAL_NODE);
        graph.setNodeAttribute(nodeId, "size", nodeState[nodeId]?.originalSize || 3);
      }
    });

    // 重置最快路径
    paths.fastestPath.edgeIds.forEach(edgeId => {
      if (graph.hasEdge(edgeId)) {
        graph.setEdgeAttribute(edgeId, "color", edgeState[edgeId]?.originalColor || COLORS.ORIGINAL_EDGE);
        graph.setEdgeAttribute(edgeId, "size", edgeState[edgeId]?.originalSize || 3);
      }
    });
    paths.fastestPath.nodeIds.forEach(nodeId => {
      if (graph.hasNode(nodeId)) {
        graph.setNodeAttribute(nodeId, "color", nodeState[nodeId]?.originalColor || COLORS.ORIGINAL_NODE);
        graph.setNodeAttribute(nodeId, "size", nodeState[nodeId]?.originalSize || 3);
      }
    });

    // 重置其他路径
    paths.otherPaths.edgeIds.forEach(edgeId => {
      if (graph.hasEdge(edgeId)) {
        graph.setEdgeAttribute(edgeId, "color", edgeState[edgeId]?.originalColor || COLORS.ORIGINAL_EDGE);
        graph.setEdgeAttribute(edgeId, "size", edgeState[edgeId]?.originalSize || 3);
      }
    });
    paths.otherPaths.nodeIds.forEach(nodeId => {
      if (graph.hasNode(nodeId)) {
        graph.setNodeAttribute(nodeId, "color", nodeState[nodeId]?.originalColor || COLORS.ORIGINAL_NODE);
        graph.setNodeAttribute(nodeId, "size", nodeState[nodeId]?.originalSize || 3);
      }
    });

    // 清空高亮路径数据
    window.mapData.state.highlightedPaths = {
      shortestPath: { edgeIds: new Set(), nodeIds: new Set() },
      fastestPath: { edgeIds: new Set(), nodeIds: new Set() },
      otherPaths: { edgeIds: new Set(), nodeIds: new Set() }
    };
    console.log('已清除高亮路径数据');
  }
}

/**
 * 重置节点和边的颜色
 * @param {Object} graph - graphology图实例
 * @param {Object} renderer - sigma渲染器实例
 */
function resetNodeAndEdgeColors(graph, renderer) {
  // 清除附近点和边的高亮
  clearNearbyHighlights(graph);

  // 清除路径高亮
  clearPathHighlights(graph);

  // 刷新渲染
  renderer.refresh();
}

/**
 * 高亮指定的边
 * @param {Object} graph - graphology图实例
 * @param {Array} edges - 边数组，每条边应有source和target属性
 * @param {String} color - 高亮颜色，可以是hex值或COLORS常量
 * @param {Boolean} highlightNodes - 是否同时高亮边的节点（默认为true）
 * @param {String} nodeColor - 节点高亮颜色（默认为PATH_NODE）
 * @param {String} pathType - 路径类型，可选值：'shortest'，'fastest'，null (默认为null，表示其他类型的高亮)
 * @param {String} startNodeId - 起始节点ID (可选)
 * @param {String} endNodeId - 结束节点ID (可选)
 */
function highlightEdges(graph, edges, color, highlightNodes = true, nodeColor = COLORS.PATH_NODE, pathType = null, startNodeId = null, endNodeId = null) {
  if (!graph || !edges || !Array.isArray(edges) || edges.length === 0) {
    console.warn("无效的参数传递给highlightEdges");
    return;
  }

  // 存储沿途的节点ID和边ID（用于高亮和防止交通更新覆盖）
  const pathNodeIds = new Set();
  const pathEdgeIds = new Set();
  
  // 遍历边数组
  edges.forEach(edge => {
    const source = edge.source?.toString() || edge.source_id?.toString();
    const target = edge.target?.toString() || edge.target_id?.toString();
    
    if (!source || !target) {
      console.warn("边缺少source或target:", edge);
      return;
    }

    // 收集路径上的节点
    if (highlightNodes) {
      pathNodeIds.add(source);
      pathNodeIds.add(target);
    }
    
    // 检查节点是否存在于图中
    const sourceExists = graph.hasNode(source);
    const targetExists = graph.hasNode(target);
    
    if (!sourceExists || !targetExists) {
      console.warn(`节点不存在于图中: source=${source} (${sourceExists}), target=${target} (${targetExists})`);
      return;
    }
    
    // 获取边ID或创建边
    let edgeId;
    try {
      edgeId = graph.edge(source, target);
      
      // 如果找到边，加入到pathEdgeIds集合中
      if (edgeId) {
        pathEdgeIds.add(edgeId);
      }
    } catch (e) {
      console.warn(`获取边ID失败: ${e.message}`);
    }
    
    if (edgeId) {
      // 如果边已存在，修改颜色和大小
      graph.setEdgeAttribute(edgeId, "color", color);
      graph.setEdgeAttribute(edgeId, "size", 6); // 加粗显示
    } else {
      // 如果边不存在，添加到图中
      try {
        const newEdgeId = graph.addEdge(source, target, {
          size: 2,
          color: color
        });
        console.log(`已添加边 ${source}->${target} 并设置颜色为 ${color}`);
        
        // 添加新边到pathEdgeIds集合
        if (newEdgeId) {
          pathEdgeIds.add(newEdgeId);
        }
      } catch (e) {
        console.warn(`添加边 ${source}->${target} 时出错:`, e);
      }
    }
  });
  
  // 高亮路径上的节点
  if (highlightNodes && pathNodeIds.size > 0) {
    pathNodeIds.forEach(nodeId => {
      if (graph.hasNode(nodeId)) {
        let currentNodeColor = nodeColor;
        
        // 如果提供了startNodeId且当前节点是起始节点
        // 提取节点ID和起始/结束节点ID的数字部分进行比较
        const currentNumericId = parseInt(nodeId.replace(/^node/, ''), 10); 
        const startNumericId = startNodeId !== null ? parseInt(startNodeId.toString().replace(/^node/, ''), 10) : null;
        const endNumericId = endNodeId !== null ? parseInt(endNodeId.toString().replace(/^node/, ''), 10) : null;

        if (startNumericId !== null && currentNumericId === startNumericId) {
          currentNodeColor = COLORS.TARGET_NODE;

        // 如果提供了endNodeId且当前节点是目标节点
        } else if (endNumericId !== null && currentNumericId === endNumericId) {
          currentNodeColor = COLORS.TARGET_NODE;
        }

        graph.setNodeAttribute(nodeId, "color", currentNodeColor);
        // 增加节点大小使其更明显
        const currentSize = graph.getNodeAttribute(nodeId, "size") || 5;
        graph.setNodeAttribute(nodeId, "size", Math.max(currentSize, 6));
      }
    });
  }
  
  // 将高亮的边和节点ID存储到window.mapData.state中，以便交通更新时保护这些颜色
  if (window.mapData && window.mapData.state) {
    // 初始化高亮路径数据结构（如果不存在）
    if (!window.mapData.state.highlightedPaths) {
      window.mapData.state.highlightedPaths = {
        shortestPath: { edgeIds: new Set(), nodeIds: new Set() },
        fastestPath: { edgeIds: new Set(), nodeIds: new Set() },
        otherPaths: { edgeIds: new Set(), nodeIds: new Set() }
      };
    }
    
    // 根据路径类型存储边和节点ID
    if (pathType === 'shortest') {
      window.mapData.state.highlightedPaths.shortestPath.edgeIds = pathEdgeIds;
      window.mapData.state.highlightedPaths.shortestPath.nodeIds = pathNodeIds;
    } else if (pathType === 'fastest') {
      window.mapData.state.highlightedPaths.fastestPath.edgeIds = pathEdgeIds;
      window.mapData.state.highlightedPaths.fastestPath.nodeIds = pathNodeIds;
    } else {
      window.mapData.state.highlightedPaths.otherPaths.edgeIds = pathEdgeIds;
      window.mapData.state.highlightedPaths.otherPaths.nodeIds = pathNodeIds;
    }
    
    console.log(`已存储${pathType || '其他'}路径的 ${pathEdgeIds.size} 条边和 ${pathNodeIds.size} 个节点ID，以防止交通更新覆盖`);
  }
  
  return { edgeIds: pathEdgeIds, nodeIds: pathNodeIds };
}

export { COLORS, highlightNearbyNodes, resetNodeAndEdgeColors, highlightEdges, clearNearbyHighlights, clearPathHighlights };