import React from "react";
import { Dice3D } from "./Dice3D";

/** Where the dice appear in the film: the app's own 3D D10s (parts/Dice3D.tsx). Renders need `--gl=angle`. */
export const DiceSlot: React.FC<{ dice: string; results: number[]; throwAt?: number; showResult?: boolean; expect?: string; desc?: string }> = (p) => <Dice3D {...p} />;
