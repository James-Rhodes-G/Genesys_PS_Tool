const getDragAfterElement = (container, pointerY) => {
  const siblings = [...container.querySelectorAll(".column-editor__draggable:not(.is-dragging)")];

  return siblings.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = pointerY - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
};

const columnOrderKey = (keys) => keys.join("\0");

const wireColumnEditorDragDrop = (exportId, { getExportMeta, onReorder }) => {
  const root = document.getElementById(exportId);
  const list = root?.querySelector(".column-editor__order-list");
  if (!list) {
    return;
  }

  let activeRow = null;
  let dropCommitted = false;

  const readOrderFromDom = () =>
    [...list.querySelectorAll(".column-editor__draggable")]
      .map((row) => row.getAttribute("data-column-key"))
      .filter(Boolean);

  const commitOrderIfChanged = () => {
    const exportMeta = getExportMeta();
    if (!exportMeta) {
      return false;
    }

    const keys = readOrderFromDom();
    if (keys.length === 0) {
      return false;
    }

    if (columnOrderKey(keys) === columnOrderKey(exportMeta.selectedColumnKeys)) {
      return false;
    }

    exportMeta.selectedColumnKeys = keys;
    onReorder();
    return true;
  };

  list.addEventListener("dragstart", (event) => {
    dropCommitted = false;
    const handle = event.target.closest(".column-editor__drag-handle");
    if (!handle) {
      return;
    }

    activeRow = handle.closest(".column-editor__draggable");
    if (!activeRow) {
      return;
    }

    const columnKey = activeRow.getAttribute("data-column-key") || "";
    activeRow.classList.add("is-dragging");

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", columnKey);
      event.dataTransfer.setData("application/x-ps-tool-column-key", columnKey);
    }
  });

  list.addEventListener("dragend", () => {
    list.querySelectorAll(".column-editor__draggable.is-dragging").forEach((row) => {
      row.classList.remove("is-dragging");
    });

    if (!dropCommitted) {
      commitOrderIfChanged();
    }

    activeRow = null;
    dropCommitted = false;
    list.querySelectorAll(".column-editor__draggable.is-drop-target").forEach((row) => {
      row.classList.remove("is-drop-target");
    });
  });

  list.addEventListener("dragover", (event) => {
    if (!activeRow) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    const afterElement = getDragAfterElement(list, event.clientY);
    if (afterElement == null) {
      list.appendChild(activeRow);
    } else {
      list.insertBefore(activeRow, afterElement);
    }
  });

  list.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropCommitted = true;
    commitOrderIfChanged();
  });
};

export { wireColumnEditorDragDrop };
