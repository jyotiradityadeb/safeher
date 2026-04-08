type ValidationDetailItem = {
  loc?: Array<string | number>;
  msg?: string;
};

function stringifyDetail(detail: unknown): string {
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const validationMessages = detail
      .map((item) => {
        if (!item || typeof item !== "object") {
          return "";
        }
        const typed = item as ValidationDetailItem;
        if (!typed.msg) {
          return "";
        }
        const location = Array.isArray(typed.loc) ? typed.loc.join(".") : "";
        return location ? `${typed.msg} (${location})` : typed.msg;
      })
      .filter(Boolean);

    if (validationMessages.length) {
      return validationMessages.join("; ");
    }
  }

  if (detail && typeof detail === "object") {
    try {
      return JSON.stringify(detail);
    } catch {
      return "Unexpected error payload.";
    }
  }

  return "";
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const maybeAxios = error as {
      response?: { data?: { detail?: unknown; message?: unknown } };
      message?: unknown;
    };

    const detailMessage = stringifyDetail(maybeAxios.response?.data?.detail);
    if (detailMessage) {
      return detailMessage;
    }

    if (typeof maybeAxios.response?.data?.message === "string") {
      return maybeAxios.response.data.message;
    }

    if (typeof maybeAxios.message === "string" && maybeAxios.message.trim()) {
      return maybeAxios.message;
    }
  }

  return fallback;
}
