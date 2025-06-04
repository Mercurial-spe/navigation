from src.models.graph import Graph
from src.models.quadtree import QuadTree
from collections import deque


class DBSCAN:
    """
    基于四叉树优化的DBSCAN聚类算法实现
    
    使用四叉树加速空间邻域查询，提高DBSCAN算法在大规模数据上的性能
    """
    
    def __init__(self, eps=1.0, min_samples=5, max_cluster_size=10):
        """
        初始化DBSCAN算法
        
        参数:
            eps: 邻域半径，在此半径内的顶点被视为邻居
            min_samples: 成为核心点所需的最小邻居数量
            max_cluster_size: 每个簇最多允许包含的顶点数量 (可选)
        """
        self.eps = eps
        self.min_samples = min_samples
        self.max_cluster_size = max_cluster_size
        self.cluster_labels = {}  # 每个点的聚类标签
        self.clusters = []        # 每个聚类的点集合
    
    def fit(self, graph):
        """
        对图中的顶点执行DBSCAN聚类
        
        参数:
            graph: Graph对象，包含要聚类的顶点
            
        返回:
            self: 返回自身，便于链式调用
        """
        # 确保图已经构建了空间索引
        if not graph.spatial_index:
            graph.build_spatial_index()
            
        if not graph.vertices:
            self.cluster_labels = {}
            self.clusters = []
            return self
            
        self.cluster_labels = {v_id: -1 for v_id in graph.vertices.keys()}  # -1 表示未分类/噪声点
        self.clusters = []
        cluster_id_counter = 0   # 当前聚类ID的生成器
        core_points_count = 0  # 核心点计数
        
        # 遍历所有顶点
        for vertex_id, vertex_obj in graph.vertices.items():
            # 如果顶点已经被分类，跳过
            if self.cluster_labels[vertex_id] != -1:
                continue
                
            # 获取当前顶点的邻居 (包含自身)
            neighbors = self._get_neighbors(vertex_obj, graph)
            
            # 如果邻居数量小于min_samples，则该点是噪声点或边界点 (暂时标记为噪声)
            if len(neighbors) < self.min_samples:
                # self.cluster_labels[vertex_id] 保持 -1
                continue
                
            # 核心点找到
            core_points_count += 1
            current_cluster_pts = [] # 当前簇的点列表
            current_cluster_id_to_assign = cluster_id_counter

            # 特殊情况：核心点的直接邻居数 > max_cluster_size
            if self.max_cluster_size is not None and len(neighbors) > self.max_cluster_size:
                # 核心点自身加入簇 (如果未满)
                if self.cluster_labels[vertex_id] == -1: # 确保未被其他途经标记
                    if len(current_cluster_pts) < self.max_cluster_size:
                        self.cluster_labels[vertex_id] = current_cluster_id_to_assign
                        current_cluster_pts.append(vertex_obj)
                
                # 直接邻居加入簇 (如果未满且未分类)
                for neighbor_point in neighbors:
                    if len(current_cluster_pts) >= self.max_cluster_size:
                        break
                    if neighbor_point.id == vertex_id: # 跳过核心点自身，已处理
                        continue
                    if self.cluster_labels[neighbor_point.id] == -1:
                        self.cluster_labels[neighbor_point.id] = current_cluster_id_to_assign
                        current_cluster_pts.append(neighbor_point)
            else:
                # 标准DBSCAN扩展
                queue = deque()
                
                # 将初始核心点加入簇和队列 (如果未满且未分类)
                if self.cluster_labels[vertex_id] == -1:
                    if self.max_cluster_size is None or len(current_cluster_pts) < self.max_cluster_size:
                        self.cluster_labels[vertex_id] = current_cluster_id_to_assign
                        current_cluster_pts.append(vertex_obj)
                        queue.append(vertex_obj)
                
                while queue:
                    # 检查簇大小是否已达上限
                    if self.max_cluster_size is not None and len(current_cluster_pts) >= self.max_cluster_size:
                        break # 停止扩展此簇

                    current_q_point = queue.popleft()
                    q_neighbors = self._get_neighbors(current_q_point, graph)

                    if len(q_neighbors) >= self.min_samples: # 如果队首点也是核心点
                        for pn_neighbor in q_neighbors:
                            # 再次检查簇大小是否已达上限
                            if self.max_cluster_size is not None and len(current_cluster_pts) >= self.max_cluster_size:
                                break

                            if self.cluster_labels[pn_neighbor.id] == -1: # 如果邻居是噪声点或未分类
                                self.cluster_labels[pn_neighbor.id] = current_cluster_id_to_assign
                                current_cluster_pts.append(pn_neighbor)
                                queue.append(pn_neighbor) # 加入队列继续扩展
                            # 如果pn_neighbor.id已被分配到其他簇，则不处理 (DBSCAN不窃取)
            
            # 如果当前簇有效（包含点），则正式添加
            if current_cluster_pts:
                self.clusters.append(current_cluster_pts)
                cluster_id_counter += 1
            # else: 核心点未能形成有效簇 (例如max_cluster_size=0), 该核心点保持噪声状态(-1)
            # 因为仅当点实际加入current_cluster_pts时，其label才会被修改。

        print(f"找到 {core_points_count} 个核心点")
        return self
    
    def _get_neighbors(self, vertex, graph):
        """
        使用四叉树查找一个顶点在eps半径内的所有邻居
        
        参数:
            vertex: 中心顶点
            graph: 包含四叉树空间索引的图对象
            
        返回:
            邻居顶点列表
        """
        # 创建一个包含当前点在eps范围内的矩形区域
        x, y = vertex.x, vertex.y
        range_rect = (x - self.eps, y - self.eps, x + self.eps, y + self.eps)
        
        # 使用四叉树的range查询获取该矩形内的所有点
        candidates = graph.spatial_index.query_range(range_rect)
        
        # 过滤出在eps圆形范围内的点
        neighbors = []
        for candidate in candidates:
            if vertex.distance_to(candidate) <= self.eps:
                neighbors.append(candidate)
                
        return neighbors
    
    def get_cluster_labels(self):
        """
        获取每个顶点的聚类标签
        
        返回:
            字典，键为顶点ID，值为聚类ID（-1表示噪声点）
        """
        return self.cluster_labels
    
    def get_clusters(self):
        """
        获取所有聚类
        
        返回:
            列表，包含每个聚类中的顶点列表
        """
        return self.clusters
    
    def get_noise_points(self, graph):
        """
        获取所有被标记为噪声的点
        
        参数:
            graph: 图对象，包含所有顶点
            
        返回:
            噪声点列表
        """
        noise_points = []
        for vertex_id, label in self.cluster_labels.items():
            if label == -1:
                noise_points.append(graph.vertices[vertex_id])
        return noise_points


def apply_dbscan(graph, eps=1.0, min_samples=5, max_cluster_size=None):
    """
    应用DBSCAN算法对图中的顶点进行聚类的便捷函数
    
    参数:
        graph: 图对象，包含要聚类的顶点
        eps: 邻域半径
        min_samples: 成为核心点所需的最小邻居数量
        max_cluster_size: 每个簇最多允许的顶点数量 (可选)
        
    返回:
        cluster_labels: 字典，键为顶点ID，值为聚类ID
        clusters: 列表，包含每个聚类中的顶点列表
    """
    dbscan = DBSCAN(eps=eps, min_samples=min_samples, max_cluster_size=max_cluster_size)
    dbscan.fit(graph)
    return dbscan.get_cluster_labels(), dbscan.get_clusters()


