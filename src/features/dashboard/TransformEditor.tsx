"use client";

import { Fragment, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogTrigger,
  Group,
  Heading,
  Input,
  Label,
  NumberField,
  Popover,
  Radio,
  RadioGroup,
  Text,
} from "react-aria-components";
import { Icon } from "@/ui/Icon";
import { transformLabel, type TransformKind, type TransformSpec } from "@/lib/transforms/pipeline";
import { MAX_TRANSFORM_STEPS, MAX_TRANSFORM_WINDOW } from "./url-state";
import type { Frequency } from "@/services/types";
import styles from "./TransformEditor.module.css";

/** What one window step is called at each frequency. */
const STEP_NOUN: Record<Frequency, string> = {
  "5min": "5-minute bars",
  daily: "days",
  weekly: "weeks",
  monthly: "months",
};

/** Starting windows that make sense at each frequency (about a month, or a quarter for z-scores). */
const DEFAULTS: Record<Frequency, { window: number; zWindow: number }> = {
  "5min": { window: 12, zWindow: 78 },
  daily: { window: 20, zWindow: 60 },
  weekly: { window: 4, zWindow: 13 },
  monthly: { window: 3, zWindow: 12 },
};

const KINDS: { id: TransformKind; label: string; describe: (noun: string) => string }[] = [
  { id: "movingAverage", label: "Moving average", describe: (n) => `Average of the last N ${n}` },
  { id: "rollingSum", label: "Rolling sum", describe: (n) => `Sum of the last N ${n}` },
  { id: "pctChange", label: "Percent change", describe: (n) => `Change versus N ${n} earlier, in %` },
  { id: "cumulative", label: "Cumulative", describe: () => "Running total over the data" },
  { id: "zScore", label: "Z-score", describe: () => "Distance from the average, in standard deviations" },
];

function buildSpec(kind: TransformKind, window: number, rolling: boolean): TransformSpec {
  switch (kind) {
    case "movingAverage":
      return { kind, window };
    case "rollingSum":
      return { kind, window };
    case "pctChange":
      return { kind, periods: window };
    case "cumulative":
      return { kind };
    case "zScore":
      return rolling ? { kind, window } : { kind };
  }
}

export interface TransformEditorProps {
  readonly transforms: readonly TransformSpec[];
  readonly onChange: (transforms: TransformSpec[]) => void;
  readonly frequency: Frequency;
}

/**
 * Edits the primary panel's transform chain. Steps apply left to right (the
 * "then" between chips is real information). Add opens a small form; each chip
 * can be removed; Clear removes all.
 */
export function TransformEditor({ transforms, onChange, frequency }: TransformEditorProps) {
  const full = transforms.length >= MAX_TRANSFORM_STEPS;
  const noun = STEP_NOUN[frequency];

  return (
    <Group aria-label="Transforms" className={styles.editor} data-tour="transforms">
      {transforms.length > 0 && (
        <ol className={styles.chain} aria-label="Applied transforms, in order">
          {transforms.map((spec, i) => (
            <Fragment key={`${i}-${transformLabel(spec)}`}>
              {i > 0 && (
                <li className={styles.then} aria-hidden="true">
                  then
                </li>
              )}
              <li className={styles.chip}>
                <span>{transformLabel(spec)}</span>
                <Button
                  className={styles.remove}
                  aria-label={`Remove ${transformLabel(spec)}`}
                  onPress={() => onChange(transforms.filter((_, j) => j !== i))}
                >
                  <Icon name="x" size={12} />
                </Button>
              </li>
            </Fragment>
          ))}
        </ol>
      )}

      <DialogTrigger>
        <Button className={styles.add} isDisabled={full}>
          <Icon name="plus" size={14} />
          {transforms.length ? "Add another" : "Add transform"}
        </Button>
        <Popover placement="bottom start" className={styles.popover}>
          <Dialog className={styles.dialog} aria-labelledby="add-transform-title">
            {({ close }) => (
              <AddTransformForm
                noun={noun}
                defaults={DEFAULTS[frequency]}
                onAdd={(spec) => {
                  onChange([...transforms, spec]);
                  close();
                }}
              />
            )}
          </Dialog>
        </Popover>
      </DialogTrigger>

      {transforms.length > 0 && (
        <Button className={styles.clear} onPress={() => onChange([])}>
          Clear
        </Button>
      )}
      {full && <span className={styles.note}>Up to {MAX_TRANSFORM_STEPS} steps</span>}
    </Group>
  );
}

function AddTransformForm({
  noun,
  defaults,
  onAdd,
}: {
  noun: string;
  defaults: { window: number; zWindow: number };
  onAdd: (spec: TransformSpec) => void;
}) {
  const [kind, setKind] = useState<TransformKind>("movingAverage");
  const [rolling, setRolling] = useState(false);
  const [window, setWindow] = useState(defaults.window);
  const [periods, setPeriods] = useState(1);
  const [zWindow, setZWindow] = useState(defaults.zWindow);

  const needsWindow = kind === "movingAverage" || kind === "rollingSum";
  const value = needsWindow ? window : kind === "pctChange" ? periods : zWindow;
  const valid = Number.isInteger(value) && value >= (kind === "zScore" ? 2 : 1) && value <= MAX_TRANSFORM_WINDOW;

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onAdd(buildSpec(kind, value, rolling));
      }}
    >
      <Heading slot="title" id="add-transform-title" className={styles.title}>
        Add a transform
      </Heading>

      <RadioGroup
        value={kind}
        onChange={(v) => setKind(v as TransformKind)}
        aria-label="Transform"
        className={styles.kinds}
      >
        {KINDS.map((k) => (
          // Focus lands on the current choice when the form opens, not on the dialog container.
          <Radio key={k.id} value={k.id} className={styles.kind} autoFocus={k.id === kind}>
            <span className={styles.kindLabel}>{k.label}</span>
            <span className={styles.kindHelp}>{k.describe(noun)}</span>
          </Radio>
        ))}
      </RadioGroup>

      {needsWindow && <WindowField label={`Window (${noun})`} value={window} onChange={setWindow} min={1} />}
      {kind === "pctChange" && (
        <WindowField label={`Compare with (${noun} earlier)`} value={periods} onChange={setPeriods} min={1} />
      )}
      {kind === "zScore" && (
        <>
          <Checkbox isSelected={rolling} onChange={setRolling} className={styles.checkbox}>
            <span className={styles.box} aria-hidden="true" />
            Use a rolling window instead of the whole history
          </Checkbox>
          {rolling && <WindowField label={`Window (${noun})`} value={zWindow} onChange={setZWindow} min={2} />}
        </>
      )}

      <Button type="submit" className={styles.submit} isDisabled={!valid}>
        Add
      </Button>
    </form>
  );
}

function WindowField({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
}) {
  return (
    <NumberField
      value={value}
      onChange={onChange}
      minValue={min}
      maxValue={MAX_TRANSFORM_WINDOW}
      step={1}
      formatOptions={{ maximumFractionDigits: 0 }}
      className={styles.field}
    >
      <Label className={styles.fieldLabel}>{label}</Label>
      <Input className={styles.input} />
      <Text slot="description" className={styles.fieldHelp}>
        Whole number from {min} to {MAX_TRANSFORM_WINDOW.toLocaleString("en-US")}
      </Text>
    </NumberField>
  );
}
