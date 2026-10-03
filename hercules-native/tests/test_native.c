#include "hercules_native.h"
#include <assert.h>
int main(void) {
  char byte = 0;
  assert(hercules_native_validate_input(NULL, 0) == HERCULES_NATIVE_OK);
  assert(hercules_native_validate_input(&byte, 1) == HERCULES_NATIVE_OK);
  assert(hercules_native_validate_input(NULL, 1) == HERCULES_NATIVE_INVALID);
  assert(hercules_native_validate_input(&byte, HERCULES_NATIVE_MAX_INPUT + 1u) == HERCULES_NATIVE_LIMIT);
  assert(hercules_native_status_string(HERCULES_NATIVE_LIMIT) != NULL);
  return 0;
}
