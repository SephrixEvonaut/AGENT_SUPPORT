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

  // Timing parameters per spec: Window starts from keyDown, not keyUp
  // Window = keyDownTime + 80 (initial) or keyDownTime + 50 (extension)
  // So for double: keyDown1=0, keyUp1=short, keyDown2 must be < 80
  // Need: short + gap < 80 for initial window
  // For subsequent: need each keyDown within 50ms extension of previous keyDown
  const short = 30; // <80ms hold = normal press
  const longHold = 110; // 80-145ms = long press (increased for margin)
  const superHold = 170; // 146-265ms = super long press (increased for margin)
  const gap = 20; // Gap between presses (keyUp to next keyDown, increased for margin)
  // Timeline check: keyDown1=0 → keyUp1=30 → keyDown2=45 (< 80 ✓)
  //                 window2=45+50=95 → keyUp2=75 → keyDown3=90 (< 95 ✓)
  //                 window3=90+50=140 → keyUp3=120 → keyDown4=135 (< 140 ✓)

  // Run tests sequentially
  await expectGesture(
    "1",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
    ],
    "single"
  );
  await wait(200);
  await expectGesture(
    "2",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: longHold },
    ],
    "single_long"
  );
  await wait(200);
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
      { type: "down", delay: gap },
      { type: "up", delay: short },
    ],
    "double"
  );
  await wait(200);
  await expectGesture(
    "5",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
      { type: "down", delay: gap },
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
      { type: "down", delay: gap },
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
      { type: "down", delay: gap },
      { type: "up", delay: short },
      { type: "down", delay: gap },
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
      { type: "down", delay: gap },
      { type: "up", delay: short },
      { type: "down", delay: gap },
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
      { type: "down", delay: gap },
      { type: "up", delay: short },
      { type: "down", delay: gap },
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
      { type: "down", delay: gap },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: short },
      { type: "down", delay: gap },
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
      { type: "down", delay: gap },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: short },
      { type: "down", delay: gap },
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
      { type: "down", delay: gap },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: superHold },
    ],
    "quadruple_super_long"
  );

  console.log("All gesture mapping tests passed.");
}

test("gesture mapping matches expected gestures", async () => {
  await runTest();
}, 20000);
