cmake_minimum_required(VERSION 3.16)
project(hercules_native C)
set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

add_library(hercules_native STATIC
  src/hercules_native.c
  src/hercules_adapters.c
)
target_include_directories(hercules_native PUBLIC include)

if(MSVC)
  target_compile_options(hercules_native PRIVATE /W4)
else()
  target_compile_options(hercules_native PRIVATE -Wall -Wextra -Wpedantic -Werror)
endif()

enable_testing()
add_executable(hercules_native_tests tests/test_native.c)
target_link_libraries(hercules_native_tests PRIVATE hercules_native)
add_test(NAME hercules_native_tests COMMAND hercules_native_tests)

add_executable(hercules_adapter_tests tests/test_adapters.c)
target_link_libraries(hercules_adapter_tests PRIVATE hercules_native)
add_test(NAME hercules_adapter_tests COMMAND hercules_adapter_tests)
