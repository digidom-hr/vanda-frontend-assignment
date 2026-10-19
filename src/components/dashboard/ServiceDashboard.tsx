"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { Button, Dialog, DialogTrigger, Heading, Modal, ModalOverlay } from "react-aria-components";
import { ChartSyncProvider } from "@/components/charts/ChartSync";
import { chartTable } from "@/components/charts/chart-table";
import type { ChartSpec } from "@/components/charts/chart-options";
import { preloadTimeChart, TimeChart } from "@/components/charts/TimeChart";
import { Panel } from "@/components/panel/Panel";
import { useDashboardState } from "@/hooks/useDashboardState";
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
import { MAX_SELECTED_SERIES, resolveRange } from "@/lib/url-state";
import { getService, type ServiceId } from "@/services/registry";
import type { SeriesColumns } from "@/services/types";
import { DASHBOARDS } from "./configs";
import type { PanelContext, PanelDefinition } from "./panels";
import styles from "./ServiceDashboard.module.css";
import { SeriesPicker, type SeriesPickerProps } from "./SeriesPicker";
import { TimeRail } from "./TimeRail";
import { FrequencyControl, RangeControl } from "./ViewControls";

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
  useEffect(preloadTimeChart, []);
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

  const fields = useMemo(() => [...new Set(config.panels.flatMap((p) => p.fields))], [config.panels]);
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

  if (catalog.isError && !catalog.data) {
    const message = catalog.error instanceof ApiError ? catalog.error.message : `${service.label} couldn't be loaded.`;
    return (
      <div className={styles.status} role="alert">
        <h1 className={styles.statusTitle}>{service.label} is unavailable</h1>
        <p>{message}</p>
        <button type="button" className={styles.retry} onClick={() => void catalog.refetch()}>
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

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar} aria-label={`${service.label} series`}>
        {pickerProps ? <SeriesPicker {...pickerProps} /> : <div className={styles.pickerLoading} aria-busy="true" />}
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.heading}>
            <h1 className={styles.title}>{primary?.name ?? service.label}</h1>
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
          {pickerProps && <MobilePicker {...pickerProps} />}
        </header>

        {selection.missing.length > 0 && (
          <p className={styles.notice}>
            {selection.missing.join(", ")} {selection.missing.length === 1 ? "isn't" : "aren't"} in {service.label}, so{" "}
            {selection.missing.length === 1 ? "it isn't" : "they aren't"} shown.
          </p>
        )}

        <div className={styles.controls}>
          <FrequencyControl
            frequencies={commonFrequencies(selection.series)}
            value={frequency}
            onChange={(f) => actions.setFrequency(f === primary?.frequencies[0] ? null : f)}
          />
          <RangeControl preset={state.preset} from={state.from} to={state.to} onPreset={actions.setPreset} />
        </div>

        {overviewSeries && range && (
          <TimeRail
            label={`Time range for ${primary?.name ?? service.label}`}
            t={overviewSeries.t}
            values={overviewSeries.fields[config.overviewField] ?? []}
            range={range}
            onCommit={({ min, max }) => actions.setCustomRange(toIsoDate(min), toIsoDate(max))}
          />
        )}

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

        <ChartSyncProvider>
          <div className={styles.panels}>
            {config.panels.map((panel) => (
              <DashboardPanel
                key={panel.id}
                panel={panel}
                ctx={ctx}
                status={tooLarge ? "success" : mainStatus}
                emptyMessage={tooLarge ? "Choose a shorter range to load this panel." : undefined}
                error={main.error}
                onRetry={() => void main.refetch()}
                isRefreshing={isRefreshing}
              />
            ))}
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
}: {
  panel: PanelDefinition;
  ctx: PanelContext | null;
  status: "pending" | "error" | "success";
  error: unknown;
  onRetry: () => void;
  isRefreshing: boolean;
  emptyMessage?: string;
}) {
  const spec = useMemo(() => (ctx && status === "success" ? panel.build(ctx) : null), [ctx, panel, status]);
  const table = useMemo(() => (spec ? chartTable(spec) : undefined), [spec]);
  return (
    <Panel
      title={panel.title}
      subtitle={ctx ? panel.subtitle?.(ctx) : undefined}
      readout={latestReadout(spec)}
      status={ctx ? status : status === "error" ? "error" : "pending"}
      error={error}
      onRetry={onRetry}
      isEmpty={status === "success" && spec === null}
      emptyMessage={emptyMessage}
      isRefreshing={isRefreshing}
      table={table}
      bodyHeight={panel.bodyHeight}
      variant={panel.layout === "primary" ? "primary" : "secondary"}
      className={styles[panel.layout]}
    >
      {spec && <TimeChart spec={spec} isRefreshing={isRefreshing} />}
    </Panel>
  );
}

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
