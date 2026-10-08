import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-tools floating button sits exactly over the sidebar's user
  // avatar — keep it out of the way during design review.
  devIndicators: false,
  // Dev logs echo server action arguments — including the password when
  // staff issue a buyer login.
  logging: {
    serverFunctions: false,
  },
};

export default nextConfig;
