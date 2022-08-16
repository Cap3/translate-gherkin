const fs = require("fs/promises");

const { expect } = require("chai");

const GherkinTranslator = require("..");

describe("GherkinTranslator", () => {
  it("Can translate German to English", async () => {
    const [input, expectedOutput] = await Promise.all([
      fs.readFile("tests/features/german.feature", { encoding: "utf8" }),
      fs.readFile("tests/features/english.feature", { encoding: "utf8" }),
    ]);
    const translator = new GherkinTranslator({ outputDialectCode: "en" });
    const output = translator.translateGherkin(input);
    expect(output).equal(expectedOutput);
  });
  it("Can translate English to German", async () => {
    const [input, expectedOutput] = await Promise.all([
      fs.readFile("tests/features/english.feature", { encoding: "utf8" }),
      fs.readFile("tests/features/german.feature", { encoding: "utf8" }),
    ]);
    const translator = new GherkinTranslator({ outputDialectCode: "de" });
    const output = translator.translateGherkin(input);
    expect(output).equal(expectedOutput);
  });
  it("Does not change file with right dialect", async () => {
    const input = await fs.readFile("tests/features/german.feature", {
      encoding: "utf8",
    });
    const translator = new GherkinTranslator({ outputDialectCode: "de" });
    const output = translator.translateGherkin(input);
    expect(output).equal(input);
  });
});
