/**
 * Cloudinary Storage Helper
 * We use Cloudinary instead of Firebase Storage to keep the app 100% free
 * and avoid requiring a credit card for the Firebase Blaze plan.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/**
 * Generic upload function to Cloudinary via unauthenticated REST API.
 */
export async function uploadToCloudinary(file: File, folder: string): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary environment variables are missing.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to upload image.');
  }

  const data = await response.json();
  // Cloudinary returns a secure_url
  return data.secure_url;
}

/**
 * Uploads an image file to Cloudinary and returns the download URL.
 */
export async function uploadProductImage(file: File, userId: string): Promise<string> {
  return uploadToCloudinary(file, `nextbench/products/${userId}`);
}

/**
 * Uploads a profile picture to Cloudinary and returns the download URL.
 */
export async function uploadProfilePicture(file: File, userId: string): Promise<string> {
  return uploadToCloudinary(file, `nextbench/profiles/${userId}`);
}
