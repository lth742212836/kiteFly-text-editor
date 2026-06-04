/**
 * native/file_writer.h - 高性能文件写入模块
 * 
 * 使用大缓冲区 + 原子写入策略：
 * - 先写入临时文件，完成后原子 rename
 * - 分块写入，避免大字符串拼接
 * - 支持编码转换（UTF-8 → GBK 等）
 */

#ifndef FILE_WRITER_H
#define FILE_WRITER_H

#include <string>
#include <cstdint>

namespace txtedit {

struct FileWriteResult {
    bool success;
    std::string error;
    uint64_t bytesWritten;
};

/**
 * 写入文件内容（带编码转换）
 * 
 * @param filePath 目标文件路径
 * @param content 文件内容（UTF-8）
 * @param encoding 目标编码（如 "gbk", "utf-8"）
 * @return 写入结果
 */
FileWriteResult writeFile(
    const std::string& filePath,
    const std::string& content,
    const std::string& encoding
);

} // namespace txtedit

#endif // FILE_WRITER_H
