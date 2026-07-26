import jsQR from "jsqr";

export type QrScanEngine = "barcode-detector" | "jsqr";

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap) => Promise<Array<{ rawValue?: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

export function prefersEnvironmentCamera(userAgent: string) {
  return /Android|iPhone|iPad|iPod/i.test(userAgent);
}

export function buildCameraConstraints(userAgent = ""): MediaStreamConstraints {
  if (prefersEnvironmentCamera(userAgent)) {
    return { video: { facingMode: { ideal: "environment" } }, audio: false };
  }
  return {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: { ideal: "user" },
    },
    audio: false,
  };
}

export function availableQrScanEngine(): QrScanEngine | null {
  if (typeof window !== "undefined" && window.BarcodeDetector) return "barcode-detector";
  return "jsqr";
}

export function decodeQrFromImageData(data: Uint8ClampedArray, width: number, height: number) {
  if (!width || !height || data.length < width * height * 4) return null;
  try {
    return jsQR(data, width, height)?.data ?? null;
  } catch {
    return null;
  }
}

export async function detectQrWithBarcodeDetector(video: HTMLVideoElement) {
  if (!window.BarcodeDetector) return null;
  const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
  const codes = await detector.detect(video);
  return codes[0]?.rawValue ?? null;
}

export function detectQrWithJsqr(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) return null;
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;

  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.drawImage(video, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  return decodeQrFromImageData(imageData.data, width, height);
}
