import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera un servidor Node.js autocontenido en .next/standalone/
  // Requerido para el Dockerfile de producción (reduce tamaño de imagen ~70%)
  output: "standalone",
};

export default nextConfig;
