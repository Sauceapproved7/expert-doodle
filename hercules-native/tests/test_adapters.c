#include "hercules_adapters.h"
#include <assert.h>
#include <stddef.h>

int main(void) {
  unsigned char input = 7;
  unsigned char output[64] = {0};
  size_t output_len = sizeof(output);

  assert(hercules_adapter_available(HERCULES_ADAPTER_CRYPTO) == 0);
  assert(hercules_adapter_available(HERCULES_ADAPTER_STORE) == 0);
  assert(hercules_adapter_available(HERCULES_ADAPTER_IO) == 0);
  assert(hercules_adapter_available(HERCULES_ADAPTER_COMPRESS) == 0);

  assert(hercules_crypto_hash(NULL, 1, output, sizeof(output)) == HERCULES_NATIVE_INVALID);
  assert(hercules_crypto_hash(&input, 1, NULL, sizeof(output)) == HERCULES_NATIVE_INVALID);
  assert(hercules_crypto_hash(&input, 1, output, sizeof(output)) == HERCULES_NATIVE_UNAVAILABLE);

  assert(hercules_store_open(NULL) == HERCULES_NATIVE_INVALID);
  assert(hercules_store_open("") == HERCULES_NATIVE_INVALID);
  assert(hercules_store_open("state.db") == HERCULES_NATIVE_UNAVAILABLE);

  assert(hercules_io_poll_once() == HERCULES_NATIVE_UNAVAILABLE);

  assert(hercules_compress_buffer(NULL, 1, output, &output_len) == HERCULES_NATIVE_INVALID);
  assert(hercules_compress_buffer(&input, 1, NULL, &output_len) == HERCULES_NATIVE_INVALID);
  assert(hercules_compress_buffer(&input, 1, output, NULL) == HERCULES_NATIVE_INVALID);
  assert(hercules_compress_buffer(&input, 1, output, &output_len) == HERCULES_NATIVE_UNAVAILABLE);
  return 0;
}
