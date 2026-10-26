import { ZodError } from "zod";
import { AppError } from "./errors.js";

export function handle(routeFn) {
  return async (request, context) => {
    try {
      return await routeFn(request, context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function errorResponse(error) {
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Data yang dikirim tidak valid.",
          details: error.issues.flatMap(toFieldErrors),
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof AppError) {
    const body = { code: error.code, message: error.message };
    if (error.details) body.details = error.details;
    return Response.json({ error: body }, { status: error.status });
  }

  console.error(error);
  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Terjadi kesalahan pada server. Silakan coba lagi.",
      },
    },
    { status: 500 },
  );
}

function toFieldErrors(issue) {
  if (issue.code === "unrecognized_keys") {
    return issue.keys.map((key) => ({
      field: [...issue.path, key].join("."),
      message: "Field tidak dikenal.",
    }));
  }
  return [{ field: issue.path.join(".") || "(body)", message: issue.message }];
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Data yang dikirim tidak valid.", [
      {
        field: "(body)",
        message: "Body request harus berupa JSON yang valid.",
      },
    ]);
  }
}
