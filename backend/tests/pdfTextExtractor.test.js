const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const { extractPdfText } = require("../src/services/pdfTextExtractor");

const samplePdfPath = path.resolve(
  __dirname,
  "../node_modules/pdf-parse/test/data/05-versions-space.pdf",
);

function hasLoadedParser(name) {
  const normalizedName = `node_modules\\${name}\\`.toLowerCase();
  return Object.keys(require.cache).some((filename) =>
    filename.toLowerCase().includes(normalizedName),
  );
}

async function withParserMocks(mocks, callback) {
  const originalLoad = Module._load;
  Module._load = function load(request, parent, isMain) {
    if (Object.hasOwn(mocks, request)) return mocks[request];
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return await callback();
  } finally {
    Module._load = originalLoad;
  }
}

async function withCapturedLogs(callback) {
  const records = [];
  const originalInfo = console.info;
  const originalWarn = console.warn;
  console.info = (...args) => records.push(args);
  console.warn = (...args) => records.push(args);

  try {
    return { result: await callback(), records };
  } finally {
    console.info = originalInfo;
    console.warn = originalWarn;
  }
}

test("loads neither PDF parser when the extractor is imported", () => {
  assert.equal(hasLoadedParser("pdf-parse"), false);
  assert.equal(hasLoadedParser("pdf-parse-modern"), false);
});

test("primary parser handles Buffer and file-path inputs without loading fallback", async () => {
  const { records, result } = await withCapturedLogs(async () => {
    const fromPath = await extractPdfText(samplePdfPath);
    assert.ok(fromPath.trim().length > 0);
    assert.equal(hasLoadedParser("pdf-parse-modern"), false);

    const sampleBuffer = await readFile(samplePdfPath);
    const fromBuffer = await extractPdfText(sampleBuffer);
    assert.ok(fromBuffer.trim().length > 0);
    assert.equal(hasLoadedParser("pdf-parse-modern"), false);
    return { fromPath, fromBuffer };
  });

  assert.ok(result.fromPath.length > 0);
  assert.ok(result.fromBuffer.length > 0);
  const logs = JSON.stringify(records);
  assert.equal((logs.match(/PDF extraction primary parser succeeded/g) || []).length, 2);
  assert.equal(logs.includes(result.fromPath), false);
  assert.equal(logs.includes(result.fromBuffer), false);
});

test("falls back to modern parser after primary failure and destroys parser", async () => {
  const pdfBuffer = Buffer.from("%PDF-private-input");
  const primaryError = new Error("bad XRef entry");
  let parserOptions;
  let destroyed = false;

  const { result, records } = await withCapturedLogs(() =>
    withParserMocks(
      {
        "pdf-parse": async () => {
          throw primaryError;
        },
        "pdf-parse-modern": {
          PDFParse: class {
            constructor(options) {
              parserOptions = options;
            }

            async getText() {
              return { text: "PRIVATE_FALLBACK_TEXT" };
            }

            async destroy() {
              destroyed = true;
            }
          },
        },
        "pdf-parse-modern/worker": { CanvasFactory: class CanvasFactory {} },
      },
      () => extractPdfText(pdfBuffer),
    ),
  );

  assert.equal(result, "PRIVATE_FALLBACK_TEXT");
  assert.deepEqual(parserOptions.data, pdfBuffer);
  assert.equal(typeof parserOptions.CanvasFactory, "function");
  assert.equal(destroyed, true);
  const logs = JSON.stringify(records);
  assert.match(logs, /"byteLength":18/);
  assert.match(logs, /PDF extraction primary parser failed/);
  assert.match(logs, /"errorName":"Error"/);
  assert.match(logs, /bad XRef entry/);
  assert.match(logs, /PDF extraction fallback parser starting/);
  assert.match(logs, /PDF extraction fallback parser succeeded/);
  assert.match(logs, /"parser":"pdf-parse-modern@2.4.5","characterCount":21/);
  assert.equal(logs.includes("PRIVATE_FALLBACK_TEXT"), false);
  assert.equal(logs.includes("%PDF-private-input"), false);
});

test("falls back when primary parser returns no readable text", async () => {
  const pdfBuffer = Buffer.from("%PDF-empty-text");
  const result = await withParserMocks(
    {
      "pdf-parse": async () => ({ text: "  " }),
      "pdf-parse-modern": {
        PDFParse: class {
          async getText() {
            return { text: "Recovered text." };
          }
        },
      },
      "pdf-parse-modern/worker": { CanvasFactory: class CanvasFactory {} },
    },
    () => extractPdfText(pdfBuffer),
  );

  assert.equal(result, "Recovered text.");
});

test("reports a safe message and preserves both parser errors when both fail", async () => {
  const pdfBuffer = Buffer.from("%PDF-test");
  const primaryError = new Error("Primary parser detail.");
  const fallbackError = new Error("Fallback parser detail.");

  await withParserMocks(
    {
      "pdf-parse": async () => {
        throw primaryError;
      },
      "pdf-parse-modern": {
        PDFParse: class {
          async getText() {
            throw fallbackError;
          }
        },
      },
      "pdf-parse-modern/worker": { CanvasFactory: class CanvasFactory {} },
    },
    async () => {
      await assert.rejects(
        extractPdfText(pdfBuffer),
        (error) => {
          assert.match(error.message, /could not be read/);
          assert.equal(error.message.includes(primaryError.message), false);
          assert.equal(error.message.includes(fallbackError.message), false);
          assert.ok(error.cause instanceof AggregateError);
          assert.deepEqual(error.cause.errors, [primaryError, fallbackError]);
          return true;
        },
      );
    },
  );
});
