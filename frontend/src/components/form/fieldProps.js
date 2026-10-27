export const FIELD_PROPS = {
  id: { type: String, required: true },
  label: { type: String, required: true },
  error: { type: [String, Array], default: null },
  hint: { type: String, default: null },
  required: { type: Boolean, default: false },
  hideLabel: { type: Boolean, default: false },
};
