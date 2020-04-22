import { ServingEntityStatistics, TankerStatistics } from "./statisticsManager";
import { globalTimeProvider } from "./gloabalTime";
import * as $ from "jquery";

export function renderTextForEntityStats(stats: ServingEntityStatistics, entityName: string, entityAlias: string) {
    const globalTime = globalTimeProvider.globalTime;
    const text = `${entityName} #${stats.id}. Время работы: ${convertSecondsToHours(stats.workingTime)} ч (${convertToPercent(
        stats.workingTime,
        globalTime
    )}%). Время простоя: ${convertSecondsToHours(stats.idleTime)} ч (${convertToPercent(
        stats.idleTime,
        globalTime
    )}%). Общее время ${convertSecondsToHours(globalTime)} ч.`;

    const component = $(`<p id="${entityAlias}${stats.id}Stats"></p>`);
    $(`#${entityAlias}Stats`).append(component);
    $(`#${entityAlias}${stats.id}Stats`).text(text);
}

export function renderTextForTankerStats(stats: TankerStatistics) {
    const text = `Танкер #${stats.id}. Время в очереди: ${
        stats.idleTime != undefined ? convertSecondsToHours(stats.idleTime) + " ч" : "не был обслужен"
    }.`;
    const component = $(`<p id="tanker${stats.id}Stats"></p>`);

    $(`#tankerStats`).append(component);
    $(`#tanker${stats.id}Stats`).text(text);
}

export function convertSecondsToHours(seconds: number): string {
    return (seconds / 60 / 60).toFixed(2);
}

export function convertToPercent(part: number, total: number): string {
    return ((part / total) * 100).toFixed(2);
}
