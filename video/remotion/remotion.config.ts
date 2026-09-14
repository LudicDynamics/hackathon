import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// 8 tabs × motion-blurred canvas bursts ran the machine out of memory; 3 is stable.
Config.setConcurrency(3);
