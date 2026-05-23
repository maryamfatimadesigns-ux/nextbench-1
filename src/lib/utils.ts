import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Optimizes image URLs for Cloudinary and handles browser compatibility
 * by converting .heic/.heif format URLs to web-friendly .jpg dynamically.
 */
export function getOptimizedImageUrl(url: string | undefined): string {
  if (!url) return '';
  
  if (url.includes('res.cloudinary.com')) {
    let optimized = url;
    
    // Replace .heic or .heif extension with .jpg
    optimized = optimized.replace(/\.(heic|heif)$/i, '.jpg');
    
    // Inject f_auto,q_auto,w_800 transformations if they are not already present
    if (optimized.includes('/image/upload/') && !optimized.includes('f_auto')) {
      optimized = optimized.replace('/image/upload/', '/image/upload/f_auto,q_auto,w_800/');
    }
    
    return optimized;
  }
  
  return url;
}
