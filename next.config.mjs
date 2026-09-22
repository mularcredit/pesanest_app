/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.BUILD_TARGET === 'pesastack' ? '.next-pesastack' : '.next',
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  // pdf-parse wraps pdf.js, which relies on its own worker/asset resolution
  // at runtime — bundling it breaks that, so it needs to run as a real Node
  // module instead.
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;
