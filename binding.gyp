{
  "targets": [
    {
      "target_name": "txtedit_native",
      "sources": [
        "native/addon.cpp",
        "native/file_reader.cpp",
        "native/file_writer.cpp",
        "native/encoding_detect.cpp",
        "native/file_validator.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.15",
        "OTHER_CFLAGS": ["-std=c++17"]
      },
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": ["/std:c++17"]
        }
      },
      "conditions": [
        ["OS=='mac'", {
          "cflags+": ["-std=c++17", "-O3", "-march=native"],
          "xcode_settings": {
            "OTHER_CFLAGS": ["-std=c++17", "-O3"]
          }
        }],
        ["OS=='linux'", {
          "cflags+": ["-std=c++17", "-O3", "-march=native"],
          "ldflags": ["-lpthread"]
        }],
        ["OS=='win'", {
          "cflags+": ["/O2"]
        }]
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ]
    }
  ]
}
