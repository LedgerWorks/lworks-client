// Ideally these would all be `node:` prefixed to ensure there isn't an npm collision
// but doing so was causing downstream consumption issues.
import crypto from "crypto";
import fs from "fs";
import path from "path";

import retry from "async-retry";
import Mixpanel from "mixpanel";

import { getDisabledTracking } from "./config";

const superProps: Record<string, string | number | Date | boolean | undefined> = {
  environment: process.env.ENVIRONMENT,
  libraryVersion: JSON.parse(
    fs.readFileSync(path.join(path.resolve(__dirname, ".."), "package.json"), "utf8")
  ).version,
};

let mixpanel: Mixpanel.Mixpanel | null = null;

async function initializeMixpanel() {
  if (getDisabledTracking()) {
    return;
  }
  if (!mixpanel) {
    mixpanel = Mixpanel.init("6645fc222e5d5f9ad0cff48457979ac8");
  }
}

async function asyncTrack(eventName: string, properties: Mixpanel.PropertyDict = {}) {
  await new Promise<void>((resolve, reject) => {
    if (!mixpanel) {
      if (!getDisabledTracking()) {
        console.warn({ eventName, properties }, "Track called with uninitialized metrics object");
      }
      resolve();
      return;
    }
    mixpanel.track(
      eventName,
      {
        ...superProps,
        ...properties,
      },
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

export async function track(
  eventName: string,
  distinctId: string,
  properties: Mixpanel.PropertyDict = {}
) {
  await initializeMixpanel();
  try {
    await retry(
      async () => {
        await asyncTrack(eventName, {
          ...properties,
          distinct_id: crypto.createHash("md5").update(distinctId).digest("hex"),
        });
      },
      { retries: 2 }
    );
  } catch (err) {
    console.warn(err, "Failed to send usage metrics");
  }
}
