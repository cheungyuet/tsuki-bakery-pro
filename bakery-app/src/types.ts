export interface BakeryItem {
  id: number;
  oven: string;
  product: string;
  quantity: number;
  temp: string;
  totalTime: number;
  steam: boolean;
  special?: string;
  note?: string;
  elapsedTime?: number;
  isOvertime?: boolean;
  startTime?: string;
  completedTime?:string;
  isCustom?: boolean;
  addedTime?: string;
  severeWarningAck?: boolean;
}

export interface ItemsState {
  queue: BakeryItem[];
  baking: BakeryItem[];
  completed: BakeryItem[];
}