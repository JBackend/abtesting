let userConfig = undefined;
try {
  userConfig = await import('./v0-user-next.config');
} catch (e) {
  // Ignore error
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
  },
  webpack: (config, { isServer }) => {
    // Disable caching entirely
    config.cache = false;
    return config;
  },
};

// Merge `userConfig` into `nextConfig`
function mergeConfig(baseConfig, additionalConfig) {
  if (!additionalConfig) {
    return baseConfig;
  }

  for (const key in additionalConfig) {
    if (
      typeof baseConfig[key] === 'object' &&
      !Array.isArray(baseConfig[key])
    ) {
      baseConfig[key] = { ...baseConfig[key], ...additionalConfig[key] };
    } else {
      baseConfig[key] = additionalConfig[key];
    }
  }
  return baseConfig;
}

// Apply the merge
const finalConfig = mergeConfig(nextConfig, userConfig);

// Export the final configuration
export default finalConfig;
