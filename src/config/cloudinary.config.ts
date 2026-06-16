import { registerAs } from '@nestjs/config'

export default registerAs('cloudinaryConfig', () => ({
  cloudName: process.env.CLOUDINARY_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
}))
