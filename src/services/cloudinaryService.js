const cloudinary = require("../config/cloudinary");

const uploadImage = (
  buffer,
  options = {}
) => {
  return new Promise((resolve, reject) => {
    const uploadStream =
      cloudinary.uploader.upload_stream(
        {
          folder:
            options.folder ||
            "laara/characters",

          resource_type: "image"
        },

        (error, result) => {
          if (error) {
            return reject(error);
          }

          resolve(result);
        }
      );

    uploadStream.end(buffer);
  });
};

const deleteImage = async (
  publicId
) => {
  if (!publicId) {
    return;
  }

  await cloudinary.uploader.destroy(
    publicId,
    {
      resource_type: "image"
    }
  );
};

module.exports = {
  uploadImage,
  deleteImage
};