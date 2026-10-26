export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  DOCUMENT_NOT_FOUND: 404,
  ITEM_NOT_FOUND: 404,
  SKU_ALREADY_EXISTS: 409,
  PRODUCT_ALREADY_IN_DOCUMENT: 409,
  INVALID_DOCUMENT_STATUS: 409,
  IDEMPOTENCY_KEY_CONFLICT: 409,
  PRODUCT_NOT_FOUND: 422,
  DOCUMENT_HAS_NO_ITEMS: 422,
  ITEM_NOT_IN_DOCUMENT: 422,
  QUANTITY_EXCEEDS_REMAINING: 422,
  DOCUMENT_NOT_FULLY_RECEIVED: 422,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  constructor(code, message, details) {
    super(message);
    const status = ERROR_STATUS[code];
    if (!status) throw new Error(`Kode error tidak dikenal: ${code}`);

    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
