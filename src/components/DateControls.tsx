"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { carryForward } from "@/actions/stock";

export default function DateControls({ date }: { date: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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
      <button
        className="btn light"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await carryForward(date);
            router.refresh();
          })
        }
      >
        Carry Forward
      </button>
    </div>
  );
}
