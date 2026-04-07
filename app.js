const browseButton = document.querySelector("#browse-button");
const processButton = document.querySelector("#process-button");
const exportButton = document.querySelector("#export-button");
const fileInput = document.querySelector("#file-input");
const fileNameInput = document.querySelector("#file-name");
const status = document.querySelector("#status");

let selectedFile = null;
let processedResult = null;

browseButton.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files ?? [];
  selectedFile = file ?? null;

  if (!selectedFile) {
    fileNameInput.value = "No file selected";
    processButton.disabled = true;
    exportButton.disabled = true;
    processedResult = null;
    setStatus("Select a CSV file to process...");
    return;
  }

  fileNameInput.value = selectedFile.name;
  processButton.disabled = false;
  exportButton.disabled = true;
  processedResult = null;
  setStatus(`Ready to process ${selectedFile.name}.`);
});

processButton.addEventListener("click", async () => {
  if (!selectedFile) {
    setStatus("Select a CSV file to process...", true);
    return;
  }

  setProcessingState(true);
  setStatus("Processing file...");
  processButton.disabled = true;
  exportButton.disabled = true;

  try {
    await new Promise((resolve) => {
      window.requestAnimationFrame(() => {
        window.setTimeout(resolve, 120);
      });
    });

    const csvText = await selectedFile.text();
    processedResult = processCsvContent(csvText);
    exportButton.disabled = false;
    setStatus(
      `Processing complete. Loaded ${processedResult.rowCount} rows and prepared ${processedResult.outputCount} unique rows for export.`,
    );
  } catch (error) {
    processedResult = null;
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Error: ${message}`, true);
  } finally {
    setProcessingState(false);
    processButton.disabled = false;
  }
});

exportButton.addEventListener("click", () => {
  if (!selectedFile || !processedResult) {
    setStatus("Process a CSV before exporting.", true);
    return;
  }

  downloadProcessedFile(selectedFile.name, processedResult.csvText);
  setStatus(`Exported Processed_${selectedFile.name}.`);
});

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function setProcessingState(isProcessing) {
  processButton.classList.toggle("is-processing", isProcessing);
  processButton.setAttribute("aria-busy", String(isProcessing));
}

function processCsvContent(csvText) {
  const rows = parseCsv(csvText);

  if (rows.length === 0) {
    throw new Error("The CSV file is empty.");
  }

  const requiredColumns = ["Invoice Number", "Reference", "Invoice Date"];
  const missingColumns = requiredColumns.filter((column) => !(column in rows[0]));

  if (missingColumns.length > 0) {
    throw new Error(`Missing required column(s): ${missingColumns.join(", ")}`);
  }

  const parsedResults = [];

  for (const row of rows) {
    const invoiceNumber = String(row["Invoice Number"] ?? "").trim();

    if (!invoiceNumber) {
      continue;
    }

    const reference = String(row.Reference ?? "");
    let startDate = "NA";
    let endDate = "NA";

    const startDateMatch1 = reference.match(/Start[:\s-]*(\d{2}-\d{2}-\d{4})/i);
    const endDateMatch1 = reference.match(/End[:\s-]*(\d{2}-\d{2}-\d{4})/i);
    const startDateMatch2 = reference.match(
      /Start[:\s-]*(\d{1,2})(st|nd|rd|th)?\s*([A-Za-z]+)\s+(\d{4})/i,
    );
    const endDateMatch2 = reference.match(
      /End[:\s-]*(\d{1,2})(st|nd|rd|th)?\s*([A-Za-z]+)\s+(\d{4})/i,
    );

    if (startDateMatch1) {
      startDate = startDateMatch1[1];
    }
    if (endDateMatch1) {
      endDate = endDateMatch1[1];
    }
    if (startDateMatch2) {
      startDate = `${startDateMatch2[1]} ${startDateMatch2[3]} ${startDateMatch2[4]}`;
    }
    if (endDateMatch2) {
      endDate = `${endDateMatch2[1]} ${endDateMatch2[3]} ${endDateMatch2[4]}`;
    }

    if (startDate === "NA" && endDate === "NA") {
      const dateRangeMatch = reference.match(
        /(\d{1,2})(st|nd|rd|th)?\s*([A-Za-z]+)\s+(\d{4})\s*[-–]\s*(\d{1,2})(st|nd|rd|th)?\s*([A-Za-z]+)\s+(\d{4})/i,
      );

      if (dateRangeMatch) {
        startDate = `${dateRangeMatch[1]} ${dateRangeMatch[3]} ${dateRangeMatch[4]}`;
        endDate = `${dateRangeMatch[5]} ${dateRangeMatch[7]} ${dateRangeMatch[8]}`;
      }
    }

    if (startDate === "NA" && endDate === "NA") {
      const singleMonthMatch = reference.match(
        /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b\s*(\d{4})?/i,
      );

      if (singleMonthMatch) {
        const monthName = normalizeMonthName(singleMonthMatch[1]);
        const year = singleMonthMatch[2] || String(new Date().getFullYear());
        const lastDay = getLastDayOfMonth(monthName, Number(year));
        startDate = `1 ${monthName} ${year}`;
        endDate = `${lastDay} ${monthName} ${year}`;
      }
    }

    const invoiceDate = convertToDate(row["Invoice Date"]);
    const endDateObj = convertToDate(endDate);
    let review = "keep";

    if (invoiceDate && endDateObj) {
      const invoiceMonthEnd = new Date(
        invoiceDate.getFullYear(),
        invoiceDate.getMonth() + 1,
        0,
      );

      if (endDateObj <= invoiceMonthEnd) {
        review = "delete";
      }
    }

    parsedResults.push({
      ...row,
      "Start Date": startDate,
      "End Date": endDate,
      Review: review,
    });
  }

  const uniqueResults = [];
  const seenInvoiceNumbers = new Set();

  for (const row of parsedResults) {
    const invoiceNumber = String(row["Invoice Number"] ?? "");

    if (seenInvoiceNumbers.has(invoiceNumber)) {
      continue;
    }

    seenInvoiceNumbers.add(invoiceNumber);
    uniqueResults.push(row);
  }

  return {
    csvText: stringifyCsv(uniqueResults),
    rowCount: rows.length,
    outputCount: uniqueResults.length,
  };
}

function downloadProcessedFile(originalName, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Processed_${originalName}`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function convertToDate(dateString) {
  if (dateString == null) {
    return null;
  }

  const normalized = String(dateString).trim();

  if (!normalized || normalized === "NA") {
    return null;
  }

  const ddmmyyyyMatch = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsedDate = new Date(normalized);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function normalizeMonthName(month) {
  const lower = month.toLowerCase();
  return `${lower[0].toUpperCase()}${lower.slice(1)}`;
}

function getLastDayOfMonth(monthName, year) {
  const monthIndex = {
    January: 0,
    February: 1,
    March: 2,
    April: 3,
    May: 4,
    June: 5,
    July: 6,
    August: 7,
    September: 8,
    October: 9,
    November: 10,
    December: 11,
  }[monthName];

  return new Date(year, monthIndex + 1, 0).getDate();
}

function parseCsv(csvText) {
  const rows = [];
  let currentField = "";
  let currentRow = [];
  let insideQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRow.push(currentField);
      currentField = "";

      if (currentRow.some((field) => field !== "")) {
        rows.push(currentRow);
      }

      currentRow = [];
      continue;
    }

    currentField += char;
  }

  currentRow.push(currentField);

  if (currentRow.some((field) => field !== "")) {
    rows.push(currentRow);
  }

  if (rows.length === 0) {
    return [];
  }

  const [headers, ...dataRows] = rows;

  return dataRows.map((fields) => {
    const row = {};

    headers.forEach((header, index) => {
      row[header] = fields[index] ?? "";
    });

    return row;
  });
}

function stringifyCsv(rows) {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.map(escapeCsvField).join(",")];

  for (const row of rows) {
    const line = headers.map((header) => escapeCsvField(row[header] ?? "")).join(",");
    lines.push(line);
  }

  return lines.join("\r\n");
}

function escapeCsvField(value) {
  const stringValue = String(value);

  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}
