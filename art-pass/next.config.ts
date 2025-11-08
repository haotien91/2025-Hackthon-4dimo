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
        hostname: "172.20.10.7",
      },
    ],
  },
};

export default nextConfig;
