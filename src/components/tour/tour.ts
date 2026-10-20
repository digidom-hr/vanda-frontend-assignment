/** One stop on the tour: the element(s) it highlights, and what it says. */
export interface TourStep {
  /**
   * `data-tour` values to highlight; the first one visible on screen is used
   * (e.g. the sidebar picker on desktop, "Change series" on phones). A step
   * whose element isn't on the page is skipped.
   */
  readonly targets: readonly string[];
  readonly title: string;
  readonly text: string;
}

export const SERVICE_TOUR: readonly TourStep[] = [
  {
    targets: ["search"],
    title: "Search every series",
    text: "Find any series in Alpha, Bravo and Charlie by name, ticker, id, sector or region. Press / on any page.",
  },
  {
    targets: ["picker", "picker-mobile"],
    title: "Pick and compare series",
    text: "Click a name to show that series. Tick the box beside it to add it to a comparison: up to six, rebased to 100.",
  },
  {
    targets: ["view-controls"],
    title: "Frequency and period",
    text: "Switch between daily, weekly, monthly or 5-minute data, and pick a period from the last month to the full history. Link hover marks the date you point at in every chart.",
  },
  {
    targets: ["transforms"],
    title: "Transform the data",
    text: "Add a moving average, rolling sum, percent change, cumulative or z-score. Chain them: they apply left to right.",
  },
  {
    targets: ["navigator"],
    title: "Fine-tune the period",
    text: "Drag the highlighted window or its handles, or scroll over the strip to zoom: every panel follows. To look closer at one chart, drag it to pan or pinch (Ctrl + scroll) to zoom.",
  },
  {
    targets: ["panel-view"],
    title: "Chart or table",
    text: "Each panel shows its latest value, and switches to a table of the numbers behind the chart.",
  },
];

/** Remembers that the tour was finished or skipped, so it doesn't start again by itself. */
export const TOUR_STORAGE_KEY = "vanda-timeseries:tour";
/** Fired on window to replay the tour (the header's tour button). */
export const TOUR_START_EVENT = "vanda-timeseries:tour-start";

export function hasSeenTour(): boolean {
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) === "done";
  } catch {
    // Storage blocked (private mode, settings): don't nag with the tour on every visit.
    return true;
  }
}

export function markTourSeen(): void {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, "done");
  } catch {
    // Storage blocked: nothing to remember.
  }
}

/** The step's element that is actually on screen (hidden elements have no boxes). */
export function findTarget(step: TourStep): HTMLElement | null {
  for (const name of step.targets) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
      if (el.getClientRects().length > 0) return el;
    }
  }
  return null;
}
