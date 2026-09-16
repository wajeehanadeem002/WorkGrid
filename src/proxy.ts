import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware(
  async (auth, request) => {
    const pathname = request.nextUrl.pathname;
    const isProtectedDocument =
      pathname === "/app" ||
      pathname.startsWith("/app/") ||
      pathname.startsWith("/join/");
    if (isProtectedDocument) {
      const { isAuthenticated, redirectToSignIn } = await auth();
      if (!isAuthenticated) return redirectToSignIn();
    }
  },
  {
    contentSecurityPolicy: {
      strict: true,
      directives: {
        "base-uri": ["'self'"],
        "frame-ancestors": ["'none'"],
        "object-src": ["'none'"],
      },
    },
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
