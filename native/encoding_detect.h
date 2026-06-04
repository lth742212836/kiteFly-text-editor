/**
 * native/encoding_detect.h - 编码检测模块
 * 
 * 高性能编码检测：
 * - BOM 检测（零开销，只需检查文件头 4 字节）
 * - UTF-8 有效性验证（SIMD 友好的逐字节扫描）
 * - GBK/GB2312 启发式检测（中文字符频率分析）
 * 
 * 替代 jschardet（纯 JS 实现），在大文件场景下性能提升 10-50x
 */

#ifndef ENCODING_DETECT_H
#define ENCODING_DETECT_H

#include <string>
#include <cstdint>

namespace txtedit {

/**
 * 检测结果结构
 */
struct EncodingResult {
    std::string encoding;   // 编码名称：utf-8, utf-16le, utf-16be, gbk
    float confidence;       // 置信度 0.0 - 1.0
    bool hasBOM;           // 是否检测到 BOM
};

/**
 * 检测 Buffer 的文本编码
 * 
 * 检测策略（按优先级）：
 * 1. BOM 标记检测 → 100% 确定
 * 2. UTF-8 有效性验证 → 有效则返回 utf-8
 * 3. GBK 启发式检测 → 中文字符出现频率高则返回 gbk
 * 4. 默认回退到 utf-8
 * 
 * @param data 数据指针
 * @param length 数据长度（字节）
 * @return 编码检测结果
 */
EncodingResult detectEncoding(const uint8_t* data, size_t length);

/**
 * 仅快速检测 BOM，不进行完整编码分析
 * 适用于只需要知道是否有 BOM 的场景
 */
std::string detectBOM(const uint8_t* data, size_t length);

} // namespace txtedit

#endif // ENCODING_DETECT_H
