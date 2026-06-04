/**
 * native/file_reader.h - 高性能文件读取模块
 * 
 * 使用 mmap (POSIX) / MapViewOfFile (Windows) 实现零拷贝文件读取。
 * 大文件场景下避免将整个文件加载到 Node.js Buffer 再传递：
 * - 小文件 (< 10MB)：直接读取到 Buffer
 * - 大文件 (>= 10MB)：使用 mmap 映射，按需分块读取
 */

#ifndef FILE_READER_H
#define FILE_READER_H

#include <string>
#include <cstdint>
#include <functional>

namespace txtedit {

/**
 * 文件读取结果
 */
struct FileReadResult {
    bool success;
    std::string content;     // 文件文本内容
    std::string encoding;    // 检测到的编码
    uint64_t fileSize;       // 文件大小（字节）
    std::string error;       // 错误信息
    float encodingConfidence; // 编码检测置信度
};

/**
 * 分块读取回调
 * 用于大文件的流式处理，每读取一块就调用一次回调
 * 
 * @param chunk 当前块的数据
 * @param offset 当前块在文件中的偏移
 * @param total 文件总大小
 */
using ChunkCallback = std::function<void(const std::string& chunk, uint64_t offset, uint64_t total)>;

/**
 * 使用 mmap 零拷贝读取文件
 * 
 * 实现细节：
 * - macOS/Linux: 使用 mmap + madvise(MADV_SEQUENTIAL) 提示内核预读
 * - Windows: 使用 CreateFileMapping + MapViewOfFile
 * - 自动处理编码检测和转换
 * 
 * @param filePath 文件路径
 * @return 读取结果
 */
FileReadResult readFileMmap(const std::string& filePath);

/**
 * 分块流式读取大文件
 * 适用于超大文件（>100MB），避免一次性加载全部内容
 * 
 * @param filePath 文件路径
 * @param chunkSize 每块大小（字节），默认 1MB
 * @param callback 每块读取后的回调
 * @return 读取结果
 */
FileReadResult readFileStreaming(
    const std::string& filePath, 
    size_t chunkSize,
    ChunkCallback callback
);

/**
 * 仅获取文件大小和编码信息，不读取全部内容
 * 用于快速预检文件，判断是否需要大文件优化策略
 * 
 * @param filePath 文件路径
 * @return 文件大小
 */
uint64_t getFileSize(const std::string& filePath);

} // namespace txtedit

#endif // FILE_READER_H
