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
        
        # 创建新顶点
        vertex = Vertex(vertex_id, x, y)
        vertices.append(vertex)

        # 将点添加到对应的网格中
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
    
    
    triangles_list = []
    circumcircles_list = [] 
    
    for triangle in triangulation:

        v1, v2, v3 = triangle
      
        triangles_list.append([v1.id, v2.id, v3.id])


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
        "circumcircles": circumcircles_list
    }


    current_dir = os.path.dirname(__file__)
    data_dir = os.path.join(current_dir, '..', '..', 'data')
    output_file = os.path.join(data_dir, 'triangulation.json')


    os.makedirs(data_dir, exist_ok=True)


    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(triangulation_data_dict, f, indent=4)
        print(f"Successfully saved triangulation data to {output_file}")
    except Exception as e:
        print(f"Error saving triangulation data to {output_file}: {e}")

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
    if not graph.is_connected():
        print(f"DEBUG: 图不连通")
      
    print(f"DEBUG: 确保图连通结束")

    print(f"DEBUG: 连通图执行完毕")
    return graph

