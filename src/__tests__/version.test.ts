import path from "node:path";
import fs from "node:fs";

import { libraryVersion } from "../config";

test("version in sync with package.json", () => {
  const fileContents = fs.readFileSync(
    path.join(path.resolve(__dirname, "..", ".."), "package.json"),
    "utf8"
  );

  const { version } = JSON.parse(fileContents);

  expect(version).toEqual(libraryVersion);
});
