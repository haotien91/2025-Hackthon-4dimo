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
        protocol: "https",
        hostname: "4dimo.020908.xyz:8443",
      },
    ],
  },
};

export default nextConfig;
