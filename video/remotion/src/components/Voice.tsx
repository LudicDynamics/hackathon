import React from "react";
import { Audio, getStaticFiles, staticFile } from "remotion";

export const hasStatic = (p: string) => getStaticFiles().some((f) => f.name === p);

/** A generated voice line from public/voice (setsuna for characters). Silent if it has not been generated yet. */
export const VoiceClip: React.FC<{ id: string; volume?: number }> = ({ id, volume = 1 }) => {
  const src = `voice/${id}.wav`;
  return hasStatic(src) ? <Audio src={staticFile(src)} volume={volume} /> : null;
};
