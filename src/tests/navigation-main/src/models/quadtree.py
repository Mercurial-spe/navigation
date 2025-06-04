"""
四叉树类，用于空间数据索引
实现高效的二维空间点查询
"""

class QuadTree:
    """
    四叉树实现，用于二维空间中的点查询
    
    属性:
        boundary: 边界矩形 (x_min, y_min, x_max, y_max)
        capacity: 每个节点的最大容量，达到后进行分裂
        points: 当前节点中的点集合
        divided: 当前节点是否已分裂
        northwest: 西北象限子节点
        northeast: 东北象限子节点
        southwest: 西南象限子节点
        southeast: 东南象限子节点
    """
    
    def __init__(self, boundary, capacity=4):
        """
        初始化四叉树节点
        
        参数:
            boundary: 边界矩形 (x_min, y_min, x_max, y_max)
            capacity: 节点最大容量
        """
        self.boundary = boundary
        self.capacity = capacity
        self.points = []
        self.divided = False
        
        # 子节点
        self.northwest = None
        self.northeast = None
        self.southwest = None
        self.southeast = None
    
    def insert(self, point):
        """
        向四叉树中插入一个点
        
        参数:
            point: 要插入的点对象，必须有x和y属性
            
        返回:
            插入成功返回True，否则返回False
        """
        # 检查点是否在边界内
        if not self._contains(point):
            return False
        
        # 如果当前节点未满，则直接添加
        if len(self.points) < self.capacity and not self.divided:
            self.points.append(point)
            return True
        
        # 如果当前节点未分裂，则进行分裂
        if not self.divided:
            self._subdivide()
        
        # 尝试将点插入到子节点中
        if self.northwest.insert(point):
            return True
        if self.northeast.insert(point):
            return True
        if self.southwest.insert(point):
            return True
        if self.southeast.insert(point):
            return True
        
        # 理论上不应该到达这一步，除非点在边界上
        return False
    
    def _subdivide(self):
        """
        将当前节点分裂为四个子节点
        """
        x_min, y_min, x_max, y_max = self.boundary
        x_mid = (x_min + x_max) / 2
        y_mid = (y_min + y_max) / 2
        
        # 创建四个子节点
        nw_boundary = (x_min, y_mid, x_mid, y_max)
        self.northwest = QuadTree(nw_boundary, self.capacity)
        
        ne_boundary = (x_mid, y_mid, x_max, y_max)
        self.northeast = QuadTree(ne_boundary, self.capacity)
        
        sw_boundary = (x_min, y_min, x_mid, y_mid)
        self.southwest = QuadTree(sw_boundary, self.capacity)
        
        se_boundary = (x_mid, y_min, x_max, y_mid)
        self.southeast = QuadTree(se_boundary, self.capacity)
        
        # 将当前节点中的点重新分配到子节点
        for point in self.points:
            self.northwest.insert(point)
            self.northeast.insert(point)
            self.southwest.insert(point)
            self.southeast.insert(point)
        
        # 清空当前节点的点列表
        self.points = []
        self.divided = True
    
    def _contains(self, point):
        """
        检查点是否在边界内
        
        参数:
            point: 要检查的点对象
            
        返回:
            如果点在边界内返回True，否则返回False
        """
        x_min, y_min, x_max, y_max = self.boundary
        return (x_min <= point.x <= x_max) and (y_min <= point.y <= y_max)
    
    def query_range(self, range_rect):
        """
        查询指定矩形范围内的所有点
        
        参数:
            range_rect: 查询范围矩形 (x_min, y_min, x_max, y_max)
            
        返回:
            范围内的点列表
        """
        found_points = []
        
        # 如果当前节点与查询范围不相交，直接返回空列表
        if not self._intersects(range_rect):
            return found_points
        
        # 检查当前节点中的点是否在查询范围内
        for point in self.points:
            if self._point_in_range(point, range_rect):
                found_points.append(point)
        
        # 如果当前节点已分裂，则在子节点中查询
        if self.divided:
            found_points.extend(self.northwest.query_range(range_rect))
            found_points.extend(self.northeast.query_range(range_rect))
            found_points.extend(self.southwest.query_range(range_rect))
            found_points.extend(self.southeast.query_range(range_rect))
        
        return found_points
    
    def _intersects(self, range_rect):
        """
        检查当前节点边界是否与查询范围相交
        
        参数:
            range_rect: 查询范围矩形
            
        返回:
            如果相交返回True，否则返回False
        """
        x_min, y_min, x_max, y_max = self.boundary
        rx_min, ry_min, rx_max, ry_max = range_rect
        
        return not (rx_max < x_min or rx_min > x_max or ry_max < y_min or ry_min > y_max)
    
    def _point_in_range(self, point, range_rect):
        """
        检查点是否在查询范围内
        
        参数:
            point: 要检查的点
            range_rect: 查询范围矩形
            
        返回:
            如果点在范围内返回True，否则返回False
        """
        rx_min, ry_min, rx_max, ry_max = range_rect
        return (rx_min <= point.x <= rx_max) and (ry_min <= point.y <= ry_max)
    
    def query_nearest(self, x, y, max_count=1, max_distance=float('inf')):
        """
        查询距离指定坐标最近的点
        
        参数:
            x: 查询点x坐标
            y: 查询点y坐标
            max_count: 最大返回点数量
            max_distance: 最大查询距离
            
        返回:
            最近的点列表，按距离排序
        """
        # 首先找出可能包含最近点的区域
        search_radius = max_distance
        search_range = (x - search_radius, y - search_radius, 
                       x + search_radius, y + search_radius)
        
        # 获取该范围内的所有点
        candidates = self.query_range(search_range)
        
        # 计算每个点到查询点的距离
        distance_points = []
        for point in candidates:
            dist = ((point.x - x) ** 2 + (point.y - y) ** 2) ** 0.5
            if dist <= max_distance:
                distance_points.append((dist, point))
        
        # 按距离排序
        distance_points.sort(key=lambda x: x[0])
        
        # 返回最近的max_count个点
        return [point for _, point in distance_points[:max_count]]
    
    def count(self):
        """
        统计四叉树中的点数量
        
        返回:
            点数量
        """
        count = len(self.points)
        
        if self.divided:
            count += self.northwest.count()
            count += self.northeast.count()
            count += self.southwest.count()
            count += self.southeast.count()
        
        return count
    
    def __str__(self):
        """返回四叉树的字符串表示"""
        return f"QuadTree(boundary={self.boundary}, points={len(self.points)}, divided={self.divided}, total_points={self.count()})" 