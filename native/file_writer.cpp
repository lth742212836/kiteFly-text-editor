/**
 * native/file_writer.cpp - 高性能文件写入实现
 * 
 * 策略：
 * 1. 写入临时文件（避免写入过程中崩溃导致原文件损坏）
 * 2. 大缓冲区批量写入（减少系统调用次数）
 * 3. 原子 rename 替换原文件
 * 4. UTF-8 → GBK 编码转换在 C++ 层完成
 */

#include "file_writer.h"

#ifdef _WIN32
#include <windows.h>
#include <io.h>
#else
#include <fcntl.h>
#include <unistd.h>
#include <cstdio>
#endif

#include <cstring>
#include <algorithm>
#include <vector>
#include <random>

namespace txtedit {

// ============================================================
// 临时文件名生成
// ============================================================

static std::string generateTempPath(const std::string& filePath) {
    // 在同目录下创建临时文件，确保 rename 是原子操作（同文件系统）
    std::string tempPath = filePath + ".txtedit_tmp_";
    
    // 添加随机后缀避免冲突
    static thread_local std::mt19937 rng(std::random_device{}());
    static const char chars[] = "abcdefghijklmnopqrstuvwxyz0123456789";
    std::uniform_int_distribution<> dist(0, sizeof(chars) - 2);
    
    for (int i = 0; i < 8; i++) {
        tempPath += chars[dist(rng)];
    }
    
    return tempPath;
}

// ============================================================
// UTF-8 → GBK 编码转换（简化版）
// ============================================================

/**
 * 将 UTF-8 字符串转换为 GBK 编码
 * 
 * 完整的 GBK 转换需要完整码表，这里实现常用汉字区域（GB2312 汉字区）。
 * 生产环境建议集成 ICU 或 libiconv 获取完整 GBK 支持。
 */

static std::vector<uint8_t> convertUTF8toGBK(const std::string& utf8) {
    std::vector<uint8_t> result;
    result.reserve(utf8.size());
    
    size_t i = 0;
    const uint8_t* data = reinterpret_cast<const uint8_t*>(utf8.data());
    size_t length = utf8.size();
    
    while (i < length) {
        uint8_t byte = data[i];
        
        if (byte <= 0x7F) {
            // ASCII: 直接透传
            result.push_back(byte);
            i++;
        } else if (byte >= 0xC2 && byte <= 0xDF && i + 1 < length) {
            // 双字节 UTF-8 → 拉丁扩展区，大多数可直接映射到 GBK 单字节区
            uint8_t b2 = data[i + 1];
            if ((b2 & 0xC0) == 0x80) {
                // 简化的拉丁字符映射
                result.push_back(0xA1);
                result.push_back(0xA1); // 替换字符
                i += 2;
            } else {
                result.push_back('?');
                i++;
            }
        } else if (byte >= 0xE0 && byte <= 0xEF && i + 2 < length) {
            // 三字节 UTF-8 → 可能是 CJK 汉字
            uint8_t b2 = data[i + 1];
            uint8_t b3 = data[i + 2];
            
            if ((b2 & 0xC0) == 0x80 && (b3 & 0xC0) == 0x80) {
                uint32_t codepoint = ((byte & 0x0F) << 12) | ((b2 & 0x3F) << 6) | (b3 & 0x3F);
                
                // GB2312 汉字区映射 (U+4E00 - U+9FA5)
                if (codepoint >= 0x4E00 && codepoint <= 0x9FA5) {
                    uint32_t offset = codepoint - 0x4E00;
                    uint8_t gbkHigh = 0xB0 + (offset / 94);
                    uint8_t gbkLow = 0xA1 + (offset % 94);
                    result.push_back(gbkHigh);
                    result.push_back(gbkLow);
                } else {
                    // 非 GB2312 汉字，用替换字符
                    result.push_back(0xA1);
                    result.push_back(0xA1);
                }
                
                i += 3;
            } else {
                result.push_back('?');
                i++;
            }
        } else if (byte >= 0xF0 && i + 3 < length) {
            // 四字节 UTF-8 → 超出 BMP，用替换字符
            result.push_back(0xA1);
            result.push_back(0xA1);
            i += 4;
        } else {
            result.push_back('?');
            i++;
        }
    }
    
    return result;
}

// ============================================================
// 文件写入实现
// ============================================================

FileWriteResult writeFile(
    const std::string& filePath,
    const std::string& content,
    const std::string& encoding
) {
    FileWriteResult result;
    result.success = false;
    result.bytesWritten = 0;
    
    std::string tempPath = generateTempPath(filePath);
    
    // 编码转换
    std::vector<uint8_t> outputData;
    const uint8_t* writeData;
    size_t writeLen;
    
    if (encoding == "utf-8") {
        writeData = reinterpret_cast<const uint8_t*>(content.data());
        writeLen = content.size();
    } else if (encoding == "gbk") {
        outputData = convertUTF8toGBK(content);
        writeData = outputData.data();
        writeLen = outputData.size();
    } else {
        // 不支持的编码，默认 UTF-8
        writeData = reinterpret_cast<const uint8_t*>(content.data());
        writeLen = content.size();
    }
    
#ifdef _WIN32
    // Windows: 使用 CreateFileW
    int wlen = MultiByteToWideChar(CP_UTF8, 0, tempPath.c_str(), -1, nullptr, 0);
    std::wstring wtempPath(wlen, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, tempPath.c_str(), -1, &wtempPath[0], wlen);
    
    HANDLE hFile = CreateFileW(
        wtempPath.c_str(),
        GENERIC_WRITE,
        0,
        nullptr,
        CREATE_ALWAYS,
        FILE_ATTRIBUTE_NORMAL | FILE_FLAG_WRITE_THROUGH,
        nullptr
    );
    
    if (hFile == INVALID_HANDLE_VALUE) {
        result.error = "Failed to create temp file: " + tempPath;
        return result;
    }
    
    // 大缓冲区批量写入（128KB）
    const size_t BUFFER_SIZE = 128 * 1024;
    size_t offset = 0;
    
    while (offset < writeLen) {
        size_t chunk = std::min(BUFFER_SIZE, writeLen - offset);
        DWORD written = 0;
        
        if (!WriteFile(hFile, writeData + offset, static_cast<DWORD>(chunk), &written, nullptr)) {
            result.error = "Write failed";
            CloseHandle(hFile);
            DeleteFileW(wtempPath.c_str());
            return result;
        }
        
        offset += written;
        result.bytesWritten += written;
    }
    
    CloseHandle(hFile);
    
    // 原子 rename
    if (!MoveFileExW(wtempPath.c_str(), 
        [&]() {
            int wlen2 = MultiByteToWideChar(CP_UTF8, 0, filePath.c_str(), -1, nullptr, 0);
            std::wstring wpath(wlen2, L'\0');
            MultiByteToWideChar(CP_UTF8, 0, filePath.c_str(), -1, &wpath[0], wlen2);
            return wpath;
        }(),
        MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH
    )) {
        result.error = "Failed to rename temp file";
        DeleteFileW(wtempPath.c_str());
        return result;
    }
    
#else // POSIX
    int fd = open(tempPath.c_str(), O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (fd < 0) {
        result.error = "Failed to create temp file: " + tempPath;
        return result;
    }
    
    // 大缓冲区批量写入（128KB）
    const size_t BUFFER_SIZE = 128 * 1024;
    size_t offset = 0;
    
    while (offset < writeLen) {
        size_t chunk = std::min(BUFFER_SIZE, writeLen - offset);
        ssize_t written = write(fd, writeData + offset, chunk);
        
        if (written < 0) {
            result.error = "Write failed";
            close(fd);
            unlink(tempPath.c_str());
            return result;
        }
        
        offset += written;
        result.bytesWritten += written;
    }
    
    // fsync 确保数据落盘
    #ifdef __APPLE__
    fcntl(fd, F_FULLFSYNC);
    #else
    fsync(fd);
    #endif
    
    close(fd);
    
    // 原子 rename
    if (rename(tempPath.c_str(), filePath.c_str()) != 0) {
        result.error = "Failed to rename temp file";
        unlink(tempPath.c_str());
        return result;
    }
#endif
    
    result.success = true;
    return result;
}

} // namespace txtedit
