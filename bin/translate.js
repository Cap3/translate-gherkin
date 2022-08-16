#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const { program } = require("commander");
const chalk = require("chalk");

const GherkinTranslator = require("..");

// Extract version from `package.json`.
const { version } = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../package.json")).toString()
);

program
  .name("npx translate-gherkin")
  .version(version)
  .description(
    "This tool translates the keywords of `*.feature` files to a target " +
      "Gherkin dialect."
  )
  .showHelpAfterError("Add `--help` option for usage information.")
  .arguments("[input-files...]", "The feature files to translates.")
  .option(
    "-i, --input <directory>",
    "The input directory. This prefix is removed from the input files to" +
      "construct the name of the output file."
  )
  .option(
    "-o, --output <directory>",
    "The output directory. By default the input files are overwritten."
  )
  .option(
    "--dialect <language-code>",
    "The two letter language code of the language to translate to.",
    GherkinTranslator.DEFAULT_DIALECT_CODE
  )
  .option("-q, --quiet", "Whether to suppress logging messages.", false)
  .option("-n, --dry-run", "Disables writing to any files.", false)
  .configureOutput({
    outputError: (str, write) => write(chalk.red.bold(str)),
  })
  .action(async (inputFileNames, opts) => {
    if (inputFileNames.length == 0) program.error("Error: No input files.");

    try {
      const translator = new GherkinTranslator({
        outputDialectCode: opts.dialect,
        enableLogging: true,
        enableVerboseLogging: !opts.quiet,
        dryRun: opts.dryRun,
      });

      const promises = inputFileNames.map((inputFileName) => {
        // Drop the input file prefix.
        const relativeInputFileName = opts.input
          ? path.relative(opts.input, inputFileName)
          : inputFileName;

        // Build the output file name.
        const outputFileName = opts.output
          ? path.join(opts.output, relativeInputFileName)
          : inputFileName;

        // Translate the file.
        return translator.translateFile(inputFileName, outputFileName);
      });

      // Wait for all files to be translated.
      await Promise.all(promises);
    } catch (e) {
      program.error(e.stack);
    }
  });

program.parse();
