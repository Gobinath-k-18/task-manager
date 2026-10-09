const { readFile } = require("node:fs/promises");

function getReadableText(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("PDF contains no readable text.");
  }
  return text;
}

function getSafeErrorDetails(error) {
  const name = typeof error?.name === "string" && /^[A-Za-z][A-Za-z0-9]{0,59}$/.test(error.name)
    ? error.name
    : "Error";
  const message = typeof error?.message === "string" ? error.message : "";
  const sanitizedMessage = message
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\b[A-Za-z]:\\[^\s]*/g, "[path]")
    .replace(/(?:\/[\w.-]+){2,}/g, "[path]")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  return { errorName: name, errorMessage: sanitizedMessage || "Unknown parser error." };
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

  console.info("PDF extraction input:", { byteLength: data.length });

  try {
    const parsePdf = require("pdf-parse");
    const result = await parsePdf(data);
    const text = getReadableText(result.text);
    console.info("PDF extraction primary parser succeeded:", {
      parser: "pdf-parse@1.1.1",
      characterCount: text.length,
    });
    return text;
  } catch (primaryError) {
    console.warn("PDF extraction primary parser failed:", getSafeErrorDetails(primaryError));
    console.info("PDF extraction fallback parser starting.");
    try {
      const text = await extractWithFallback(data);
      console.info("PDF extraction fallback parser succeeded:", {
        parser: "pdf-parse-modern@2.4.5",
        characterCount: text.length,
      });
      return text;
    } catch (fallbackError) {
      console.warn("PDF extraction fallback parser failed:", getSafeErrorDetails(fallbackError));
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
