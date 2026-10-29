/**
 * Excel-like scene tabs. Each tab scopes one scene (elements + appState)
 * to its own localStorage keys. The tab list and the active tab persist
 * across reloads.
 */
import { isInitializedImageElement } from "@excalidraw/element";

import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";

import { appJotaiStore, atom } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";

export type SceneTab = { id: string; name: string };

export const sceneElementsKey = (tabId: string) =>
  `${STORAGE_KEYS.LOCAL_STORAGE_SCENE_PREFIX}${tabId}`;

export const sceneAppStateKey = (tabId: string) =>
  `${sceneElementsKey(tabId)}-state`;

const generateTabId = () =>
  `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const readTabs = (): SceneTab[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_TABS);
    if (data) {
      const tabs = JSON.parse(data) as SceneTab[];
      if (Array.isArray(tabs) && tabs.length) {
        return tabs;
      }
    }
  } catch (error: any) {
    console.error(error);
  }
  return [];
};

const persistTabs = (tabs: SceneTab[]) => {
  try {
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_TABS, JSON.stringify(tabs));
  } catch (error: any) {
    console.error(error);
  }
};

const persistActiveTabId = (tabId: string) => {
  try {
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_ACTIVE_TAB, tabId);
  } catch (error: any) {
    console.error(error);
  }
};

/**
 * Restore persisted tabs or create the first one. On the very first run,
 * migrate the pre-tabs single-scene data (if any) into the new tab so
 * existing work isn't lost.
 */
const initializeTabs = (): { tabs: SceneTab[]; activeTabId: string } => {
  let tabs = readTabs();

  if (!tabs.length) {
    const firstTab = { id: generateTabId(), name: "Scene 1" };
    tabs = [firstTab];

    try {
      const legacyElements = localStorage.getItem(
        STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      );
      const legacyAppState = localStorage.getItem(
        STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      );
      if (legacyElements) {
        localStorage.setItem(sceneElementsKey(firstTab.id), legacyElements);
      }
      if (legacyAppState) {
        localStorage.setItem(sceneAppStateKey(firstTab.id), legacyAppState);
      }
    } catch (error: any) {
      console.error(error);
    }

    persistTabs(tabs);
    persistActiveTabId(firstTab.id);
  }

  let activeTabId = "";
  try {
    activeTabId =
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ACTIVE_TAB) || "";
  } catch (error: any) {
    console.error(error);
  }
  if (!tabs.some((tab) => tab.id === activeTabId)) {
    activeTabId = tabs[0].id;
    persistActiveTabId(activeTabId);
  }

  return { tabs, activeTabId };
};

const initialState = initializeTabs();

export const sceneTabsAtom = atom<SceneTab[]>(initialState.tabs);
export const activeSceneTabIdAtom = atom<string>(initialState.activeTabId);

export const getSceneTabs = () => appJotaiStore.get(sceneTabsAtom);

export const getActiveSceneTabId = () =>
  appJotaiStore.get(activeSceneTabIdAtom);

export const setActiveSceneTabId = (tabId: string) => {
  persistActiveTabId(tabId);
  appJotaiStore.set(activeSceneTabIdAtom, tabId);
};

const updateTabs = (tabs: SceneTab[]) => {
  appJotaiStore.set(sceneTabsAtom, tabs);
  persistTabs(tabs);
};

export const createSceneTab = (name: string): SceneTab => {
  const tab = { id: generateTabId(), name };
  updateTabs([...getSceneTabs(), tab]);
  return tab;
};

export const renameSceneTab = (tabId: string, name: string) => {
  updateTabs(
    getSceneTabs().map((tab) => (tab.id === tabId ? { ...tab, name } : tab)),
  );
};

/**
 * Removes the tab and its persisted scene. Files (images) are intentionally
 * left in IDB since they may be shared across tabs; obsolete ones are
 * cleaned up on load via `clearObsoleteFiles` + `getAllSceneFileIds`.
 */
export const deleteSceneTab = (tabId: string) => {
  updateTabs(getSceneTabs().filter((tab) => tab.id !== tabId));

  try {
    localStorage.removeItem(sceneElementsKey(tabId));
    localStorage.removeItem(sceneAppStateKey(tabId));
  } catch (error: any) {
    console.error(error);
  }
};

/** file ids referenced by ALL tabs' persisted scenes, so that image
 *  garbage-collection doesn't wipe files belonging to inactive tabs */
export const getAllSceneFileIds = (): FileId[] => {
  const fileIds: FileId[] = [];

  for (const tab of getSceneTabs()) {
    try {
      const data = localStorage.getItem(sceneElementsKey(tab.id));
      if (data) {
        const elements = JSON.parse(data) as readonly ExcalidrawElement[];
        for (const element of elements) {
          if (isInitializedImageElement(element)) {
            fileIds.push(element.fileId);
          }
        }
      }
    } catch (error: any) {
      console.error(error);
    }
  }

  return fileIds;
};
