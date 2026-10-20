"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { Button, Dialog, DialogTrigger, Heading, Modal, ModalOverlay } from "react-aria-components";
import { ChartSyncProvider } from "@/components/charts/ChartSync";
import { chartTable } from "@/components/charts/chart-table";
import type { ChartSpec } from "@/components/charts/chart-options";
import { preloadRangeNavigator, RangeNavigator, RangeNavigatorSkeleton } from "@/components/charts/RangeNavigator";
import { preloadTimeChart, TimeChart } from "@/components/charts/TimeChart";
import { Skeleton } from "@/components/feedback/Skeleton";
import { Icon } from "@/components/icons/Icon";
import { Panel, SLOW_LOAD_MESSAGE, SLOW_LOAD_MS } from "@/components/panel/Panel";
import { useDashboardState } from "@/hooks/useDashboardState";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { useSeriesList, useTimeseries } from "@/hooks/useServiceData";
import { ApiError } from "@/lib/api-client";
import {
  commonFrequencies,
  compareBlockedReason,
  extentOf,
  fetchWindow,
  resolveFrequency,
  resolveSelection,
} from "@/lib/dashboard";
import { formatFacetValue, formatTimestamp, formatValue } from "@/lib/format";
import { toIsoDate } from "@/lib/time";
import { DEFAULT_RANGE, MAX_SELECTED_SERIES, resolveRange } from "@/lib/url-state";
import { getService, type ServiceId } from "@/services/registry";
import type { SeriesColumns } from "@/services/types";
import { DASHBOARDS } from "./configs";
import { panelAvailable, type ChartPanelDefinition, type PanelContext, type PanelDefinition } from "./panels";
import styles from "./ServiceDashboard.module.css";
import { SeriesPicker, SeriesPickerSkeleton, type SeriesPickerProps } from "./SeriesPicker";
import { TransformEditor } from "./TransformEditor";
import { FrequencyControl, RangeControl } from "./ViewControls";

/** Explicit layout → class map: layout names are data, not CSS class names. */
const LAYOUT_CLASS: Record<PanelDefinition["layout"], string | undefined> = {
  primary: styles.layoutPrimary,
  secondary: styles.layoutSecondary,
  sidebar: styles.layoutSidebar,
  half: styles.layoutHalf,
  wide: styles.layoutWide,
};

/** The latest value of the first series inside the visible range, as a readout. */
function latestReadout(spec: ChartSpec | null): ReactNode {
  const series = spec?.series[0];
  if (!spec || !series) return null;
  for (let i = series.t.length - 1; i >= 0; i--) {
    const t = series.t[i] as number;
    const v = series.values[i];
    if (spec.range && t > spec.range.max) continue;
    if (v === null || v === undefined) continue;
    return (
      <>
        <b>{formatValue(v, spec.unit, spec.decimals)}</b> on {formatTimestamp(t, spec.intraday)}
      </>
    );
  }
  return null;
}

/** One service's page: series picker, view controls and the service's panels. */
export function ServiceDashboard({ serviceId }: { serviceId: ServiceId }) {
  const service = getService(serviceId);
  const config = DASHBOARDS[serviceId];
  const [state, actions] = useDashboardState(service);

  // Fetch the chart code in parallel with the data rather than after it.
  useEffect(() => {
    preloadTimeChart();
    preloadRangeNavigator();
  }, []);
  const catalog = useSeriesList(serviceId);

  const selection = useMemo(
    () => resolveSelection(catalog.data?.series ?? [], state.series),
    [catalog.data, state.series],
  );
  const primary = selection.series[0];
  const frequency = resolveFrequency(selection.series, state.frequency);
  const rangeSelection = { preset: state.preset, from: state.from, to: state.to };

  // The overview (primary series, default frequency, one field) gives the data's time extent.
  const overview = useTimeseries(
    serviceId,
    primary
      ? { ids: [primary.id], frequency: primary.frequencies[0] ?? "daily", fields: [config.overviewField] }
      : null,
  );
  const extent = useMemo(() => extentOf(overview.data?.series ?? []), [overview.data]);
  const overviewSeries = overview.data?.series[0];

  // Only the panels shown for this selection: e.g. a net-only series must not request "gross".
  // Until the catalog arrives no series is known, so availability can't be
  // decided yet: show every panel in its loading state rather than a blank page.
  const panels = useMemo(
    () =>
      selection.series.length === 0
        ? config.panels
        : config.panels.filter((panel) => panelAvailable(panel, { series: selection.series })),
    [config.panels, selection.series],
  );
  const fields = useMemo(() => [...new Set(panels.flatMap((p) => p.fields))], [panels]);
  const fetchRange = fetchWindow(frequency, rangeSelection, extent);
  const main = useTimeseries(
    serviceId,
    primary && fetchRange ? { ids: selection.series.map((s) => s.id), frequency, fields, ...fetchRange } : null,
  );

  const columns = useMemo(
    () => new Map<string, SeriesColumns>((main.data?.series ?? []).map((c) => [c.seriesId, c])),
    [main.data],
  );
  const dataExtent = extentOf(main.data?.series ?? []) ?? extent;
  const range = dataExtent ? resolveRange(rangeSelection, dataExtent) : null;
  const rangeMin = range?.min;
  const rangeMax = range?.max;

  // Panels rebuild their charts only when an input really changes. Keyed on
  // primitives (not the freshly created range object), so re-renders caused by
  // fetch status alone don't rerun transforms or rebuild charts.
  const ctx = useMemo<PanelContext | null>(
    () =>
      primary && rangeMin !== undefined && rangeMax !== undefined
        ? {
            service,
            series: selection.series,
            columns,
            frequency,
            range: { min: rangeMin, max: rangeMax },
            transforms: state.transforms,
          }
        : null,
    [primary, service, selection.series, columns, frequency, rangeMin, rangeMax, state.transforms],
  );

  // One explanation for the whole page when loading is slow (e.g. a data service
  // waking up). Declared before the early return below: hooks must always run.
  const slowLoad = useDelayedFlag(catalog.isPending || (primary !== undefined && main.isPending), SLOW_LOAD_MS);

  if (catalog.isError && !catalog.data) {
    const message = catalog.error instanceof ApiError ? catalog.error.message : `${service.label} couldn't be loaded.`;
    return (
      <div className={styles.status} role="alert">
        <h1 className={styles.statusTitle}>{service.label} is unavailable</h1>
        <p>{message}</p>
        <button type="button" className={styles.retry} onClick={() => void catalog.refetch()}>
          <Icon name="rotate-ccw" size={14} />
          Try again
        </button>
      </div>
    );
  }

  const pickerProps: SeriesPickerProps | null = catalog.data
    ? {
        label: `${service.label} series`,
        series: catalog.data.series,
        groupBy: config.groupBy,
        selected: selection.series.map((s) => s.id),
        maxSelected: MAX_SELECTED_SERIES,
        onShow: (id) => actions.selectSeries([id]),
        onToggleCompare: (id) => {
          // The default series isn't in the URL yet; write the full selection.
          const ids = selection.series.map((s) => s.id);
          actions.selectSeries(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
        },
        compareBlockedReason: (s) => compareBlockedReason(s, primary, frequency),
      }
    : null;

  const mainStatus = main.isError && !main.data ? "error" : main.data ? "success" : "pending";
  // A range too large to load is one page-level problem with one fix, not an error in every panel.
  const tooLarge = main.error instanceof ApiError && main.error.code === "too_large" && !main.data;
  const isRefreshing = main.isPlaceholderData || (main.isFetching && main.data !== undefined);

  // The range control, under the primary chart: it sets the period for every panel.
  let navigator: ReactNode = null;
  if (overviewSeries && range) {
    navigator = (
      <RangeNavigator
        label={`Time range for ${primary?.name ?? service.label}`}
        t={overviewSeries.t}
        values={overviewSeries.fields[config.overviewField] ?? []}
        range={range}
        onCommit={({ min, max }) => actions.setCustomRange(toIsoDate(min), toIsoDate(max))}
      />
    );
  } else if (catalog.isPending || (primary !== undefined && overview.isPending)) {
    navigator = <RangeNavigatorSkeleton />;
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar} aria-label={`${service.label} series`}>
        {pickerProps ? <SeriesPicker {...pickerProps} /> : <SeriesPickerSkeleton label={`${service.label} series`} />}
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.heading}>
            {catalog.isPending ? (
              <HeadingSkeleton label={service.label} />
            ) : (
              <h1 className={styles.title}>{primary?.name ?? service.label}</h1>
            )}
            {primary && (
              <p className={styles.facts}>
                <span>{primary.id}</span>
                {primary.facets.map((f) => (
                  <span key={f.key}>{formatFacetValue(f.value)}</span>
                ))}
                <span>{primary.unit}</span>
                {selection.series.length > 1 && <span>Comparing {selection.series.length} series</span>}
              </p>
            )}
          </div>
          {pickerProps ? <MobilePicker {...pickerProps} /> : <MobilePickerSkeleton />}
        </header>

        {selection.missing.length > 0 && (
          <p className={styles.notice}>
            {selection.missing.join(", ")} {selection.missing.length === 1 ? "isn't" : "aren't"} in {service.label}, so{" "}
            {selection.missing.length === 1 ? "it isn't" : "they aren't"} shown.
          </p>
        )}

        <div className={styles.controls}>
          <FrequencyControl
            // Until the series are known, offer the service's frequencies: the
            // usual outcome, and the control keeps its final size while loading.
            frequencies={catalog.isPending ? service.frequencies : commonFrequencies(selection.series)}
            value={frequency}
            onChange={(f) => actions.setFrequency(f === primary?.frequencies[0] ? null : f)}
          />
          <RangeControl preset={state.preset} from={state.from} to={state.to} onPreset={actions.setPreset} />
        </div>

        {tooLarge && (
          <div className={styles.notice} role="alert">
            <p>
              This range has too much {frequency === "5min" ? "5-minute " : ""}data to load at once. Choose a shorter
              range.
            </p>
            <button type="button" className={styles.noticeAction} onClick={() => actions.setPreset("1Y")}>
              Show the last year
            </button>
          </div>
        )}

        {slowLoad && (
          <p className={styles.notice} role="status">
            {SLOW_LOAD_MESSAGE}
          </p>
        )}

        <ChartSyncProvider>
          <div className={styles.panels}>
            {panels.map((panel) =>
              panel.kind === "custom" ? (
                <panel.Component
                  key={panel.id}
                  ctx={ctx}
                  onShowSeries={(id) => actions.selectSeries([id])}
                  className={LAYOUT_CLASS[panel.layout]}
                />
              ) : (
                <DashboardPanel
                  key={panel.id}
                  panel={panel}
                  ctx={ctx}
                  status={tooLarge ? "success" : mainStatus}
                  emptyMessage={tooLarge ? "Choose a shorter range to load this panel." : undefined}
                  error={main.error}
                  onRetry={() => void main.refetch()}
                  isRefreshing={isRefreshing}
                  footer={panel.layout === "primary" ? navigator : undefined}
                  toolbar={
                    panel.layout === "primary" ? (
                      <TransformEditor
                        transforms={state.transforms}
                        onChange={actions.setTransforms}
                        frequency={frequency}
                      />
                    ) : undefined
                  }
                />
              ),
            )}
          </div>
        </ChartSyncProvider>
      </div>
    </div>
  );
}

function DashboardPanel({
  panel,
  ctx,
  status,
  error,
  onRetry,
  isRefreshing,
  emptyMessage,
  toolbar,
  footer,
}: {
  panel: ChartPanelDefinition;
  ctx: PanelContext | null;
  status: "pending" | "error" | "success";
  error: unknown;
  onRetry: () => void;
  isRefreshing: boolean;
  emptyMessage?: string;
  toolbar?: ReactNode;
  footer?: ReactNode;
}) {
  const spec = useMemo(() => (ctx && status === "success" ? panel.build(ctx) : null), [ctx, panel, status]);
  const table = useMemo(() => (spec ? chartTable(spec) : undefined), [spec]);
  return (
    <Panel
      title={panel.title}
      subtitle={ctx ? panel.subtitle?.(ctx) : subtitlePlaceholder(panel)}
      readout={latestReadout(spec)}
      status={ctx ? status : status === "error" ? "error" : "pending"}
      error={error}
      onRetry={onRetry}
      isEmpty={status === "success" && spec === null}
      emptyMessage={emptyMessage}
      explainSlowLoad={false}
      toolbar={toolbar}
      footer={footer}
      isRefreshing={isRefreshing}
      table={table}
      bodyHeight={panel.bodyHeight}
      variant={panel.layout === "primary" ? "primary" : "secondary"}
      className={LAYOUT_CLASS[panel.layout]}
    >
      {spec && <TimeChart spec={spec} isRefreshing={isRefreshing} />}
    </Panel>
  );
}

/**
 * A panel's subtitle before its context (series, frequency) is known: the text
 * itself when it is fixed, otherwise a placeholder (short: e.g. "Daily").
 */
function subtitlePlaceholder(panel: ChartPanelDefinition): ReactNode {
  if (panel.staticSubtitle) return panel.staticSubtitle;
  return panel.subtitle ? <Skeleton tone="text" width="3.5rem" /> : undefined;
}

/** The page title and its facts line while the catalog loads. */
function HeadingSkeleton({ label }: { label: string }) {
  return (
    <>
      <h1 className={styles.title}>
        <span className="visually-hidden">{label}</span>
        <Skeleton tone="text" width="min(20rem, 55vw)" />
      </h1>
      <p className={styles.facts}>
        <Skeleton tone="text" width="14rem" />
      </p>
    </>
  );
}

/** Holds the place of "Change series" on narrow screens. */
function MobilePickerSkeleton() {
  return (
    <div className={styles.changeSeriesPlaceholder}>
      <Skeleton width="8.5rem" height="var(--touch-target)" />
    </div>
  );
}

/**
 * The whole page's shape before the dashboard can render (the server-rendered
 * HTML, while the page reads its view from the URL). Same layout, panels and
 * placeholders as the dashboard's own loading state, so nothing jumps when it
 * takes over.
 */
export function ServiceDashboardSkeleton({ serviceId }: { serviceId: ServiceId }) {
  const service = getService(serviceId);
  const config = DASHBOARDS[serviceId];
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar} aria-label={`${service.label} series`}>
        <SeriesPickerSkeleton label={`${service.label} series`} />
      </aside>
      <div className={styles.main} aria-busy="true">
        <header className={styles.header}>
          <div className={styles.heading}>
            <HeadingSkeleton label={service.label} />
          </div>
          <MobilePickerSkeleton />
        </header>
        {/* The same controls the dashboard shows before its data arrives, so nothing shifts. */}
        <div className={styles.controls}>
          <FrequencyControl frequencies={service.frequencies} value={resolveFrequency([], null)} onChange={noop} />
          <RangeControl preset={DEFAULT_RANGE} from={null} to={null} onPreset={noop} />
        </div>
        <div className={styles.panels}>
          {config.panels.map((panel) =>
            panel.kind === "custom" ? (
              <panel.Component key={panel.id} ctx={null} onShowSeries={noop} className={LAYOUT_CLASS[panel.layout]} />
            ) : (
              <Panel
                key={panel.id}
                title={panel.title}
                subtitle={subtitlePlaceholder(panel)}
                status="pending"
                explainSlowLoad={false}
                bodyHeight={panel.bodyHeight}
                variant={panel.layout === "primary" ? "primary" : "secondary"}
                className={LAYOUT_CLASS[panel.layout]}
                toolbar={
                  panel.layout === "primary" ? (
                    <Skeleton width="6.75rem" height="1.75rem" radius="var(--radius-pill)" />
                  ) : undefined
                }
                footer={panel.layout === "primary" ? <RangeNavigatorSkeleton /> : undefined}
              >
                {null}
              </Panel>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function noop(): void {}

/** On narrow screens the series list opens as a sheet. */
function MobilePicker(props: SeriesPickerProps) {
  return (
    <DialogTrigger>
      <Button className={styles.changeSeries}>Change series</Button>
      <ModalOverlay isDismissable className={styles.overlay}>
        <Modal className={styles.sheet}>
          <Dialog className={styles.sheetDialog} aria-labelledby="series-sheet-title">
            {({ close }) => (
              <>
                <div className={styles.sheetHead}>
                  <Heading slot="title" id="series-sheet-title" className={styles.sheetTitle}>
                    {props.label}
                  </Heading>
                  <Button className={styles.changeSeries} onPress={close}>
                    Done
                  </Button>
                </div>
                <SeriesPicker
                  {...props}
                  onShow={(id) => {
                    props.onShow(id);
                    close();
                  }}
                />
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
