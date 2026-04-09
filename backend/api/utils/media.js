import fs from "fs/promises";
import imagekit from "../configs/imagekit.js";

const isImage = (mime = "") => mime.startsWith("image/");
const isVideo = (mime = "") => mime.startsWith("video/");
const isAudio = (mime = "") => mime.startsWith("audio/");

const withTransform = (url = "", transform = "") => {
  if (!url || !transform) return url;
  return `${url}${url.includes("?") ? "&" : "?"}tr=${transform}`;
};

const IMAGE_TRANSFORMS = {
  posts: [
    { quality: "auto" },
    { format: "webp" },
    { width: "1600" },
  ],
  reels: [
    { quality: "auto" },
    { width: "1080" },
  ],
  stories: [
    { quality: "auto" },
    { format: "webp" },
    { width: "1080" },
  ],
  profiles: [
    { quality: "auto" },
    { format: "webp" },
    { width: "640" },
  ],
  covers: [
    { quality: "auto" },
    { format: "webp" },
    { width: "1600" },
  ],
  "group-avatars": [
    { quality: "auto" },
    { format: "webp" },
    { width: "640" },
  ],
  "chat-media": [
    { quality: "auto" },
    { format: "webp" },
    { width: "1280" },
  ],
  default: [
    { quality: "auto" },
    { format: "webp" },
    { width: "1280" },
  ],
};

const buildImageUrl = (filePath, preset = "default") =>
  imagekit.url({
    path: filePath,
    transformation: IMAGE_TRANSFORMS[preset] || IMAGE_TRANSFORMS.default,
  });

const buildThumbnailUrl = (filePath, width = "480") =>
  imagekit.url({
    path: filePath,
    transformation: [
      { quality: "auto" },
      { format: "webp" },
      { width: String(width) },
    ],
  });

export const readAndRemoveUploadedFile = async (file) => {
  const buffer = await fs.readFile(file.path);
  await fs.unlink(file.path).catch(() => {});
  return buffer;
};

export const uploadOptimizedMedia = async (file, folder = "default", customFileName = "") => {
  const buffer = await readAndRemoveUploadedFile(file);
  const uploadRes = await imagekit.upload({
    file: buffer,
    fileName: customFileName || file.originalname,
    folder,
  });

  const mimeType = file.mimetype || "";

  if (isImage(mimeType)) {
    return {
      url: buildImageUrl(uploadRes.filePath, folder),
      originalUrl: uploadRes.url,
      thumbnail: buildThumbnailUrl(uploadRes.filePath),
      filePath: uploadRes.filePath,
      mimeType,
      size: file.size || 0,
    };
  }

  if (isVideo(mimeType)) {
    return {
      url: withTransform(uploadRes.url, "q-auto,vc-auto"),
      originalUrl: uploadRes.url,
      thumbnail: uploadRes.thumbnailUrl ? withTransform(uploadRes.thumbnailUrl, "q-auto,f-webp,w-720") : "",
      filePath: uploadRes.filePath,
      mimeType,
      size: file.size || 0,
    };
  }

  if (isAudio(mimeType)) {
    return {
      url: uploadRes.url,
      originalUrl: uploadRes.url,
      thumbnail: "",
      filePath: uploadRes.filePath,
      mimeType,
      size: file.size || 0,
    };
  }

  return {
    url: uploadRes.url,
    originalUrl: uploadRes.url,
    thumbnail: "",
    filePath: uploadRes.filePath,
    mimeType,
    size: file.size || 0,
  };
};
