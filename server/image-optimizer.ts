import sharp from 'sharp';

interface OptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  convertToWebP?: boolean;
  maintainAspectRatio?: boolean;
}

interface OptimizedImage {
  buffer: Buffer;
  mimetype: string;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
}

/**
 * Optimiza y comprime una imagen
 * @param buffer - Buffer de la imagen original
 * @param mimetype - Tipo MIME de la imagen original
 * @param options - Opciones de optimización
 */
export async function optimizeImage(
  buffer: Buffer,
  mimetype: string,
  options: OptimizationOptions = {}
): Promise<OptimizedImage> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 85,
    convertToWebP = false,
    maintainAspectRatio = true
  } = options;

  const originalSize = buffer.length;
  
  try {
    let image = sharp(buffer);
    
    // Obtener metadata de la imagen
    const metadata = await image.metadata();
    
    // Redimensionar si excede los límites
    if (metadata.width && metadata.height) {
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        image = image.resize(maxWidth, maxHeight, {
          fit: maintainAspectRatio ? 'inside' : 'cover',
          withoutEnlargement: true
        });
      }
    }
    
    // Rotar según EXIF si existe
    image = image.rotate();
    
    let optimizedBuffer: Buffer;
    let outputMimetype: string;
    
    // Convertir a WebP si está habilitado (mejor compresión)
    if (convertToWebP) {
      optimizedBuffer = await image
        .webp({ quality, effort: 4 })
        .toBuffer();
      outputMimetype = 'image/webp';
    } else {
      // Mantener el formato original pero optimizado
      if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') {
        optimizedBuffer = await image
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
        outputMimetype = 'image/jpeg';
      } else if (mimetype === 'image/png') {
        optimizedBuffer = await image
          .png({ quality, compressionLevel: 9, effort: 8 })
          .toBuffer();
        outputMimetype = 'image/png';
      } else if (mimetype === 'image/webp') {
        optimizedBuffer = await image
          .webp({ quality, effort: 4 })
          .toBuffer();
        outputMimetype = 'image/webp';
      } else {
        // Para otros formatos, convertir a JPEG por defecto
        optimizedBuffer = await image
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
        outputMimetype = 'image/jpeg';
      }
    }
    
    const optimizedSize = optimizedBuffer.length;
    const compressionRatio = ((originalSize - optimizedSize) / originalSize * 100);
    
    console.log(`📸 Imagen optimizada: ${(originalSize / 1024).toFixed(2)}KB → ${(optimizedSize / 1024).toFixed(2)}KB (${compressionRatio.toFixed(1)}% reducción)`);
    
    return {
      buffer: optimizedBuffer,
      mimetype: outputMimetype,
      originalSize,
      optimizedSize,
      compressionRatio
    };
    
  } catch (error) {
    console.error('Error al optimizar imagen:', error);
    // Si falla la optimización, devolver la imagen original
    return {
      buffer,
      mimetype,
      originalSize,
      optimizedSize: originalSize,
      compressionRatio: 0
    };
  }
}

/**
 * Crea múltiples versiones de una imagen (thumbnail, medium, original)
 */
export async function createImageVariants(
  buffer: Buffer,
  mimetype: string
): Promise<{
  thumbnail: OptimizedImage;
  medium: OptimizedImage;
  full: OptimizedImage;
}> {
  const [thumbnail, medium, full] = await Promise.all([
    // Thumbnail: 300x300
    optimizeImage(buffer, mimetype, {
      maxWidth: 300,
      maxHeight: 300,
      quality: 80,
      maintainAspectRatio: true
    }),
    // Medium: 800x800
    optimizeImage(buffer, mimetype, {
      maxWidth: 800,
      maxHeight: 800,
      quality: 85,
      maintainAspectRatio: true
    }),
    // Full: 1920x1080
    optimizeImage(buffer, mimetype, {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 90,
      maintainAspectRatio: true
    })
  ]);
  
  return { thumbnail, medium, full };
}

