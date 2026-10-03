#include "hercules_runtime.h"

static unsigned int adapter_bit(hercules_adapter_kind adapter) {
  if ((int)adapter < (int)HERCULES_ADAPTER_CRYPTO || (int)adapter > (int)HERCULES_ADAPTER_COMPRESS) return 0u;
  return 1u << (unsigned int)adapter;
}

hercules_native_status hercules_runtime_init(hercules_runtime_state *state) {
  hercules_adapter_kind adapter;
  if (state == NULL) return HERCULES_NATIVE_INVALID;

  state->abi_version = HERCULES_RUNTIME_ABI_VERSION;
  state->initialized = 0u;
  state->available_mask = 0u;

  for (adapter = HERCULES_ADAPTER_CRYPTO; adapter <= HERCULES_ADAPTER_COMPRESS; adapter = (hercules_adapter_kind)((int)adapter + 1)) {
    if (hercules_adapter_available(adapter)) state->available_mask |= adapter_bit(adapter);
  }

  state->initialized = 1u;
  return HERCULES_NATIVE_OK;
}

void hercules_runtime_shutdown(hercules_runtime_state *state) {
  if (state == NULL) return;
  state->available_mask = 0u;
  state->initialized = 0u;
}

int hercules_runtime_has(const hercules_runtime_state *state, hercules_adapter_kind adapter) {
  unsigned int bit;
  if (state == NULL || state->initialized == 0u) return 0;
  bit = adapter_bit(adapter);
  if (bit == 0u) return 0;
  return (state->available_mask & bit) != 0u;
}

hercules_native_status hercules_runtime_require(const hercules_runtime_state *state, hercules_adapter_kind adapter) {
  if (state == NULL || state->initialized == 0u) return HERCULES_NATIVE_INVALID;
  if (adapter_bit(adapter) == 0u) return HERCULES_NATIVE_INVALID;
  return hercules_runtime_has(state, adapter) ? HERCULES_NATIVE_OK : HERCULES_NATIVE_UNAVAILABLE;
}
