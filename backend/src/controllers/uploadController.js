const cloudinary = require("../config/cloudinary");

function hasAllowedImageSignature(buffer) {
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isPng = buffer.length >= pngSignature.length && buffer.subarray(0, 8).equals(pngSignature);
  const isWebp =
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";

  return isJpeg || isPng || isWebp;
}

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "task-manager",
        resource_type: "image",
        secure: true,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      },
    );

    uploadStream.end(buffer);
  });
}

async function uploadImage(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: "Please select an image to upload" });
  }

  if (!hasAllowedImageSignature(req.file.buffer)) {
    return res.status(415).json({ message: "Only JPG, JPEG, PNG, and WEBP images are allowed" });
  }

  try {
    const result = await uploadToCloudinary(req.file.buffer);
    if (typeof result?.secure_url !== "string" || !result.secure_url.startsWith("https://")) {
      return res.status(502).json({ message: "Image upload failed. Please try again" });
    }

    return res.status(201).json({
      message: "Image uploaded successfully",
      imageUrl: result.secure_url,
    });
  } catch {
    return res.status(502).json({ message: "Image upload failed. Please try again" });
  }
}

module.exports = { uploadImage };