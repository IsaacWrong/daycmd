import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setEntryPoint("./remotion/index.ts");
Config.setPublicDir("./remotion/shots");
Config.setConcurrency(null);
