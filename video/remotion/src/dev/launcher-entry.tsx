// Standalone preview of the launcher shot (the main entry is src/index.ts).
//   npx remotion still src/dev/launcher-entry.tsx LauncherPreview out/launcher.png --frame=60
import React from "react";
import { Composition, registerRoot } from "remotion";
import { LauncherShot } from "../scenes/parts/Launcher";

const Root: React.FC = () => (
  <Composition id="LauncherPreview" component={LauncherShot} durationInFrames={150} fps={30} width={1920} height={1080} defaultProps={{ target: "wuwu" }} />
);

registerRoot(Root);
