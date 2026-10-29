import { Footer, useExcalidrawAPI } from "@excalidraw/excalidraw";
import React from "react";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";
import { SceneTabs } from "./SceneTabs";

export const AppFooter = React.memo(() => {
  const excalidrawAPI = useExcalidrawAPI();

  return (
    <Footer>
      <div
        style={{
          display: "flex",
          gap: "0.6em",
          alignItems: "center",
          marginRight: "auto",
        }}
      >
        {isVisualDebuggerEnabled() && (
          <DebugFooter onChange={() => excalidrawAPI?.refresh()} />
        )}
        <SceneTabs />
      </div>
    </Footer>
  );
});
