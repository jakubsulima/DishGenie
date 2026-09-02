import React from "react";
import { useLanguage } from "../context/languageContext";

interface FridgeOperationSuccessProps {
  message?: string;
  onUndo?: () => void;
}

const FridgeOperationSuccess: React.FC<FridgeOperationSuccessProps> = ({
  message = "Fridge updated",
  onUndo,
}) => {
  const { t } = useLanguage();

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl border border-green-700/20 bg-green-50 px-4 py-3 text-sm text-green-900"
      role="status"
      aria-live="polite"
    >
      <span>{t(message)}</span>
      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          className="shrink-0 font-semibold underline underline-offset-2"
        >
          {t("Undo")}
        </button>
      )}
    </div>
  );
};

export default FridgeOperationSuccess;
