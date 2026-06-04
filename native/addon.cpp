/**
 * native/addon.cpp - Node.js N-API 绑定层
 * 
 * 将 C++ 高性能文件操作暴露为 Node.js 原生模块。
 * 使用 node-addon-api (N-API) 确保 ABI 稳定性，跨 Node.js 版本兼容。
 * 
 * 暴露的 API：
 * - readFile(filePath)        → 零拷贝读取文件
 * - readFileStreaming(...)    → 流式分块读取
 * - writeFile(path, content, enc) → 原子写入文件
 * - validateFiles(paths)      → 批量验证文件
 * - detectEncoding(buffer)    → 快速编码检测
 */

#include <napi.h>
#include "file_reader.h"
#include "file_writer.h"
#include "file_validator.h"
#include "encoding_detect.h"

// ============================================================
// readFile(filePath: string) → object
// ============================================================

Napi::Value ReadFile(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Expected a file path string").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    std::string filePath = info[0].As<Napi::String>().Utf8Value();
    
    txtedit::FileReadResult result = txtedit::readFileMmap(filePath);
    
    Napi::Object obj = Napi::Object::New(env);
    obj.Set("success", Napi::Boolean::New(env, result.success));
    
    if (result.success) {
        obj.Set("content", Napi::String::New(env, result.content));
        obj.Set("encoding", Napi::String::New(env, result.encoding));
        obj.Set("encodingConfidence", Napi::Number::New(env, result.encodingConfidence));
        // fileSize 用 BigInt 安全传递大数值
        obj.Set("fileSize", Napi::BigInt::New(env, result.fileSize));
    } else {
        obj.Set("error", Napi::String::New(env, result.error));
    }
    
    return obj;
}

// ============================================================
// writeFile(filePath: string, content: string, encoding: string) → object
// ============================================================

Napi::Value WriteFile(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 3) {
        Napi::TypeError::New(env, "Expected (filePath, content, encoding)").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    std::string filePath = info[0].As<Napi::String>().Utf8Value();
    std::string content = info[1].As<Napi::String>().Utf8Value();
    std::string encoding = info[2].As<Napi::String>().Utf8Value();
    
    txtedit::FileWriteResult result = txtedit::writeFile(filePath, content, encoding);
    
    Napi::Object obj = Napi::Object::New(env);
    obj.Set("success", Napi::Boolean::New(env, result.success));
    obj.Set("bytesWritten", Napi::BigInt::New(env, result.bytesWritten));
    
    if (!result.success) {
        obj.Set("error", Napi::String::New(env, result.error));
    }
    
    return obj;
}

// ============================================================
// validateFiles(paths: string[]) → object[]
// ============================================================

Napi::Value ValidateFiles(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsArray()) {
        Napi::TypeError::New(env, "Expected an array of file paths").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    Napi::Array jsArray = info[0].As<Napi::Array>();
    std::vector<std::string> paths;
    paths.reserve(jsArray.Length());
    
    for (uint32_t i = 0; i < jsArray.Length(); i++) {
        Napi::Value elem = jsArray.Get(i);
        if (elem.IsString()) {
            paths.push_back(elem.As<Napi::String>().Utf8Value());
        }
    }
    
    auto results = txtedit::validateFiles(paths);
    
    Napi::Array output = Napi::Array::New(env, results.size());
    for (size_t i = 0; i < results.size(); i++) {
        Napi::Object entry = Napi::Object::New(env);
        entry.Set("path", Napi::String::New(env, results[i].path));
        entry.Set("size", Napi::BigInt::New(env, results[i].size));
        entry.Set("isFile", Napi::Boolean::New(env, results[i].isFile));
        output.Set(i, entry);
    }
    
    return output;
}

// ============================================================
// detectEncoding(buffer: Buffer) → object
// ============================================================

Napi::Value DetectEncoding(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsBuffer()) {
        Napi::TypeError::New(env, "Expected a Buffer").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    Napi::Buffer<uint8_t> buffer = info[0].As<Napi::Buffer<uint8_t>>();
    const uint8_t* data = buffer.Data();
    size_t length = buffer.Length();
    
    txtedit::EncodingResult result = txtedit::detectEncoding(data, length);
    
    Napi::Object obj = Napi::Object::New(env);
    obj.Set("encoding", Napi::String::New(env, result.encoding));
    obj.Set("confidence", Napi::Number::New(env, result.confidence));
    obj.Set("hasBOM", Napi::Boolean::New(env, result.hasBOM));
    
    return obj;
}

// ============================================================
// getFileSize(filePath: string) → BigInt
// ============================================================

Napi::Value GetFileSize(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Expected a file path string").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    std::string filePath = info[0].As<Napi::String>().Utf8Value();
    uint64_t size = txtedit::getFileSize(filePath);
    
    return Napi::BigInt::New(env, size);
}

// ============================================================
// 模块初始化
// ============================================================

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("readFile", Napi::Function::New(env, ReadFile));
    exports.Set("writeFile", Napi::Function::New(env, WriteFile));
    exports.Set("validateFiles", Napi::Function::New(env, ValidateFiles));
    exports.Set("detectEncoding", Napi::Function::New(env, DetectEncoding));
    exports.Set("getFileSize", Napi::Function::New(env, GetFileSize));
    
    return exports;
}

NODE_API_MODULE(txtedit_native, Init)
