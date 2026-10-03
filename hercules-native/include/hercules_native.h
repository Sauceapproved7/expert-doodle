#ifndef HERCULES_NATIVE_H
#define HERCULES_NATIVE_H
#include <stddef.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef enum {
  HERCULES_NATIVE_OK = 0,
  HERCULES_NATIVE_INVALID = 1,
  HERCULES_NATIVE_LIMIT = 2,
  HERCULES_NATIVE_UNAVAILABLE = 3,
  HERCULES_NATIVE_INTERNAL = 4
} hercules_native_status;
#define HERCULES_NATIVE_MAX_INPUT (16u * 1024u * 1024u)
hercules_native_status hercules_native_validate_input(const void *data, size_t len);
const char *hercules_native_status_string(hercules_native_status status);
#ifdef __cplusplus
}
#endif
#endif
