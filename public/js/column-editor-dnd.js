const wireColumnEditorDragDrop = (exportId, { getExportMeta, onReorder }) => {
  const root = document.getElementById(exportId);
  const list = root?.querySelector(".column-editor__order-list");
  if (!list) {
    return;
  }

  let draggedKey = null;

  const clearDropTarget = () => {
    list.querySelectorAll(".column-editor__draggable.is-drop-target").forEach((element) => {
      element.classList.remove("is-drop-target");
    });
  };

  list.querySelectorAll(".column-editor__draggable").forEach((item) => {
    item.querySelectorAll("input, label, gux-form-field-checkbox").forEach((control) => {
      control.addEventListener("mousedown", () => {
        item.draggable = false;
      });
      control.addEventListener("mouseup", () => {
        item.draggable = true;
      });
    });

    item.addEventListener("dragstart", (event) => {
      draggedKey = item.getAttribute("data-column-key");
      item.classList.add("is-dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedKey || "");
      }
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("is-dragging");
      draggedKey = null;
      clearDropTarget();
    });

    item.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      clearDropTarget();
      if (item.getAttribute("data-column-key") !== draggedKey) {
        item.classList.add("is-drop-target");
      }
    });

    item.addEventListener("dragleave", () => {
      item.classList.remove("is-drop-target");
    });

    item.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearDropTarget();

      const targetKey = item.getAttribute("data-column-key");
      const exportMeta = getExportMeta();
      if (!exportMeta || !draggedKey || !targetKey || draggedKey === targetKey) {
        return;
      }

      const keys = exportMeta.selectedColumnKeys.filter((key) => key !== draggedKey);
      const targetIndex = keys.indexOf(targetKey);
      if (targetIndex === -1) {
        keys.push(draggedKey);
      } else {
        keys.splice(targetIndex, 0, draggedKey);
      }

      exportMeta.selectedColumnKeys = keys;
      draggedKey = null;
      onReorder();
    });
  });

  list.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
};

export { wireColumnEditorDragDrop };
