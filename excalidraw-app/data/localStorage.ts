import {
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "@excalidraw/excalidraw/appState";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import {
  getActiveSceneTabId,
  sceneAppStateKey,
  sceneElementsKey,
} from "./sceneTabs";

export const importFromLocalStorage = (
  tabId: string = getActiveSceneTabId(),
) => {
  let savedElements = null;
  let savedState = null;

  try {
    savedElements = localStorage.getItem(sceneElementsKey(tabId));
    savedState = localStorage.getItem(sceneAppStateKey(tabId));
  } catch (error: any) {
    // Unable to access localStorage
    console.error(error);
  }

  let elements: ExcalidrawElement[] = [];
  if (savedElements) {
    try {
      elements = JSON.parse(savedElements);
    } catch (error: any) {
      console.error(error);
      // Do nothing because elements array is already empty
    }
  }

  let appState = null;
  if (savedState) {
    try {
      appState = {
        ...getDefaultAppState(),
        ...clearAppStateForLocalStorage(
          JSON.parse(savedState) as Partial<AppState>,
        ),
      };
    } catch (error: any) {
      console.error(error);
      // Do nothing because appState is already null
    }
  }
  return { elements, appState };
};

export const getElementsStorageSize = () => {
  try {
    const elements = localStorage.getItem(
      sceneElementsKey(getActiveSceneTabId()),
    );
    const elementsSize = elements?.length || 0;
    return elementsSize;
  } catch (error: any) {
    console.error(error);
    return 0;
  }
};

export const getTotalStorageSize = () => {
  try {
    const appState = localStorage.getItem(
      sceneAppStateKey(getActiveSceneTabId()),
    );

    const appStateSize = appState?.length || 0;

    return appStateSize + getElementsStorageSize();
  } catch (error: any) {
    console.error(error);
    return 0;
  }
};
