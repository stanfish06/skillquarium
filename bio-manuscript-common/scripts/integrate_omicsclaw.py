#!/usr/bin/env python3
"""
OmicsClaw 联动脚本

封装 OmicsClaw CLI 调用，用于实际数据分析。
"""

import subprocess
import os
from typing import Optional, Dict, List


class OmicsClawRunner:
    """OmicsClaw 运行器"""
    
    def __init__(self, omicsclaw_path: str = "omicsclaw"):
        """
        初始化
        
        Args:
            omicsclaw_path: omicsclaw 命令路径
        """
        self.omicsclaw_path = omicsclaw_path
    
    def run_skill(self, 
                  skill_name: str,
                  input_file: str,
                  output_dir: Optional[str] = None,
                  params: Optional[Dict] = None) -> Dict:
        """
        运行 OmicsClaw skill
        
        Args:
            skill_name: skill 名称
            input_file: 输入文件路径
            output_dir: 输出目录
            params: 参数字典
            
        Returns:
            运行结果
        """
        cmd = [self.omicsclaw_path, "run", skill_name, "--input", input_file]
        
        if output_dir:
            cmd.extend(["--output", output_dir])
        
        if params:
            for key, value in params.items():
                cmd.extend([f"--{key}", str(value)])
        
        # 运行命令
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        return {
            "skill": skill_name,
            "command": " ".join(cmd),
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "success": result.returncode == 0
        }
    
    def preprocess(self, input_file: str, output_dir: str) -> Dict:
        """
        数据预处理
        
        Args:
            input_file: 输入文件
            output_dir: 输出目录
            
        Returns:
            运行结果
        """
        return self.run_skill(
            skill_name="spatial-preprocess",
            input_file=input_file,
            output_dir=output_dir
        )
    
    def cluster(self, 
                input_file: str, 
                method: str = "leiden",
                resolution: float = 0.5) -> Dict:
        """
        职类分析
        
        Args:
            input_file: 输入文件
            method: 职类方法
            resolution: 分辨率参数
            
        Returns:
            运行结果
        """
        return self.run_skill(
            skill_name="spatial-domains",
            input_file=input_file,
            params={"method": method, "resolution": resolution}
        )
    
    def annotate(self, input_file: str, method: str = "markers") -> Dict:
        """
        细胞类型注释
        
        Args:
            input_file: 输入文件
            method: 注释方法
            
        Returns:
            运行结果
        """
        return self.run_skill(
            skill_name="spatial-annotate",
            input_file=input_file,
            params={"method": method}
        )
    
    def find_markers(self, input_file: str, output_dir: str) -> Dict:
        """
        Marker 基因识别
        
        Args:
            input_file: 输入文件
            output_dir: 输出目录
            
        Returns:
            运行结果
        """
        return self.run_skill(
            skill_name="sc-markers",
            input_file=input_file,
            output_dir=output_dir
        )
    
    def spatial_statistics(self, input_file: str) -> Dict:
        """
        空间统计分析
        
        Args:
            input_file: 输入文件
            
        Returns:
            运行结果
        """
        return self.run_skill(
            skill_name="spatial-statistics",
            input_file=input_file
        )
    
    def enrichment(self, 
                   gene_list: List[str], 
                   database: str = "KEGG_2021_Human") -> Dict:
        """
        通路富集分析
        
        Args:
            gene_list: 基因列表
            database: 富集数据库
            
        Returns:
            运行结果
        """
        # 创建临时文件
        temp_file = "/tmp/gene_list.txt"
        with open(temp_file, "w") as f:
            f.write("\n".join(gene_list))
        
        return self.run_skill(
            skill_name="spatial-enrichment",
            input_file=temp_file,
            params={"database": database}
        )


def main():
    """主函数"""
    runner = OmicsClawRunner()
    
    # 示例：预处理
    print("示例：运行 spatial-preprocess")
    result = runner.preprocess(
        input_file="data/example.h5ad",
        output_dir="results/"
    )
    
    print(f"命令: {result['command']}")
    print(f"成功: {result['success']}")
    
    if not result['success']:
        print(f"错误: {result['stderr']}")


if __name__ == "__main__":
    main()