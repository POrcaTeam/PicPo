import { createRoot } from "react-dom/client";
import { Edit } from "./edit";

function init() {
  const rootContainer = document.querySelector("#__root");
  if (!rootContainer) throw new Error("Can't find Options root element");
  const root = createRoot(rootContainer);
  root.render(<Edit />);
}

init();
