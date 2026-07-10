import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Emit .next/standalone: a self-contained server plus only the node_modules it
  // actually traced. Without this the Docker image would need the whole workspace's
  // dependency tree.
  output: 'standalone',

  // This is a monorepo: apps/web imports @heritage-saturday/shared from packages/, and
  // its dependencies are hoisted to the root node_modules. Tracing from apps/web would
  // miss both. Point the tracer at the workspace root.
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
