#ifndef HERCULES_RUNTIME_H
#define HERCULES_RUNTIME_H
#include "hercules_adapters.h"
#include <stddef.h>
#ifdef __cplusplus
extern "C" {
#endif

#define HERCULES_RUNTIME_ABI_VERSION 1u

typedef struct {
  unsigned int abi_version;
  unsigned int initialized;
  unsigned int available_mask;
} hercules_runtime_state;

hercules_native_status hercules_runtime_init(hercules_runtime_state *state);
void hercules_runtime_shutdown(hercules_runtime_state *state);
int hercules_runtime_has(const hercules_runtime_state *state, hercules_adapter_kind adapter);
hercules_native_status hercules_runtime_require(const hercules_runtime_state *state, hercules_adapter_kind adapter);

#ifdef __cplusplus
}
#endif
#endif
