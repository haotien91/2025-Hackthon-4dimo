import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 允許使用遠端圖片來源
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "cultureexpress.taipei",
      },
      {
        protocol: "http",
        hostname: "142.91.103.69",
      },
    ],
  },
};

export default nextConfig;
