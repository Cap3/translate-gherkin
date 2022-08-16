const fs = require("fs/promises");
const path = require("path");

const chalk = require("chalk");
const Gherkin = require("@cucumber/gherkin");
const GherkinUtils = require("@cucumber/gherkin-utils");
const Messages = require("@cucumber/messages");

const infoChalk = chalk.bold;
const removedChalk = chalk.redBright.bold;
const addedChalk = chalk.greenBright.bold;

/**
 * Translator for the keywords in Gherkin files.
 */
class GherkinTranslator {
  /**
   * The language code of the default output dialect.
   *
   * This should be the Gherkin default dialect. Language annotations with
   * this code will be removed automatically.
   */
  static DEFAULT_DIALECT_CODE = "en";

  constructor({
    outputDialectCode,
    enableLogging,
    enableVerboseLogging,
    dryRun,
  }) {
    this.enableLogging = enableLogging;
    this.enableVerboseLogging = enableVerboseLogging;
    this.dryRun = dryRun;

    // Validate that the specified Gherkin dialect exists.
    this.outputDialectCode = outputDialectCode;
    this.outputDialect = Gherkin.dialects[outputDialectCode];
    if (!this.outputDialect) throw `Unknown dialect: ${outputDialectCode}`;

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
      `${this.dryRun ? "Would translate" : "Translating"} ${infoChalk(
        inputFileName
      )} -> ${infoChalk(outputFileName)}`
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
      this.logVerbose(` * file is in ${infoChalk(sourceDialect.name)} already`);
      return source;
    }
    this.logVerbose(
      ` * from ${infoChalk(sourceDialect.name)} to ${infoChalk(
        this.outputDialect.name
      )} dialect`
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

    // Translate the language annotation.
    // This has to be the last step, because the source array might be shifted
    // due to the insertion or removal of a language comment.
    this.translateLanguageComment(translatedLines);
    return translatedLines.join("\n");
  }

  /**
   * Translates the language comment at the top of a Gherkin file.
   *
   * Modifies the first line of the given array in-place.
   * If the source dialect is the default dialect and there is no language
   * annotation, a new first line is added with the language annotation.
   * If the language annotation is not necessary in the target dialect (i.e,
   * the target dialect is the default dialect), the annotation is removed.
   *
   * @param {string[]} sourceLines An array of the lines of Gherkin source code.
   */
  translateLanguageComment(sourceLines) {
    // Make sure that there is at least one line.
    if (sourceLines.length == 0) return;

    // Test if the first line of the file is the language annotation.
    const firstLine = sourceLines[0];
    const pattern = /^(\s*#\s*language:\s*)(\w+)(\s*)$/;
    const match = firstLine.match(pattern);

    // If the language annotation is missing, create it.
    if (!match) {
      sourceLines.unshift(`# language: ${this.outputDialectCode}`);
      this.logVerbose(
        ` + line 1: ${addedChalk(`# language: ${this.outputDialectCode}`)}`
      );
      return;
    }

    // If the language annotation exists but is not needed in the target
    // dialect remove it.
    const sourceDialectCode = match[2];
    if (this.outputDialectCode == GherkinTranslator.DEFAULT_DIALECT_CODE) {
      sourceLines.shift();
      this.logVerbose(
        ` - line 1: ${removedChalk(`# language: ${sourceDialectCode}`)}`
      );
      return;
    }

    // Replace the first line but keep all spaces as in the input.
    const prefix = match[1];
    const suffix = match[3];
    sourceLines[0] = `${prefix}${this.outputDialectCode}${suffix}`;
    this.logVerbose(
      ` * line 1: # language: ${removedChalk(
        sourceDialectCode
      )} -> ${addedChalk(this.outputDialectCode)}`
    );
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
      this.logVerbose(` * found no translation for '${keyword}' keyword`);
      return;
    }
    this.logVerbose(
      ` * line ${location.line}: ${removedChalk(
        keyword.trim()
      )} -> ${addedChalk(translatedKeyword.trim())}`
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
   * Logs the given text to the console if verbose logging is enabled.
   *
   * @param {string} text The text to log to the console.
   */
  logVerbose(text) {
    if (this.enableVerboseLogging) this.log(text);
  }

  /**
   * Logs the given text to the console if logging is enabled.
   *
   * @param {string} text The text to log to the console.
   */
  log(text) {
    if (this.enableLogging) console.log(text);
  }
}

module.exports = GherkinTranslator;
