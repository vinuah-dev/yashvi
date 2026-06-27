export const MEMBER_IMAGE_MAX_FILE_SIZE = 6 * 1024 * 1024;
export const MEMBER_IMAGE_TARGET_BYTES = 100 * 1024;
export const MEMBER_IMAGE_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateMemberImage(file) {
  if (!file) {
    return "Please select an image";
  }

  if (!MEMBER_IMAGE_ALLOWED_TYPES.includes(file.type)) {
    return "Please select a JPG, PNG, or WebP image";
  }

  if (file.size > MEMBER_IMAGE_MAX_FILE_SIZE) {
    return "Image must be less than 6MB";
  }

  return null;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
}

async function renderCompressedBlob(image, maxWidth, maxHeight) {
  const widthRatio = maxWidth / image.width;
  const heightRatio = maxHeight / image.height;
  const scale = Math.min(1, widthRatio, heightRatio);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context is not available");
  }

  context.drawImage(image, 0, 0, width, height);

  let bestBlob = null;
  for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42, 0.32, 0.24, 0.18]) {
    const blob = await canvasToBlob(canvas, quality);
    if (!blob) {
      continue;
    }

    bestBlob = blob;
    if (blob.size <= MEMBER_IMAGE_TARGET_BYTES) {
      return blob;
    }
  }

  return bestBlob;
}

export async function compressMemberImage(file, targetBytes = MEMBER_IMAGE_TARGET_BYTES) {
  const image = await loadImage(file);
  let bestBlob = null;

  for (const dimension of [320, 280, 240, 200, 160, 128, 96]) {
    const blob = await renderCompressedBlob(image, dimension, dimension);
    if (!blob) {
      continue;
    }

    if (!bestBlob || blob.size < bestBlob.size) {
      bestBlob = blob;
    }

    if (blob.size <= targetBytes) {
      bestBlob = blob;
      break;
    }
  }

  if (!bestBlob) {
    throw new Error("Failed to compress image");
  }

  const compressedFileName = `${file.name.replace(/\.[^.]+$/, "")}.jpg`;
  return new File([bestBlob], compressedFileName, { type: "image/jpeg" });
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}