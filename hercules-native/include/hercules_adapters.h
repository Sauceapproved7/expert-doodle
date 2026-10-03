#ifndef HERCULES_ADAPTERS_H
#define HERCULES_ADAPTERS_H
#include "hercules_native.h"
#include <stddef.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef enum {
  HERCULES_ADAPTER_CRYPTO = 0,
  HERCULES_ADAPTER_STORE = 1,
  HERCULES_ADAPTER_IO = 2,
  HERCULES_ADAPTER_COMPRESS = 3
} hercules_adapter_kind;
int hercules_adapter_available(hercules_adapter_kind adapter);
hercules_native_status hercules_crypto_hash(const void *input, size_t input_len, unsigned char *output, size_t output_len);
hercules_native_status hercules_store_open(const char *path);
hercules_native_status hercules_io_poll_once(void);
hercules_native_status hercules_compress_buffer(const void *input, size_t input_len, void *output, size_t *output_len);
#ifdef __cplusplus
}
#endif
#endif
