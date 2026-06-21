import { HttpException } from "@nestjs/common";

type ValidationErrorLike = {
  constraints?: Record<string, string>;
  children?: unknown[];
};

export function flattenValidationMessages(message: unknown): string[] {
  if (typeof message === "string") {
    return [message];
  }

  if (!Array.isArray(message)) {
    return [];
  }

  return message.flatMap((item) => {
    if (typeof item === "string") {
      return [item];
    }

    if (typeof item === "object" && item !== null) {
      const error = item as ValidationErrorLike;
      const fromConstraints = error.constraints
        ? Object.values(error.constraints)
        : [];
      const fromChildren = error.children
        ? flattenValidationMessages(error.children)
        : [];

      return [...fromConstraints, ...fromChildren];
    }

    return [];
  });
}

export function extractHttpExceptionDetails(exception: HttpException): {
  status: number;
  message: string;
  validationErrors: string[] | null;
} {
  const status = exception.getStatus();
  const response = exception.getResponse();

  if (typeof response === "string") {
    return { status, message: response, validationErrors: null };
  }

  if (typeof response === "object" && response !== null) {
    const body = response as Record<string, unknown>;
    const validationErrors = flattenValidationMessages(body.message);

    if (validationErrors.length > 0) {
      return {
        status,
        message: validationErrors.join("; "),
        validationErrors,
      };
    }

    if (typeof body.message === "string") {
      return { status, message: body.message, validationErrors: null };
    }
  }

  return { status, message: exception.message, validationErrors: null };
}
