#include "hercules_runtime.h"
#include <assert.h>

int main(void) {
  hercules_runtime_state state = {0u, 0u, 0u};

  assert(hercules_runtime_init(NULL) == HERCULES_NATIVE_INVALID);
  assert(hercules_runtime_require(&state, HERCULES_ADAPTER_CRYPTO) == HERCULES_NATIVE_INVALID);

  assert(hercules_runtime_init(&state) == HERCULES_NATIVE_OK);
  assert(state.abi_version == HERCULES_RUNTIME_ABI_VERSION);
  assert(state.initialized == 1u);
  assert(state.available_mask == 0u);

  assert(hercules_runtime_has(&state, HERCULES_ADAPTER_CRYPTO) == 0);
  assert(hercules_runtime_has(&state, HERCULES_ADAPTER_STORE) == 0);
  assert(hercules_runtime_has(&state, HERCULES_ADAPTER_IO) == 0);
  assert(hercules_runtime_has(&state, HERCULES_ADAPTER_COMPRESS) == 0);
  assert(hercules_runtime_require(&state, HERCULES_ADAPTER_CRYPTO) == HERCULES_NATIVE_UNAVAILABLE);
  assert(hercules_runtime_require(&state, (hercules_adapter_kind)99) == HERCULES_NATIVE_INVALID);

  hercules_runtime_shutdown(&state);
  assert(state.initialized == 0u);
  assert(state.available_mask == 0u);
  assert(hercules_runtime_has(&state, HERCULES_ADAPTER_CRYPTO) == 0);
  return 0;
}
