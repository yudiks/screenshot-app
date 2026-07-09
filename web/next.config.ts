import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @resvg/resvg-js ships a native .node binding that the bundler can't inline;
  // keep it external so it's required at runtime from node_modules.
  serverExternalPackages: ["@resvg/resvg-js"],
  // Ensure the bundled font used to render annotation text in the /download
  // route is included in the serverless function's file trace (resvg reads it
  // by path in native code, which the tracer can't detect automatically).
  outputFileTracingIncludes: {
    "/s/[id]/download": ["./assets/fonts/Roboto-Regular.ttf"],
  },
};

export default nextConfig;
