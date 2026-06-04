/**
 * native/file_validator.cpp - 批量文件验证实现
 * 
 * 性能优势：
 * - 单次 JNI/N-API 调用处理所有路径，避免 N 次 IPC 往返
 * - C++ 层直接调用 stat，无需 JS 层字符串操作开销
 */

#include "file_validator.h"

#ifdef _WIN32
#include <windows.h>
#else
#include <sys/stat.h>
#endif

namespace txtedit {

std::vector<FileValidationEntry> validateFiles(const std::vector<std::string>& paths) {
    std::vector<FileValidationEntry> results;
    results.reserve(paths.size());
    
    for (const auto& path : paths) {
        FileValidationEntry entry;
        entry.path = path;
        entry.exists = false;
        entry.isFile = false;
        entry.size = 0;
        
#ifdef _WIN32
        // Windows: 使用 GetFileAttributesExW
        int wlen = MultiByteToWideChar(CP_UTF8, 0, path.c_str(), -1, nullptr, 0);
        std::wstring wpath(wlen, L'\0');
        MultiByteToWideChar(CP_UTF8, 0, path.c_str(), -1, &wpath[0], wlen);
        
        WIN32_FILE_ATTRIBUTE_DATA attrData;
        if (GetFileAttributesExW(wpath.c_str(), GetFileExInfoStandard, &attrData)) {
            entry.exists = true;
            entry.isFile = !(attrData.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY);
            if (entry.isFile) {
                ULARGE_INTEGER size;
                size.LowPart = attrData.nFileSizeLow;
                size.HighPart = attrData.nFileSizeHigh;
                entry.size = size.QuadPart;
            }
        }
#else
        struct stat st;
        if (stat(path.c_str(), &st) == 0) {
            entry.exists = true;
            entry.isFile = S_ISREG(st.st_mode);
            if (entry.isFile) {
                entry.size = st.st_size;
            }
        }
#endif
        
        // 只返回有效文件
        if (entry.exists && entry.isFile) {
            results.push_back(entry);
        }
    }
    
    return results;
}

} // namespace txtedit
