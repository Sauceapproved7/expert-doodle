#include "hercules_native.h"
hercules_native_status hercules_native_validate_input(const void *data, size_t len) {
  if (len > HERCULES_NATIVE_MAX_INPUT) return HERCULES_NATIVE_LIMIT;
  if (len != 0 && data == NULL) return HERCULES_NATIVE_INVALID;
  return HERCULES_NATIVE_OK;
}
const char *hercules_native_status_string(hercules_native_status status) {
  switch (status) {
    case HERCULES_NATIVE_OK: return "ok";
    case HERCULES_NATIVE_INVALID: return "invalid";
    case HERCULES_NATIVE_LIMIT: return "limit";
    case HERCULES_NATIVE_UNAVAILABLE: return "unavailable";
    case HERCULES_NATIVE_INTERNAL: return "internal";
    default: return "unknown";
  }
}
