import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl({
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    return [
      { source: "/en", destination: "/", permanent: true },
      { source: "/en/:path*", destination: "/:path*", permanent: true },
      { source: "/sv", destination: "/", permanent: true },
      { source: "/sv/:path*", destination: "/:path*", permanent: true },
    ];
  },
});
