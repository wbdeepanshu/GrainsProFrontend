import { useToast } from "@/hooks/use-toast";

export function getApiSuccessMessage(result, fallback = "Operation completed successfully.") {
  if (typeof result === "string") return result;
  return result?.message || fallback;
}

export function getApiErrorMessage(error, fallback = "Something went wrong") {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  return (
    error?.data?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

export function useSuccessPopup() {
  const { toast } = useToast();

  const showSuccess = (message, options = {}) => {
    toast({
      title: options.title || "Success",
      description: typeof message === "string" ? message : message?.text || "Done",
    });
  };

  const showError = (message, options = {}) => {
    toast({
      title: options.title || "Error",
      description:
        typeof message === "string"
          ? message
          : message?.text || getApiErrorMessage(message),
      variant: "destructive",
    });
  };

  return { showSuccess, showError, getApiErrorMessage };
}

export default useSuccessPopup;
