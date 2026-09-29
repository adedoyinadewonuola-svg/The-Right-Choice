"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { carryForward } from "@/actions/stock";

export default function DateControls({
  date,
  hasCountedData,
}: {
  date: string;
  /** True once the day holds entries, so the destructive variant has to be asked for. */
  hasCountedData: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  function run(overwriteClosing: boolean) {
    startTransition(async () => {
      const carried = await carryForward(date, overwriteClosing);
      setNotice(carried ? null : "There is no earlier recorded day to carry from yet.");
      router.refresh();
    });
  }

  function handleResetClosing() {
    if (
      !window.confirm(
        `Reset Closing Stock for ${date} to the previous day's closing?\n\nThis discards the closing figures counted for this day. Opening Stock is carried forward either way.`
      )
    ) {
      return;
    }
    run(true);
  }

  return (
    <div className="controls">
      <input
        className="input"
        type="date"
        defaultValue={date}
        title="Enter or select the date manually"
        onChange={(e) => {
          if (e.target.value) router.push(`/today?date=${e.target.value}`);
        }}
      />
      {notice && <span className="notice">{notice}</span>}
      <button
        className="btn light"
        disabled={pending}
        title={
          hasCountedData
            ? "Brings Opening Stock in from the previous day's closing and leaves this day's closing count alone."
            : "Brings Opening Stock in from the previous day's closing."
        }
        onClick={() => run(!hasCountedData)}
      >
        {hasCountedData ? "Carry Forward Opening" : "Carry Forward"}
      </button>
      {hasCountedData && (
        <button
          className="btn light"
          disabled={pending}
          onClick={handleResetClosing}
        >
          Carry Forward &amp; Reset Closing
        </button>
      )}
    </div>
  );
}
