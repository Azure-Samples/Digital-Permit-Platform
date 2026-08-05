/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: __dirname,
  serverExternalPackages: [
    "@azure/monitor-opentelemetry",
    "@azure/identity",
    "@azure/storage-blob",
    "@prisma/client",
    "bcryptjs",
    "openai",
    "pdf-parse",
    "mammoth",
    "jszip",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.blob.core.windows.net",
      },
    ],
  },
};

module.exports = nextConfig;
