// Standalone preview for the 3D dice part (not part of the Launch film).
//   npx remotion still src/dev/dice-entry.tsx DicePreview out/dice-f45.png --frame=45 --gl=angle
import React from "react";
import { AbsoluteFill, Composition, Img, registerRoot, staticFile } from "remotion";
import { Dice3D } from "../scenes/parts/Dice3D";

const Preview: React.FC = () => (
  <AbsoluteFill style={{ background: "#0A0A0A" }}>
    <Img src={staticFile("scenes/wuwu-seventh-berth.webp")} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(.35) blur(6px)" }} />
    <AbsoluteFill style={{ background: "rgba(41,40,32,0.45)" }} />
    <AbsoluteFill style={{ padding: "90px 200px" }}>
      <Dice3D dice="2d10" results={[7, 6]} throwAt={6} showResult expect=">=11" desc="Deciphering the scrapes" />
    </AbsoluteFill>
  </AbsoluteFill>
);

const Root: React.FC = () => <Composition id="DicePreview" component={Preview} durationInFrames={90} fps={30} width={1920} height={1080} />;

registerRoot(Root);
