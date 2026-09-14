import React from "react";
import { Composition } from "remotion";
import { Launch, SCENES } from "./Launch";
import { FPS, H, sectionLength, TOTAL, W, type SectionId } from "./lib/timing";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Launch" component={Launch} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
    {(Object.keys(SCENES) as SectionId[]).map((id) => (
      <Composition key={id} id={id} component={SCENES[id]} durationInFrames={sectionLength(id)} fps={FPS} width={W} height={H} />
    ))}
  </>
);
