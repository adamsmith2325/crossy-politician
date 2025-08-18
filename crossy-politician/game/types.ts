export type LaneType = 'grass' | 'road';
export interface Lane { idx: number; type: LaneType; dir: 1 | -1; speed: number; cars: number[]; }
