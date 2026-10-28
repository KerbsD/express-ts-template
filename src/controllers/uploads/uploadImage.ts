import { randomUUID } from "node:crypto";

import type { Request, Response } from "express";
import { fileTypeFromBuffer } from "file-type";

import { logger, serializeError } from "../../lib/logger.ts";
import {
  isUploadStorageConfigured,
  supabaseAdmin,
  uploadBucket,
} from "../../lib/supabase.ts";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  isUploadFolder,
  type UploadFolder,
} from "../../lib/uploads.ts";

/**
 * Accepts one multipart image, sniffs its real type from the bytes (the
 * client-supplied Content-Type is not trusted), and stores it in the public
 * Supabase bucket. Mounted below verifyJwt, so only authenticated admins can
 * reach it.
 */
const handleUploadImage = async (req: Request, res: Response) => {
  if (!isUploadStorageConfigured || !supabaseAdmin || !uploadBucket) {
    res.status(503).json({
      success: false,
      message: "Image uploads are not configured on the server.",
    });
    return;
  }

  const file = req.file;
  if (!file) {
    res.status(400).json({
      success: false,
      message: 'Choose an image to upload in the "file" field.',
    });
    return;
  }

  const folderInput: unknown = req.body?.folder;
  if (folderInput !== undefined && !isUploadFolder(folderInput)) {
    res.status(400).json({
      success: false,
      message: 'folder must be one of "portfolio", "merch", "design", or "misc".',
    });
    return;
  }
  const folder: UploadFolder = isUploadFolder(folderInput) ? folderInput : "misc";

  const detected = await fileTypeFromBuffer(file.buffer);
  if (!detected || !ALLOWED_IMAGE_MIME_TYPES.has(detected.mime)) {
    res.status(400).json({
      success: false,
      message: "Upload a JPEG, PNG, WebP, AVIF, or GIF image.",
    });
    return;
  }

  const objectPath = `${folder}/${randomUUID()}.${detected.ext}`;
  const storage = supabaseAdmin.storage.from(uploadBucket);

  const { error } = await storage.upload(objectPath, file.buffer, {
    contentType: detected.mime,
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) {
    logger.error(
      {
        err: serializeError(error),
        folder,
        path: objectPath,
        size: file.size,
      },
      "supabase image upload failed",
    );
    res.status(502).json({
      success: false,
      message: "Could not upload the image. Please try again.",
    });
    return;
  }

  const { data } = storage.getPublicUrl(objectPath);

  res.status(201).json({
    success: true,
    data: {
      url: data.publicUrl,
      path: objectPath,
      contentType: detected.mime,
      size: file.size,
    },
  });
};

export { handleUploadImage };
