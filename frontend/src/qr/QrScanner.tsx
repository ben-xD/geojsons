import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useStore } from "@/store/store";
import { X, SwitchCamera, Camera, Type, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface CameraDevice {
  id: string;
  label: string;
}

type ImportMode = "camera" | "text";

function TextImport({ onClose }: { onClose: () => void }) {
  const addQrCode = useStore.use.addQrCode();
  const [text, setText] = useState("");

  const handleImport = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    addQrCode(trimmed);
    onClose();
  };

  return (
    <div className="w-full max-w-sm px-4 flex flex-col gap-3">
      <textarea
        className="w-full h-40 p-3 text-sm bg-muted/50 border border-border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground resize-none font-mono"
        placeholder="Paste QR code content here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <button
        className="w-full py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
        disabled={!text.trim()}
        onClick={handleImport}
      >
        Import
      </button>
    </div>
  );
}

function CameraScanner({ onClose }: { onClose: () => void }) {
  const addQrCode = useStore.use.addQrCode();
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [activeCameraIndex, setActiveCameraIndex] = useState(0);
  const [switching, setSwitching] = useState(false);
  const [cameraMenuOpen, setCameraMenuOpen] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const closedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const addQrCodeRef = useRef(addQrCode);
  onCloseRef.current = onClose;
  addQrCodeRef.current = addQrCode;

  // Unique ID per mount to avoid DOM collisions when remounting
  const readerId = useId().replace(/:/g, "-");

  useEffect(() => {
    if (!readerRef.current) return;
    let cancelled = false;
    setError(null);

    const scanner = new Html5Qrcode(readerRef.current.id);
    scannerRef.current = scanner;

    const onDecode = (decodedText: string) => {
      if (closedRef.current) return;
      closedRef.current = true;
      scanner
        .stop()
        .catch(() => {})
        .finally(() => {
          addQrCodeRef.current(decodedText);
          onCloseRef.current();
        });
    };

    const startCamera = (cameraId: string) => {
      if (cancelled) return;
      return scanner.start(cameraId, { fps: 10, qrbox: { width: 250, height: 250 } }, onDecode, () => {});
    };

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (cancelled) return;
        if (devices.length === 0) {
          setError("No cameras found on this device.");
          return;
        }
        const mapped = devices.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id.slice(0, 8)}` }));
        setCameras(mapped);
        const backIndex = mapped.findIndex((c) => /back|rear|environment/i.test(c.label));
        const idx = backIndex >= 0 ? backIndex : 0;
        setActiveCameraIndex(idx);
        startCamera(mapped[idx].id)?.catch((err) => {
          if (!cancelled) setError(err?.message || "Camera access denied.");
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Camera access denied. Please allow camera permissions.");
      });

    return () => {
      cancelled = true;
      try {
        const state = scanner.getState();
        if (state === 2 || state === 3) {
          scanner
            .stop()
            .then(() => scanner.clear())
            .catch(() => {});
        } else {
          scanner.clear();
        }
      } catch {
        // scanner may not be initialized yet
      }
    };
  }, [readerId, retryKey]);

  const startScanner = async (scanner: Html5Qrcode, cameraId: string) => {
    await scanner.start(
      cameraId,
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        if (closedRef.current) return;
        closedRef.current = true;
        scanner
          .stop()
          .catch(() => {})
          .finally(() => {
            addQrCodeRef.current(decodedText);
            onCloseRef.current();
          });
      },
      () => {},
    );
  };

  const switchCamera = async (targetIndex: number) => {
    if (!scannerRef.current || switching || targetIndex === activeCameraIndex) return;
    setCameraMenuOpen(false);
    setSwitching(true);

    const scanner = scannerRef.current;
    const previousIndex = activeCameraIndex;

    try {
      await scanner.stop().catch(() => {});
      scanner.clear();
      await startScanner(scanner, cameras[targetIndex].id);
      setActiveCameraIndex(targetIndex);
    } catch {
      // Try to fall back to the previous camera
      try {
        scanner.clear();
        await startScanner(scanner, cameras[previousIndex].id);
      } catch {
        setError("Failed to switch camera.");
      }
    } finally {
      setSwitching(false);
    }
  };

  return (
    <>
      {cameras.length > 1 && (
        <div className="absolute top-4 left-4 z-10">
          <button
            className="p-2 rounded-full bg-muted text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
            onClick={() => setCameraMenuOpen((p) => !p)}
            disabled={switching}
          >
            <SwitchCamera size={20} />
          </button>
          {cameraMenuOpen && (
            <div className="absolute left-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg p-1 min-w-[180px]">
              {cameras.map((cam, i) => (
                <button
                  key={cam.id}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-md transition-colors text-left",
                    i === activeCameraIndex
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted",
                  )}
                  onClick={() => switchCamera(i)}
                >
                  <Camera size={14} className="shrink-0" />
                  <span className="truncate">{cam.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error ? (
        <div className="text-center px-6 flex flex-col items-center gap-3">
          <p className="text-destructive font-medium">Unable to access camera</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            onClick={() => setRetryKey((k) => k + 1)}
          >
            <RotateCcw size={14} />
            Retry
          </button>
        </div>
      ) : (
        <div className="w-full max-w-sm px-4">
          <div id={readerId} ref={readerRef} className="w-full rounded-lg overflow-hidden" />
          <p className="text-center text-sm text-muted-foreground mt-4">
            {switching ? "Switching camera..." : "Point your camera at a QR code"}
          </p>
        </div>
      )}
    </>
  );
}

export function QrScanner({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<ImportMode>("camera");

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex flex-col items-center justify-center">
      <button
        className="absolute top-4 right-4 p-2 rounded-full bg-muted text-foreground hover:bg-muted/80 transition-colors z-10"
        onClick={onClose}
      >
        <X size={24} />
      </button>

      {/* Mode tabs */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex bg-muted rounded-lg p-0.5 z-10">
        <button
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
            mode === "camera" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setMode("camera")}
        >
          <Camera size={14} />
          Scan
        </button>
        <button
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
            mode === "text" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setMode("text")}
        >
          <Type size={14} />
          Text
        </button>
      </div>

      {mode === "camera" ? <CameraScanner onClose={onClose} /> : <TextImport onClose={onClose} />}
    </div>
  );
}
