"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Button, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { placeCard } from "@/lib/tour-placement";
import { findTarget, hasSeenTour, markTourSeen, SERVICE_TOUR, TOUR_START_EVENT, type TourStep } from "./tour";
import styles from "./ServiceTour.module.css";

/** Space between the highlighted element and the edge of its spotlight. */
const SPOTLIGHT_PAD = 6;
/** A moment after the page is ready, so the layout has settled under the spotlight. */
const START_DELAY_MS = 400;

/**
 * The service page's onboarding tour: the page dims, a spotlight sits on one
 * control at a time, and a small card explains it. It starts by itself the
 * first time someone opens a service page (once its charts are there), and
 * the header's tour button replays it. Finishing or skipping it, including
 * with Escape, is remembered.
 *
 * It is a modal dialog (React Aria): focus moves into the card and stays
 * there, the page behind is inert, and each step's text is announced as it
 * changes.
 */
export function ServiceTour({ ready }: { ready: boolean }) {
  const [steps, setSteps] = useState<readonly TourStep[]>([]);
  const [index, setIndex] = useState(0);
  // Separate from the steps: while the overlay closes, it still renders the last step.
  const [open, setOpen] = useState(false);

  const start = useCallback(() => {
    // Only the steps whose element is on screen right now (e.g. no navigator yet).
    const available = SERVICE_TOUR.filter((step) => findTarget(step) !== null);
    setIndex(0);
    setSteps(available);
    setOpen(available.length > 0);
  }, []);

  useEffect(() => {
    if (!ready || hasSeenTour()) return;
    const timer = setTimeout(start, START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [ready, start]);

  useEffect(() => {
    window.addEventListener(TOUR_START_EVENT, start);
    return () => window.removeEventListener(TOUR_START_EVENT, start);
  }, [start]);

  const close = () => {
    markTourSeen();
    setOpen(false);
  };

  const step = steps[index];
  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(open) => !open && close()}
      isDismissable={false}
      className={styles.overlay}
    >
      {step && (
        <TourStepCard
          step={step}
          index={index}
          total={steps.length}
          onBack={() => setIndex((i) => Math.max(0, i - 1))}
          onNext={() => (index + 1 < steps.length ? setIndex(index + 1) : close())}
          onSkip={close}
        />
      )}
    </ModalOverlay>
  );
}

function TourStepCard({
  step,
  index,
  total,
  onBack,
  onNext,
  onSkip,
}: {
  step: TourStep;
  index: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const spotlight = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const textId = useId();
  const last = index === total - 1;

  // Bring the step's element into view, then keep the spotlight and the card
  // on it through scrolling and resizing. Positions are written straight to
  // the two elements: they change every frame while scrolling, and React
  // state would re-render the card each time.
  useLayoutEffect(() => {
    const target = findTarget(step);
    if (!target) return;
    const first = target.getBoundingClientRect();
    if (first.top < 0 || first.bottom > window.innerHeight) target.scrollIntoView({ block: "center" });

    const position = () => {
      // The card renders through a portal and may attach a frame later; the next frame places it.
      const light = spotlight.current;
      const panel = card.current;
      if (!light || !panel) return;
      const box = target.getBoundingClientRect();
      const lit = {
        top: box.top - SPOTLIGHT_PAD,
        left: box.left - SPOTLIGHT_PAD,
        width: box.width + 2 * SPOTLIGHT_PAD,
        height: box.height + 2 * SPOTLIGHT_PAD,
      };
      Object.assign(light.style, {
        top: `${lit.top}px`,
        left: `${lit.left}px`,
        width: `${lit.width}px`,
        height: `${lit.height}px`,
      });
      const place = placeCard(
        { ...lit, left: box.left },
        { width: panel.offsetWidth, height: panel.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
      );
      Object.assign(panel.style, { top: `${place.top}px`, left: `${place.left}px`, opacity: "1" });
    };

    position();
    let frame = requestAnimationFrame(position);
    const follow = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(position);
    };
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [step]);

  return (
    <>
      <div ref={spotlight} className={styles.spotlight} aria-hidden="true" />
      {/* Transparent, not hidden, until placed: it stays in the accessibility tree. */}
      <Modal ref={card} className={styles.card} style={{ opacity: 0 }}>
        <Dialog className={styles.dialog} aria-describedby={textId}>
          {/* Announced as the steps change; focus stays on Next. */}
          <div aria-live="polite" aria-atomic="true" className={styles.content}>
            <p className={styles.progress}>
              Step {index + 1} of {total}
            </p>
            <Heading slot="title" className={styles.title}>
              {step.title}
            </Heading>
            <p id={textId} className={styles.text}>
              {step.text}
            </p>
          </div>
          <div className={styles.actions}>
            {!last && (
              <Button className={styles.skip} onPress={onSkip}>
                Skip tour
              </Button>
            )}
            <span className={styles.spacer} />
            {index > 0 && (
              <Button className={styles.back} onPress={onBack}>
                Back
              </Button>
            )}
            <Button className={styles.next} onPress={onNext} autoFocus>
              {last ? "Done" : "Next"}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </>
  );
}
