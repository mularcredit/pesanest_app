/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.BUILD_TARGET === 'pesastack' ? '.next-pesastack' : '.next',
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
