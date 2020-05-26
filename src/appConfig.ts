import * as $ from "jquery";
import { convertSecondsToHours } from "./helpers";

class AppConfig {
    public simulationTime: number;

    public processingLineCount: number;
    public towCount: number;

    public tankerIntensity: Intensity;
    public towIntensity: Intensity;
    public processingLineIntensity: Intensity;
}

export class Intensity {
    public start: number;
    public end: number;
}

export function getConfig(): AppConfig {
    const appConfig = new AppConfig();

    appConfig.simulationTime = convertHoursToSeconds(Number($("input.simulationTime").val()));
    appConfig.processingLineCount = Number($("input.processingLineCount").val());
    appConfig.towCount = Number($("input.towCount").val());

    appConfig.tankerIntensity = new Intensity();
    appConfig.tankerIntensity.start = convertHoursToSeconds(Number($("div.tankerSettings input.from").val()));
    appConfig.tankerIntensity.end = convertHoursToSeconds(Number($("div.tankerSettings input.to").val()));

    appConfig.processingLineIntensity = new Intensity();
    appConfig.processingLineIntensity.start = convertHoursToSeconds(Number($("div.processingLineSettings input.from").val()));
    appConfig.processingLineIntensity.end = convertHoursToSeconds(Number($("div.processingLineSettings input.to").val()));

    appConfig.towIntensity = new Intensity();
    appConfig.towIntensity.start = convertHoursToSeconds(Number($("div.towSettings input.from").val()));
    appConfig.towIntensity.end = convertHoursToSeconds(Number($("div.towSettings input.to").val()));

    return appConfig;
}

function convertHoursToSeconds(hours: number): number {
    return hours * 60 * 60;
}
