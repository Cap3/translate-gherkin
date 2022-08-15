const fs = require("fs/promises");
const path = require("path");

const Gherkin = require("@cucumber/gherkin");
const GherkinUtils = require("@cucumber/gherkin-utils");
const Messages = require("@cucumber/messages");

/**
 * Translator for the keywords in Gherkin files.
 */
class GherkinTranslator {
  constructor({ outputDialect, enableLogging, dryRun }) {
    this.enableLogging = enableLogging;
    this.dryRun = dryRun;

    // Validate that the specified Gherkin dialect exists.
    this.outputDialect = Gherkin.dialects[outputDialect];
    if (!this.outputDialect) throw `Unknown dialect: ${outputDialect}`;

    // Initialize parser.
    const uuidGenerator = Messages.IdGenerator.uuid();
    const builder = new Gherkin.AstBuilder(uuidGenerator);
    const matcher = new Gherkin.GherkinClassicTokenMatcher();
    this.parser = new Gherkin.Parser(builder, matcher);
  }

  /**
   * Translates the given input file and writes the result to the given
   * output file.
   *
   * @param {string} inputFileName The name of the file to read from.
   * @param {string} outputFileName The name of the file to write to.
   * @returns A future that completes when the output file has been written.
   */
  async translateFile(inputFileName, outputFileName) {
    // Read the Gherkin file.
    const source = await fs.readFile(inputFileName, { encoding: "utf8" });

    // Translate the Gherkin file.
    this.log(
      `${
        this.dryRun ? "Would translate" : "Translating"
      } ${inputFileName} -> ${outputFileName}`
    );
    const translated = this.translateGherkin(source);

    // Write the translated file.
    if (!this.dryRun) {
      const outputDirectory = path.dirname(outputFileName);
      await fs.mkdir(outputDirectory, { recursive: true });
      await fs.writeFile(outputFileName, translated, { encoding: "utf8" });
    }
  }

  /**
   * Translates the given source of a Gherkin file to the english dialect.
   *
   * @param {string} source The Gherkin source to translate.
   * @returns The translated Gherkin source code.
   */
  translateGherkin(source) {
    const document = this.parser.parse(source);

    // Do nothing if the document is written in the right dialect already.
    const sourceDialect = Gherkin.dialects[document.feature.language];
    if (sourceDialect == this.outputDialect) {
      this.log(` - file is in ${sourceDialect.name} already`);
      return source;
    }
    this.log(
      ` - from ${sourceDialect.name} to ${this.outputDialect.name} dialect`
    );

    // Walk the Gherkin document and translate the keyword of all nodes.
    const handler = (node, sourceLines) =>
      this.translateKeywordOf(node, { sourceLines, sourceDialect });
    const handlers = {
      feature: handler,
      background: handler,
      rule: handler,
      scenario: handler,
      step: handler,
      examples: handler,
    };
    const translatedLines = GherkinUtils.walkGherkinDocument(
      document,
      source.split("\n"),
      handlers
    );
    return translatedLines.join("\n");
  }

  /**
   * Translates the keyword of a Gherkin message to the output dialect.
   *
   * @param {Object} message A Gherkin message whose keyword to translate.
   * @param {string} message.keyword The keyword to translate.
   * @param {Gherkin.Location} message.location The location of the message in
   * the source code.
   * @param {Object} options
   * @param {string[]} options.sourceLines The lines of the input file.
   * @param {Gherkin.Dialect} options.sourceDialect The input file dialect.
   * @returns The updated lines of the source code. The given source code array
   * is updated in-place.
   */
  translateKeywordOf({ keyword, location }, { sourceLines, sourceDialect }) {
    // Try to translate the keyword.
    const translatedKeyword = this.translateKeyword(keyword, sourceDialect);
    if (!translatedKeyword) {
      this.log(` - found no translation for '${keyword}' keyword`);
      return;
    }
    this.log(
      ` - line ${location.line}: ` +
        `${keyword.trim()} -> ${translatedKeyword.trim()}`
    );

    // Replace the keyword in the source line.
    const lineIndex = location.line - 1;
    const sourceLine = sourceLines[lineIndex];
    const translatedLine = sourceLine.replace(keyword, translatedKeyword);
    sourceLines.splice(lineIndex, 1, translatedLine);
    return sourceLines;
  }

  /**
   * Translates the given keyword from the given dialect to the configured
   * output dialect.
   *
   * @param {string} keyword The keyword in the input dialect.
   * @param {Gherkin.Dialect} sourceDialect The dialect of the input file.
   * @returns {string} The translated keyword.
   */
  translateKeyword(keyword, sourceDialect) {
    // Find the keyword type in the source dialect.
    const dialectEntry = Object.entries(sourceDialect)
      .filter(([_, value]) => Array.isArray(value))
      .find(([_, keywords]) => keywords.includes(keyword));
    if (!dialectEntry) return null;
    const [keywordType, alternativeKeywords] = dialectEntry;

    // Translate the keyword to the output dialect.
    const keywordIndex = alternativeKeywords.indexOf(keyword);
    return this.selectOutputKeyword(keyword, keywordType, keywordIndex);
  }

  /**
   * Select the keyword from the output dialect to use for a keyword of the
   * given type.
   *
   * Since there may be multiple keyword candidates in the output dialect,
   * the keyword at the same position as in the input dialect is chosen
   * preferably. If there are less alternatives in the output dialect and
   * the input keyword position is not defined in the output dialect, the last
   * available candidate is chosen. The last element is preferred because the
   * first alternative of the step keywords tends to be the bullet point `* `.
   *
   * @param {string} keyword The keyword in the input dialect.
   * @param {string} keywordType The type of the keyword to translate.
   * @param {number} keywordIndex The index of the keyword in the input dialect.
   * @returns {string} The selected keyword from the output dialect.
   */
  selectOutputKeyword(keyword, keywordType, keywordIndex) {
    const candidates = this.outputDialect[keywordType];
    const index = Math.min(keywordIndex, candidates.length - 1);
    return candidates[index];
  }

  /**
   * Logs the given text to the console if logging is enabled.
   *
   * @param {string} text The text to log to the console.
   */
  log(text) {
    if (this.enableLogging) {
      console.log(text);
    }
  }
}

module.exports = GherkinTranslator;
