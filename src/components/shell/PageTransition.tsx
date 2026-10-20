import { ViewTransition, type ReactNode } from "react";

/**
 * Crossfades a page's content when the route changes: home to a service, or
 * one service to another ("same app, different view"). The header sits
 * outside it and doesn't move.
 *
 * Next.js runs navigations as transitions, which is what activates a
 * ViewTransition. The key turns a service-to-service change (same route,
 * new param) into an exit and an enter; the shared name pairs the outgoing
 * and incoming page so they crossfade in place (CSS: `.content-swap` in
 * globals.css). Under reduced motion the swap is instant.
 */
export function PageTransition({ id, children }: { id: string; children: ReactNode }) {
  return (
    <ViewTransition key={id} name="page" share="content-swap" default="none">
      {children}
    </ViewTransition>
  );
}
