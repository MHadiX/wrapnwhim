import type { NextConfig } from "next";
const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  poweredByHeader: false,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  images: { unoptimized: true },
  allowedDevOrigins: ["127.0.0.1"],
};
export default config;
