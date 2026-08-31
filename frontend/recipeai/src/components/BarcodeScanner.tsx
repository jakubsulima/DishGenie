import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import type { DecodeHintType, Result } from "@zxing/library";
import ErrorAlert from "./ErrorAlert";
import { useLanguage } from "../context/languageContext";

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onBarcodeDetected: (barcode: string) => void;
}

type ScannerControls = IScannerControls;

const CAMERA_CONSTRAINTS: MediaStreamConstraints[] = [
  {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  },
  {
    audio: false,
    video: { facingMode: "environment" },
  },
  {
    audio: false,
    video: true,
  },
];

const isRecoverableScanError = (error?: unknown): boolean => {
  if (!error || !(error instanceof Error)) {
    return true;
  }

  const recoverableNames = [
    "NotFoundException",
    "ChecksumException",
    "FormatException",
    "NoMultiFormatReadersException",
  ];

  return recoverableNames.includes(error.name);
};

const getStartScannerError = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Camera access was blocked. Allow camera permission and try again.";
    }

    if (error.name === "NotFoundError") {
      return "No camera was found on this device.";
    }

    if (error.name === "NotReadableError") {
      return "Camera is already in use by another app. Close it and retry.";
    }
  }

  return "Could not start camera scanner. Please allow camera access or enter barcode manually.";
};

const BarcodeScanner = ({
  isOpen,
  onClose,
  onBarcodeDetected,
}: BarcodeScannerProps) => {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<ScannerControls | null>(null);
  const hasDetectedRef = useRef(false);

  const [manualBarcode, setManualBarcode] = useState("");
  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, onClose]);

  const stopScanner = () => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }

    hasDetectedRef.current = false;

    if (videoRef.current) {
      const mediaStream = videoRef.current.srcObject as MediaStream | null;
      mediaStream?.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    let isCancelled = false;

    const startScanner = async () => {
      setError("");
      setIsStarting(true);
      hasDetectedRef.current = false;

      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t("Your browser does not support camera access."));
        setIsStarting(false);
        return;
      }

      try {
        const [
          { BrowserMultiFormatReader },
          { BarcodeFormat, DecodeHintType },
        ] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);

        const scannerHints = new Map<DecodeHintType, unknown>([
          [
            DecodeHintType.POSSIBLE_FORMATS,
            [
              BarcodeFormat.EAN_13,
              BarcodeFormat.EAN_8,
              BarcodeFormat.UPC_A,
              BarcodeFormat.UPC_E,
              BarcodeFormat.CODE_128,
            ],
          ],
        ]);

        const reader = new BrowserMultiFormatReader(scannerHints, {
          delayBetweenScanAttempts: 250,
          delayBetweenScanSuccess: 500,
          tryPlayVideoTimeout: 5000,
        });

        let controls: ScannerControls | null = null;
        let startError: unknown;

        for (const constraints of CAMERA_CONSTRAINTS) {
          try {
            controls = await reader.decodeFromConstraints(
              constraints,
              videoRef.current ?? undefined,
              (
                result: Result | undefined,
                scanError: unknown,
                activeControls: ScannerControls,
              ) => {
                if (hasDetectedRef.current) {
                  return;
                }

                if (result) {
                  const scannedBarcode = result.getText().trim();
                  if (!scannedBarcode) {
                    return;
                  }

                  hasDetectedRef.current = true;
                  activeControls.stop();
                  controlsRef.current = null;
                  onBarcodeDetected(scannedBarcode);
                  onClose();
                  return;
                }

                if (scanError && !isRecoverableScanError(scanError)) {
                  setError(
                    (currentError) =>
                      currentError ||
                      t("Scanner is active but cannot read this barcode yet. Try better lighting or enter the code manually."),
                  );
                }
              },
            );
            break;
          } catch (caughtError) {
            startError = caughtError;
          }
        }

        if (!controls) {
          throw startError;
        }

        if (isCancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
      } catch (caughtError) {
        setError(t(getStartScannerError(caughtError)));
      } finally {
        setIsStarting(false);
      }
    };

    startScanner();

    return () => {
      isCancelled = true;
      stopScanner();
    };
  }, [isOpen, onBarcodeDetected, onClose, t]);

  const handleManualSubmit = () => {
    const trimmed = manualBarcode.trim();
    if (!trimmed) {
      return;
    }
    onBarcodeDetected(trimmed);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div
        className="mobile-card-enter w-full max-w-xl overflow-hidden rounded-2xl border border-primary/20 bg-secondary shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="barcode-scanner-title"
      >
        <div className="border-b border-primary/10 bg-primary px-4 py-3 text-background sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="barcode-scanner-title" className="text-lg font-bold">
                {t("Scan Barcode")}
              </h3>
              <p className="text-sm text-background/75">
                {t("Place the barcode inside the frame for fast detection.")}
              </p>
            </div>
            <button
              onClick={onClose}
              className="mobile-soft-press rounded-md border border-background/20 px-2.5 py-1.5 text-sm font-medium text-background/80 transition-colors hover:bg-background/10 hover:text-background"
            >
              {t("Close")}
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="relative overflow-hidden rounded-xl border border-primary/15 bg-background">
            <video
              ref={videoRef}
              className="h-64 w-full object-cover sm:h-72"
              autoPlay
              muted
              playsInline
            />
            <div className="pointer-events-none absolute inset-0 p-5">
              <div className="relative h-full w-full rounded-xl border-2 border-accent/75">
                <div className="scanner-sweep absolute left-3 right-3 h-0.5 bg-accent/90 shadow-[0_0_16px_rgba(255,212,60,0.8)]" />
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="rounded-full border border-primary/15 bg-background px-3 py-1 text-text/70">
              {t("Supports EAN and UPC formats")}
            </span>
            {isStarting && (
              <span className="rounded-full bg-accent/20 px-3 py-1 font-medium text-text">
                {t("Starting camera...")}
              </span>
            )}
          </div>

          <ErrorAlert
            message={error}
            compact
            className="mt-3"
            onAutoHide={() => setError("")}
          />

          <div className="mt-5 border-t border-primary/10 pt-4">
            <label className="mb-1.5 block text-sm font-medium text-text">
              {t("Enter barcode manually")}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                placeholder="e.g. 5901234123457"
                className="w-full rounded-lg border border-primary/20 bg-background px-3 py-2.5 text-text placeholder:text-text/50 focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                onClick={handleManualSubmit}
                className="mobile-soft-press rounded-lg bg-accent px-4 py-2.5 font-semibold text-text transition-colors hover:bg-accent/90"
              >
                {t("Use Code")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;
