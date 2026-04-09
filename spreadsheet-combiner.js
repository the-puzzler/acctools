const TEMPLATE_WORKBOOK_PATH = "./BS%20Recs%20Template%20JL.xlsx";
const browseButton = document.querySelector("#browse-button");
const processButton = document.querySelector("#process-button");
const exportButton = document.querySelector("#export-button");
const fileInput = document.querySelector("#file-input");
const fileNameInput = document.querySelector("#file-name");
const fileList = document.querySelector("#file-list");
const dropZone = document.querySelector("#drop-zone");
const status = document.querySelector("#status");

let selectedFiles = [];
let combinedWorkbook = null;
let templateWorkbookPromise = null;

browseButton.addEventListener("click", (event) => {
  event.stopPropagation();
  fileInput.click();
});

fileInput.addEventListener("change", (event) => {
  addFiles(Array.from(event.target.files ?? []));
  fileInput.value = "";
});

dropZone.addEventListener("click", () => {
  fileInput.click();
});

dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});

dropZone.addEventListener("dragenter", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragging");
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragging");
});

dropZone.addEventListener("dragleave", (event) => {
  if (event.target === dropZone) {
    dropZone.classList.remove("is-dragging");
  }
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
  addFiles(Array.from(event.dataTransfer?.files ?? []));
});

processButton.addEventListener("click", async () => {
  if (selectedFiles.length === 0) {
    setStatus("Select one or more Excel files before combining.", true);
    return;
  }

  setProcessingState(true);
  processButton.disabled = true;
  exportButton.disabled = true;
  setStatus("Building combined workbook...");

  try {
    await new Promise((resolve) => {
      window.requestAnimationFrame(() => {
        window.setTimeout(resolve, 120);
      });
    });

    combinedWorkbook = await buildCombinedWorkbook(selectedFiles);
    exportButton.disabled = false;
    setStatus(
      `Workbook ready. Added ${combinedWorkbook.importedCount} imported sheet(s) after ${combinedWorkbook.templateSheetCount} template sheet(s).`,
    );
  } catch (error) {
    combinedWorkbook = null;
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Error: ${message}`, true);
  } finally {
    setProcessingState(false);
    processButton.disabled = selectedFiles.length === 0;
  }
});

exportButton.addEventListener("click", () => {
  if (!combinedWorkbook) {
    setStatus("Build the workbook before exporting.", true);
    return;
  }

  const fileName = `Combined_Xero_Exports_${getIsoDateStamp()}.xlsx`;
  window.XLSX.writeFile(combinedWorkbook.workbook, fileName);
  setStatus(`Exported ${fileName}.`);
});

function renderSelectedFiles() {
  fileList.replaceChildren();

  for (const file of selectedFiles) {
    const item = document.createElement("li");
    item.textContent = file.name;
    fileList.append(item);
  }

  if (selectedFiles.length === 0) {
    fileNameInput.textContent = "No files selected";
    processButton.disabled = true;
    return;
  }

  fileNameInput.textContent =
    selectedFiles.length === 1
      ? selectedFiles[0].name
      : `${selectedFiles.length} files selected`;
  processButton.disabled = false;
}

function addFiles(files) {
  if (files.length === 0) {
    if (selectedFiles.length === 0) {
      setStatus("Select the Xero exports you want to combine.");
    }
    return;
  }

  const acceptedFiles = files.filter(isSpreadsheetFile);

  if (acceptedFiles.length === 0) {
    setStatus("Only Excel workbooks can be added here.", true);
    return;
  }

  const fileMap = new Map(selectedFiles.map((file) => [getFileKey(file), file]));

  for (const file of acceptedFiles) {
    fileMap.set(getFileKey(file), file);
  }

  selectedFiles = Array.from(fileMap.values());
  combinedWorkbook = null;
  exportButton.disabled = true;
  renderSelectedFiles();
  setStatus(`Ready to combine ${selectedFiles.length} workbook(s).`);
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function setProcessingState(isProcessing) {
  processButton.classList.toggle("is-processing", isProcessing);
  processButton.setAttribute("aria-busy", String(isProcessing));
}

async function buildCombinedWorkbook(files) {
  const templateWorkbook = await loadTemplateWorkbook();
  const workbook = window.XLSX.utils.book_new();
  const usedSheetNames = new Set();

  for (const sheetName of templateWorkbook.SheetNames) {
    const nextName = createUniqueSheetName(sheetName, usedSheetNames);
    window.XLSX.utils.book_append_sheet(
      workbook,
      cloneWorksheet(templateWorkbook.Sheets[sheetName]),
      nextName,
    );
    usedSheetNames.add(nextName);
  }

  let importedCount = 0;

  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const sourceWorkbook = window.XLSX.read(buffer, { type: "array", cellStyles: true });
    const firstSheetName = sourceWorkbook.SheetNames[0];

    if (!firstSheetName) {
      throw new Error(`"${file.name}" does not contain any worksheets.`);
    }

    const worksheet = sourceWorkbook.Sheets[firstSheetName];
    const preferredSheetName = deriveSheetName(worksheet, file.name);
    const nextName = createUniqueSheetName(preferredSheetName, usedSheetNames);

    window.XLSX.utils.book_append_sheet(workbook, cloneWorksheet(worksheet), nextName);
    usedSheetNames.add(nextName);
    importedCount += 1;
  }

  return {
    workbook,
    importedCount,
    templateSheetCount: templateWorkbook.SheetNames.length,
  };
}

async function loadTemplateWorkbook() {
  if (!templateWorkbookPromise) {
    templateWorkbookPromise = fetch(new URL(TEMPLATE_WORKBOOK_PATH, window.location.href))
      .then((response) => {
        if (!response.ok) {
          throw new Error("The template workbook could not be loaded.");
        }

        return response.arrayBuffer();
      })
      .then((buffer) => window.XLSX.read(buffer, { type: "array", cellStyles: true }))
      .catch(() => {
        throw new Error(
          "The template workbook could not be loaded. If you opened this page directly from disk, serve this folder from a local web server and try again.",
        );
      });
  }

  return templateWorkbookPromise;
}

function deriveSheetName(worksheet, fallbackFileName) {
  const rawValue = worksheet?.A1?.w ?? worksheet?.A1?.v ?? stripFileExtension(fallbackFileName);
  const normalized = String(rawValue).replace(/\s+/g, " ").trim();
  const cleaned = normalized.replace(/[\[\]:*?/\\]/g, "").slice(0, 31).trim();
  return cleaned || stripFileExtension(fallbackFileName).slice(0, 31);
}

function createUniqueSheetName(baseName, usedSheetNames) {
  const safeBaseName = (baseName || "Sheet").slice(0, 31) || "Sheet";

  if (!usedSheetNames.has(safeBaseName)) {
    return safeBaseName;
  }

  let attempt = 2;

  while (attempt < 1000) {
    const suffix = ` (${attempt})`;
    const candidate = `${safeBaseName.slice(0, 31 - suffix.length)}${suffix}`;

    if (!usedSheetNames.has(candidate)) {
      return candidate;
    }

    attempt += 1;
  }

  throw new Error(`Too many duplicate sheet names derived from "${safeBaseName}".`);
}

function stripFileExtension(fileName) {
  return fileName.replace(/\.[^.]+$/, "");
}

function cloneWorksheet(worksheet) {
  if (typeof structuredClone === "function") {
    return structuredClone(worksheet);
  }

  return JSON.parse(JSON.stringify(worksheet));
}

function getIsoDateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function getFileKey(file) {
  return `${file.name}__${file.size}__${file.lastModified}`;
}

function isSpreadsheetFile(file) {
  return /\.(xlsx|xls|xlsm)$/i.test(file.name);
}
