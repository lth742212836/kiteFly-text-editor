/**
 * native/file_validator.h - 批量文件验证模块
 * 
 * 使用单次系统调用批量 stat 文件路径数组，
 * 避免 Node.js 中逐个调用 fs.statSync 的开销。
 */

#ifndef FILE_VALIDATOR_H
#define FILE_VALIDATOR_H

#include <string>
#include <vector>
#include <cstdint>

namespace txtedit {

struct FileValidationEntry {
    std::string path;
    uint64_t size;
    bool isFile;
    bool exists;
};

/**
 * 批量验证文件路径
 * 一次性检查所有路径，返回有效文件列表
 * 
 * @param paths 待验证的文件路径列表
 * @return 验证结果列表（仅包含有效文件）
 */
std::vector<FileValidationEntry> validateFiles(const std::vector<std::string>& paths);

} // namespace txtedit

#endif // FILE_VALIDATOR_H
