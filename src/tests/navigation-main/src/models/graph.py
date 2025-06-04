"""
图类，表示整个地图及其所有顶点和边
"""
import math
from collections import defaultdict, deque  # 添加deque用于BFS
from .quadtree import QuadTree

class Graph:
    """
    图类，表示整个地图
    
    属性:
        vertices: 图中所有顶点的字典 {id: vertex}
        edges: 图中所有边的字典 {id: edge}
        spatial_index: 空间索引结构
    """
    
    def __init__(self):
        """初始化空图"""
        self.vertices = {}  # id -> vertex
        self.edges = {}     # id -> edge
        self.spatial_index = None  # 空间索引，后续实现
        self.next_vertex_id = 0
        self.next_edge_id = 0
    
    def add_vertex(self, vertex):
        """
        添加顶点到图中
        
        参数:
            vertex: 要添加的顶点
            
        返回:
            添加的顶点
        """
        self.vertices[vertex.id] = vertex
        
        # 如果存在空间索引，则添加到索引中
        if self.spatial_index:
            self.spatial_index.insert(vertex)
            
        return vertex
    
    def create_vertex(self, x, y):
        """
        创建并添加一个新顶点
        
        参数:
            x: x坐标
            y: y坐标
            
        返回:
            创建的顶点
        """
        from .vertex import Vertex
        vertex_id = self.next_vertex_id
        self.next_vertex_id += 1
        vertex = Vertex(vertex_id, x, y)
        return self.add_vertex(vertex)
    
    def add_edge(self, edge):
        """
        添加边到图中
        
        参数:
            edge: 要添加的边
            
        返回:
            添加的边
        """
        self.edges[edge.id] = edge
        return edge
    
    def create_edge(self, vertex1, vertex2, capacity=100):
        """
        创建并添加一个新边
        
        参数:
            vertex1: 第一个顶点
            vertex2: 第二个顶点
            capacity: 道路容量
            
        返回:
            创建的边
        """
        from .edge import Edge
        
        # 检查顶点是否存在于图中
        if vertex1.id not in self.vertices or vertex2.id not in self.vertices:
            raise ValueError("顶点必须已经存在于图中")
        
        # 检查是否已存在连接这两个顶点的边
        for edge in vertex1.edges:
            if (edge.vertex1 == vertex1 and edge.vertex2 == vertex2) or \
               (edge.vertex1 == vertex2 and edge.vertex2 == vertex1):
                return edge
        
        edge_id = self.next_edge_id
        self.next_edge_id += 1
        edge = Edge(edge_id, vertex1, vertex2, capacity)
        return self.add_edge(edge)
    
    def get_vertex(self, vertex_id):
        """
        通过ID获取顶点
        
        参数:
            vertex_id: 顶点ID
            
        返回:
            顶点对象，如果不存在则为None
        """
        return self.vertices.get(vertex_id)
    
    def get_edge(self, edge_id):
        """
        通过ID获取边
        
        参数:
            edge_id: 边ID
            
        返回:
            边对象，如果不存在则为None
        """
        return self.edges.get(edge_id)
    
    def get_edge_between(self, vertex1, vertex2):
        """
        获取连接两个顶点的边
        
        参数:
            vertex1: 第一个顶点
            vertex2: 第二个顶点
            
        返回:
            连接两个顶点的边，如果不存在则为None
        """
        for edge in vertex1.edges:
            if (edge.vertex1 == vertex1 and edge.vertex2 == vertex2) or \
               (edge.vertex1 == vertex2 and edge.vertex2 == vertex1):
                return edge
        return None
    
    def build_spatial_index(self):
        """
        构建空间索引，用于快速查找顶点
        """
        if not self.vertices:
            return
        
        # 确定图的边界
        x_values = [v.x for v in self.vertices.values()]
        y_values = [v.y for v in self.vertices.values()]
        
        x_min, x_max = min(x_values), max(x_values)
        y_min, y_max = min(y_values), max(y_values)
        
        # 为了确保边界包含所有点，增加一点边距
        padding = max((x_max - x_min), (y_max - y_min)) * 0.01
        boundary = (x_min - padding, y_min - padding, x_max + padding, y_max + padding)
        
        # 创建四叉树
        self.spatial_index = QuadTree(boundary)
        
        # 将所有顶点插入四叉树
        for vertex in self.vertices.values():
            self.spatial_index.insert(vertex)
        
        return self.spatial_index
    
    def get_nearby_vertices(self, x, y, n=100):
        """
        获取距离指定坐标最近的n个顶点
        
        参数:
            x: x坐标
            y: y坐标
            n: 返回的顶点数量
            
        返回:
            顶点列表，按距离排序
        """
        # 如果没有空间索引，则构建一个
        if not self.spatial_index:
            self.build_spatial_index()
        
        # 使用空间索引进行快速查询
        if self.spatial_index:
            # 先获取一个合理的查询范围
            # 使用当前的最大边界对角线长度作为初始查询半径
            boundary = self.spatial_index.boundary
            x_min, y_min, x_max, y_max = boundary
            max_dist = math.sqrt((x_max - x_min) ** 2 + (y_max - y_min) ** 2)
            initial_radius = max_dist / 10  # 初始半径设为地图对角线的1/10
            
            # 递增查询半径直到找到足够的顶点
            nearby = []
            radius = initial_radius
            while len(nearby) < n and radius <= max_dist:
                nearby = self.spatial_index.query_nearest(x, y, max_count=n, max_distance=radius)
                radius *= 2  # 每次查询半径翻倍
            
            return nearby
        
        # 如果没有空间索引，则使用暴力方法计算所有顶点到指定坐标的距离
        distances = []
        for vertex in self.vertices.values():
            dist = ((vertex.x - x) ** 2 + (vertex.y - y) ** 2) ** 0.5
            distances.append((dist, vertex))
        
        # 按距离排序并返回前n个
        distances.sort(key=lambda x: x[0])
        return [v for _, v in distances[:n]]
    
    def get_subgraph(self, vertices):
        """
        根据顶点集合获取子图
        
        参数:
            vertices: 顶点集合
            
        返回:
            包含这些顶点及其间边的子图
        """
        subgraph = Graph()
        
        # 添加顶点
        for vertex in vertices:
            new_vertex = subgraph.create_vertex(vertex.x, vertex.y)
            
        # 创建顶点映射
        vertex_map = {v.id: subgraph.vertices[i] for i, v in enumerate(vertices)}
        
        # 添加边
        added_edges = set()
        for vertex in vertices:
            for edge in vertex.edges:
                # 检查该边的两个顶点是否都在子图中
                if edge.vertex1 in vertices and edge.vertex2 in vertices:
                    edge_key = tuple(sorted([edge.vertex1.id, edge.vertex2.id]))
                    if edge_key not in added_edges:
                        v1 = vertex_map[edge.vertex1.id]
                        v2 = vertex_map[edge.vertex2.id]
                        subgraph.create_edge(v1, v2, edge.capacity)
                        added_edges.add(edge_key)
        
        return subgraph
    
    def is_connected(self):
        """
        检查图是否连通
        
        返回:
            如果图连通则为True，否则为False
        """
        # 空图或只有一个顶点的图被认为是连通的
        if len(self.vertices) <= 1:
            print("DEBUG: 图顶点数量小于等于1，视为连通")
            return True
        
        print(f"DEBUG: 图共有顶点 {len(self.vertices)} 个")
        
        # 使用BFS检查连通性
        visited = set()
        start_vertex_id = next(iter(self.vertices.keys()))
        start_vertex = self.vertices[start_vertex_id]
        queue = [start_vertex]
        
        print(f"DEBUG: 从顶点 {start_vertex.id} 开始BFS遍历")
        
        while queue:
            vertex = queue.pop(0)
            if vertex.id not in visited:
                visited.add(vertex.id)
                # 获取所有邻居顶点
                neighbors = vertex.get_neighbors()
                # print(f"DEBUG: 顶点 {vertex.id} 的邻居: {[n.id for n in neighbors]}")
                
                for neighbor in neighbors:
                    if neighbor.id not in visited:
                        queue.append(neighbor)
        
        # print(f"DEBUG: 已访问顶点数: {len(visited)}, 总顶点数: {len(self.vertices)}")
        # print(f"DEBUG: 已访问顶点ID: {visited}")
        # print(f"DEBUG: 图中所有顶点ID: {list(self.vertices.keys())}")
        
        # 检查是否所有顶点都被访问
        return len(visited) == len(self.vertices)
    
    def get_all_paths(self, start, end, max_depth=10):
        """
        获取从起点到终点的所有路径
        
        参数:
            start: 起点
            end: 终点
            max_depth: 最大搜索深度
            
        返回:
            路径列表，每个路径是顶点列表
        """
        def dfs(current, path, depth):
            if depth > max_depth:
                return []
            
            if current == end:
                return [path.copy()]
            
            results = []
            for neighbor in current.get_neighbors():
                if neighbor not in path:
                    path.append(neighbor)
                    results.extend(dfs(neighbor, path, depth + 1))
                    path.pop()
            
            return results
        
        return dfs(start, [start], 0)
    
    def __str__(self):
        """返回图的字符串表示"""
        return f"Graph(vertices={len(self.vertices)}, edges={len(self.edges)})"
    
    def __repr__(self):
        """返回图的详细表示"""
        return self.__str__()
    
    def get_vertices_in_radius(self, center_x: float, center_y: float, radius: float):
        """
        获取指定坐标和半径范围内的所有顶点
        
        参数:
            center_x: 中心点x坐标
            center_y: 中心点y坐标
            radius: 查询半径
            
        返回:
            在半径范围内的顶点列表
        """
        if not self.spatial_index:
            self.build_spatial_index()

        if not self.spatial_index: # Still no index (e.g., empty graph)
            return []

        # Define the query bounding box for the spatial index
        query_bounds = (center_x - radius, center_y - radius, center_x + radius, center_y + radius)
        candidate_vertices = self.spatial_index.query_range(query_bounds)

        vertices_in_radius = []
        for vertex in candidate_vertices:
            # Calculate squared distance for efficiency, compare with radius squared
            distance_sq = (vertex.x - center_x)**2 + (vertex.y - center_y)**2
            if distance_sq <= radius**2:
                vertices_in_radius.append(vertex)
        return vertices_in_radius

    def get_all_vertices_by_type(self, attribute_type: str):
        """
        获取图中所有指定属性类型的顶点
        
        参数:
            attribute_type: 属性类型字符串 ('gas_station', 'shopping_mall', 'parking_lot')
            
        返回:
            符合条件的顶点列表
        """
        return [v for v in self.vertices.values() if v.get_attribute_type() == attribute_type]

   