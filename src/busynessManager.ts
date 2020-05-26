import { State } from "./statisticsManager";
import * as _ from "lodash";
import { QueueEventState } from "./queue";

export class BusynessManager {
    public static convertToBusynessStates(stateIds: Array<{ state: State; id: number }>): BusynessState[] {
        const entityBusynessStates = _(stateIds)
            .uniqBy(s => s.id)
            .map(i => {
                const entityState = new EntityBusynessState();
                entityState.id = i.id;

                entityState.isWorking = i.state.name == QueueEventState.Working.toString();

                return entityState;
            })
            .value();

        const busynessStates: BusynessState[] = [];
        let previousTime = 0;

        _(BusynessManager.groupSameTimeStates(stateIds)).each(sg => {
            const entityStates = entityBusynessStates.filter(es => sg.map(s => s.id).includes(es.id));

            entityStates.forEach(es => {
                es.isWorking = _(sg.filter(s => s.id === es.id && s.state.duration > 0)).first().state.name === QueueEventState.Working.toString();
            });

            const currentTime = sg[0].state.time;

            const busynessState = new BusynessState();
            busynessState.duration = currentTime - previousTime;
            busynessState.startTime = previousTime;
            busynessState.loadPercent = (entityBusynessStates.filter(es => es.isWorking).length / entityBusynessStates.length) * 100;

            busynessStates.push(busynessState);

            previousTime = currentTime;
        });

        return busynessStates;
    }

    public static convertTowToBusynessStates(stateIds: Array<{ state: State; id: number }>): BusynessState[] {
        const entityBusynessStates = _(stateIds)
            .uniqBy(s => s.id)
            .map(i => {
                const entityState = new EntityBusynessState();
                entityState.id = i.id;

                entityState.isWorking = i.state.name == QueueEventState.Working.toString();

                return entityState;
            })
            .value();

        const busynessStates: BusynessState[] = [];
        let previousTime = 0;

        _(BusynessManager.groupSameTimeStates(stateIds)).each(sg => {
            const entityStates = entityBusynessStates.filter(es => sg.map(s => s.id).includes(es.id));

            entityStates.forEach(es => {
                es.isWorking = _(sg.filter(s => s.id === es.id)).first().state.name === QueueEventState.Working.toString();
            });

            const currentTime = sg[0].state.time;

            const busynessState = new BusynessState();
            busynessState.duration = currentTime - previousTime;
            busynessState.startTime = previousTime;
            busynessState.loadPercent = (entityBusynessStates.filter(es => es.isWorking).length / entityBusynessStates.length) * 100;

            busynessStates.push(busynessState);

            previousTime = currentTime;
        });

        return busynessStates;
    }

    private static groupSameTimeStates(stateIds: Array<{ state: State; id: number }>): Array<Array<{ state: State; id: number }>> {
        const result: Array<Array<{ state: State; id: number }>> = [];

        let currentTime = stateIds[0].state.time;
        let batch: Array<{ state: State; id: number }> = [];

        stateIds.forEach(s => {
            if (s.state.time === currentTime) {
                batch.push(s);
            } else {
                result.push(batch);

                currentTime = s.state.time;
                batch = [s];
            }
        });

        return result;
    }
}

export class BusynessState {
    public startTime: number;
    public duration: number;
    public loadPercent: number;
}

export class EntityBusynessState {
    public id: number;
    public isWorking: boolean;
}
