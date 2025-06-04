"""
随机地图生成功能模块
"""
import random
import math
import json
import os
from ..models.graph import Graph
from ..models.vertex import Vertex
from ..models.edge import Edge
from .delaunay import create_delaunay_triangulation,circumcircle

def generate_random_points(n=10000, x_min=0, y_min=0, x_max=10000, y_max=10000, min_distance=0):
    """
    生成随机分布的点集
    
    参数:
        n: 要生成的点数量
        x_min: x坐标最小值
        y_min: y坐标最小值
        x_max: x坐标最大值
        y_max: y坐标最大值
        min_distance: 任意两点之间的最小距离
        
    返回:
        生成的顶点列表
    """
    
    # 目标正方形数量（约100个）
    target_grid_count = min(100, max(10, n // 100))
    
    # 计算每个维度的网格数量
    width = x_max - x_min
    height = y_max - y_min
    grid_width = math.ceil(math.sqrt(target_grid_count * width / height))
    grid_height = math.ceil(target_grid_count / grid_width)
    
    # 计算每个网格的尺寸
    cell_width = width / grid_width
    cell_height = height / grid_height
    
    # 初始化网格
    grid = {}
    for i in range(grid_width):
        for j in range(grid_height):
            grid[(i, j)] = []
    
    vertices = []
    
    # 生成n个点
    for vertex_id in range(n):
        # 计算每个网格的权重（反比于已有点的数量）
        weights = []
        cells = []
        
        for cell, points in grid.items():
            # 权重与网格中点的数量成反比
            weight = 1.0 / (len(points) + 1)
            weights.append(weight)
            cells.append(cell)
        
        # 归一化权重作为概率
        total_weight = sum(weights)
        probabilities = [w / total_weight for w in weights]
        
        # 根据概率选择一个网格
        selected_cell = random.choices(cells, probabilities)[0]
        
        # 在选定的网格内随机生成一个点
        i, j = selected_cell
        x = random.uniform(x_min + i * cell_width, x_min + (i + 1) * cell_width)
        y = random.uniform(y_min + j * cell_height, y_min + (j + 1) * cell_height)
        
        # 如果指定了最小距离
        if min_distance > 0:
            # 检查与相邻网格中的点的距离
            too_close = False
            
            # 获取需要检查的相邻网格
            neighbors = [(i, j)]  # 包括当前网格
            for di in [-1, 0, 1]:
                for dj in [-1, 0, 1]:
                    ni, nj = i + di, j + dj
                    if (ni, nj) != (i, j) and 0 <= ni < grid_width and 0 <= nj < grid_height:
                        neighbors.append((ni, nj))
            
            # 仅检查相邻网格中的点
            for neighbor in neighbors:
                for other_vertex in grid[neighbor]:
                    dist = ((other_vertex.x - x) ** 2 + (other_vertex.y - y) ** 2) ** 0.5
                    if dist < min_distance:
                        too_close = True
                        break
                if too_close:
                    break
            
            # 如果太近，跳过并在后面补充
            if too_close:
                continue
        
        # 创建新顶点
        vertex = Vertex(vertex_id, x, y)
        vertices.append(vertex)
        
        # 将点添加到对应的网格中
        grid[selected_cell].append(vertex)
    
    # 如果由于最小距离约束没有生成足够的点，减小约束后补充
    if len(vertices) < n and min_distance > 0:
        remaining = n - len(vertices)
        reduced_min_distance = min_distance * 0.5
        
        # 使用简单的随机生成方法补充其余的点
        attempts = 0
        max_attempts = remaining * 10
        
        while len(vertices) < n and attempts < max_attempts:
            # 选择权重较小的网格
            weights = []
            cells = []
            
            for cell, points in grid.items():
                weight = 1.0 / (len(points) + 1)
                weights.append(weight)
                cells.append(cell)
            
            total_weight = sum(weights)
            probabilities = [w / total_weight for w in weights]
            
            selected_cell = random.choices(cells, probabilities)[0]
            
            i, j = selected_cell
            x = random.uniform(x_min + i * cell_width, x_min + (i + 1) * cell_width)
            y = random.uniform(y_min + j * cell_height, y_min + (j + 1) * cell_height)
            
            # 使用较小的最小距离进行检查
            too_close = False
            
            neighbors = [(i, j)]
            for di in [-1, 0, 1]:
                for dj in [-1, 0, 1]:
                    ni, nj = i + di, j + dj
                    if (ni, nj) != (i, j) and 0 <= ni < grid_width and 0 <= nj < grid_height:
                        neighbors.append((ni, nj))
            
            for neighbor in neighbors:
                for other_vertex in grid[neighbor]:
                    dist = ((other_vertex.x - x) ** 2 + (other_vertex.y - y) ** 2) ** 0.5
                    if dist < reduced_min_distance:
                        too_close = True
                        break
                if too_close:
                    break
            
            attempts += 1
            
            if not too_close:
                vertex = Vertex(len(vertices), x, y)
                vertices.append(vertex)
                grid[selected_cell].append(vertex)
    
    return vertices

def generate_connected_map(vertices, edge_factor=2.5, capacity_range=(50, 200)):
    """
    生成连通的地图
    
    参数:
        vertices: 顶点列表
        edge_factor: 控制边数量的因子
        capacity_range: 道路容量范围(min, max)
        
    返回:
        包含所有顶点和边的图
    """
    # 创建新图
    graph = Graph()
    
    # 添加所有顶点到图
    vertex_map = {}  # 原始顶点到图顶点的映射
    for i, v in enumerate(vertices):
        graph_vertex = graph.create_vertex(v.x, v.y)
        vertex_map[v] = graph_vertex
    
    # 使用Delaunay三角剖分创建初始连接
    triangulation = create_delaunay_triangulation(vertices)
    
    # Prepare triangulation data for JSON serialization
    triangles_list = []
    circumcircles_list = [] # List to store circumcircle data
    
    for triangle in triangulation:
        # Assuming triangle is a tuple of Vertex objects (v1, v2, v3)
        v1, v2, v3 = triangle
        # Convert triangle vertices to a list of vertex IDs
        triangles_list.append([v1.id, v2.id, v3.id])

        # Calculate the circumcircle for the triangle
        try:
            center_x, center_y, radius = circumcircle(v1, v2, v3)
            circumcircles_list.append({
                "vertices": [v1.id, v2.id, v3.id],
                "center_x": center_x,
                "center_y": center_y,
                "radius": radius
            })
        except Exception as e:
            print(f"Warning: Could not calculate circumcircle for triangle {v1.id},{v2.id},{v3.id}: {e}")




    triangulation_data_dict = {
        "triangles": triangles_list,
        "circumcircles": circumcircles_list # Add the circumcircles data
    }


    current_dir = os.path.dirname(__file__)
    data_dir = os.path.join(current_dir, '..', '..', 'data')
    output_file = os.path.join(data_dir, 'triangulation.json')

    # Ensure the data directory exists
    os.makedirs(data_dir, exist_ok=True)

    # Save the triangulation data to the JSON file
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(triangulation_data_dict, f, indent=4)
        print(f"Successfully saved triangulation data to {output_file}")
    except Exception as e:
        print(f"Error saving triangulation data to {output_file}: {e}")

    # From triangulation extract edges
    edges = set()
    for triangle in triangulation:
        v1, v2, v3 = triangle
        edges.add(tuple(sorted([v1.id, v2.id])))
        edges.add(tuple(sorted([v2.id, v3.id])))
        edges.add(tuple(sorted([v3.id, v1.id])))
    
    # 添加边到图
    for v1_id, v2_id in edges:
        v1 = graph.get_vertex(v1_id)
        v2 = graph.get_vertex(v2_id)
        graph.create_edge(v1, v2)
    
    print(f"DEBUG: 三角剖分结束")
    # 确保图连通
    ensure_connectivity(graph)
    print(f"DEBUG: 确保图连通结束")
    # 随机添加额外的边以增加道路网络密度
    add_additional_edges(graph, edge_factor)
    print(f"DEBUG: 随机添加额外的边结束")
    print(f"DEBUG: 连通图执行完毕")
    return graph

def ensure_connectivity(graph):
    """
    确保图是连通的
    
    参数:
        graph: 要确保连通的图
    """
    # 检查图是否已经连通
    if graph.is_connected():
        return
    
    # 获取所有顶点
    vertices = list(graph.vertices.values())
    
    # 找到所有连通分量
    components = find_connected_components(graph)
    
    # 连接所有分量
    for i in range(len(components) - 1):
        # 从相邻分量中选择距离最近的顶点对
        min_dist = float('inf')
        closest_pair = None
        
        for v1 in components[i]:
            for v2 in components[i + 1]:
                dist = v1.distance_to(v2)
                if dist < min_dist:
                    min_dist = dist
                    closest_pair = (v1, v2)
        
        # 添加连接边
        if closest_pair:
            v1, v2 = closest_pair
            graph.create_edge(v1, v2)

def find_connected_components(graph):
    """
    找到图中的所有连通分量
    
    参数:
        graph: 要分析的图
        
    返回:
        连通分量列表，每个分量是一个顶点集合
    """
    components = []
    unvisited = set(graph.vertices.values())
    
    while unvisited:
        # 从未访问顶点中取一个开始BFS
        start = next(iter(unvisited))
        component = set()
        queue = [start]
        
        while queue:
            vertex = queue.pop(0)
            if vertex in unvisited:
                component.add(vertex)
                unvisited.remove(vertex)
                for neighbor in vertex.get_neighbors():
                    if neighbor in unvisited:
                        queue.append(neighbor)
        
        components.append(component)
    
    return components

def add_additional_edges(graph, edge_factor):
    """
    添加额外的边以增加道路网络密度
    
    参数:
        graph: 要添加边的图
        edge_factor: 控制边数量的因子
    """
    n = len(graph.vertices)
    target_edges = int(n * edge_factor)
    current_edges = len(graph.edges)
    
    # 如果已有足够的边，不添加
    if current_edges >= target_edges:
        return
    
    vertices_list = list(graph.vertices.values())
    
    # 对于每个顶点，找到最近的几个顶点并尝试添加边
    for vertex in vertices_list:
        # 找到最近的顶点
        neighbors = []
        for other in vertices_list:
            if other != vertex:
                dist = vertex.distance_to(other)
                neighbors.append((dist, other))
        
        # 按距离排序
        neighbors.sort(key=lambda x: x[0])
        
        # 尝试连接到最近的几个顶点
        for dist, neighbor in neighbors[:10]:  # 限制只考虑最近的10个点
            # 如果已有边或道路会不合理地交叉，跳过
            if graph.get_edge_between(vertex, neighbor) or would_cross_existing_edges(graph, vertex, neighbor):
                continue
            
            # 添加新边
            graph.create_edge(vertex, neighbor)
            current_edges += 1
            
            # 如果已达到目标边数，结束
            if current_edges >= target_edges:
                return

def would_cross_existing_edges(graph, v1, v2):
    """
    检查添加新边是否会导致不合理的交叉
    
    参数:
        graph: 当前图
        v1: 第一个顶点
        v2: 第二个顶点
        
    返回:
        如果添加会导致不合理交叉则为True，否则为False
    """
    # 检查现有边是否会与新边交叉
    for edge in graph.edges.values():
        v3 = edge.vertex1
        v4 = edge.vertex2
        
        # 如果共享顶点，不会交叉
        if v1 == v3 or v1 == v4 or v2 == v3 or v2 == v4:
            continue
        
        # 检查边是否相交
        if do_segments_intersect(
            (v1.x, v1.y), (v2.x, v2.y),
            (v3.x, v3.y), (v4.x, v4.y)
        ):
            return True
    
    return False

def do_segments_intersect(p1, p2, p3, p4):
    """
    检查两条线段是否相交
    
    参数:
        p1: 第一条线段的起点 (x, y)
        p2: 第一条线段的终点 (x, y)
        p3: 第二条线段的起点 (x, y)
        p4: 第二条线段的终点 (x, y)
        
    返回:
        如果线段相交则为True，否则为False
    """
    # 计算方向
    d1 = direction(p3, p4, p1)
    d2 = direction(p3, p4, p2)
    d3 = direction(p1, p2, p3)
    d4 = direction(p1, p2, p4)
    
    # 如果方向不同，线段相交
    if ((d1 > 0 and d2 < 0) or (d1 < 0 and d2 > 0)) and \
       ((d3 > 0 and d4 < 0) or (d3 < 0 and d4 > 0)):
        return True
    
    # 检查共线的情况
    if d1 == 0 and on_segment(p3, p4, p1):
        return True
    if d2 == 0 and on_segment(p3, p4, p2):
        return True
    if d3 == 0 and on_segment(p1, p2, p3):
        return True
    if d4 == 0 and on_segment(p1, p2, p4):
        return True
    
    return False

def direction(p1, p2, p3):
    """
    计算三点方向
    
    参数:
        p1: 点1 (x, y)
        p2: 点2 (x, y)
        p3: 点3 (x, y)
        
    返回:
        大于0表示逆时针，小于0表示顺时针，等于0表示共线
    """
    return (p3[1] - p1[1]) * (p2[0] - p1[0]) - (p2[1] - p1[1]) * (p3[0] - p1[0])

def on_segment(p1, p2, p3):
    """
    检查点p3是否在线段p1-p2上
    
    参数:
        p1: 线段起点 (x, y)
        p2: 线段终点 (x, y)
        p3: 检查点 (x, y)
        
    返回:
        如果p3在线段上则为True，否则为False
    """
    return (min(p1[0], p2[0]) <= p3[0] <= max(p1[0], p2[0]) and
            min(p1[1], p2[1]) <= p3[1] <= max(p1[1], p2[1]))

    
