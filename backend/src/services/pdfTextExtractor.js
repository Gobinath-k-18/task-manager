const { readFile } = require("node:fs/promises");

function getReadableText(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("PDF contains no readable text.");
  }
  return text;
}

async function extractWithFallback(data) {
  const { PDFParse } = require("pdf-parse-modern");
  const { CanvasFactory } = require("pdf-parse-modern/worker");
  const parser = new PDFParse({ data, CanvasFactory });

  try {
    const result = await parser.getText();
    return getReadableText(result.text);
  } finally {
    if (typeof parser.destroy === "function") {
      await parser.destroy();
    }
  }
}

async function extractPdfText(input) {
  let data;

  if (Buffer.isBuffer(input)) {
    data = input;
  } else if (typeof input === "string" && input.trim()) {
    try {
      data = await readFile(input);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unknown file error occurred.";
      throw new Error(`Unable to read PDF file: ${message}`, { cause: error });
    }
  } else {
    throw new TypeError("PDF input must be a non-empty file path or a Buffer.");
  }

  if (data.length === 0) {
    throw new Error("PDF file is empty.");
  }

  try {
    const parsePdf = require("pdf-parse");
    const result = await parsePdf(data);
    return getReadableText(result.text);
  } catch (primaryError) {
    try {
      return await extractWithFallback(data);
    } catch (fallbackError) {
      throw new Error(
        "This PDF could not be read. Please re-save or export it as a new PDF and try again.",
        {
          cause: new AggregateError(
            [primaryError, fallbackError],
            "Both PDF text extraction parsers failed.",
          ),
        },
      );
    }
  }
}

module.exports = { extractPdfText };
