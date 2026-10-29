/**
 * Excel-like tab bar rendered in the app footer. Each tab holds a separate
 * scene (see `../data/sceneTabs`). Switching tabs persists the outgoing scene
 * (via a save flush) and loads the target scene from its own storage keys.
 */
import { CaptureUpdateAction, useExcalidrawAPI } from "@excalidraw/excalidraw";
import { isInitializedImageElement } from "@excalidraw/element";
import ConfirmDialog from "@excalidraw/excalidraw/components/ConfirmDialog";
import {
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";
import { useState } from "react";

import React from "react";

import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";

import { useAtomValue } from "../app-jotai";
import { updateStaleImageStatuses } from "../data/FileManager";
import { LocalData } from "../data/LocalData";
import { importFromLocalStorage } from "../data/localStorage";
import {
  activeSceneTabIdAtom,
  createSceneTab,
  deleteSceneTab,
  renameSceneTab,
  sceneTabsAtom,
  setActiveSceneTabId,
} from "../data/sceneTabs";

const TAB_NAME_MAX_LENGTH = 30;

// unified horizontal spacing: container inset, inter-tab gap and tab inner
// padding all match so the gap between sheets equals the left/right padding
const TAB_H_SPACING = "0.4rem";

// Excalidraw's hand-drawn UI font, matching the canvas text so the tab bar
// and the confirm popup read consistently with the rest of the app
const HAND_FONT_FAMILY = '"Excalifont", "Xiaolai", var(--ui-font)';

export const SceneTabs = () => {
  const excalidrawAPI = useExcalidrawAPI();
  const tabs = useAtomValue(sceneTabsAtom);
  const activeTabId = useAtomValue(activeSceneTabIdAtom);

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [tabToDelete, setTabToDelete] = useState<string | null>(null);

  const loadMissingFiles = (elements: readonly ExcalidrawElement[]) => {
    if (!excalidrawAPI) {
      return;
    }

    const currentFiles = excalidrawAPI.getFiles();
    const missingFileIds = elements.reduce((acc, element) => {
      if (isInitializedImageElement(element) && !currentFiles[element.fileId]) {
        return acc.concat(element.fileId);
      }
      return acc;
    }, [] as FileId[]);

    if (!missingFileIds.length) {
      return;
    }

    LocalData.fileStorage
      .getFiles(missingFileIds)
      .then(({ loadedFiles, erroredFiles }) => {
        if (loadedFiles.length) {
          excalidrawAPI.addFiles(loadedFiles);
        }
        updateStaleImageStatuses({
          excalidrawAPI,
          erroredFiles,
          elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
        });
      });
  };

  const switchTab = (tabId: string) => {
    if (tabId === activeTabId || !excalidrawAPI) {
      return;
    }

    // theme is a global preference — keep the current one instead of
    // restoring a possibly-stale per-scene value (which would flash light)
    const { theme } = excalidrawAPI.getAppState();

    // flush the debounced save so the outgoing scene is persisted under
    // its own tab before the storage scope moves to the new one
    LocalData.flushSave();
    setActiveSceneTabId(tabId);

    const localDataState = importFromLocalStorage(tabId);
    const elements = restoreElements(localDataState?.elements ?? null, null, {
      repairBindings: true,
    });

    excalidrawAPI.updateScene({
      elements,
      appState: {
        ...restoreAppState(localDataState?.appState ?? null, null),
        theme,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    loadMissingFiles(elements);
  };

  const addTab = () => {
    if (!excalidrawAPI) {
      return;
    }

    LocalData.flushSave();

    const tab = createSceneTab(`Scene ${tabs.length + 1}`);
    setActiveSceneTabId(tab.id);

    // clear the canvas but keep the current view state & theme — passing
    // restoreAppState(null, null) would reset the theme back to light
    excalidrawAPI.updateScene({
      elements: [],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  };

  const performDelete = (tabId: string) => {
    // persist whatever is on screen into its own tab first
    LocalData.flushSave();

    const index = tabs.findIndex((tab) => tab.id === tabId);
    const wasActive = tabId === activeTabId;
    const remaining = tabs.filter((tab) => tab.id !== tabId);

    deleteSceneTab(tabId);

    if (wasActive && remaining.length) {
      switchTab(remaining[Math.max(0, index - 1)].id);
    }
  };

  const commitRename = (tabId: string) => {
    const name = editingValue.trim().slice(0, TAB_NAME_MAX_LENGTH);
    if (name) {
      renameSceneTab(tabId, name);
    }
    setEditingTabId(null);
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: TAB_H_SPACING,
          fontFamily: HAND_FONT_FAMILY,
          fontSize: "0.75rem",
          height: "var(--lg-button-size)",
          background: "var(--color-surface-low)",
          boxShadow: "0 0 0 1px var(--color-surface-lowest)",
          borderRadius: "var(--border-radius-lg)",
          padding: `0 ${TAB_H_SPACING}`,
          maxWidth: "100%",
          overflow: "auto hidden",
        }}
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            title={`${tab.name} (double-click to rename)`}
            onPointerDown={() => switchTab(tab.id)}
            onDoubleClick={() => {
              setEditingTabId(tab.id);
              setEditingValue(tab.name);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              flexShrink: 0,
              padding: `0.25rem ${TAB_H_SPACING}`,
              borderRadius: "var(--border-radius-md)",
              background:
                tab.id === activeTabId
                  ? "var(--color-surface-primary-container)"
                  : "transparent",
              color:
                tab.id === activeTabId
                  ? "var(--color-on-primary-container)"
                  : "var(--color-on-surface)",
              cursor: "pointer",
              userSelect: "none",
              maxWidth: "10rem",
            }}
          >
            {editingTabId === tab.id ? (
              <input
                autoFocus
                defaultValue={editingValue}
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) => setEditingValue(event.target.value)}
                onBlur={() => commitRename(tab.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    commitRename(tab.id);
                  } else if (event.key === "Escape") {
                    setEditingTabId(null);
                  }
                }}
                style={{
                  width: "6rem",
                  fontSize: "inherit",
                  fontFamily: "inherit",
                  background: "var(--color-surface-lowest)",
                  color: "var(--color-on-surface)",
                  border: "1px solid var(--color-border-outline)",
                  borderRadius: "var(--border-radius-md)",
                  padding: "0.1rem 0.2rem",
                }}
              />
            ) : (
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.name}
              </span>
            )}
            {tabs.length > 1 && editingTabId !== tab.id && (
              <span
                role="button"
                aria-label={`Close ${tab.name}`}
                title="Close tab"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setTabToDelete(tab.id);
                }}
                style={{ opacity: 0.6, fontWeight: "bold" }}
              >
                ×
              </span>
            )}
          </div>
        ))}
        <div
          role="button"
          aria-label="New tab"
          title="New tab"
          onPointerDown={addTab}
          style={{
            padding: `0.25rem ${TAB_H_SPACING}`,
            borderRadius: "var(--border-radius-md)",
            color: "var(--color-on-surface)",
            cursor: "pointer",
            userSelect: "none",
            flexShrink: 0,
            fontWeight: "bold",
          }}
        >
          +
        </div>
      </div>
      {tabToDelete && (
        <ConfirmDialog
          className="scene-tabs-confirm-dialog"
          onCancel={() => setTabToDelete(null)}
          onConfirm={() => {
            performDelete(tabToDelete);
            setTabToDelete(null);
          }}
          title="Delete tab"
          confirmText="Delete"
        >
          <p>Are you sure you want to delete this tab and its content?</p>
        </ConfirmDialog>
      )}
    </>
  );
};
