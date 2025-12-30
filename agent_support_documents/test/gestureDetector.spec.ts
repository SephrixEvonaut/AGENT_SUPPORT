import { test } from "vitest";
import { GestureDetector } from "../src/gestureDetector.js";
import { DEFAULT_GESTURE_SETTINGS } from "../src/profileLoader.js";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
  const settings = { ...DEFAULT_GESTURE_SETTINGS };
  const detector = new GestureDetector(settings, (event) => {
    // noop - replaced per-test
  });

  // Helper to run a single check
  const expectGesture = (
    key: string,
    actions: Array<{ type: "down" | "up"; delay: number }>,
    expected: string,
    timeout = 1000
  ) => {
    return new Promise<void>((resolve, reject) => {
      const events: any[] = [];

      const collector = (ev: any) => {
        events.push(ev);
        if (ev.gesture === expected) {
          (detector as any).offGesture?.(collector);
          resolve();
        }
      };

      // temporarily subscribe to emissions
      (detector as any).onGesture?.(collector);

      // schedule actions relative to now
      let t = 0;
      for (const a of actions) {
        t += a.delay;
        if (a.type === "down") {
          setTimeout(() => detector.handleKeyDown(key), t);
        } else {
          setTimeout(() => detector.handleKeyUp(key), t);
        }
      }

      // timeout
      setTimeout(() => {
        (detector as any).offGesture?.(collector);
        reject(
          new Error(
            `Timeout waiting for gesture ${expected}. Got: ${events
              .map((e) => e.gesture)
              .join(",")}`
          )
        );
      }, timeout);
    });
  };

  // Sequence definitions: delays chosen so multiPressWindow (350ms) groups presses
  const short = 50; // <80ms final release
  const longHold = 100; // 80-145ms
  const superHold = 160; // 146-265ms

  // Run tests sequentially
  await expectGesture(
    "1",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
    ],
    "single"
  );
  await wait(150);
  await expectGesture(
    "2",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: longHold },
    ],
    "single_long"
  );
  await wait(150);
  await expectGesture(
    "3",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: superHold },
    ],
    "single_super_long"
  );
  await wait(200);

  await expectGesture(
    "4",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
      { type: "down", delay: 100 },
      { type: "up", delay: short },
    ],
    "double"
  );
  await wait(150);
  await expectGesture(
    "5",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
      { type: "down", delay: 100 },
      { type: "up", delay: longHold },
    ],
    "double_long"
  );
  await wait(150);
  await expectGesture(
    "6",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
      { type: "down", delay: 100 },
      { type: "up", delay: superHold },
    ],
    "double_super_long"
  );
  await wait(200);

  await expectGesture(
    "W",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
      { type: "down", delay: 100 },
      { type: "up", delay: short },
      { type: "down", delay: 100 },
      { type: "up", delay: short },
    ],
    "triple"
  );
  await wait(150);
  await expectGesture(
    "A",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
      { type: "down", delay: 100 },
      { type: "up", delay: short },
      { type: "down", delay: 100 },
      { type: "up", delay: longHold },
    ],
    "triple_long"
  );
  await wait(150);
  await expectGesture(
    "S",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
      { type: "down", delay: 100 },
      { type: "up", delay: short },
      { type: "down", delay: 100 },
      { type: "up", delay: superHold },
    ],
    "triple_super_long"
  );
  await wait(200);

  await expectGesture(
    "D",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
      { type: "down", delay: 80 },
      { type: "up", delay: short },
      { type: "down", delay: 80 },
      { type: "up", delay: short },
      { type: "down", delay: 80 },
      { type: "up", delay: short },
    ],
    "quadruple"
  );
  await wait(150);
  await expectGesture(
    "B",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
      { type: "down", delay: 80 },
      { type: "up", delay: short },
      { type: "down", delay: 80 },
      { type: "up", delay: short },
      { type: "down", delay: 80 },
      { type: "up", delay: longHold },
    ],
    "quadruple_long"
  );
  await wait(150);
  await expectGesture(
    "C",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
      { type: "down", delay: 80 },
      { type: "up", delay: short },
      { type: "down", delay: 80 },
      { type: "up", delay: short },
      { type: "down", delay: 80 },
      { type: "up", delay: superHold },
    ],
    "quadruple_super_long"
  );

  console.log("All gesture mapping tests passed.");
}

test("gesture mapping matches expected gestures", async () => {
  await runTest();
}, 20000);
