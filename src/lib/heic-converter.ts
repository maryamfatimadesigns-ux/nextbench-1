/**
 * Checks if a file is a HEIC or HEIF image based on its extension or MIME type
 */
export function isHeicFile(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return (
    extension === 'heic' ||
    extension === 'heif' ||
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.type === 'image/heic-sequence' ||
    file.type === 'image/heif-sequence'
  );
}

/**
 * Automatically converts HEIC/HEIF files to JPEG using client-side conversion.
 * If the file is not a HEIC/HEIF image, it returns the original file untouched.
 */
export async function convertHeicToJpeg(file: File): Promise<File> {
  if (!isHeicFile(file)) {
    return file;
  }

  try {
    // Dynamically import heic2any so it's split into its own lazy-loaded bundle
    // @ts-ignore
    const heic2anyModule = await import('heic2any');
    const heic2any = (heic2anyModule.default || heic2anyModule) as any;

    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.85
    });

    const blob = Array.isArray(converted) ? converted[0] : converted;
    
    // Replace extension with .jpg
    const baseName = file.name.replace(/\.(heic|heif)$/i, '');
    const newName = `${baseName || 'image'}.jpg`;

    return new File([blob], newName, {
      type: 'image/jpeg',
      lastModified: Date.now()
    });
  } catch (error) {
    console.error('HEIC conversion failed, using original file:', error);
    return file;
  }
}
