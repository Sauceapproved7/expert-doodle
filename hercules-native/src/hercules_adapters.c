#include "hercules_adapters.h"

int hercules_adapter_available(hercules_adapter_kind adapter) {
  switch (adapter) {
    case HERCULES_ADAPTER_CRYPTO:
    case HERCULES_ADAPTER_STORE:
    case HERCULES_ADAPTER_IO:
    case HERCULES_ADAPTER_COMPRESS:
      return 0;
    default:
      return 0;
  }
}

hercules_native_status hercules_crypto_hash(const void *input, size_t input_len, unsigned char *output, size_t output_len) {
  hercules_native_status status = hercules_native_validate_input(input, input_len);
  if (status != HERCULES_NATIVE_OK) return status;
  if (output == NULL || output_len == 0) return HERCULES_NATIVE_INVALID;
  return HERCULES_NATIVE_UNAVAILABLE;
}

hercules_native_status hercules_store_open(const char *path) {
  if (path == NULL || path[0] == '\0') return HERCULES_NATIVE_INVALID;
  return HERCULES_NATIVE_UNAVAILABLE;
}

hercules_native_status hercules_io_poll_once(void) {
  return HERCULES_NATIVE_UNAVAILABLE;
}

hercules_native_status hercules_compress_buffer(const void *input, size_t input_len, void *output, size_t *output_len) {
  hercules_native_status status = hercules_native_validate_input(input, input_len);
  if (status != HERCULES_NATIVE_OK) return status;
  if (output == NULL || output_len == NULL || *output_len == 0) return HERCULES_NATIVE_INVALID;
  return HERCULES_NATIVE_UNAVAILABLE;
}
