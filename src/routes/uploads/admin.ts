import express from "express";
import multer from "multer";

import { handleUploadImage } from "../../controllers/uploads/uploadImage.ts";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "../../lib/uploads.ts";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
    fields: 4,
    parts: 6,
  },
});

const uploadSingle = upload.single("file");

router.post(
  "/",
  (req, res, next) => {
    uploadSingle(req, res, (error: unknown) => {
      if (!error) return next();

      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            success: false,
            message: `Image must be ${MAX_UPLOAD_MB} MB or smaller.`,
          });
        }

        return res.status(400).json({
          success: false,
          message: 'Upload one image in the "file" field.',
        });
      }

      return next(error);
    });
  },
  handleUploadImage,
);

export default router;
