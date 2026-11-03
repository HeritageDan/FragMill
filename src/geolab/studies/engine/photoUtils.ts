/**
 * Photo compression utility for FraGeo Lab Study Reports.
 * Resizes images to max 1600px on the longest side, formats to JPEG with ~0.8 quality.
 */

export interface CompressedImageResult {
  blob: Blob;
  mimeType: string;
  base64: string;
  width: number;
  height: number;
}

export async function compressStudyPhoto(
  input: Blob | File | string,
  maxDimension = 1600,
  quality = 0.8
): Promise<CompressedImageResult> {
  // If running in Node.js or test environment where window / Image is not available:
  if (typeof window === 'undefined' || typeof document === 'undefined' || !document.createElement) {
    let base64 = typeof input === 'string' ? input : '';
    if (!base64 && typeof input === 'object' && 'arrayBuffer' in input) {
      try {
        const buf = await (input as Blob).arrayBuffer();
        base64 = `data:image/jpeg;base64,${Buffer.from(buf).toString('base64')}`;
      } catch {
        base64 = 'data:image/jpeg;base64,';
      }
    }
    const blob = typeof input === 'string' ? new Blob([input], { type: 'image/jpeg' }) : (input as Blob);
    return {
      blob,
      mimeType: 'image/jpeg',
      base64: base64 || 'data:image/jpeg;base64,',
      width: 800,
      height: 600,
    };
  }

  return new Promise((resolve, reject) => {
    let srcUrl = '';
    let isObjectUrl = false;

    if (typeof input === 'string') {
      srcUrl = input;
    } else {
      srcUrl = URL.createObjectURL(input);
      isObjectUrl = true;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (isObjectUrl) {
        URL.revokeObjectURL(srcUrl);
      }

      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        // Fallback
        const fallbackBlob = typeof input === 'string' ? new Blob([input], { type: 'image/jpeg' }) : (input as Blob);
        resolve({
          blob: fallbackBlob,
          mimeType: 'image/jpeg',
          base64: typeof input === 'string' ? input : '',
          width,
          height,
        });
        return;
      }

      // Draw white background then image
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const base64 = canvas.toDataURL('image/jpeg', quality);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({
              blob,
              mimeType: 'image/jpeg',
              base64,
              width,
              height,
            });
          } else {
            resolve({
              blob: new Blob([], { type: 'image/jpeg' }),
              mimeType: 'image/jpeg',
              base64,
              width,
              height,
            });
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = (err) => {
      if (isObjectUrl) {
        URL.revokeObjectURL(srcUrl);
      }
      reject(new Error(`Failed to load image for compression: ${err}`));
    };

    img.src = srcUrl;
  });
}
