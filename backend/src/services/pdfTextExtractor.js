const { readFile } = require("node:fs/promises");

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

    if (typeof result.text !== "string" || !result.text.trim()) {
      throw new Error("PDF contains no readable text.");
    }

    return result.text;
  } catch (error) {
    if (error instanceof Error && error.message === "PDF contains no readable text.") {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "An unknown PDF parsing error occurred.";
    throw new Error(`Unable to extract text from PDF: ${message}`, { cause: error });
  }
}

module.exports = { extractPdfText };
