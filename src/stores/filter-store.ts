import { StoreApi, UseBoundStore, create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type ISize = "small" | "medium" | "large" | "";
export type IType =
  | "JPG"
  | "GIF"
  | "PNG"
  | "BMP"
  | "SVG"
  | "WEBP"
  | "ICO"
  | "TIFF"
  | "AVIF"
  | "";
export type IShape = "square" | "wide" | "rectangle" | "";
export type FilterStates = {
  size: ISize;
  type: IType;
  shape: IShape;
};

export type FilterActionStates = {
  setSize: (size: ISize) => void;
  setType: (type: IType) => void;
  setShape: (shape: IShape) => void;
};

export type FilterStore = FilterStates & Partial<FilterActionStates>;

export const initFilterStore = (): FilterStore => {
  return {
    size: "",
    type: "",
    shape: "",
  };
};

const useFilterStoreBase = create<FilterStore>()(
  immer((set, get) => ({
    ...initFilterStore(),
    setSize: (size) => {
      set((draft) => {
        draft.size = size;
      });
    },
    setType: (type) => {
      set((draft) => {
        draft.type = type;
      });
    },
    setShape: (shape) => {
      set((draft) => {
        draft.shape = shape;
      });
    },
  }))
);

type WithSelectors<S> = S extends { getState: () => infer T }
  ? S & { use: { [K in keyof T]: () => T[K] } }
  : never;

const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(
  _store: S
) => {
  let store = _store as WithSelectors<typeof _store>;
  store.use = {};
  for (let k of Object.keys(store.getState())) {
    (store.use as any)[k] = () => store((s) => s[k as keyof typeof s]);
  }

  return store;
};

export const useFilterStore = createSelectors(useFilterStoreBase);
