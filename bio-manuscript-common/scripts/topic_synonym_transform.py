#!/usr/bin/env python3
"""
Topic 同义变换生成器

生成研究主题的多个语义等价表达，用于文献搜索。
"""

import re
from typing import List, Dict


class TopicSynonymTransformer:
    """Topic 同义变换器"""
    
    # 领域术语映射
    DOMAIN_TERMS = {
        "空间组学": ["spatial omics", "spatial transcriptomics", "spatial biology"],
        "多组学": ["multi-omics", "multi-modal", "multimodal"],
        "整合": ["integration", "fusion", "alignment", "mapping"],
        "单细胞": ["single-cell", "scRNA-seq", "single cell"],
        "转录组": ["transcriptomics", "RNA-seq", "gene expression"],
        "蛋白质组": ["proteomics", "protein expression"],
        "表观遗传": ["epigenomics", "epigenetic", "ATAC-seq", "ChIP-seq"],
        "细胞类型": ["cell type", "cell identity", "cell annotation"],
        "轨迹": ["trajectory", "pseudotime", "development"],
        "通讯": ["communication", "interaction", "signaling"],
    }
    
    def __init__(self):
        self.variants = []
    
    def transform(self, topic: str) -> List[str]:
        """
        生成 topic 的同义变换
        
        Args:
            topic: 原始研究主题
            
        Returns:
            变体列表
        """
        self.variants = []
        
        # 1. 原始 topic
        self.variants.append(topic)
        
        # 2. 中文翻译
        en_topic = self._translate_to_english(topic)
        if en_topic != topic:
            self.variants.append(en_topic)
        
        # 3. 术语替换
        term_variants = self._replace_terms(en_topic)
        self.variants.extend(term_variants)
        
        # 4. 词序调整
        order_variants = self._reorder_words(en_topic)
        self.variants.extend(order_variants)
        
        # 5. 上下位扩展
        hierarchy_variants = self._expand_hierarchy(en_topic)
        self.variants.extend(hierarchy_variants)
        
        # 去重
        self.variants = list(set(self.variants))
        
        return self.variants
    
    def _translate_to_english(self, topic: str) -> str:
        """中文翻译为英文"""
        # 简单的术语替换
        result = topic
        for cn, en_list in self.DOMAIN_TERMS.items():
            if cn in topic:
                result = result.replace(cn, en_list[0])
        return result
    
    def _replace_terms(self, topic: str) -> List[str]:
        """术语替换"""
        variants = []
        
        for cn, en_list in self.DOMAIN_TERMS.items():
            for en in en_list:
                # 检查是否有相关术语
                for other_cn, other_en_list in self.DOMAIN_TERMS.items():
                    for other_en in other_en_list:
                        if other_en in topic.lower():
                            new_topic = topic.lower().replace(other_en, en)
                            if new_topic != topic.lower():
                                variants.append(new_topic)
        
        return variants
    
    def _reorder_words(self, topic: str) -> List[str]:
        """词序调整"""
        variants = []
        words = topic.lower().split()
        
        if len(words) >= 3:
            # 交换前两个词
            variant1 = ' '.join([words[1], words[0]] + words[2:])
            variants.append(variant1)
            
            # "integration of X and Y" → "X and Y integration"
            if "integration" in words:
                idx = words.index("integration")
                if idx == 0:
                    variant2 = ' '.join(words[1:] + ["integration"])
                    variants.append(variant2)
        
        return variants
    
    def _expand_hierarchy(self, topic: str) -> List[str]:
        """上下位扩展"""
        variants = []
        
        # 上位词
        if "spatial" in topic.lower():
            # 上位：multi-modal
            variants.append(topic.lower().replace("spatial", "multi-modal"))
            variants.append(topic.lower().replace("spatial", "single-cell"))
        
        if "multi-omics" in topic.lower():
            # 下位：具体模态
            variants.append(topic.lower().replace("multi-omics", "transcriptomics proteomics"))
            variants.append(topic.lower().replace("multi-omics", "RNA protein"))
        
        return variants
    
    def generate_search_queries(self, topic: str, max_variants: int = 15) -> List[Dict]:
        """
        生成搜索查询
        
        Returns:
            查询列表，每个包含 topic 和搜索平台
        """
        variants = self.transform(topic)[:max_variants]
        
        queries = []
        for i, variant in enumerate(variants):
            queries.append({
                "id": i + 1,
                "query": variant,
                "platforms": ["PubMed", "bioRxiv", "arXiv q-bio"]
            })
        
        return queries


def main():
    """主函数"""
    transformer = TopicSynonymTransformer()
    
    # 示例
    topic = "空间多组学整合"
    variants = transformer.transform(topic)
    
    print(f"原始 Topic: {topic}")
    print(f"\n生成的 {len(variants)} 个变体:")
    for i, v in enumerate(variants, 1):
        print(f"  {i}. {v}")
    
    print(f"\n搜索查询:")
    queries = transformer.generate_search_queries(topic)
    for q in queries:
        print(f"  Query {q['id']}: {q['query']}")
        print(f"    Platforms: {', '.join(q['platforms'])}")


if __name__ == "__main__":
    main()