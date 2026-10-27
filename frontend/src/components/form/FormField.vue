<script setup>
import { computed } from "vue";
import BaseErrorIcon from "@/components/base/BaseErrorIcon.vue";
import { FIELD_PROPS } from "@/components/form/fieldProps";

const props = defineProps({
  ...FIELD_PROPS,
  size: { type: String, default: "md", validator: (value) => ["md", "lg"].includes(value) },
});

const SIZE_CLASSES = {
  md: "rounded-lg px-3 py-2 text-sm shadow-xs max-sm:min-h-11 max-sm:text-base pointer-coarse:min-h-11",
  lg: "h-14 rounded-xl px-4 text-base shadow-md shadow-gray-200/70",
};

const MESSAGE_SIZE_CLASSES = {
  md: "mt-1 text-xs",
  lg: "mt-1.5 text-sm",
};

const errorMessage = computed(() => (Array.isArray(props.error) ? props.error[0] : props.error));
const errorId = computed(() => `${props.id}-error`);
const hintId = computed(() => `${props.id}-hint`);

const describedBy = computed(() => {
  if (errorMessage.value) return errorId.value;
  return props.hint ? hintId.value : undefined;
});

const controlClass = computed(() => [
  "block w-full border bg-white text-gray-900 caret-signal-sky placeholder:text-gray-500 focus:ring-2 focus:outline-none",
  SIZE_CLASSES[props.size],
  errorMessage.value
    ? "border-red-500 focus:border-red-600 focus:ring-red-600"
    : "border-gray-500/80 focus:border-signal-sky focus:ring-signal-sky",
]);
</script>

<template>
  <div>
    <label
      :for="id"
      :class="hideLabel ? 'sr-only' : 'mb-1 block text-sm font-medium text-gray-700'"
    >
      {{ label }}
      <span v-if="required" class="text-red-600" aria-hidden="true">*</span>
    </label>
    <slot v-bind="{ describedBy, hasError: Boolean(errorMessage), controlClass }" />
    <p
      v-if="errorMessage"
      :id="errorId"
      :class="['flex items-start gap-1.5 text-red-600', MESSAGE_SIZE_CLASSES[size]]"
    >
      <BaseErrorIcon v-if="size === 'lg'" />
      {{ errorMessage }}
    </p>
    <p v-else-if="hint" :id="hintId" :class="['text-gray-500', MESSAGE_SIZE_CLASSES[size]]">
      {{ hint }}
    </p>
  </div>
</template>
